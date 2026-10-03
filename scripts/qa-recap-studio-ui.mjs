import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4187';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
await page.route(/firebasedatabase\.app|firebaseio\.com|script\.google\.com/, route => route.abort());
await page.goto(`${base}/?qa=recap-studio-v3`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => !!window.PresenceExecutiveRecap && typeof window.prcProductivityOf === 'function');
await page.waitForFunction(() => [...document.styleSheets].some(sheet => sheet.href && sheet.href.includes('presence-executive-recap.css')));
await page.waitForTimeout(400);
pageErrors.length = 0;
consoleErrors.length = 0;

const roles = [
  { key: 'member', actor: { uid: 'ic', name: '일반팀원', role: 'IC', status: 'active' }, access: null },
  { key: 'tl', actor: { uid: 'fuse-tl', name: '고윤경', role: 'TL', status: 'active' }, access: { uid: 'fuse-tl', scope: 'team', teamKey: 'fuse', active: true } },
  { key: 'admin', actor: { uid: 'admin', name: '임재영', role: 'AOP', status: 'active' }, access: { uid: 'admin', scope: 'all', active: true } },
];
const viewports = [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }];
const failures = [];
const results = [];

async function install(role) {
  await page.evaluate(({ role }) => {
    const payDates = {
      '2026-08': ['2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28'],
      '2026-09': ['2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25'],
      '2026-10': ['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30'],
    };
    const users = {
      admin: { uid: 'admin', name: '임재영', role: 'AOP', status: 'active' },
      'fuse-tl': { uid: 'fuse-tl', name: '고윤경', role: 'TL', status: 'active' },
      'fuse-child': { uid: 'fuse-child', name: '권영웅', role: 'LR', status: 'active' },
      'fuse-grandchild': { uid: 'fuse-grandchild', name: 'Blin', role: 'IC', status: 'active' },
      'fuse-departed': { uid: 'fuse-departed', name: '김하진', role: 'LR', status: 'departed' },
      'wave-tl': { uid: 'wave-tl', name: '윤채영', role: 'TL', status: 'active' },
      'wave-child': { uid: 'wave-child', name: '민병준', role: 'LR', status: 'active' },
      'wave-grandchild': { uid: 'wave-grandchild', name: '손예진', role: 'IC', status: 'active' },
      ic: { uid: 'ic', name: '일반팀원', role: 'IC', status: 'active' },
    };
    const migration = {
      status: { state: 'complete', runId: 'qa-v3', version: '2026-10-03.team-history-v3', configHash: 'cfg-v3', desiredHash: 'desired-v3', updatedAt: Date.now(), coverage: { expectedWeekly: 68, actualWeekly: 68, expectedBep: 14, actualBep: 14 }, conflictCount: 0, unresolvedCount: 0 },
      marker: { state: 'complete', version: '2026-10-03.team-history-v3', runId: 'qa-v3', configHash: 'cfg-v3', desiredHash: 'desired-v3', verifiedHash: 'desired-v3', completedAt: Date.now() },
    };
    const defs = {
      fuse: [
        { ...users['fuse-tl'], parentUid: 'admin' },
        { ...users['fuse-child'], parentUid: 'fuse-tl' },
        { ...users['fuse-grandchild'], parentUid: 'fuse-child' },
        { ...users['fuse-departed'], parentUid: 'fuse-tl', activeTo: '2026-08-31' },
      ],
      youngwave: [
        { ...users['wave-tl'], parentUid: 'admin' },
        { ...users['wave-child'], parentUid: 'wave-tl' },
        { ...users['wave-grandchild'], parentUid: 'wave-child' },
      ],
    };
    const activeFor = (member, month) => !member.activeTo || month <= member.activeTo.slice(0, 7);
    const makeRecord = (member, pay, offset) => ({ uid: member.uid, name: member.name, role: member.role, payDate: pay, payType: 'performance', netPayment: 620000 + offset * 85000, rejectCLCount: offset % 3 === 0 ? 1 : 0, rejectSWCount: offset % 5 === 0 ? 1 : 0, resubmitCLCount: 0, resubmitSWCount: 0 });
    const makeSnapshot = (scope, month) => {
      const pays = payDates[month];
      const members = scope === 'presence' ? [...defs.fuse, ...defs.youngwave] : defs[scope];
      const eligible = members.filter(member => activeFor(member, month));
      const rows = eligible.map((member, memberIndex) => {
        const available = month === '2026-10' ? 1 : pays.length;
        const records = pays.map((pay, payIndex) => payIndex < available ? makeRecord(member, pay, memberIndex + payIndex + 1) : null);
        const weekly = pays.map((pay, payIndex) => payIndex < available ? 2 + ((memberIndex + payIndex) % 4) : 0);
        const fieldDays = weekly.reduce((sum, value) => sum + (value ? 2 : 0), 0);
        const sales = weekly.reduce((sum, value) => sum + value, 0);
        const rejects = records.filter(Boolean).reduce((sum, item) => sum + item.rejectCLCount + item.rejectSWCount, 0);
        const income = records.filter(Boolean).reduce((sum, item) => sum + item.netPayment, 0);
        return { uid: member.uid, name: member.name, role: member.role, parentUid: member.parentUid, fieldDays, sales, income, rejects, resubmits: 0, rejectRate: sales ? rejects / sales * 100 : 0, weekly, records, savedWeeks: records.filter(Boolean).length };
      });
      const weeklySales = pays.map((_, index) => rows.reduce((sum, row) => sum + row.weekly[index], 0));
      const weeklyIncome = pays.map((_, index) => rows.reduce((sum, row) => sum + Number(row.records[index]?.netPayment || 0), 0));
      const weeklyRejects = pays.map((_, index) => rows.reduce((sum, row) => sum + Number(row.records[index]?.rejectCLCount || 0) + Number(row.records[index]?.rejectSWCount || 0), 0));
      const totals = rows.reduce((out, row) => { out.fieldDays += row.fieldDays; out.sales += row.sales; out.income += row.income; out.rejects += row.rejects; return out; }, { fieldDays: 0, sales: 0, income: 0, rejects: 0, resubmits: 0, bond: 0 });
      totals.netSales = Math.max(0, totals.sales - totals.rejects);
      totals.avg = totals.fieldDays ? totals.sales / totals.fieldDays : 0;
      totals.rejectRate = totals.sales ? totals.rejects / totals.sales * 100 : 0;
      const expectedRecords = eligible.length * pays.length;
      const actualRecords = rows.reduce((sum, row) => sum + row.savedWeeks, 0);
      return { scope, month, migration: structuredClone(migration), coverage: { expectedRecords, actualRecords, conflicts: 0 }, pays, rows, records: rows.flatMap(row => row.records.filter(Boolean)), totals, weeklySales, weeklyIncome, weeklyRejects, weeklyNetSales: weeklySales.map((sales, index) => Math.max(0, sales - weeklyRejects[index])), period: { from: `${month}-01`, to: `${month}-28` } };
    };
    const snapshots = {};
    Object.keys(payDates).forEach(month => {
      snapshots[month] = { presence: makeSnapshot('presence', month), fuse: makeSnapshot('fuse', month), youngwave: makeSnapshot('youngwave', month) };
    });
    state.users = structuredClone(users);
    state.recapStudioAccess = role.access ? structuredClone(role.access) : null;
    state.recapStudioMigration = structuredClone(migration);
    state.recapStudioError = '';
    me = structuredClone(role.actor);
    window.__recapStudioAuthAccess = role.access ? structuredClone(role.access) : null;
    window.__recapStudioMigration = structuredClone(migration);
    window.__qaRecapSnapshots = snapshots;
    window.PresenceExecutiveRecapDataAdapter = {
      getSnapshot(request) {
        if (role.key === 'member') return { error: '권한이 없습니다.' };
        if (role.key === 'tl' && request.scope !== 'fuse') return { error: '승인된 팀 범위와 요청 범위가 일치하지 않습니다.' };
        const source = window.__qaRecapSnapshots[request.range.from]?.[request.scope];
        if (!source) return { migration: structuredClone(window.__recapStudioMigration), coverage: { expectedRecords: 0, actualRecords: 0, conflicts: 0 }, pays: [], rows: [], records: [], totals: { fieldDays: 0, sales: 0, income: 0, rejects: 0, resubmits: 0, netSales: 0, avg: 0, rejectRate: 0 }, weeklySales: [], weeklyIncome: [], weeklyRejects: [], weeklyNetSales: [] };
        return structuredClone(source);
      },
    };
    window.recapStudioIsAdmin = actor => actor?.uid === 'admin';
    window.recapStudioTeamMemberIds = (teamKey, pays) => {
      const month = String(pays?.[0] || '2026-09').slice(0, 7);
      return (window.__qaRecapSnapshots[month]?.[teamKey]?.rows || []).map(row => row.uid);
    };
    window.recapStudioAdminPeople = () => Object.values(users);
    DB.set = async () => {};
    DB.update = async () => {};
    DB.get = async () => null;
    DB.on = () => () => {};
    window.PresenceExecutiveRecap.reset();
    let qaStyle = document.getElementById('qaRecapStudioStyle');
    if (!qaStyle) { qaStyle = document.createElement('style'); qaStyle.id = 'qaRecapStudioStyle'; document.head.appendChild(qaStyle); }
    qaStyle.textContent = 'html.qa-recap-studio body>*:not(#qaStudio),html.qa-recap-studio #authGate,html.qa-recap-studio #presenceEntryLobby,html.qa-recap-studio #presenceGameLoader{display:none!important}html.qa-recap-studio,html.qa-recap-studio body{background:#f7f9fc!important;overflow-x:hidden!important}html.qa-recap-studio #qaStudio{position:relative;z-index:2147483647;min-height:100vh}';
    document.documentElement.classList.add('qa-recap-studio');
    let stage = document.getElementById('qaStudio');
    if (!stage) { stage = document.createElement('main'); stage.id = 'qaStudio'; document.body.appendChild(stage); }
    stage.setAttribute('style', 'display:block!important;max-width:1360px;margin:0 auto;padding:12px');
    stage.innerHTML = '<div id="tlhExecutiveRecapMount"></div>';
    document.body.classList.add('app-on');
    window.PresenceExecutiveRecap.render('tlhExecutiveRecapMount', { actor: me, config: { teamKey: role.key === 'admin' ? 'presence' : 'fuse', teamName: role.key === 'admin' ? 'Presence' : 'FUSE', kind: role.key === 'admin' ? 'aop' : 'team' } });
  }, { role });
}

async function inspect(roleKey) {
  return page.evaluate(roleKey => {
    const visible = element => !!element && getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0;
    const shell = document.querySelector('.ers-shell');
    const periodGrid = document.querySelector('.ers-periods');
    const periodStyle = periodGrid ? getComputedStyle(periodGrid) : null;
    const buttons = [...document.querySelectorAll('.ers-shell button,.ers-shell select,.ers-shell input')].filter(visible).map(element => ({ name: element.textContent.trim() || element.getAttribute('aria-label') || element.id, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
    const rects = [...document.querySelectorAll('.ers-team-summary-card,.ers-kpi,.ers-card')].filter(visible).map(element => ({ name: element.className, top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right }));
    const overlap = rects.some((a, index) => rects.slice(index + 1).some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2));
    return {
      roleKey,
      shell: !!shell,
      text: shell?.textContent.replace(/\s+/g, ' ').trim() || '',
      scopeOptions: [...document.querySelectorAll('#ersScope option')].map(option => option.textContent.trim()),
      teamCards: [...document.querySelectorAll('.ers-team-summary-card')].map(card => ({ scope: card.dataset.scope, status: card.dataset.status, text: card.textContent.replace(/\s+/g, ' ').trim(), selected: card.classList.contains('is-selected') })),
      people: [...document.querySelectorAll('.ers-members tbody th b')].map(element => element.textContent.trim()),
      periods: [...document.querySelectorAll('.ers-period')].map(element => element.textContent.trim()),
      periodGap: periodStyle ? Number.parseFloat(periodStyle.columnGap || periodStyle.gap || '0') : 0,
      buttonSizes: buttons,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      overlap,
      chartScroll: !!document.querySelector('.ers-chart-scroll[role="region"][tabindex="0"]'),
      rotatedLabels: [...document.querySelectorAll('.ers-donut-label')].some(label => /rotate/i.test(label.getAttribute('transform') || '')),
      mountedContext: !!window.PresenceExecutiveRecap.state.context,
    };
  }, roleKey);
}

async function setMonth(month) {
  await page.locator('#ersAnchor').evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); }, month);
  await page.waitForTimeout(80);
}

for (const role of roles) {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await install(role);
    if (role.key !== 'member') await page.locator('[data-ers-action="toggle"]').click({ force: true });
    if (role.key !== 'member') await setMonth('2026-09');
    const row = await inspect(role.key);
    results.push({ role: role.key, viewport: `${viewport.width}x${viewport.height}`, ...row });
    if (role.key === 'member') {
      if (row.shell || row.text || row.mountedContext) failures.push(`${role.key}/${viewport.width}: privileged Studio DOM/context exposed`);
      continue;
    }
    if (!row.shell || row.periods.join('|') !== 'Weekly|Monthly|Quarterly|Yearly') failures.push(`${role.key}/${viewport.width}: launcher or period tabs missing`);
    if (row.periodGap < 8) failures.push(`${role.key}/${viewport.width}: adjacent period target gap below 8px (${row.periodGap}px)`);
    if (!['Actual Income', 'Net Sales', 'Reject Rate', 'AVG', 'Net / CL / SW', 'PERFORMANCE & RECAP SUPPORT'].every(token => row.text.includes(token))) failures.push(`${role.key}/${viewport.width}: dashboard essentials missing`);
    if (row.overflow || row.overlap || row.rotatedLabels || !row.chartScroll) failures.push(`${role.key}/${viewport.width}: overflow/overlap/rotation/scroll-region regression`);
    if (viewport.width <= 1024 && row.buttonSizes.some(item => item.width < 44 || item.height < 44)) failures.push(`${role.key}/${viewport.width}: target below 44px`);
    if (role.key === 'tl' && (row.scopeOptions.length || row.teamCards.length !== 1 || row.teamCards[0]?.scope !== 'fuse' || row.people.some(name => ['윤채영', '민병준', '손예진'].includes(name)) || !['고윤경', '권영웅', 'Blin'].every(name => row.people.includes(name)))) failures.push(`${role.key}/${viewport.width}: exact recursive team boundary failed`);
    if (role.key === 'admin' && (!['Presence', 'FUSE', 'YOUNG WAVE', '개인'].every(option => row.scopeOptions.includes(option)) || row.teamCards.map(card => card.scope).join('|') !== 'presence|fuse|youngwave' || row.teamCards.some(card => card.status !== 'ready'))) failures.push(`${role.key}/${viewport.width}: admin three verified cards missing`);
    if (role.key !== 'member' && (viewport.width === 390 || viewport.width === 1440)) await page.screenshot({ path: `/tmp/presence-recap-studio-v3-${role.key}-${viewport.width}.png`, fullPage: true });
  }
}

await page.setViewportSize({ width: 390, height: 844 });
await install(roles[2]);
await page.locator('[data-ers-action="toggle"]').click({ force: true });
for (const month of ['2026-08', '2026-09', '2026-10']) {
  await setMonth(month);
  const cards = await page.evaluate(() => [...document.querySelectorAll('.ers-team-summary-card')].map(card => ({ scope: card.dataset.scope, status: card.dataset.status, text: card.textContent.replace(/\s+/g, ' ').trim() })));
  const expectedStatus = month === '2026-10' ? 'progress' : 'ready';
  if (cards.length !== 3 || cards.some(card => card.status !== expectedStatus)) failures.push(`admin/${month}: Presence/FUSE/YOUNG WAVE status mismatch (${JSON.stringify(cards)})`);
}
await setMonth('2026-08');
await page.locator('.ers-team-summary-card[data-scope="fuse"]').click({ force: true });
await page.waitForTimeout(60);
let detail = await page.evaluate(() => ({ title: document.querySelector('.ers-dashboard-title h2')?.textContent.trim(), people: [...document.querySelectorAll('.ers-members tbody th b')].map(item => item.textContent.trim()) }));
if (detail.title !== 'FUSE' || !['고윤경', '권영웅', 'Blin', '김하진'].every(name => detail.people.includes(name))) failures.push(`admin/august: recursive or historical member missing (${JSON.stringify(detail)})`);
await setMonth('2026-09');
detail = await page.evaluate(() => ({ people: [...document.querySelectorAll('.ers-members tbody th b')].map(item => item.textContent.trim()) }));
if (detail.people.includes('김하진') || !detail.people.includes('Blin')) failures.push(`admin/september: departed boundary or grandchild failed (${JSON.stringify(detail)})`);
await page.locator('.ers-team-summary-card[data-scope="youngwave"]').click({ force: true });
detail = await page.evaluate(() => ({ title: document.querySelector('.ers-dashboard-title h2')?.textContent.trim(), people: [...document.querySelectorAll('.ers-members tbody th b')].map(item => item.textContent.trim()) }));
if (detail.title !== 'YOUNG WAVE' || !['윤채영', '민병준', '손예진'].every(name => detail.people.includes(name)) || detail.people.includes('Blin')) failures.push(`admin/september: card detail switch or Young Wave descendants failed (${JSON.stringify(detail)})`);

await page.evaluate(() => {
  const data = window.__qaRecapSnapshots['2026-09'].youngwave;
  data.coverage.actualRecords = data.coverage.expectedRecords - 2;
  window.PresenceExecutiveRecap.invalidate();
});
await page.waitForTimeout(60);
let statusCard = await page.locator('.ers-team-summary-card[data-scope="youngwave"]').evaluate(card => ({ status: card.dataset.status, text: card.textContent.replace(/\s+/g, ' ').trim() }));
if (statusCard.status !== 'partial' || !/입력 \d+\/\d+/.test(statusCard.text)) failures.push(`historical partial status missing (${JSON.stringify(statusCard)})`);

await page.evaluate(() => {
  const empty = window.__qaRecapSnapshots['2026-09'].youngwave;
  empty.rows = []; empty.records = []; empty.weeklySales = []; empty.weeklyIncome = []; empty.weeklyRejects = []; empty.weeklyNetSales = [];
  empty.totals = { fieldDays: 0, sales: 0, income: 0, rejects: 0, resubmits: 0, netSales: 0, avg: 0, rejectRate: 0 };
  empty.coverage = { expectedRecords: 0, actualRecords: 0, conflicts: 0 };
  window.PresenceExecutiveRecap.invalidate();
});
await page.waitForTimeout(60);
statusCard = await page.locator('.ers-team-summary-card[data-scope="youngwave"]').evaluate(card => ({ status: card.dataset.status, text: card.textContent.replace(/\s+/g, ' ').trim() }));
if (statusCard.status !== 'empty' || !statusCard.text.includes('입력 없음')) failures.push(`no-record status missing (${JSON.stringify(statusCard)})`);

for (const stateName of ['locked', 'failed', 'rolling-back', 'rolled-back']) {
  await page.evaluate(stateName => {
    Object.values(window.__qaRecapSnapshots['2026-09']).forEach(data => { data.migration.status.state = stateName; });
    window.PresenceExecutiveRecap.invalidate();
  }, stateName);
  await page.waitForTimeout(40);
  const states = await page.evaluate(() => [...document.querySelectorAll('.ers-team-summary-card')].map(card => card.dataset.status));
  const expected = stateName === 'locked' ? 'locked' : stateName === 'failed' ? 'error' : 'rollback';
  if (states.length !== 3 || states.some(state => state !== expected)) failures.push(`migration ${stateName} state missing (${states.join('|')})`);
}

await page.setViewportSize({ width: 390, height: 844 });
await install(roles[2]);
await page.locator('[data-ers-action="toggle"]').click({ force: true });
await page.evaluate(() => {
  Object.values(window.__qaRecapSnapshots['2026-10']).forEach(data => {
    data.migration.status.state = 'blocked';
    data.migration.status.conflictCount = 1;
    data.migration.status.unresolvedCount = 1;
  });
  window.recapStudioPreflightV3 = async () => ({
    blocked: true,
    conflicts: [{
      type: 'weekly-source-invalid', uid: 'unsafe-uid', name: '<script>not executable</script>',
      teamKey: 'youngwave', payDate: '2026-09-04', path: 'recapStudioTeams/private-path',
      existing: { secret: 'must-not-render' },
    }],
    unresolved: [{
      type: 'unapproved-descendant', uid: 'pending-uid', name: '<img src=x onerror=alert(1)>',
      teamKey: 'youngwave', upline: '민병준', month: '2026-09', rawRecord: 'must-not-render',
    }],
  });
  window.PresenceExecutiveRecap.invalidate();
});
await page.locator('[data-ers-action="preflight-v3"]').click({ force: true });
await page.waitForSelector('.ers-migration-diagnostics');
const diagnosticAudit = await page.evaluate(() => {
  const details = document.querySelector('.ers-migration-diagnostics');
  const items = window.PresenceExecutiveRecap.state.migrationAction.diagnostics || [];
  return {
    open: details?.open,
    text: details?.textContent.replace(/\s+/g, ' ').trim() || '',
    html: details?.innerHTML || '',
    executableNodes: details?.querySelectorAll('script,img').length || 0,
    itemCount: details?.querySelectorAll('li').length || 0,
    resultBeforeDetails: details?.previousElementSibling?.classList.contains('ers-migration-result') || false,
    fieldSets: items.map(item => Object.keys(item).sort()),
  };
});
const allowedDiagnosticFields = new Set(['type', 'uid', 'name', 'teamKey', 'upline', 'month', 'payDate']);
if (diagnosticAudit.open !== false || diagnosticAudit.itemCount !== 2 || !diagnosticAudit.resultBeforeDetails) failures.push(`admin diagnostic disclosure layout failed (${JSON.stringify(diagnosticAudit)})`);
if (!diagnosticAudit.text.includes('주간 원본 확인 필요') || !diagnosticAudit.text.includes('미승인 하위 구성원') || !diagnosticAudit.text.includes('pending-uid')) failures.push(`admin diagnostic details missing (${JSON.stringify(diagnosticAudit)})`);
if (diagnosticAudit.executableNodes || /private-path|must-not-render|rawRecord|existing/.test(diagnosticAudit.html)) failures.push(`admin diagnostic leaked raw or executable payload (${JSON.stringify(diagnosticAudit)})`);
if (!diagnosticAudit.html.includes('&lt;script&gt;') || !diagnosticAudit.html.includes('&lt;img')) failures.push('admin diagnostic values were not HTML-escaped');
if (diagnosticAudit.fieldSets.some(fields => fields.some(field => !allowedDiagnosticFields.has(field)))) failures.push(`admin diagnostic whitelist failed (${JSON.stringify(diagnosticAudit.fieldSets)})`);
await page.locator('.ers-migration-diagnostics summary').click();
const diagnosticGeometry = await page.evaluate(() => {
  const details = document.querySelector('.ers-migration-diagnostics');
  const summary = details?.querySelector('summary');
  const rect = details?.getBoundingClientRect();
  return {
    open: details?.open,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    summaryHeight: summary?.getBoundingClientRect().height || 0,
    left: rect?.left || 0,
    right: rect?.right || 0,
    viewport: innerWidth,
  };
});
if (!diagnosticGeometry.open || diagnosticGeometry.overflow || diagnosticGeometry.summaryHeight < 44 || diagnosticGeometry.left < -1 || diagnosticGeometry.right > diagnosticGeometry.viewport + 1) failures.push(`admin diagnostic mobile geometry failed (${JSON.stringify(diagnosticGeometry)})`);

for (const role of [roles[1], roles[0]]) {
  await install(role);
  if (role.key !== 'member') await page.locator('[data-ers-action="toggle"]').click({ force: true });
  await page.evaluate(() => {
    window.PresenceExecutiveRecap.state.migrationAction = {
      busy: false, ready: false, tone: 'error', message: '관리자 전용 진단',
      diagnostics: [{ type: 'unapproved-descendant', uid: 'should-not-render', name: '비공개' }],
    };
    window.PresenceExecutiveRecap.invalidate();
  });
  const leakedDiagnostics = await page.locator('.ers-migration-diagnostics, [data-ers-action="preflight-v3"], [data-ers-action="migrate-v3"]').count();
  if (leakedDiagnostics) failures.push(`${role.key}: admin migration diagnostics/control exposed`);
}

await install(roles[1]);
await page.evaluate(() => window.PresenceExecutiveRecap.reset());
const zeroized = await page.evaluate(() => ({ html: document.getElementById('tlhExecutiveRecapMount')?.innerHTML || '', context: window.PresenceExecutiveRecap.state.context, hostId: window.PresenceExecutiveRecap.state.hostId }));
if (zeroized.html || zeroized.context || zeroized.hostId) failures.push('logout reset did not clear privileged DOM/state');
if (pageErrors.length) failures.push(...pageErrors.map(error => `pageerror: ${error}`));
if (consoleErrors.length) failures.push(...consoleErrors.map(error => `console: ${error}`));

await writeFile('/tmp/presence-recap-studio-ui-v3-results.json', JSON.stringify(results, null, 2));
await browser.close();
if (failures.length) throw new Error(failures.join('\n'));
console.log(JSON.stringify({ pass: true, cases: results.length, results: '/tmp/presence-recap-studio-ui-v3-results.json' }));
