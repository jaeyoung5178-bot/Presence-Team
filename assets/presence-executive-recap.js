(function (root) {
  'use strict';

  const store = {
    open: false,
    period: 'monthly',
    anchor: '',
    scope: 'presence',
    personUid: '',
    context: null,
    hostId: '',
    cache: new Map(),
    pending: new Map(),
  };

  const PERIODS = [
    ['weekly', 'Weekly'],
    ['monthly', 'Monthly'],
    ['quarterly', 'Quarterly'],
    ['yearly', 'Yearly'],
  ];
  const TEAM_CONTEXT = {
    presence: { teamKey: 'presence', teamName: 'Presence', leaderName: '임재영', kind: 'aop' },
    fuse: { teamKey: 'fuse', teamName: 'FUSE', leaderName: '고윤경', kind: 'team' },
    youngwave: { teamKey: 'youngwave', teamName: 'YOUNG WAVE', leaderName: '윤채영', kind: 'team' },
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }
  function number(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
  function money(value) { return '₩' + Math.round(number(value)).toLocaleString('ko-KR'); }
  function percent(value) { return Number.isFinite(Number(value)) ? Number(value).toFixed(1) + '%' : '—'; }
  function monthKey(date) {
    const d = date instanceof Date ? date : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function shiftMonth(key, amount) {
    const parts = String(key || monthKey()).split('-').map(Number);
    const d = new Date(parts[0], (parts[1] || 1) - 1 + amount, 1, 12);
    return monthKey(d);
  }
  function periodRange(period, anchor) {
    const year = Number(anchor.slice(0, 4)), month = Number(anchor.slice(5, 7));
    if (period === 'yearly') return { from: year + '-01', to: year + '-12' };
    if (period === 'quarterly') {
      const start = Math.floor((month - 1) / 3) * 3 + 1;
      return { from: year + '-' + String(start).padStart(2, '0'), to: year + '-' + String(start + 2).padStart(2, '0') };
    }
    return { from: anchor, to: anchor };
  }
  function roleRank(role) { return ['IC', 'LR', 'TL', 'AOP', 'OP', 'O'].indexOf(role); }
  function canView(context) {
    const actor = context && context.actor, config = context && context.config;
    return !!(actor && config && actor.status === 'active' && roleRank(actor.role) >= roleRank('TL'));
  }
  function canAggregate(actor) {
    return typeof root.recapStudioIsAdmin === 'function' && root.recapStudioIsAdmin(actor);
  }
  function reportMeta(range) {
    if (typeof root.prcReportPeriodMeta === 'function') return root.prcReportPeriodMeta(range.from, range.to);
    return { from: range.from, to: range.to, pays: [], period: { from: '', to: '' }, rangeLabel: range.from === range.to ? range.from : range.from + ' ~ ' + range.to };
  }
  function memberIds(teamKey, pays) {
    if (teamKey === 'presence') return null;
    if (typeof root.recapStudioTeamMemberIds !== 'function') return new Set();
    return new Set(root.recapStudioTeamMemberIds(teamKey, pays || []));
  }
  function recordRejects(record) {
    if (!record || record.payType === 'hourly') return { rejects: 0, resubmits: 0 };
    return {
      rejects: number(record.rejectCLCount) + number(record.rejectSWCount),
      resubmits: number(record.resubmitCLCount) + number(record.resubmitSWCount),
    };
  }
  function rowTotals(rows, pays) {
    const weeklySales = pays.map(function (_, index) { return rows.reduce(function (sum, row) { return sum + number((row.weekly || [])[index]); }, 0); });
    const weeklyIncome = pays.map(function (_, index) { return rows.reduce(function (sum, row) { return sum + number(((row.records || [])[index] || {}).netPayment); }, 0); });
    const weeklyRejects = pays.map(function (_, index) {
      return rows.reduce(function (sum, row) { const v = recordRejects((row.records || [])[index]); return sum + Math.max(0, v.rejects - v.resubmits); }, 0);
    });
    const totals = rows.reduce(function (out, row) {
      out.fieldDays += number(row.fieldDays); out.sales += number(row.sales); out.income += number(row.income);
      out.rejects += number(row.rejects); out.resubmits += number(row.resubmits); out.bond += number(row.bond);
      return out;
    }, { fieldDays: 0, sales: 0, income: 0, rejects: 0, resubmits: 0, bond: 0 });
    totals.netSales = Math.max(0, totals.sales - totals.rejects + totals.resubmits);
    totals.avg = totals.fieldDays ? totals.sales / totals.fieldDays : 0;
    totals.rejectRate = totals.sales ? Math.max(0, totals.rejects - totals.resubmits) / totals.sales * 100 : 0;
    return { totals: totals, weeklySales: weeklySales, weeklyIncome: weeklyIncome, weeklyRejects: weeklyRejects, weeklyNetSales: weeklySales.map(function (sales, index) { return Math.max(0, sales - weeklyRejects[index]); }) };
  }
  function filterAggregate(base, scope, personUid) {
    const ids = scope === 'person' ? new Set(personUid ? [personUid] : []) : memberIds(scope, base.pays || []);
    const rows = ids ? (base.rows || []).filter(function (row) { return ids.has(row.uid); }) : (base.rows || []).slice();
    const summary = rowTotals(rows, base.pays || []);
    return Object.assign({}, base, summary, { rows: rows, records: rows.flatMap(function (row) { return (row.records || []).filter(Boolean); }) });
  }
  function weeklySlice(data) {
    const pays = data.pays || [];
    if (!pays.length) return data;
    const today = typeof root.TODAY === 'string' ? root.TODAY : new Date().toISOString().slice(0, 10);
    let index = pays.reduce(function (last, pay, current) { return pay <= today ? current : last; }, -1);
    if (index < 0) index = pays.length - 1;
    const pay = pays[index];
    const rows = (data.rows || []).map(function (row) {
      const record = (row.records || [])[index] || null;
      const counts = recordRejects(record);
      const sales = number((row.weekly || [])[index]);
      const days = typeof root.prcWeekSales === 'function' ? number(root.prcWeekSales(row.name, pay).days) : 0;
      return Object.assign({}, row, {
        fieldDays: days, sales: sales, income: number(record && record.netPayment), rejects: counts.rejects,
        resubmits: counts.resubmits, rejectRate: sales ? Math.max(0, counts.rejects - counts.resubmits) / sales * 100 : 0,
        weekly: [sales], records: [record], savedWeeks: record ? 1 : 0,
      });
    }).filter(function (row) { return row.fieldDays || row.sales || row.income || row.rejects || row.resubmits || row.savedWeeks; });
    const summary = rowTotals(rows, [pay]);
    const week = typeof root.prcWeekInfo === 'function' ? root.prcWeekInfo(pay) : { sd: '', ed: '' };
    return Object.assign({}, data, summary, { pays: [pay], rows: rows, records: rows.flatMap(function (row) { return (row.records || []).filter(Boolean); }), period: { from: week.sd || '', to: week.ed || '' } });
  }
  function localSnapshot(context, request) {
    if (!canAggregate(context.actor) || typeof root.prcAdminAgg !== 'function') return null;
    if (request.scope !== 'presence' && request.scope !== 'person' && typeof root.recapStudioMirrorAgg === 'function') {
      const mirrored = root.recapStudioMirrorAgg(request.scope, request.range.from, request.range.to, '');
      if (mirrored === undefined) return { availability: 'mirror-missing', error: '선택한 팀의 리캡 미러가 아직 연결되지 않았습니다.' };
      return request.period === 'weekly' ? weeklySlice(mirrored) : mirrored;
    }
    const base = root.prcAdminAgg(request.range.from, request.range.to, '');
    const filtered = filterAggregate(base, request.scope, request.personUid);
    return request.period === 'weekly' ? weeklySlice(filtered) : filtered;
  }
  function adapterKey(request) {
    return [request.actorUid, request.period, request.range.from, request.range.to, request.scope, request.personUid].join('|');
  }
  function adapterSnapshot(context, request, host) {
    const adapter = root.PresenceExecutiveRecapDataAdapter;
    if (!adapter || typeof adapter.getSnapshot !== 'function') return null;
    const key = adapterKey(request);
    if (store.cache.has(key)) return store.cache.get(key);
    if (store.pending.has(key)) return undefined;
    try {
      const result = adapter.getSnapshot(Object.assign({ actor: context.actor, config: context.config }, request));
      if (result && typeof result.then === 'function') {
        store.pending.set(key, true);
        result.then(function (snapshot) {
          store.pending.delete(key); store.cache.set(key, request.period === 'weekly' && snapshot && !snapshot.error ? weeklySlice(snapshot) : (snapshot || null));
          if (document.getElementById(host.id)) render(host, context);
        }).catch(function (error) {
          store.pending.delete(key); store.cache.set(key, { error: error && error.message ? error.message : '집계 데이터를 불러오지 못했어요.' });
          if (document.getElementById(host.id)) render(host, context);
        });
        return undefined;
      }
      if (result === undefined) return undefined;
      return request.period === 'weekly' && result && !result.error ? weeklySlice(result) : (result || null);
    } catch (error) {
      return { error: error && error.message ? error.message : '집계 연결을 확인해 주세요.' };
    }
  }
  function resolveSnapshot(context, request, host) {
    const secure = adapterSnapshot(context, request, host);
    if (secure !== null) return secure;
    return localSnapshot(context, request);
  }
  function scopeLabel(scope, personUid, data) {
    if (scope === 'person') {
      const row = (data && data.rows || []).find(function (item) { return item.uid === personUid; });
      const user = row || availablePeople().find(function (item) { return item.uid === personUid; });
      return user ? user.name + ' ' + (user.role || '') : '팀원';
    }
    return TEAM_CONTEXT[scope] ? TEAM_CONTEXT[scope].teamName : 'Presence';
  }
  function availablePeople() {
    const people = typeof root.recapStudioAdminPeople === 'function' ? root.recapStudioAdminPeople() : [];
    return people.filter(function (user) {
      return user && user.status === 'active' && roleRank(user.role) >= roleRank('LR');
    }).sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'ko'); });
  }
  function controlsHTML(context, meta) {
    const admin = canAggregate(context.actor);
    const tabs = PERIODS.map(function (item) {
      return '<button type="button" class="ers-period' + (store.period === item[0] ? ' is-active' : '') + '" data-ers-action="period" data-value="' + item[0] + '" aria-pressed="' + (store.period === item[0]) + '">' + item[1] + '</button>';
    }).join('');
    let scopes = '<div class="ers-fixed-scope"><span>Scope</span><b>' + esc(context.config.teamName) + '</b></div>';
    if (admin) {
      scopes = '<label class="ers-field"><span>Scope</span><select id="ersScope" data-ers-change="scope"><option value="presence"' + (store.scope === 'presence' ? ' selected' : '') + '>Presence</option><option value="fuse"' + (store.scope === 'fuse' ? ' selected' : '') + '>FUSE</option><option value="youngwave"' + (store.scope === 'youngwave' ? ' selected' : '') + '>YOUNG WAVE</option><option value="person"' + (store.scope === 'person' ? ' selected' : '') + '>개인</option></select></label>';
      if (store.scope === 'person') scopes += '<label class="ers-field"><span>Person</span><select id="ersPerson" data-ers-change="person"><option value="">팀원 선택</option>' + availablePeople().map(function (user) { return '<option value="' + esc(user.uid) + '"' + (store.personUid === user.uid ? ' selected' : '') + '>' + esc(user.name + ' ' + (user.role || '')) + '</option>'; }).join('') + '</select></label>';
    }
    return '<div class="ers-toolbar"><div class="ers-periods" role="group" aria-label="리캡 기간">' + tabs + '</div><div class="ers-filter-row">' + scopes + '<div class="ers-month-nav"><button type="button" data-ers-action="shift" data-value="-1" aria-label="이전 기간">‹</button><label><span>Anchor</span><input id="ersAnchor" type="month" value="' + esc(store.anchor) + '" data-ers-change="anchor"></label><button type="button" data-ers-action="shift" data-value="1" aria-label="다음 기간">›</button></div></div><div class="ers-range"><span>' + esc(meta.rangeLabel || store.anchor) + '</span><small>' + esc(meta.period && meta.period.from ? meta.period.from + ' – ' + meta.period.to : '급여일 기준 집계') + '</small></div></div>';
  }
  function emptyStateHTML(context, pending, error) {
    const title = pending ? '보안 집계를 불러오는 중입니다' : error ? '집계 연결을 확인해 주세요' : '팀 리캡 보안 연결을 준비 중입니다';
    const body = error || (pending ? '팀 범위를 확인하고 수익·리젝 집계를 안전하게 가져오고 있어요.' : esc(context.config.teamName) + ' TL에게는 팀원의 개별 급여 원본을 노출하지 않습니다. 승인된 팀 집계 어댑터가 연결되면 이 화면에 바로 반영됩니다.');
    return '<section class="ers-secure-state" role="status"><span class="ers-secure-icon" aria-hidden="true">✦</span><div><b>' + title + '</b><p>' + body + '</p></div><span class="ers-secure-badge">TEAM AGGREGATE ONLY</span></section>';
  }
  function metricHTML(label, value, note, tone) {
    return '<article class="ers-kpi ' + (tone || '') + '"><span>' + esc(label) + '</span><strong>' + value + '</strong><small>' + esc(note) + '</small></article>';
  }
  function summarySnapshot(context, scope, request, host, activeSnapshot) {
    if (scope === request.scope && request.scope !== 'person') return activeSnapshot;
    const summaryRequest = Object.assign({}, request, { scope: scope, personUid: '' });
    return resolveSnapshot(context, summaryRequest, host);
  }
  function summaryAvailability(scope, data) {
    if (data === undefined) return { key: 'pending', label: '불러오는 중' };
    if (!data || data.availability === 'mirror-missing') return { key: 'missing', label: '미러 연결 필요' };
    if (data.error) return { key: 'error', label: '집계 확인 필요' };
    const pays = data.pays || [];
    const rosterCount = scope === 'presence' ? (data.rows || []).length : memberIds(scope, pays).size;
    if (scope !== 'presence' && rosterCount === 0) return { key: 'missing', label: '팀원 범위 미설정' };
    const totals = data.totals || {};
    const hasPerformance = number(totals.sales) !== 0 || number(totals.fieldDays) !== 0 || number(totals.income) !== 0 || number(totals.rejects) !== 0 || number(totals.resubmits) !== 0 || (data.records || []).length !== 0;
    return hasPerformance ? { key: 'ready', label: '집계 완료' } : { key: 'zero', label: '실적 0 · 정상 집계' };
  }
  function teamSummaryCardHTML(context, scope, data) {
    const admin = canAggregate(context.actor), availability = summaryAvailability(scope, data), ready = availability.key === 'ready' || availability.key === 'zero';
    const totals = ready && data ? (data.totals || {}) : {};
    const label = scope === 'presence' ? 'Presence 전체' : TEAM_CONTEXT[scope].teamName;
    const tag = admin ? 'button' : 'article';
    const selected = store.scope === scope && store.scope !== 'person';
    const interactive = admin ? ' type="button" data-ers-action="scope-card" data-value="' + esc(scope) + '" aria-pressed="' + selected + '" aria-label="' + esc(label) + ' 상세 결과 보기"' : '';
    const dash = '<span aria-label="집계 준비 중">—</span>';
    const sales = ready ? number(totals.sales).toLocaleString('ko-KR') + '<small>건</small>' : dash;
    const fieldDays = ready ? number(totals.fieldDays).toLocaleString('ko-KR') + '일' : '—';
    const avg = ready ? number(totals.avg).toFixed(2) : '—';
    const income = ready ? money(totals.income) : '—';
    const rejectRate = ready ? percent(totals.rejectRate) : '—';
    return '<' + tag + ' class="ers-team-summary-card is-' + availability.key + (selected ? ' is-selected' : '') + '" data-scope="' + esc(scope) + '" data-status="' + availability.key + '"' + interactive + '><span class="ers-team-summary-top"><span><small>TEAM RESULT</small><b>' + esc(label) + '</b></span><em>' + esc(availability.label) + '</em></span><span class="ers-team-summary-sales"><small>세일즈</small><strong>' + sales + '</strong></span><span class="ers-team-summary-stats"><span><small>필드일</small><b>' + fieldDays + '</b></span><span><small>AVG</small><b>' + avg + '</b></span><span><small>Actual Income</small><b>' + income + '</b></span><span><small>Reject Rate</small><b>' + rejectRate + '</b></span></span>' + (admin ? '<span class="ers-team-summary-link">상세 보기 <i aria-hidden="true">→</i></span>' : '') + '</' + tag + '>';
  }
  function teamOverviewHTML(context, request, host, activeSnapshot, meta) {
    const admin = canAggregate(context.actor), scopes = admin ? ['presence', 'fuse', 'youngwave'] : [context.config.teamKey];
    const cards = scopes.map(function (scope) { return teamSummaryCardHTML(context, scope, summarySnapshot(context, scope, request, host, activeSnapshot)); }).join('');
    return '<section class="ers-team-overview" aria-label="' + esc(meta.rangeLabel || store.anchor) + ' 팀별 결과"><div class="ers-team-overview-head"><div><span>TEAM COMPARISON</span><h2>' + (admin ? '팀별 결과' : '우리 팀 결과') + '</h2></div><p>' + (admin ? '카드를 누르면 해당 팀의 상세 리캡으로 전환됩니다.' : '승인된 우리 팀 범위만 안전하게 표시합니다.') + '</p></div><div class="ers-team-overview-grid' + (scopes.length === 1 ? ' is-single' : '') + '">' + cards + '</div></section>';
  }
  function trendData(data) {
    const pays = data.pays || [], net = data.weeklyNetSales || (data.weeklySales || []).map(function (sales, i) { return Math.max(0, number(sales) - number((data.weeklyRejects || [])[i])); }), income = data.weeklyIncome || [];
    if (pays.length <= 8) return { labels: pays.map(function (pay) { return Number(pay.slice(5, 7)) + '/' + Number(pay.slice(8, 10)); }), net: net, income: income };
    const buckets = {};
    pays.forEach(function (pay, index) { const key = pay.slice(0, 7); buckets[key] = buckets[key] || { net: 0, income: 0 }; buckets[key].net += number(net[index]); buckets[key].income += number(income[index]); });
    return { labels: Object.keys(buckets).map(function (key) { return Number(key.slice(5, 7)) + '월'; }), net: Object.values(buckets).map(function (v) { return v.net; }), income: Object.values(buckets).map(function (v) { return v.income; }) };
  }
  function performanceChartHTML(data) {
    const series = trendData(data), width = 720, height = 270, left = 48, right = 24, top = 28, bottom = 42, plotW = width - left - right, plotH = height - top - bottom;
    const maxNet = Math.max.apply(null, series.net.concat([1])), maxIncome = Math.max.apply(null, series.income.concat([1])), count = Math.max(1, series.labels.length), step = plotW / count;
    const points = series.net.map(function (value, index) { return { x: left + step * (index + .5), y: top + plotH - value / maxNet * plotH, value: value }; });
    const bars = series.income.map(function (value, index) { const h = value / maxIncome * plotH; return '<rect class="ers-income-bar" x="' + (left + step * index + step * .22).toFixed(2) + '" y="' + (top + plotH - h).toFixed(2) + '" width="' + (step * .56).toFixed(2) + '" height="' + h.toFixed(2) + '" rx="5"><title>' + esc(series.labels[index]) + ' 실제 인컴 ' + money(value) + '</title></rect>'; }).join('');
    const line = points.map(function (point) { return point.x.toFixed(2) + ',' + point.y.toFixed(2); }).join(' ');
    const labels = series.labels.map(function (label, index) { return '<text x="' + (left + step * (index + .5)).toFixed(2) + '" y="' + (height - 14) + '" text-anchor="middle">' + esc(label) + '</text>'; }).join('');
    const dots = points.map(function (point, index) { return '<circle cx="' + point.x.toFixed(2) + '" cy="' + point.y.toFixed(2) + '" r="5"><title>' + esc(series.labels[index]) + ' Net ' + point.value + '건</title></circle>'; }).join('');
    return '<article class="ers-card ers-performance"><div class="ers-card-head"><div><span>WEEKLY PERFORMANCE</span><h3>Net Sales &amp; Actual Income</h3></div><div class="ers-chart-key"><span class="net">Net Sales</span><span class="income">Actual Income</span></div></div><div class="ers-chart-scroll" role="region" tabindex="0" aria-label="주차별 성과 차트, 좌우로 스크롤 가능"><svg class="ers-performance-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="주차별 Net Sales와 Actual Income"><line x1="' + left + '" y1="' + (top + plotH) + '" x2="' + (width - right) + '" y2="' + (top + plotH) + '" class="ers-axis"/>' + bars + '<polyline points="' + line + '" class="ers-net-line"/>' + dots + labels + '</svg></div><div class="ers-chart-exact">' + series.labels.map(function (label, i) { return '<span><b>' + esc(label) + '</b>Net ' + number(series.net[i]).toLocaleString('ko-KR') + '건 · ' + money(series.income[i]) + '</span>'; }).join('') + '</div></article>';
  }
  function donutLabel(item) {
    if (item.pct < (item.name === 'Net' ? 22 : 18)) return '';
    const angle = (item.start + item.pct / 2) * Math.PI / 50, x = 170 + 112 * Math.sin(angle), y = 170 - 112 * Math.cos(angle);
    return '<text class="ers-donut-label" data-series="' + item.name + '" x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" text-anchor="middle" dominant-baseline="central">' + item.name + ' ' + percent(item.pct) + '</text>';
  }
  function donutHTML(productivity) {
    const valid = productivity.sales > 0 && !productivity.invalid, cl = valid ? productivity.clPctOfSales : 0, sw = valid ? productivity.swPctOfSales : 0, net = valid ? productivity.retainedPctOfSales : 0;
    const items = [{ name: 'CL', pct: cl, start: 0 }, { name: 'SW', pct: sw, start: cl }, { name: 'Net', pct: net, start: cl + sw }];
    return '<article class="ers-card ers-mix"><div class="ers-card-head"><div><span>SALES QUALITY</span><h3>Net / CL / SW</h3></div></div><div class="ers-donut-layout"><svg class="ers-donut" viewBox="0 0 340 340" role="img" aria-label="Net ' + percent(net) + ', CL ' + percent(cl) + ', SW ' + percent(sw) + '"><circle cx="170" cy="170" r="112" pathLength="100" class="ers-donut-net"/><circle cx="170" cy="170" r="112" pathLength="100" class="ers-donut-cl" stroke-dasharray="' + cl + ' ' + (100 - cl) + '"/><circle cx="170" cy="170" r="112" pathLength="100" class="ers-donut-sw" stroke-dasharray="' + sw + ' ' + (100 - sw) + '" stroke-dashoffset="-' + cl + '"/>' + items.map(donutLabel).join('') + '<text x="170" y="144" class="ers-donut-center-label">총 리젝률</text><text x="170" y="180" class="ers-donut-center-value">' + (valid ? percent(productivity.rejectPctOfSales) : '—') + '</text><text x="170" y="207" class="ers-donut-center-sub">' + number(productivity.netRejects).toLocaleString('ko-KR') + '건 / ' + number(productivity.sales).toLocaleString('ko-KR') + '건</text></svg><div class="ers-mix-list">' + items.map(function (item) { const count = item.name === 'CL' ? productivity.netCL : item.name === 'SW' ? productivity.netSW : productivity.retained; return '<div class="' + item.name.toLowerCase() + '"><span><i></i>' + item.name + '</span><b>' + number(count).toLocaleString('ko-KR') + '건</b><small>' + (valid ? percent(item.pct) : '—') + '</small></div>'; }).join('') + '</div></div></article>';
  }
  function tableHTML(data) {
    const rows = (data.rows || []).map(function (row) {
      const netRejects = Math.max(0, number(row.rejects) - number(row.resubmits)), net = Math.max(0, number(row.sales) - netRejects), avg = number(row.fieldDays) ? number(row.sales) / number(row.fieldDays) : 0;
      return '<tr><th scope="row"><b>' + esc(row.name) + '</b><small>' + esc(row.role || '') + '</small></th><td>' + number(row.fieldDays).toLocaleString('ko-KR') + '일</td><td>' + number(row.sales).toLocaleString('ko-KR') + '건</td><td class="ers-net-cell">' + net.toLocaleString('ko-KR') + '건</td><td>' + money(row.income) + '</td><td>' + percent(row.rejectRate) + '</td><td>' + avg.toFixed(2) + '</td></tr>';
    }).join('');
    return '<article class="ers-card ers-members"><div class="ers-card-head"><div><span>TEAM DETAIL</span><h3>팀원별 성과</h3></div><small>' + (data.rows || []).length + '명</small></div><div class="ers-table-scroll" role="region" tabindex="0" aria-label="팀원별 리캡 표"><table><thead><tr><th>팀원</th><th>필드일</th><th>Sales</th><th>Net</th><th>Actual Income</th><th>Reject</th><th>AVG</th></tr></thead><tbody>' + (rows || '<tr><td colspan="7" class="ers-table-empty">선택한 기간에 집계된 데이터가 없어요.</td></tr>') + '</tbody></table></div></article>';
  }
  function insightHTML(data, productivity) {
    const net = data.weeklyNetSales || [], income = data.weeklyIncome || [], last = net.length - 1;
    const netDelta = last > 0 ? number(net[last]) - number(net[last - 1]) : null, incomeDelta = last > 0 ? number(income[last]) - number(income[last - 1]) : null;
    const direction = netDelta == null ? '비교 기간 부족' : netDelta > 0 ? 'Net Sales 상승' : netDelta < 0 ? 'Net Sales 하락' : 'Net Sales 유지';
    const note = netDelta == null ? '앞선 기간이 있으면 증감과 변동 원인을 표시합니다.' : '직전 구간 대비 Net ' + (netDelta >= 0 ? '+' : '') + netDelta.toLocaleString('ko-KR') + '건, Actual Income ' + (incomeDelta >= 0 ? '+' : '−') + money(Math.abs(incomeDelta)) + '입니다.';
    const risk = productivity.rejectPctOfSales >= 25 ? '리젝률이 25%를 넘어 원본 리캡과 리섭 현황을 먼저 확인해야 합니다.' : productivity.rejectPctOfSales >= 15 ? '리젝률이 주의 구간입니다. CL·SW 비중을 함께 보세요.' : '리젝률은 현재 안정 구간입니다.';
    return '<aside class="ers-card ers-insight"><span>PERFORMANCE &amp; RECAP SUPPORT</span><h3>' + esc(direction) + '</h3><p>' + esc(note) + '</p><div><b>리캡 포인트</b><p>' + esc(risk) + '</p></div><small>급여일 기준 Actual Income과 필드 기록 기준 Sales는 기준 시점이 다릅니다.</small></aside>';
  }
  function dashboardHTML(context, data, meta) {
    if (!data) return emptyStateHTML(context, false, '');
    if (data.error) return emptyStateHTML(context, false, data.error);
    const totals = data.totals || {}, productivity = typeof root.prcProductivityOf === 'function' ? root.prcProductivityOf(data) : { sales: number(totals.sales), actualIncome: number(totals.income), netRejects: 0, netCL: 0, netSW: 0, retained: number(totals.netSales), rejectPctOfSales: number(totals.rejectRate), clPctOfSales: 0, swPctOfSales: 0, retainedPctOfSales: 100, rejectValue: 0, clValue: 0, swValue: 0 };
    const label = scopeLabel(store.scope, store.personUid, data), periodText = meta.rangeLabel || store.anchor;
    return '<div class="ers-dashboard"><div class="ers-dashboard-title"><div><span>EXECUTIVE RECAP</span><h2>' + esc(label) + '</h2><p>' + esc(periodText) + ' · 실제 리캡과 필드 기록 기준</p></div><span class="ers-live"><i></i>LIVE DATA</span></div><div class="ers-kpis">' + metricHTML('Actual Income', money(totals.income), (data.pays || []).length + '개 급여 주차', 'income') + metricHTML('Net Sales', number(totals.netSales).toLocaleString('ko-KR') + '건', '총 ' + number(totals.sales).toLocaleString('ko-KR') + '건 기준', 'net') + metricHTML('Reject Rate', percent(totals.rejectRate), '리섭 반영 후 순리젝', 'reject') + metricHTML('AVG', number(totals.avg).toFixed(2), number(totals.fieldDays).toLocaleString('ko-KR') + ' 필드일', 'avg') + '</div><div class="ers-visual-grid">' + performanceChartHTML(data) + donutHTML(productivity) + '</div><div class="ers-detail-grid">' + tableHTML(data) + insightHTML(data, productivity) + '</div></div>';
  }
  function bodyHTML(context, host) {
    const range = periodRange(store.period, store.anchor), meta = reportMeta(range);
    const request = { actorUid: context.actor.uid, period: store.period, range: range, scope: canAggregate(context.actor) ? store.scope : context.config.teamKey, personUid: canAggregate(context.actor) ? store.personUid : '' };
    const snapshot = resolveSnapshot(context, request, host), pending = snapshot === undefined;
    return controlsHTML(context, meta) + teamOverviewHTML(context, request, host, snapshot, meta) + (pending ? emptyStateHTML(context, true, '') : dashboardHTML(context, snapshot, meta));
  }
  function launcherHTML(context) {
    return '<section class="ers-shell' + (store.open ? ' is-open' : '') + '" aria-label="Executive Recap Studio"><button type="button" class="ers-launcher" data-ers-action="toggle" aria-expanded="' + store.open + '"><span class="ers-launch-mark" aria-hidden="true"><i></i><b>R</b></span><span class="ers-launch-copy"><small>EXECUTIVE ANALYTICS</small><strong>Recap Studio</strong><em>Performance &amp; Recap Support</em></span><span class="ers-launch-meta"><b>' + esc(context.config.teamName) + '</b><small>' + (store.open ? 'Studio 닫기' : 'Studio 열기') + '</small></span><span class="ers-launch-arrow" aria-hidden="true">↗</span></button><div class="ers-body"' + (store.open ? '' : ' hidden') + '></div></section>';
  }
  function render(hostOrId, context) {
    const host = typeof hostOrId === 'string' ? document.getElementById(hostOrId) : hostOrId;
    if (!host) return;
    if (!canView(context)) { host.replaceChildren(); return; }
    store.context = context; store.hostId = host.id || '';
    if (!store.anchor) store.anchor = monthKey();
    if (!canAggregate(context.actor)) { store.scope = context.config.teamKey; store.personUid = ''; }
    host.innerHTML = launcherHTML(context);
    if (store.open) {
      const body = host.querySelector('.ers-body');
      body.innerHTML = bodyHTML(context, host);
    }
  }
  function rerender(focusId) {
    const host = document.getElementById(store.hostId);
    if (!host || !store.context) return;
    render(host, store.context);
    if (focusId) requestAnimationFrame(function () { const el = document.getElementById(focusId); if (el) el.focus({ preventScroll: true }); });
  }
  function onClick(event) {
    const button = event.target.closest('[data-ers-action]');
    if (!button || !button.closest('.ers-shell')) return;
    const action = button.dataset.ersAction;
    if (action === 'toggle') { store.open = !store.open; rerender(); if (store.open) requestAnimationFrame(function () { document.querySelector('#' + store.hostId + ' .ers-toolbar')?.scrollIntoView({ block: 'nearest' }); }); }
    if (action === 'period') { store.period = button.dataset.value || 'monthly'; rerender(); }
    if (action === 'shift') { store.anchor = shiftMonth(store.anchor, number(button.dataset.value)); rerender(); }
    if (action === 'scope-card' && canAggregate(store.context && store.context.actor)) { store.scope = ['presence', 'fuse', 'youngwave'].includes(button.dataset.value) ? button.dataset.value : 'presence'; store.personUid = ''; rerender(); requestAnimationFrame(function () { document.querySelector('#' + store.hostId + ' .ers-dashboard-title')?.scrollIntoView({ block: 'start' }); }); }
  }
  function onChange(event) {
    const input = event.target.closest('[data-ers-change]');
    if (!input || !input.closest('.ers-shell')) return;
    const kind = input.dataset.ersChange;
    if (kind === 'anchor' && /^\d{4}-\d{2}$/.test(input.value)) { store.anchor = input.value; rerender('ersAnchor'); }
    if (kind === 'scope') { store.scope = ['presence', 'fuse', 'youngwave', 'person'].includes(input.value) ? input.value : 'presence'; if (store.scope !== 'person') store.personUid = ''; rerender('ersScope'); }
    if (kind === 'person') { store.personUid = input.value || ''; rerender('ersPerson'); }
  }
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);

  root.PresenceExecutiveRecap = {
    render: render,
    reset: function () { const host = document.getElementById(store.hostId); if (host) host.replaceChildren(); store.open = false; store.period = 'monthly'; store.anchor = ''; store.scope = 'presence'; store.personUid = ''; store.context = null; store.hostId = ''; store.cache.clear(); store.pending.clear(); },
    invalidate: function () { store.cache.clear(); store.pending.clear(); if (store.open) rerender(); },
    open: function () { store.open = true; rerender(); },
    state: store,
  };
})(window);
