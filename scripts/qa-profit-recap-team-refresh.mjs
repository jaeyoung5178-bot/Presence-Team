import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.route(/(firebaseio\.com|firebasedatabase\.app|identitytoolkit|securetoken|gstatic\.com\/firebasejs|googleapis\.com\/(?!css))/, (route) => route.abort());
await page.goto(`${baseUrl}/?qa=profit-recap-team-refresh`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.locator('#authGate:not(.hidden) .auth-card').waitFor({ state: 'visible', timeout: 20000 });

const initial = await page.evaluate(() => {
  window.__firebaseReady = true;
  window.__adminOff = false;
  window.__previewRole = null;
  const leader = { uid: 'umqn54ujf', name: '고윤경', id: 'fuse', role: 'TL', status: 'active', surveys: {} };
  const member = { uid: 'umqon3e0p', name: '권영웅', id: 'hero', role: 'LR', status: 'active', surveys: {} };
  me = leader;
  state.users = { [leader.uid]: leader, [member.uid]: member };
  state.managers = ['고윤경'];
  state.recapStudioAccess = { uid: leader.uid, active: true, scope: 'team', teamKey: 'fuse' };
  window.__recapStudioAuthAccess = state.recapStudioAccess;
  state.recapStudioTeams = {};
  state.recapStudioTeamKey = 'fuse';
  state.recapStudioTeam = null;
  state.recapStudioError = '';
  state.weeklyProfitRecaps = {};
  state.profitMonthlyBep = {};
  profitRecapPayDate = '2026-10-02';
  profitRecapTargetUid = '';
  curTab = 'profitrecap';
  document.querySelectorAll('.mpanel').forEach((panel) => panel.classList.remove('active'));
  document.getElementById('m-profitrecap')?.classList.add('active');
  renderProfitRecap();
  const text = document.getElementById('profitRecapBody')?.textContent || '';
  return { text, hasLiveStatus: !!document.querySelector('#profitRecapBody [role="status"][aria-live="polite"]') };
});

const emptyMirror = await page.evaluate(() => {
  state.recapStudioTeam = { roster: {}, weekly: {}, bep: {} };
  recapStudioRefresh();
  const text = document.getElementById('profitRecapBody')?.textContent || '';
  return {
    text,
    selected: document.getElementById('prcTargetUid')?.value || '',
    options: [...document.querySelectorAll('#prcTargetUid option')].map((option) => option.textContent.trim()),
    stillEmpty: text.includes('수정할 활성 리더가 없어요'),
    stillLoading: text.includes('불러오는 중'),
  };
});

const after = await page.evaluate(() => {
  const interval = (uid, name, role) => ({ uid, name, role, activeFrom: '2026-01-01', assignmentId: `qa-${uid}` });
  state.recapStudioTeam = {
    roster: {
      umqn54ujf: { uid: 'umqn54ujf', name: '고윤경', role: 'TL', intervals: { 'qa-umqn54ujf': interval('umqn54ujf', '고윤경', 'TL') } },
      umqon3e0p: { uid: 'umqon3e0p', name: '권영웅', role: 'LR', intervals: { 'qa-umqon3e0p': interval('umqon3e0p', '권영웅', 'LR') } },
    },
    weekly: {},
    bep: {},
  };
  recapStudioRefresh();
  const text = document.getElementById('profitRecapBody')?.textContent || '';
  return {
    text,
    selected: document.getElementById('prcTargetUid')?.value || '',
    options: [...document.querySelectorAll('#prcTargetUid option')].map((option) => option.textContent.trim()),
    stillEmpty: text.includes('수정할 활성 리더가 없어요'),
    stillLoading: text.includes('불러오는 중'),
  };
});

const rankings = await page.evaluate(() => {
  const previous = state.memberInfo;
  state.memberInfo = {
    고경력A: { join: '2025-01-01' }, 고경력B: { join: '2025-02-01' }, 고경력C: { join: '2025-03-01' },
    저경력A: { join: '2025-04-01' }, 저경력B: { join: '2025-05-01' }, 저경력C: { join: '2025-06-30' },
    저표본: { join: '2025-01-01' }, 신입고리젝: { join: '2026-08-01' },
  };
  const rows = [
    { name: '고경력A', sales: 40, rejects: 20, resubmits: 0 },
    { name: '고경력B', sales: 30, rejects: 12, resubmits: 0 },
    { name: '고경력C', sales: 25, rejects: 8, resubmits: 0 },
    { name: '저경력A', sales: 40, rejects: 2, resubmits: 0 },
    { name: '저경력B', sales: 22, rejects: 2, resubmits: 0 },
    { name: '저경력C', sales: 20, rejects: 3, resubmits: 0 },
    { name: '저표본', sales: 10, rejects: 0, resubmits: 0 },
    { name: '신입고리젝', sales: 40, rejects: 40, resubmits: 0 },
  ];
  const data = { period: { from: '2026-09-01', to: '2026-09-30' }, rows, records: [], totals: { sales: 227, rejects: 87, resubmits: 11, income: 0, fieldDays: 0 } };
  const result = prcProductivityInsights(data);
  const html = prcProductivityHTML(data);
  state.memberInfo = previous;
  return {
    high: result.highestRanks.map((row) => row.name),
    low: result.lowestRanks.map((row) => row.name),
    highCount: result.highestRanks.length,
    lowCount: result.lowestRanks.length,
    hasHighTitle: html.includes('리젝률 높은 TOP 3'),
    hasLowTitle: html.includes('리젝률 낮은 TOP 3'),
    hasSimpleResub: html.includes('리섭 비율') && !html.includes('리섭 현황'),
    leaksRecipientDetail: html.includes('누가받은') || html.includes('해당 없음'),
  };
});

const responsive = {};
for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 1024, 768], ['phone', 390, 844]]) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(60);
  responsive[name] = await page.evaluate(() => {
    const controls = [...document.querySelectorAll('#m-profitrecap button,#m-profitrecap input,#m-profitrecap select')]
      .filter((el) => getComputedStyle(el).display !== 'none' && !el.closest('[hidden]') && el.getBoundingClientRect().height > 0);
    return {
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      undersized: controls.map((el) => ({ label: el.textContent.trim() || el.getAttribute('aria-label'), height: Math.round(el.getBoundingClientRect().height) })).filter((item) => item.height < 44),
    };
  });
}

const failures = [];
if (!initial.text.includes('팀 리캡 데이터를 불러오는 중이에요') || initial.text.includes('수정할 활성 리더가 없어요') || !initial.hasLiveStatus) failures.push('pending team snapshot is not represented as an accessible loading state');
if (emptyMirror.selected !== 'umqn54ujf' || emptyMirror.stillEmpty || emptyMirror.stillLoading || !emptyMirror.text.includes('고윤경') || !emptyMirror.options.some((label) => label.includes('권영웅'))) failures.push('empty or partial FUSE mirror hid the reviewed weekly recap roster');
if (after.selected !== 'umqn54ujf' || after.stillEmpty || after.stillLoading || !after.text.includes('고윤경') || !after.options.some((label) => label.includes('권영웅'))) failures.push('team snapshot arrival did not refresh the FUSE weekly recap editor');
if (rankings.highCount !== 3 || rankings.lowCount !== 3 || JSON.stringify(rankings.high) !== JSON.stringify(['고경력A','고경력B','고경력C']) || JSON.stringify(rankings.low) !== JSON.stringify(['저경력A','저경력B','저경력C']) || !rankings.hasHighTitle || !rankings.hasLowTitle || !rankings.hasSimpleResub || rankings.leaksRecipientDetail) failures.push('three-month TOP 3 reject-rate ranking rules failed');
for (const [name, result] of Object.entries(responsive)) if (result.overflow || result.undersized.length) failures.push(`${name} responsive gate failed`);
if (errors.length) failures.push('browser page errors occurred');

await browser.close();
console.log(JSON.stringify({ initial, emptyMirror, after, rankings, responsive, errors, failures }, null, 2));
if (failures.length) process.exit(1);
