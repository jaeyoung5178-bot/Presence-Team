(function (global) {
  'use strict';
  const DEFAULT = { targetUid: '', displayName: '윤채영', goalRoleLabel: 'AOP', teamKey: 'youngwave', week1Start: '2026-11-09', weeklyTarget: 3200000, weekCount: 2, displayFrom: '2026-11-11', bondDeductionBps: 4500, multiplierBps: 5500, thresholdBasis: 'net', calcBasis: 'dailyFundraising', calculationMode: 'bondDeduction', enabled: false };
  let host = null, env = null, config = null, days = {}, configDirty = false, dayDirty = new Set(), busyDays = new Set(), dayMessages = new Map(), dayBases = new Map(), configBusy = false, preview = null, message = '', sequence = 0, selectedDay = '', actorKey = '';
  const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const read = v => typeof v === 'function' ? v() : v;
  const admin = () => !!env && read(env.isAdmin) === true;
  const allowed = () => admin() || (!!env && read(env.canWriteDays) === true);
  const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(Date.now()));
  const money = n => Math.round(n).toLocaleString('ko-KR') + '원';
  const addDays = (d, n) => { const value = new Date(d + 'T12:00:00Z'); value.setUTCDate(value.getUTCDate() + n); return Number.isFinite(+value) ? value.toISOString().slice(0, 10) : ''; };
  const dateLabel = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? Number(d.slice(5, 7)) + '월 ' + Number(d.slice(8, 10)) + '일' : '날짜 미설정';
  const normalized = value => ({ ...DEFAULT, ...(value || {}) });
  function weekly(snapshot) {
    return [0, 1].map(i => ({ startDate: addDays(snapshot.week1Start, i * 7), endDate: addDays(snapshot.week1Start, i * 7 + 6), netTotal: null, coverage: { status: 'pending' }, ...(Array.isArray(snapshot.weeks) ? snapshot.weeks[i] : snapshot.weeks?.['w' + (i + 1)]) }));
  }
  function homeHTML(value, options = {}) {
    const s = normalized(value), weeks = weekly(s), at = options.today || today();
    if (!options.preview && (!s.enabled || at < s.displayFrom || at > weeks[1].endDate)) return '';
    const goal = Number(s.weeklyTarget), validGoal = Number.isFinite(goal) && goal > 0;
    const rows = weeks.map((w, i) => {
      const amount = w.net ?? w.netTotal ?? w.total, known = typeof amount === 'number' && Number.isFinite(amount) && amount >= 0;
      const partial = (w.status || w.coverage?.status) === 'partial', achieved = known && validGoal && amount >= goal;
      const percent = known && validGoal ? Math.min(100, Math.max(0, amount / goal * 100)) : 0;
      const count = Number.isInteger(w.confirmedDays) ? ' · ' + w.confirmedDays + '/' + (w.expectedDays || 7) + '일 확인' : '';
      const status = (w.status || w.coverage?.status) === 'error' ? '집계를 불러오지 못했어요' : !known ? '달성률 —' : (partial ? '일부 집계 · ' : '') + (achieved ? '목표 달성' : '남은 ' + money(Math.max(0, goal - amount)));
      return '<div class="ppc-week' + (!known ? ' is-pending' : '') + '"><div class="ppc-week-head"><span><b>W' + (i + 1) + '</b> ' + dateLabel(w.startDate) + ' ~ ' + dateLabel(w.endDate) + '</span><span class="ppc-week-state' + (achieved ? ' is-achieved' : '') + '">' + (achieved ? '달성' : '입력 ' + (w.confirmedDays || 0) + '일') + '</span></div><div class="ppc-progress-copy"><strong class="ppc-total">' + (known ? money(amount) : '금액 입력 대기') + '</strong><span class="ppc-status' + (partial ? ' is-partial' : '') + '" role="status">' + status + '</span></div><div class="ppc-track" role="progressbar" aria-label="' + (i + 1) + '주 차 공제 후 팀 합계 목표 진행" aria-valuemin="0" aria-valuemax="100"' + (known && validGoal ? ' aria-valuenow="' + percent.toFixed(1) + '"' : ' aria-valuetext="집계 준비 중"') + '><span style="width:' + percent.toFixed(2) + '%"></span></div></div>';
    }).join('');
    const both = weeks.every(w => typeof (w.net ?? w.netTotal ?? w.total) === 'number' && (w.net ?? w.netTotal ?? w.total) >= goal);
    return '<section class="ppc-card" aria-label="' + escape(s.displayName) + ' AOP 프로모션"><div class="ppc-heading"><div><span class="ppc-kicker">' + (options.preview ? '관리자 로컬 미리보기' : both ? '두 주 목표 달성' : 'TL → AOP') + '</span><h2>' + escape(s.displayName) + ' <span>AOP 프로모션</span></h2></div><span class="ppc-goal">매주 목표 <strong>' + (validGoal ? money(goal) : '미설정') + '</strong></span></div><div class="ppc-weeks">' + rows + '</div><p class="ppc-footnote">일별 팀 생산성 기준 · 본드 ' + (s.bondDeductionBps / 100) + '% 공제 · 인컴 ' + (100 - s.bondDeductionBps / 100) + '% 반영 · 2주 각각 달성</p></section>';
  }
  function refreshSources() {
    if (!config || !configDirty) config = normalized(read(env.config));
    const source = read(env.ledger) || {};
    for (let i = 0; i < 14; i++) { const date = addDays(config.week1Start, i), raw = source[date] || Object.values(source).find(row => row?.date === date); if (!dayDirty.has(date) && !busyDays.has(date)) days[date] = raw ? { gross: raw.gross ?? raw.amount ?? null, confirmed: raw.confirmed === true || typeof raw.amount === 'number' } : { gross: null, confirmed: false }; }
    if (!selectedDay || selectedDay < config.week1Start || selectedDay > addDays(config.week1Start, 13)) selectedDay = today() >= config.week1Start && today() <= addDays(config.week1Start, 13) ? today() : config.week1Start;
  }
  function rowHTML(date) {
    if (date !== selectedDay) return '';
    const entry = days[date] || {}, recorded = entry.confirmed === true && typeof entry.gross === 'number', future = date > today();
    const picker = '<label class="ppc-day-picker">날짜 선택<select data-ppc-date>' + Array.from({ length: 14 }, (_, i) => { const d = addDays(config.week1Start, i), r = days[d]; return '<option value="' + d + '"' + (d === date ? ' selected' : '') + '>' + dateLabel(d) + ' · ' + (r?.confirmed ? '기록 있음' : d > today() ? '예정' : '미입력') + '</option>'; }).join('') + '</select></label>';
    return picker + '<div class="ppc-day" data-ppc-day="' + date + '"><label for="ppcGross-' + date + '">팀 생산성 금액(본드 차감 전)<small>' + (recorded ? '확인된 기록' : future ? '예정 · 빈칸 가능' : '미입력') + '</small></label><div class="ppc-day-input"><input id="ppcGross-' + date + '" data-ppc-gross type="number" inputmode="numeric" min="0" step="1" placeholder="미입력" value="' + (recorded ? escape(entry.gross) : '') + '" aria-label="' + dateLabel(date) + ' 팀 생산성 금액(본드 차감 전) 원"' + (busyDays.has(date) ? ' disabled' : '') + '><span>원</span></div><button type="button" data-ppc-save-day' + (busyDays.has(date) || typeof env.onSaveDay !== 'function' ? ' disabled' : '') + '>' + (busyDays.has(date) ? '저장 중' : '저장') + '</button><span class="ppc-day-status" role="status">' + (dayDirty.has(date) ? '저장 전' : '') + '</span></div>';
  }
  function renderAdmin() {
    if (!host) return;
    if (!allowed()) { host.replaceChildren(); config = null; days = {}; dayDirty.clear(); configDirty = false; preview = null; return; }
    refreshSources();
    const targets = read(env.targets) || [], teams = (read(env.teams) || [{ key: 'youngwave', name: 'YOUNG WAVE' }]).filter(team => team.key === 'youngwave');
    host.innerHTML = '<section class="ppc-admin" aria-labelledby="ppcAdminTitle"><header><span class="ppc-kicker">관리자 전용</span><h2 id="ppcAdminTitle">프로모션 관리</h2><p>팀 생산성 금액(본드 차감 전)을 입력하고, 주간 목표를 관리하세요.</p></header><div class="ppc-fields"><label>대상<select data-ppc-config="targetUid"><option value="">대상 선택</option>' + targets.map(p => '<option value="' + escape(p.uid) + '"' + (p.uid === config.targetUid ? ' selected' : '') + '>' + escape(p.name) + '</option>').join('') + '</select></label><label>팀<select data-ppc-config="teamKey">' + teams.map(t => '<option value="' + escape(t.key) + '"' + (t.key === config.teamKey ? ' selected' : '') + '>' + escape(t.name) + '</option>').join('') + '</select></label><label>첫 주 시작일 (월요일)<input type="date" data-ppc-config="week1Start" value="' + escape(config.week1Start) + '" required></label><label>공개 시작일<input type="date" data-ppc-config="displayFrom" value="' + escape(config.displayFrom) + '" required></label><label>매주 공제 후 목표 (원)<input type="number" min="1" step="1" data-ppc-config="weeklyTarget" value="' + config.weeklyTarget + '" required></label><label>본드 공제 비율 (%)<input type="number" min="0" max="100" step="0.01" data-ppc-config="bondDeductionBps" value="' + (config.bondDeductionBps / 100) + '" required></label></div><div class="ppc-unconfirmed"><strong>각 주를 독립적으로 확인합니다</strong><p>1주 차 ' + dateLabel(config.week1Start) + ' ~ ' + dateLabel(addDays(config.week1Start, 6)) + ' · 2주 차 ' + dateLabel(addDays(config.week1Start, 7)) + ' ~ ' + dateLabel(addDays(config.week1Start, 13)) + '<br>주간 초과 금액은 다음 주로 이월되지 않습니다.</p></div><label class="ppc-switch"><input type="checkbox" data-ppc-enabled' + (config.enabled ? ' checked' : '') + '>공개 표시<span>공개 시작일 전에는 홈에 표시되지 않아요</span></label><div class="ppc-admin-actions"><button type="button" data-ppc-save-config' + (configBusy || typeof env.onSaveConfig !== 'function' ? ' disabled' : '') + '>' + (configBusy ? '저장 중…' : '설정 저장') + '</button><button type="button" data-ppc-preview aria-expanded="' + !!preview + '">로컬 미리보기</button></div><p class="ppc-admin-status" role="status">' + escape(message || (configDirty ? '저장하지 않은 설정' : '설정과 일별 팀 생산성은 각각 저장됩니다.')) + '</p><div class="ppc-ledger-heading"><h3>일별 팀 생산성</h3><p>빈칸은 미입력, 직접 입력한 0원은 확인된 기록입니다.</p></div><div class="ppc-ledger">' + Array.from({ length: 14 }, (_, i) => rowHTML(addDays(config.week1Start, i))).join('') + '</div><div data-ppc-preview-host>' + (preview ? homeHTML(preview, { preview: true }) : '') + '</div></section>';
    if (!admin()) {
      host.querySelector('.ppc-admin header').innerHTML = '<span class="ppc-kicker">담당 팀장</span><h2 id="ppcAdminTitle">일별 팀 생산성</h2><p>팀 생산성 금액(본드 차감 전)을 기록하세요.</p>';
      host.querySelectorAll('.ppc-fields,.ppc-unconfirmed,.ppc-switch,.ppc-admin-actions,.ppc-admin-status,[data-ppc-preview-host]').forEach(node => node.remove());
      host.querySelector('.ppc-ledger-heading h3').textContent = '일별 팀 생산성';
    }
    host.querySelectorAll('[data-ppc-config]').forEach(input => { input.oninput = () => {
      if (!admin()) return;
      const key = input.dataset.ppcConfig; config[key] = ['weeklyTarget', 'bondDeductionBps'].includes(key) ? Number(input.value) * (key === 'bondDeductionBps' ? 100 : 1) : input.value;
      if (key === 'targetUid') config.displayName = targets.find(p => p.uid === input.value)?.name || '';
      configDirty = true; host.querySelector('.ppc-admin-status').textContent = '저장하지 않은 설정';
    }; });
    if (admin()) host.querySelector('[data-ppc-enabled]').onchange = e => { config.enabled = e.target.checked; configDirty = true; };
    if (admin()) host.querySelector('[data-ppc-config="teamKey"]').disabled = true;
    host.querySelector('[data-ppc-date]').onchange = e => { selectedDay = e.target.value; renderAdmin(); host.querySelector('[data-ppc-date]').focus({ preventScroll: true }); };
    if (admin()) host.querySelector('[data-ppc-config="bondDeductionBps"]').max = '100';
    host.querySelectorAll('[data-ppc-day]').forEach(row => {
      const date = row.dataset.ppcDay, input = row.querySelector('[data-ppc-gross]');
      if (date > today()) { input.disabled = true; row.querySelector('[data-ppc-save-day]').disabled = true; }
      if (dayMessages.has(date)) row.querySelector('.ppc-day-status').textContent = dayMessages.get(date);
      input.oninput = () => { if (!allowed() || date > today()) return; if (!dayDirty.has(date)) dayBases.set(date, Number(read(env.config)?.revision) || 0); days[date] = { gross: input.value === '' ? null : input.valueAsNumber, confirmed: input.value !== '' }; dayDirty.add(date); dayMessages.delete(date); row.querySelector('.ppc-day-status').textContent = '저장 전'; };
      row.querySelector('[data-ppc-save-day]').onclick = async () => {
        if (!allowed() || date > today() || !input.reportValidity() || busyDays.has(date) || typeof env.onSaveDay !== 'function') return;
        const ticket = sequence, payload = { ...(days[date] || { gross: null, confirmed: false }), expectedRevision: dayBases.has(date) ? dayBases.get(date) : Number(read(env.config)?.revision) || 0 }; busyDays.add(date); input.disabled = true; row.querySelector('button').disabled = true;
        try { await env.onSaveDay(date, payload); if (ticket !== sequence || !allowed()) return; dayDirty.delete(date); dayBases.delete(date); dayMessages.set(date, '저장됨'); }
        catch (error) { if (ticket === sequence) dayMessages.set(date, error.message || '저장하지 못했어요. 입력을 유지했어요.'); }
        finally { busyDays.delete(date); if (ticket === sequence && allowed()) renderAdmin(); }
      };
    });
    if (admin()) host.querySelector('[data-ppc-save-config]').onclick = async () => {
      if (!admin() || configBusy || typeof env.onSaveConfig !== 'function') return;
      const invalid = host.querySelector('[data-ppc-config]:invalid'); if (invalid) { invalid.reportValidity(); return; }
      if (new Date(config.week1Start + 'T12:00:00Z').getUTCDay() !== 1) { host.querySelector('.ppc-admin-status').textContent = '첫 주 시작일은 월요일로 선택해 주세요.'; return; }
      const ticket = sequence; configBusy = true; renderAdmin();
      try { await env.onSaveConfig({ ...config, weekCount: 2 }); if (ticket !== sequence || !admin()) return; configDirty = false; message = '설정을 저장했어요.'; }
      catch (error) { if (ticket === sequence) message = error.message || '설정을 저장하지 못했어요. 초안을 유지했어요.'; }
      finally { if (ticket === sequence) { configBusy = false; renderAdmin(); } }
    };
    if (admin()) host.querySelector('[data-ppc-preview]').onclick = async () => {
      if (!admin()) return;
      const ticket = sequence;
      try { const result = typeof env.onPreview === 'function' ? await env.onPreview({ config: { ...config }, ledger: { ...days } }) : { ...config, weeks: [null, null] }; if (ticket !== sequence || !admin()) return; preview = result; host.querySelector('[data-ppc-preview-host]').innerHTML = homeHTML(result, { preview: true }); host.querySelector('[data-ppc-preview]').setAttribute('aria-expanded', 'true'); }
      catch (error) { if (ticket === sequence) host.querySelector('.ppc-admin-status').textContent = error.message || '미리보기를 준비하지 못했어요.'; }
    };
    if (configBusy) host.querySelectorAll('[data-ppc-config],[data-ppc-enabled]').forEach(input => { input.disabled = true; });
  }
  function mountAdmin(container, options = {}) {
    const parent = typeof container === 'string' ? document.getElementById(container) : container; if (!parent) return;
    const nextActor = read(options.actorUid) || '';
    if (env && actorKey !== nextActor) dispose();
    actorKey = nextActor;
    env = options;
    if (!allowed()) { host?.replaceChildren(); return; }
    let owned = parent.querySelector('[data-promotion-campaign-admin]'); if (!owned) { owned = document.createElement('div'); owned.setAttribute('data-promotion-campaign-admin', ''); parent.appendChild(owned); }
    host = owned; renderAdmin();
  }
  function sync() { if (host) renderAdmin(); }
  function dispose() { sequence++; host?.remove(); host = null; env = null; config = null; days = {}; dayDirty.clear(); busyDays.clear(); dayMessages.clear(); dayBases.clear(); configDirty = false; configBusy = false; preview = null; message = ''; selectedDay = ''; actorKey = ''; }
  addEventListener('beforeunload', e => { if (configDirty || dayDirty.size) { e.preventDefault(); e.returnValue = ''; } });
  global.PresencePromotionCampaign = Object.freeze({ homeHTML, mountAdmin, sync, dispose });
})(window);
