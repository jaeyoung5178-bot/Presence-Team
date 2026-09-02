import { createRequire } from 'node:module';
import { stat, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const pptxBundle = process.env.PRESENCE_PPTX_BUNDLE;
const output = process.env.PRESENCE_PPTX_OUTPUT || '/tmp/presence-profit-recap-qa.pptx';

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
  state.managers = [];
  state.extraMembers = [];
  state.removedMembers = [];
  state.memberInfo = {
    '임재영': { join: '2026-01-01', left: null },
    '황혜진': { join: '2025-07-01', left: null },
    '윤채영': { join: '2025-08-10', left: null },
  };
  state.sales = {};
  const sale = (date, user, count) => { state.sales[`${date}|${user.name}`] = { date, name: user.name, role: user.role, count, t: 1 }; };
  ['2026-07-28', '2026-08-04', '2026-08-11', '2026-08-18'].forEach((d, i) => sale(d, a, [2, 3, 4, 5][i]));
  ['2026-07-29', '2026-08-05', '2026-08-12', '2026-08-19'].forEach((d, i) => sale(d, b, [1, 2, 3, 4][i]));
  state.sales['2026-08-20|황혜진'] = { date: '2026-08-20', name: '황혜진', role: 'LR', count: 0, checked: true, t: 1 };
  state.weeklyProfitRecaps = {};
  const pays = ['2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28'];
  const put = (pay, user, income, rejectCL, rejectSW, resubmitCL, resubmitSW, payType = 'performance') => {
    const w = prcWeekInfo(pay);
    state.weeklyProfitRecaps[pay] ||= {};
    state.weeklyProfitRecaps[pay][user.uid] = { uid: user.uid, name: user.name, role: user.role, payType, payDate: pay, incomeDate: pay, activityFrom: w.sd, activityTo: w.ed, weekEnding: w.we, netPayment: income, rejectCLCount: rejectCL, rejectSWCount: rejectSW, resubmitCLCount: resubmitCL, resubmitSWCount: resubmitSW, bondBalance: payType === 'performance' ? 1000 : 0, bep: payType === 'performance' ? 2000 : 0, updatedAt: 1 };
  };
  [100, 200, 300, 400].forEach((income, i) => put(pays[i], a, income, [1, 1, 1, 0][i], [0, 0, 1, 0][i], [0, 0, 1, 0][i], 0));
  [50, 60, 70, 80].forEach((income, i) => put(pays[i], b, income, [5, 1, 0, 0][i], 0, 0, 0, i === 0 ? 'hourly' : 'performance'));
  state.profitMonthlyBep = { '2026-08': { 'qa-a': 2000, 'qa-b': 2000 } };
  window.__qaRecapWrites = [];
  DB.set = async (path, value) => { window.__qaRecapWrites.push({ path, value }); };
  DB.update = async () => {};
  DB.get = async () => null;
  DB.on = () => () => {};
  me = admin;
  continueLogin(admin);
  prcAdminFrom = '2026-09';
  prcAdminTo = '2026-09';
  prcAdminPreset = 'month';
  prcAdminScope = 'team';
  document.querySelectorAll('.mpanel').forEach((panel) => panel.classList.remove('active'));
  document.getElementById('m-recap')?.classList.add('active');
  renderProfitRecapAdminView();
  const monthPicker = document.getElementById('praReportMonth');
  monthPicker.value = '2026-08';
  monthPicker.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelectorAll('.modal.on').forEach((modal) => modal.classList.remove('on'));
  const loader = document.getElementById('presenceGameLoader');
  if (loader) { loader.classList.remove('show', 'complete'); loader.style.pointerEvents = 'none'; }
});
await page.waitForTimeout(150);

const desktop = await page.evaluate(() => {
  const d = prcAdminAgg('2026-08', '2026-08', '');
  const yoon = d.rows.find((r) => r.name === '윤채영');
  const productivity = prcProductivityOf(d);
  const preview = document.getElementById('profitRecapAdminView')?.textContent || '';
  return {
    pays: d.pays,
    period: d.period,
    weeklySales: d.weeklySales,
    weeklyRejects: d.weeklyRejects,
    weeklyIncome: d.weeklyIncome,
    rowOrder: d.rows.map((r) => r.name),
    productivity,
    totals: d.totals,
    yoon: yoon && { weekly: yoon.weekly, sales: yoon.sales, fieldDays: yoon.fieldDays, avg: prcAvgOf(yoon), income: yoon.income, bond: yoon.bond, rejects: yoon.rejects, resubmits: yoon.resubmits, rejectRate: Number(yoon.rejectRate.toFixed(1)), payLabel: yoon.payLabel },
    previewChecks: {
      monthPicker: document.getElementById('praReportMonth')?.value === '2026-08' && prcAdminFrom === '2026-08' && prcAdminTo === '2026-08' && prcAdminPreset === 'month',
      monthPickerLabel: (document.querySelector('.pra-month-picker')?.textContent || '').includes('다운로드할 리캡 월') && (document.querySelector('.pra-month-picker')?.textContent || '').includes('현재 선택 · 2026년 8월'),
      monthDownloadLabel: (document.querySelector('.pra-download')?.textContent || '').includes('2026년 8월 팀 전체자료 PPT 다운로드'),
      latestCompletedPayMonth: prcLatestPayMonth('2026-09-02') === '2026-08',
      cover: preview.includes('26년 8월 Recap'),
      weeks: ['W1', 'W2', 'W3', 'W4'].every((v) => preview.includes(v)),
      formula: preview.includes('리젝률은 성과제 주차만') && preview.includes('(리젝−리섭)÷세일즈'),
      netSales: preview.includes('Net 세일즈'),
      remainingBond: preview.includes('잔여본드') && preview.includes('₩1,000'),
      distinctTrend: preview.includes('주차별 현황'),
      distinctTypes: ['주차별 세일즈', '주차별 리젝', '주차별 실제 인컴'].every((v) => preview.includes(v)),
      naturalTitles: !['세일즈 · 막대', '리젝 · 선', '꺾은선/영역', '지표별 독립 축'].some(v=>preview.includes(v)),
      incomeOneLine: [...document.querySelectorAll('.pra-mini-line text.income-value')].length > 0 && [...document.querySelectorAll('.pra-mini-line text.income-value')].every((el) => !/[\r\n]/.test(el.textContent) && el.getAttribute('style')?.includes('white-space:nowrap')),
      joinOrderLabel: preview.includes('입사일 순'),
      memberAvg: [...document.querySelectorAll('#m-recap .pra-table thead th')].some((el) => el.textContent.trim() === 'AVG') && preview.includes('AVG=세일즈÷필드일(NA 제외·0건 포함)') && [...document.querySelectorAll('#m-recap .pra-table td.avg')].some((el) => el.textContent.trim() === '3.50'),
      payColumnRemoved: ![...document.querySelectorAll('#m-recap .pra-table thead th')].some((el) => el.textContent.trim() === '급여'),
      productivitySlide: preview.includes('실인컴과 리젝') && preview.includes('실제 인컴') && preview.includes('CL · 클라이언트') && preview.includes('SW · 세일즈웍스'),
      simplifiedProductivity: (() => { const slide=document.querySelector('#m-recap .pra-income-reject-slide'); return !!slide && slide.textContent.includes('총 리젝률') && slide.textContent.includes('Net 세일즈') && !slide.textContent.includes('Gross Sales'); })(),
      bondRemovedFromRing: !document.querySelector('#m-recap .pra-story-donut svg')?.textContent.includes('본드'),
      lossWithoutBondCalculation: preview.includes('리젝 손실액') && preview.includes('(본드에서 우선차감)') && preview.includes('₩440,000') && preview.includes('순리젝 4건 × ₩110,000'),
      oneCompositeRing: document.querySelectorAll('#m-recap .pra-story-donut').length === 1 && document.querySelectorAll('#m-recap .pra-story-donut svg').length === 1,
      referenceTheme: getComputedStyle(document.querySelector('#m-recap .pra-slide')).backgroundColor === 'rgb(239, 248, 255)' && getComputedStyle(document.querySelector('#m-recap .pra-title'),'::before').content.includes('['),
      referenceDonutColors: ['#5aa4eb','#6d67c7','#3c439c'].every((color) => document.querySelector('#m-recap .pra-story-donut')?.innerHTML.toLowerCase().includes(color)),
      performanceOnlyRejects: preview.includes('리젝률은 성과제 주차만'),
      typoRemoved: !preview.includes('리실'),
    },
    chartCount: document.querySelectorAll('#m-recap .pra-chart').length,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
  };
});
await page.screenshot({ path: '/tmp/presence-recap-month-desktop.png', fullPage: false });
await page.locator('#m-recap .pra-slide').last().screenshot({ path: '/tmp/presence-recap-member-avg-detail.png' });
await page.locator('#m-recap .pra-income-reject-slide').screenshot({ path: '/tmp/presence-recap-reference-donut.png' });

await page.setViewportSize({ width: 1024, height: 768 });
await page.waitForTimeout(100);
const tablet = await page.evaluate(() => ({
  horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
  chartCount: document.querySelectorAll('#m-recap .pra-chart').length,
  chartsInsideViewport: [...document.querySelectorAll('#m-recap .pra-chart')].every((el) => { const r = el.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; }),
}));
await page.screenshot({ path: '/tmp/presence-recap-month-tablet.png', fullPage: false });

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(100);
const phone = await page.evaluate(() => {
  const tableWrap = document.querySelector('#m-recap .pra-table-wrap');
  const controls = [...document.querySelectorAll('#m-recap .pra-month-picker input,#m-recap .pra-controls button,#m-recap .pra-controls input,#m-recap .pra-controls select')].filter((el) => getComputedStyle(el).display !== 'none');
  return {
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    tableScrollable: !!tableWrap && tableWrap.scrollWidth > tableWrap.clientWidth,
    chartCount: document.querySelectorAll('#m-recap .pra-chart').length,
    undersized: controls.map((el) => ({ label: el.textContent.trim() || el.getAttribute('aria-label'), h: Math.round(el.getBoundingClientRect().height) })).filter((x) => x.h < 44),
  };
});
await page.screenshot({ path: '/tmp/presence-recap-month-phone.png', fullPage: false });

const leaderPhone = await page.evaluate(async () => {
  const leader = state.users['qa-a'];
  me = leader;
  profitRecapPayDate = '2026-07-31';
  document.querySelectorAll('.mpanel').forEach((panel) => panel.classList.remove('active'));
  document.getElementById('m-profitrecap')?.classList.add('active');
  renderProfitRecap();
  const hourlyButton = document.querySelector('#m-profitrecap [data-pay-type="hourly"]');
  const performanceButton = document.querySelector('#m-profitrecap [data-pay-type="performance"]');
  const perf = document.getElementById('prcPerformanceFields');
  const first = {
    hourlyPressed: hourlyButton?.getAttribute('aria-pressed'),
    performancePressed: performanceButton?.getAttribute('aria-pressed'),
    performanceHidden: !!perf?.hidden,
    note: document.getElementById('prcPayTypeNote')?.textContent || '',
    label: document.querySelector('label[for="prcNet"]')?.textContent || '',
  };
  document.getElementById('prcNet').value = '123456';
  await saveProfitRecap();
  const saved = state.weeklyProfitRecaps['2026-07-31']['qa-a'];
  prcSetPayType('performance');
  const switched = {
    performanceHidden: !!document.getElementById('prcPerformanceFields')?.hidden,
    performancePressed: document.querySelector('#m-profitrecap [data-pay-type="performance"]')?.getAttribute('aria-pressed'),
  };
  const controls = [...document.querySelectorAll('#m-profitrecap .prc-paytype button,#m-profitrecap input,#m-profitrecap .prc-save')].filter((el) => getComputedStyle(el).display !== 'none' && !el.closest('[hidden]'));
  return {
    first,
    switched,
    saved: { payType: saved?.payType, netPayment: saved?.netPayment, hourlyPay: saved?.hourlyPay, rejectCLCount: saved?.rejectCLCount, rejectSWCount: saved?.rejectSWCount, bondBalance: saved?.bondBalance, bep: saved?.bep },
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    undersized: controls.map((el) => ({ label: el.textContent.trim() || el.getAttribute('aria-label'), h: Math.round(el.getBoundingClientRect().height) })).filter((x) => x.h < 44),
  };
});

const managerPhone = await page.evaluate(async () => {
  const manager = state.users['qa-a'];
  state.managers = [manager.name];
  me = manager;
  profitRecapTargetUid = 'qa-b';
  profitRecapPayDate = '2026-08-14';
  window.__qaRecapWrites = [];
  document.querySelectorAll('.mpanel').forEach((panel) => panel.classList.remove('active'));
  document.getElementById('m-profitrecap')?.classList.add('active');
  renderProfitRecap();
  const before = {
    manager: isManager(me),
    canManage: canManageTeamRecords(me),
    selected: document.getElementById('prcTargetUid')?.value || '',
    targetText: document.querySelector('#m-profitrecap .prc-target')?.textContent || '',
    net: document.getElementById('prcNet')?.value || '',
  };
  document.getElementById('prcNet').value = '777';
  await saveProfitRecap();
  const controls = [...document.querySelectorAll('#m-profitrecap .prc-target select,#m-profitrecap input,#m-profitrecap button')].filter((el) => getComputedStyle(el).display !== 'none' && !el.closest('[hidden]') && el.getBoundingClientRect().height > 0);
  const undersized = controls.map((el) => ({ label: el.textContent.trim() || el.getAttribute('aria-label'), h: Math.round(el.getBoundingClientRect().height) })).filter((x) => x.h < 44);
  document.querySelectorAll('.mpanel').forEach((panel) => panel.classList.remove('active'));
  document.getElementById('m-recap')?.classList.add('active');
  renderProfitRecapAdminView();
  const saved = state.weeklyProfitRecaps['2026-08-14']['qa-b'];
  return {
    before,
    saved: { uid: saved?.uid, name: saved?.name, netPayment: saved?.netPayment, updatedBy: saved?.updatedBy },
    paths: window.__qaRecapWrites.map((x) => x.path),
    adminPreview: (document.getElementById('profitRecapAdminView')?.textContent || '').includes('팀 전체'),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    undersized,
  };
});

await page.setViewportSize({ width: 1440, height: 900 });
await page.evaluate(() => {
  me = state.users.admin;
  const pptIncome = [1937346, 2040035, 2541542, 4382067];
  ['2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28'].forEach((pay, index) => {
    if (state.weeklyProfitRecaps[pay]?.['qa-a']) state.weeklyProfitRecaps[pay]['qa-a'].netPayment = pptIncome[index];
    if (state.weeklyProfitRecaps[pay]?.['qa-b']) state.weeklyProfitRecaps[pay]['qa-b'].netPayment = 0;
  });
  document.querySelectorAll('.mpanel').forEach((panel) => panel.classList.remove('active'));
  document.getElementById('m-recap')?.classList.add('active');
  renderProfitRecapAdminView();
});
// Exercise the same pinned 3.12 runtime as production by default, not an unrelated installed version.
if (pptxBundle) await page.addScriptTag({ path: pptxBundle });
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
const report = await page.evaluate(async bytes => {
  const zip = await JSZip.loadAsync(new Uint8Array(bytes));
  const paths=Object.keys(zip.files).filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a,b)=>Number(a.match(/slide(\d+)/)[1])-Number(b.match(/slide(\d+)/)[1]));
  const slides=await Promise.all(paths.map(p=>zip.file(p).async('string')));
  const detail=slides.slice(3).join('');
  return {slideCount:slides.length,month:slides[0]?.includes('26년 8월 Recap')&&slides[0]?.includes('2026.08'),brand:[...slides].every((slide)=>slide.includes('Presence')),weekly:slides[1]?.includes('주차별 현황'),reject:slides[2]?.includes('리젝 손실액')&&slides[2]?.includes('Net 세일즈'),detail:detail.includes('팀원별 상세 세일즈')&&['AVG','3.50','AVG=세일즈÷필드일(NA 제외·0건 포함)','W1','W2','W3','W4','황혜진','윤채영','잔여본드'].every(t=>detail.includes(t)),theme:[...slides].every((slide)=>slide.includes('EFF8FF'))};
}, Array.from(await readFile(output)));

const expectedPays = ['2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28'];
const failures = [];
if(report.slideCount!==4||!report.month||!report.brand||!report.weekly||!report.reject||!report.detail||!report.theme)failures.push('Selected month, reference theme, visible brand, weekly charts, member AVG, or detail slides are missing from the full report');
if (JSON.stringify(desktop.pays) !== JSON.stringify(expectedPays)) failures.push('August pay dates are not W1-W4 Fridays');
if (JSON.stringify(desktop.rowOrder) !== JSON.stringify(['황혜진', '윤채영'])) failures.push('Recap members are not ordered by entry date');
if (desktop.productivity.unit !== 110000 || desktop.productivity.fieldDays !== 9 || desktop.productivity.sales !== 24 || desktop.productivity.actualIncome !== 1260 || desktop.productivity.netCL !== 3 || desktop.productivity.netSW !== 1 || desktop.productivity.retained !== 20 || desktop.productivity.grossValue !== 2640000 || desktop.productivity.retainedValue !== 2200000 || desktop.productivity.rejectValue !== 440000 || Number(desktop.productivity.rejectPctOfSales.toFixed(1)) !== 16.7 || Number(desktop.productivity.clPctOfSales.toFixed(1)) !== 12.5 || Number(desktop.productivity.swPctOfSales.toFixed(1)) !== 4.2 || Math.abs(desktop.productivity.modelPctTotal-100) > 0.000001) failures.push('Gross Sales, Reject Loss, Actual Income, or CL/SW one-ring breakdown is incorrect');
if (desktop.period.from !== '2026-07-27' || desktop.period.to !== '2026-08-23') failures.push('Payroll activity period is incorrect');
if (JSON.stringify(desktop.weeklySales) !== JSON.stringify([3, 5, 7, 9])) failures.push('Weekly sales aggregation is incorrect');
if (JSON.stringify(desktop.weeklyRejects) !== JSON.stringify([1, 2, 2, 0])) failures.push('Weekly reject aggregation is incorrect');
if (JSON.stringify(desktop.weeklyIncome) !== JSON.stringify([150, 260, 370, 480])) failures.push('Weekly net income aggregation is incorrect');
if (desktop.totals.sales !== 24 || desktop.totals.fieldDays !== 9 || desktop.totals.income !== 1260 || desktop.totals.bond !== 2000 || desktop.totals.rejects !== 5 || desktop.totals.resubmits !== 1 || desktop.totals.netSales !== 20 || Number(desktop.totals.avg.toFixed(2)) !== 2.67) failures.push('Team totals, bond, or explicit zero-day field count are incorrect');
if (!desktop.yoon || desktop.yoon.sales !== 14 || desktop.yoon.fieldDays !== 4 || desktop.yoon.avg !== 3.5 || desktop.yoon.income !== 1000 || desktop.yoon.bond !== 1000 || desktop.yoon.rejects !== 4 || desktop.yoon.resubmits !== 1 || desktop.yoon.rejectRate !== 21.4 || JSON.stringify(desktop.yoon.weekly) !== JSON.stringify([2, 3, 4, 5])) failures.push('Member AVG, bond, reject-rate, or weekly calculations are incorrect');
if (desktop.totals.hourlyWeeks !== 1 || desktop.totals.performanceWeeks !== 7) failures.push('Hourly/performance recap counts are incorrect');
if (Object.values(desktop.previewChecks).some((v) => !v) || desktop.chartCount !== 3) failures.push('Preview does not match requested presentation-grade donut structure');
if (desktop.horizontalOverflow || tablet.horizontalOverflow || tablet.chartCount !== 3 || !tablet.chartsInsideViewport || phone.horizontalOverflow || phone.chartCount !== 3 || !phone.tableScrollable || phone.undersized.length) failures.push('Responsive layout gate failed');
if (leaderPhone.first.hourlyPressed !== 'true' || leaderPhone.first.performancePressed !== 'false' || !leaderPhone.first.performanceHidden || !leaderPhone.first.note.includes('급여 금액만') || !leaderPhone.first.label.includes('시급 급여') || leaderPhone.switched.performanceHidden || leaderPhone.switched.performancePressed !== 'true' || leaderPhone.saved.payType !== 'hourly' || leaderPhone.saved.netPayment !== 123456 || leaderPhone.saved.hourlyPay !== 123456 || leaderPhone.saved.rejectCLCount !== 0 || leaderPhone.saved.rejectSWCount !== 0 || leaderPhone.saved.bondBalance !== 0 || leaderPhone.saved.bep !== 0 || leaderPhone.horizontalOverflow || leaderPhone.undersized.length) failures.push('Mobile hourly/performance recap editor gate failed');
if (!managerPhone.before.manager || !managerPhone.before.canManage || managerPhone.before.selected !== 'qa-b' || !managerPhone.before.targetText.includes('황혜진') || managerPhone.saved.uid !== 'qa-b' || managerPhone.saved.name !== '황혜진' || managerPhone.saved.netPayment !== 777 || managerPhone.saved.updatedBy !== 'qa-a' || !managerPhone.paths.includes('weeklyProfitRecaps/2026-08-14/qa-b') || !managerPhone.paths.includes('weeklyProfitRecapsPrivate/qa-b/2026-08-14') || !managerPhone.adminPreview || managerPhone.horizontalOverflow || managerPhone.undersized.length) failures.push('Manager team-member recap edit gate failed');
if (pptxStat.size < 25000) failures.push('Generated PPTX is unexpectedly small');
if (!download.suggestedFilename().startsWith('Presence_2026-08_2026-08_')) failures.push('Selected report month is not reflected in the PPT filename');
if (errors.length) failures.push('Browser page errors occurred');

await browser.close();
console.log(JSON.stringify({ desktop, tablet, phone, leaderPhone, managerPhone, report, pptx: { output, bytes: pptxStat.size, suggestedFilename: download.suggestedFilename() }, errors, consoleErrors, failures }, null, 2));
if (failures.length) process.exit(1);
