import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const output = process.env.PRESENCE_QA_OUTPUT || '/tmp/presence-recap-member-eligibility';
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
await page.route(/(firebaseio\.com|firebasedatabase\.app|identitytoolkit|securetoken|gstatic\.com\/firebasejs|googleapis\.com\/(?!css))/, (route) => route.abort());
await page.goto(`${base}/?qa=recap-member-eligibility`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.locator('#authGate:not(.hidden) .auth-card').waitFor({ state: 'visible', timeout: 20000 });

await page.evaluate(() => {
  window.__firebaseReady = true;
  window.showPresenceEntryLobby = () => false;
  window.__presenceEntryPass = true;
  window.__adminOff = false;
  window.__previewRole = null;
  const admin = { uid: 'admin', name: '임재영', id: 'presence', loginKey: 'presence', role: 'AOP', status: 'active', surveys: {} };
  const yoon = { uid: 'yoon', name: '윤채영', id: 'yoon', loginKey: 'yoon', role: 'TL', status: 'active', surveys: {} };
  const hajin = { uid: 'hajin', name: '김하진', id: 'hajin', loginKey: 'hajin', role: 'LR', status: 'active', surveys: {} };
  state.users = { admin, yoon, hajin };
  state.managers = [];
  state.extraMembers = [];
  state.removedMembers = [];
  state.memberInfo = {
    임재영: { join: '2025-01-01', left: null },
    윤채영: { join: '2025-01-01', left: null },
    김하진: { join: '2025-01-01', left: null },
  };
  state.sales = {};
  const sale = (date, user, count) => { state.sales[`${date}|${user.name}`] = { date, name: user.name, role: user.role, count, checked: true, t: 1 }; };
  sale('2026-07-28', yoon, 2); sale('2026-07-29', hajin, 4);
  sale('2026-08-25', yoon, 2); sale('2026-08-26', hajin, 4);
  sale('2026-09-22', yoon, 2); sale('2026-09-23', hajin, 4);
  state.weeklyProfitRecaps = {};
  const put = (pay, user, income, stalePayDate = '') => {
    const w = prcWeekInfo(pay);
    (state.weeklyProfitRecaps[pay] ||= {})[user.uid] = {
      uid: user.uid, name: user.name, role: user.role, payType: 'performance', payDate: stalePayDate || pay,
      incomeDate: pay, activityFrom: w.sd, activityTo: w.ed, weekEnding: w.we, netPayment: income,
      rejectCLCount: user.uid === 'hajin' ? 2 : 1, rejectSWCount: 0, resubmitCLCount: 0, resubmitSWCount: 0,
      bondBalance: 1000, bep: 2000, updatedAt: 1,
    };
  };
  put('2026-08-07', yoon, 200); put('2026-08-07', hajin, 400);
  put('2026-09-04', yoon, 200); put('2026-09-04', hajin, 400, '2026-08-28');
  put('2026-10-02', yoon, 200); put('2026-10-02', hajin, 400);
  state.profitMonthlyBep = { '2026-08': { yoon: 2000, hajin: 2000 }, '2026-09': { yoon: 2000, hajin: 2000 }, '2026-10': { yoon: 2000, hajin: 2000 } };
  DB.set = async () => {};
  DB.update = async () => {};
  DB.get = async () => null;
  DB.on = () => () => {};
  me = admin;
  document.querySelectorAll('.mpanel').forEach((panel) => panel.classList.remove('active'));
  document.getElementById('m-recap')?.classList.add('active');
});

const report = await page.evaluate(async () => {
  const names = (data) => data.rows.map((row) => row.name);
  const summarize = (data) => ({ names: names(data), records: data.records.length, sales: data.totals.sales, income: data.totals.income, rejects: data.totals.rejects });
  const august = prcAdminAgg('2026-08', '2026-08', '');
  const september = prcAdminAgg('2026-09', '2026-09', '');
  const october = prcAdminAgg('2026-10', '2026-10', '');
  const mixed = prcAdminAgg('2026-08', '2026-09', '');
  const mixedHajin = mixed.rows.find((row) => row.uid === 'hajin');
  const rawSeptemberHajin = state.weeklyProfitRecaps['2026-09-04'].hajin;
  const recordsForHajin = prcRecordsFor('hajin').map((record) => record.incomeDate || record.payDate);

  const augustRecord = state.weeklyProfitRecaps['2026-08-07'].hajin;
  delete state.weeklyProfitRecaps['2026-08-07'].hajin;
  const pendingAugust = prcPendingRecapMembers('2026-08');
  const pendingSeptember = prcPendingRecapMembers('2026-09');
  state.weeklyProfitRecaps['2026-08-07'].hajin = augustRecord;

  profitRecapPayDate = '2026-08-07';
  const weeklyAugust = {
    editable: prcEditableUsers('2026-08').map((user) => user.name),
    team: prcTeamHTML('2026-08-07'),
    export: prcExportHTML('2026-08'),
  };
  profitRecapPayDate = '2026-09-04';
  const weeklySeptember = {
    editable: prcEditableUsers('2026-09').map((user) => user.name),
    team: prcTeamHTML('2026-09-04'),
    export: prcExportHTML('2026-09'),
  };

  prcAdminScope = 'person';
  prcAdminPreset = 'month';
  prcAdminUid = 'hajin';
  prcAdminFrom = '2026-08'; prcAdminTo = '2026-08'; renderProfitRecapAdminView();
  const adminAugust = { options: [...document.querySelectorAll('#praUid option')].map((el) => el.textContent), html: document.getElementById('profitRecapAdminView').textContent };
  prcAdminFrom = '2026-09'; prcAdminTo = '2026-09'; prcAdminUid = 'hajin'; renderProfitRecapAdminView();
  const adminSeptember = { selected: prcAdminUid, options: [...document.querySelectorAll('#praUid option')].map((el) => el.textContent), html: document.getElementById('profitRecapAdminView').textContent };

  const holder = document.createElement('div');
  holder.innerHTML = prcExportHTML('2026-08');
  document.body.appendChild(holder);
  const exportMonth = holder.querySelector('#prcExportMonth');
  exportMonth.value = '2026-09';
  prcExportMonthChanged('2026-09');
  const switchedExportOptions = [...holder.querySelectorAll('#prcExportUid option')].map((el) => el.textContent);
  holder.remove();

  window.__pptCaptures = [];
  class QaPptx { async write(){ return new ArrayBuffer(8); } }
  prcPptLoad = async () => QaPptx;
  prcPptCover = (_ppt, data, from) => window.__pptCaptures.push({ from, names: data.rows.map((row) => row.name), sales: data.totals.sales, income: data.totals.income });
  prcPptSummary = () => {};
  prcPptProductivity = () => {};
  prcPptDetail = () => {};
  window.PresenceRecapPptx = { prepare: async (buffer) => new Blob([buffer]) };
  URL.createObjectURL = () => 'blob:qa';
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function() {};
  const pptMonth = document.getElementById('praReportMonth');
  pptMonth.value = '2026-09'; prcAdminFrom = '2026-09'; prcAdminTo = '2026-09'; prcAdminPreset = 'month';
  await exportProfitRecapPpt('team', 'admin');
  pptMonth.value = '2026-08'; prcAdminFrom = '2026-08'; prcAdminTo = '2026-08';
  await exportProfitRecapPpt('team', 'admin');

  return {
    policy: { aug: prcMemberEligibleForRecap({ name: '김하진' }, '2026-08'), sep: prcMemberEligibleForRecap({ name: '김하진' }, '2026-09'), oct: prcMemberEligibleForRecap({ name: '김하진' }, '2026-10') },
    august: summarize(august), september: summarize(september), october: summarize(october),
    mixedHajin: mixedHajin && { sales: mixedHajin.sales, income: mixedHajin.income, weekly: mixedHajin.weekly },
    rawSeptemberHajinStillPresent: !!rawSeptemberHajin,
    recordsForHajin,
    pendingAugust: pendingAugust?.pending?.map((user) => user.name) || [],
    pendingSeptember: pendingSeptember?.pending?.map((user) => user.name) || [],
    weeklyAugust, weeklySeptember, adminAugust, adminSeptember, switchedExportOptions,
    detailAugust: prcAdminDetailSlides(august, 'team', 'Presence', '2026년 8월'),
    detailSeptember: prcAdminDetailSlides(september, 'team', 'Presence', '2026년 9월'),
    ppt: window.__pptCaptures,
  };
});

assert.deepEqual(report.policy, { aug: true, sep: false, oct: false });
assert.ok(report.august.names.includes('김하진'), 'August historical recap keeps 김하진');
assert.deepEqual(report.august, { names: ['김하진', '윤채영'], records: 2, sales: 6, income: 600, rejects: 3 });
assert.deepEqual(report.september, { names: ['윤채영'], records: 1, sales: 2, income: 200, rejects: 1 });
assert.deepEqual(report.october, { names: ['윤채영'], records: 1, sales: 2, income: 200, rejects: 1 });
assert.equal(report.mixedHajin.sales, 4, 'cross-month report keeps only pre-policy sales');
assert.equal(report.mixedHajin.income, 400, 'cross-month report keeps only pre-policy income');
assert.deepEqual(report.mixedHajin.weekly.slice(4), [0, 0, 0, 0], 'post-policy weekly slots are zeroed');
assert.equal(report.rawSeptemberHajinStillPresent, true, 'source record is preserved');
assert.deepEqual(report.recordsForHajin, ['2026-08-07'], 'history view exposes only eligible recap records');
assert.ok(report.pendingAugust.includes('김하진'), 'August pending target still includes 김하진');
assert.ok(!report.pendingSeptember.includes('김하진'), 'September pending target excludes 김하진');
assert.ok(report.weeklyAugust.editable.includes('김하진') && report.weeklyAugust.team.includes('김하진') && report.weeklyAugust.export.includes('김하진'));
assert.ok(!report.weeklySeptember.editable.includes('김하진') && !report.weeklySeptember.team.includes('김하진') && !report.weeklySeptember.export.includes('김하진'));
assert.ok(report.adminAugust.options.some((name) => name.includes('김하진')) && report.adminAugust.html.includes('김하진'));
assert.ok(!report.adminSeptember.options.some((name) => name.includes('김하진')) && !report.adminSeptember.html.includes('김하진'));
assert.notEqual(report.adminSeptember.selected, 'hajin', 'stale personal selection is reset');
assert.ok(!report.switchedExportOptions.some((name) => name.includes('김하진')), 'weekly export selector refreshes with month');
assert.ok(report.detailAugust.includes('김하진') && !report.detailSeptember.includes('김하진'));
assert.deepEqual(report.ppt, [
  { from: '2026-09', names: ['윤채영'], sales: 2, income: 200 },
  { from: '2026-08', names: ['김하진', '윤채영'], sales: 6, income: 600 },
]);

for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
  await page.setViewportSize(viewport);
  const geometry = await page.evaluate(() => {
    prcAdminScope = 'team'; prcAdminPreset = 'month'; prcAdminFrom = '2026-09'; prcAdminTo = '2026-09'; renderProfitRecapAdminView();
    return { overflow: document.documentElement.scrollWidth > innerWidth + 1, hajinVisible: document.getElementById('profitRecapAdminView').textContent.includes('김하진') };
  });
  assert.equal(geometry.overflow, false, `${viewport.width}px has no horizontal overflow`);
  assert.equal(geometry.hajinVisible, false, `${viewport.width}px September recap excludes 김하진`);
  await page.screenshot({ path: `${output}/september-${viewport.width}.png`, fullPage: false });
}

assert.deepEqual(pageErrors, []);
assert.deepEqual(consoleErrors.filter((message) => !message.includes('Failed to load resource: net::ERR_FAILED')), []);
console.log(JSON.stringify({ status: 'PASS', report, screenshots: output }, null, 2));
await browser.close();
