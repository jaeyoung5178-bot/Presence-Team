import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const viewports = [
  { name: 'phone-admin', width: 390, height: 844 },
  { name: 'tablet-admin', width: 1024, height: 768 },
  { name: 'desktop-admin', width: 1440, height: 900 },
];
const expectedCounts = [10, 12, 14, 13, 15, 5, 3];
const expectedMonday = ['임재영','고윤경','박인선','유승민','윤채영','김종훈','손예진','권영웅','민병준','이수민'];
const expectedMondayCopy = '9/7 필드인원\n\n재영 윤경 인선 승민 채영\n종훈 예진 영웅 병준 수민\n\n(10명)';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const reports = [];
const failures = [];

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()); });
  await page.addInitScript(() => localStorage.clear());
  await page.goto(`${baseUrl}/?qa=setup-weekday-${viewport.name}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#authGate:not(.hidden) .auth-card').waitFor({ state: 'visible', timeout: 20000 });
  await page.evaluate(() => {
    window.__firebaseReady = true;
    window.showPresenceEntryLobby = () => false;
    window.__presenceEntryPass = true;
    window.__adminOff = false;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value) => { window.__setupCopied = value; } } });
    const admin = { uid: FOUNDER.uid || 'admin', id: FOUNDER.id || 'presence', loginKey: FOUNDER.id || 'presence', name: FOUNDER.name || '임재영', role: 'AOP', status: 'active', surveys: {} };
    state.users = { [admin.uid]: admin };
    DB.set = async () => {};
    DB.update = async () => {};
    DB.get = async () => null;
    DB.on = () => () => {};
    me = admin;
    document.getElementById('authGate')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    document.body.classList.add('app-on');
    document.querySelectorAll('.mpanel').forEach((panel) => panel.classList.remove('active'));
    document.getElementById('m-setupkit')?.classList.add('active');
    renderSetupKit();
    const date = document.getElementById('skDate');
    date.value = '2026-09-07';
    date.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#m-setupkit [data-sk="byday"]')?.click();
    document.querySelectorAll('.modal.on').forEach((modal) => modal.classList.remove('on'));
    const loader = document.getElementById('presenceGameLoader');
    if (loader) { loader.classList.remove('show', 'complete'); loader.style.pointerEvents = 'none'; }
  });
  await page.locator('#skWeekdayGrid .sk-weekday-card').first().waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#skWeekdayGrid .sk-weekday-card').first().locator('[data-plan-copy]').click();
  await page.waitForTimeout(150);
  const report = await page.evaluate(({ expectedCounts, expectedMonday, expectedMondayCopy }) => {
    const schedule = JSON.parse(localStorage.getItem('pd_setup_schedule') || '{}');
    const allDaily = JSON.parse(localStorage.getItem('pd_daily_by_date') || '{}');
    const monday = allDaily['2026-09-07'] || [];
    const mondayNames = monday.filter((item) => item.on !== false).map((item) => item.name);
    const dates = Array.from({ length: 7 }, (_, index) => `2026-09-${String(7 + index).padStart(2, '0')}`);
    const cards = [...document.querySelectorAll('#skWeekdayGrid .sk-weekday-card')];
    const buttons = [...document.querySelectorAll('#skTomorrow,#m-setupkit .sk-sub button,#m-setupkit .sk-page.on button')].filter((el) => el.getBoundingClientRect().height > 0);
    const rosterOrder = JSON.parse(localStorage.getItem('pd_weekly') || '[]');
    const roleAccess = {
      member: canSetupKit({ uid: 'member', name: '멤버', role: 'IC', status: 'active' }),
      leaderWithoutPermission: canSetupKit({ uid: 'leader', name: '리더', role: 'LR', status: 'active' }),
      leaderWithPermission: canSetupKit({ uid: 'leader-sk', name: '리더', role: 'LR', status: 'active', sk: true }),
      founder: canSetupKit(me),
    };
    const copyTexts = cards.map((card) => card.querySelector('.sk-weekday-copy')?.textContent || '');
    const maxNamesPerLine = Math.max(...copyTexts.flatMap((text) => text.split('\n').filter((line) => /^[가-힣 ]+$/.test(line.trim())).map((line) => line.trim().split(/\s+/).length)));
    return {
      tabExists: Boolean(document.querySelector('[data-sk="byday"]')),
      tabActive: document.querySelector('[data-sk="byday"]')?.classList.contains('on') || false,
      cardCount: cards.length,
      counts: dates.map((ds) => (schedule[ds] || []).length),
      mondayNames,
      mondayAllRows: monday.length,
      mondayCardText: copyTexts[0],
      copiedText: window.__setupCopied || '',
      weeklyCount: rosterOrder.length,
      duplicateSumin: mondayNames.filter((name) => name === '이수민').length,
      maxNamesPerLine,
      roleAccess,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      clippedCards: cards.filter((el) => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).length,
      undersizedButtons: innerWidth <= 1024 ? buttons.map((el) => ({ label: el.textContent.trim(), h: Math.round(el.getBoundingClientRect().height) })).filter((x) => x.h < 44) : [],
      expectedCounts,
      expectedMonday,
      expectedMondayCopy,
    };
  }, { expectedCounts, expectedMonday, expectedMondayCopy });
  report.errors = errors;
  reports.push({ viewport, ...report });
  await page.screenshot({ path: `/tmp/presence-setup-weekday-${viewport.name}.png`, fullPage: true });
  const bad = !report.tabExists || !report.tabActive || report.cardCount !== 7 || JSON.stringify(report.counts) !== JSON.stringify(expectedCounts) || JSON.stringify(report.mondayNames) !== JSON.stringify(expectedMonday) || report.mondayAllRows !== 21 || report.mondayCardText !== expectedMondayCopy || report.copiedText !== expectedMondayCopy || report.weeklyCount !== 21 || report.duplicateSumin !== 1 || report.maxNamesPerLine > 5 || report.horizontalOverflow || report.clippedCards || report.undersizedButtons.length || report.roleAccess.member || report.roleAccess.leaderWithoutPermission || !report.roleAccess.leaderWithPermission || !report.roleAccess.founder || errors.length;
  if (bad) failures.push({ viewport, ...report });
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ reports, failures }, null, 2));
if (failures.length) process.exit(1);
