import { createRequire } from 'node:module';
import { stat } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const pptxBundle = '/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pptxgenjs/dist/pptxgen.bundle.js';
const output = '/tmp/presence-profit-recap-qa.pptx';

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const consoleErrors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
await page.goto(`${baseUrl}/?qa=profit-recap-ppt`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.locator('#authGate:not(.hidden) .auth-card').waitFor({ state: 'visible', timeout: 20000 });

await page.evaluate(() => {
  window.__firebaseReady = true;
  window.showPresenceEntryLobby = () => false;
  window.__presenceEntryPass = true;
  window.__adminOff = false;
  window.__previewRole = null;
  const admin = { uid: 'admin', name: '임재영', id: 'presence', loginKey: 'presence', role: 'AOP', status: 'active', surveys: {} };
  const a = { uid: 'qa-a', name: '윤채영', id: 'yoon', loginKey: 'yoon', role: 'TL', status: 'active', surveys: {} };
  const b = { uid: 'qa-b', name: '황혜진', id: 'hwang', loginKey: 'hwang', role: 'LR', status: 'active', surveys: {} };
  state.users = { admin, 'qa-a': a, 'qa-b': b };
  state.extraMembers = [];
  state.removedMembers = [];
  state.sales = {};
  const sale = (date, user, count) => { state.sales[`${date}|${user.name}`] = { date, name: user.name, role: user.role, count, t: 1 }; };
  ['2026-07-28', '2026-08-04', '2026-08-11', '2026-08-18'].forEach((d, i) => sale(d, a, [2, 3, 4, 5][i]));
  ['2026-07-29', '2026-08-05', '2026-08-12', '2026-08-19'].forEach((d, i) => sale(d, b, [1, 2, 3, 4][i]));
  state.sales['2026-08-20|황혜진'] = { date: '2026-08-20', name: '황혜진', role: 'LR', count: 0, checked: true, t: 1 };
  state.weeklyProfitRecaps = {};
  const pays = ['2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28'];
  const put = (pay, user, income, rejectCL, rejectSW, resubmitCL, resubmitSW) => {
    const w = prcWeekInfo(pay);
    state.weeklyProfitRecaps[pay] ||= {};
    state.weeklyProfitRecaps[pay][user.uid] = { uid: user.uid, name: user.name, role: user.role, payDate: pay, incomeDate: pay, activityFrom: w.sd, activityTo: w.ed, weekEnding: w.we, netPayment: income, rejectCLCount: rejectCL, rejectSWCount: rejectSW, resubmitCLCount: resubmitCL, resubmitSWCount: resubmitSW, bondBalance: 1000, bep: 2000 };
  };
  [100, 200, 300, 400].forEach((income, i) => put(pays[i], a, income, [1, 1, 2, 0][i], 0, [0, 0, 1, 0][i], 0));
  [50, 60, 70, 80].forEach((income, i) => put(pays[i], b, income, [0, 1, 0, 0][i], 0, 0, 0));
  state.profitMonthlyBep = { '2026-08': { 'qa-a': 2000, 'qa-b': 2000 } };
  DB.set = async () => {};
  DB.update = async () => {};
  DB.get = async () => null;
  DB.on = () => () => {};
  me = admin;
  continueLogin(admin);
  prcAdminFrom = '2026-08';
  prcAdminTo = '2026-08';
  prcAdminPreset = 'month';
  prcAdminScope = 'team';
  document.querySelectorAll('.mpanel').forEach((panel) => panel.classList.remove('active'));
  document.getElementById('m-recap')?.classList.add('active');
  renderProfitRecapAdminView();
  document.querySelectorAll('.modal.on').forEach((modal) => modal.classList.remove('on'));
  const loader = document.getElementById('presenceGameLoader');
  if (loader) { loader.classList.remove('show', 'complete'); loader.style.pointerEvents = 'none'; }
});
await page.waitForTimeout(150);

const desktop = await page.evaluate(() => {
  const d = prcAdminAgg('2026-08', '2026-08', '');
  const yoon = d.rows.find((r) => r.name === '윤채영');
  const preview = document.getElementById('profitRecapAdminView')?.textContent || '';
  return {
    pays: d.pays,
    period: d.period,
    weeklySales: d.weeklySales,
    weeklyRejects: d.weeklyRejects,
    weeklyIncome: d.weeklyIncome,
    totals: d.totals,
    yoon: yoon && { weekly: yoon.weekly, sales: yoon.sales, rejects: yoon.rejects, resubmits: yoon.resubmits, rejectRate: Number(yoon.rejectRate.toFixed(1)) },
    previewChecks: {
      cover: preview.includes('26년 8월 Recap'),
      weeks: ['W1', 'W2', 'W3', 'W4'].every((v) => preview.includes(v)),
      formula: preview.includes('리젝률=(리젝−리섭)÷세일즈'),
      netSales: preview.includes('Net Sales · 리젝·리섭 반영'),
      salesTrend: preview.includes('세일즈 추이'),
      rejectTrend: preview.includes('리젝 추이'),
      incomeTrend: preview.includes('실인컴 추이'),
      typoRemoved: !preview.includes('리실'),
    },
    chartCount: document.querySelectorAll('#m-recap .pra-chart').length,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
  };
});

await page.setViewportSize({ width: 1024, height: 768 });
await page.waitForTimeout(100);
const tablet = await page.evaluate(() => ({
  horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
  chartCount: document.querySelectorAll('#m-recap .pra-chart').length,
  chartsInsideViewport: [...document.querySelectorAll('#m-recap .pra-chart')].every((el) => { const r = el.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; }),
}));

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(100);
const phone = await page.evaluate(() => {
  const tableWrap = document.querySelector('#m-recap .pra-table-wrap');
  const controls = [...document.querySelectorAll('#m-recap .pra-controls button,#m-recap .pra-controls input,#m-recap .pra-controls select')].filter((el) => getComputedStyle(el).display !== 'none');
  return {
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    tableScrollable: !!tableWrap && tableWrap.scrollWidth > tableWrap.clientWidth,
    chartCount: document.querySelectorAll('#m-recap .pra-chart').length,
    undersized: controls.map((el) => ({ label: el.textContent.trim() || el.getAttribute('aria-label'), h: Math.round(el.getBoundingClientRect().height) })).filter((x) => x.h < 44),
  };
});

await page.setViewportSize({ width: 1440, height: 900 });
await page.addScriptTag({ path: pptxBundle });
const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
await page.evaluate(() => exportProfitRecapPpt('team'));
const download = await downloadPromise;
if (!download) {
  const diagnostic = await page.evaluate(() => ({ hasPptx: !!window.PptxGenJS, toast: document.getElementById('toast')?.textContent || '', slides: document.querySelectorAll('.pra-slide').length }));
  await browser.close();
  console.log(JSON.stringify({ desktop, phone, diagnostic, errors, consoleErrors, failures: ['PPT download did not start'] }, null, 2));
  process.exit(1);
}
await download.saveAs(output);
const pptxStat = await stat(output);

const expectedPays = ['2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28'];
const failures = [];
if (JSON.stringify(desktop.pays) !== JSON.stringify(expectedPays)) failures.push('August pay dates are not W1-W4 Fridays');
if (desktop.period.from !== '2026-07-27' || desktop.period.to !== '2026-08-23') failures.push('Payroll activity period is incorrect');
if (JSON.stringify(desktop.weeklySales) !== JSON.stringify([3, 5, 7, 9])) failures.push('Weekly sales aggregation is incorrect');
if (JSON.stringify(desktop.weeklyRejects) !== JSON.stringify([1, 2, 2, 0])) failures.push('Weekly reject aggregation is incorrect');
if (JSON.stringify(desktop.weeklyIncome) !== JSON.stringify([150, 260, 370, 480])) failures.push('Weekly net income aggregation is incorrect');
if (desktop.totals.sales !== 24 || desktop.totals.fieldDays !== 9 || desktop.totals.income !== 1260 || desktop.totals.rejects !== 5 || desktop.totals.resubmits !== 1 || desktop.totals.netSales !== 20 || Number(desktop.totals.avg.toFixed(2)) !== 2.67) failures.push('Team totals or explicit zero-day field count are incorrect');
if (!desktop.yoon || desktop.yoon.sales !== 14 || desktop.yoon.rejects !== 4 || desktop.yoon.resubmits !== 1 || desktop.yoon.rejectRate !== 21.4 || JSON.stringify(desktop.yoon.weekly) !== JSON.stringify([2, 3, 4, 5])) failures.push('Member reject-rate or weekly calculations are incorrect');
if (Object.values(desktop.previewChecks).some((v) => !v) || desktop.chartCount !== 3) failures.push('Preview does not match requested structure');
if (desktop.horizontalOverflow || tablet.horizontalOverflow || tablet.chartCount !== 3 || !tablet.chartsInsideViewport || phone.horizontalOverflow || phone.chartCount !== 3 || !phone.tableScrollable || phone.undersized.length) failures.push('Responsive layout gate failed');
if (pptxStat.size < 25000) failures.push('Generated PPTX is unexpectedly small');
if (errors.length) failures.push('Browser page errors occurred');

await browser.close();
console.log(JSON.stringify({ desktop, tablet, phone, pptx: { output, bytes: pptxStat.size, suggestedFilename: download.suggestedFilename() }, errors, consoleErrors, failures }, null, 2));
if (failures.length) process.exit(1);
