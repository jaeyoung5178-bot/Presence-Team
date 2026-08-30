import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const viewports = [
  { name: 'phone-admin', width: 390, height: 844 },
  { name: 'tablet-admin', width: 1024, height: 768 },
  { name: 'desktop-admin', width: 1440, height: 900 },
];
const expectedTomorrow = ['유승민','손예진','문승현','권영웅','민병준','이수민','김남경'];
const expectedCounts = [7,12,14,16,15,5,3];
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const reports = [];
const failures = [];

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()); });
  await page.addInitScript(() => localStorage.clear());
  await page.goto(`${baseUrl}/?qa=setup-roster-${viewport.name}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#authGate:not(.hidden) .auth-card').waitFor({ state: 'visible', timeout: 20000 });
  await page.evaluate(() => {
    window.__firebaseReady = true;
    window.showPresenceEntryLobby = () => false;
    window.__presenceEntryPass = true;
    window.__adminOff = false;
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
    date.value = '2026-08-31';
    date.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#m-setupkit [data-sk="roster"]')?.click();
    document.querySelectorAll('.modal.on').forEach((modal) => modal.classList.remove('on'));
    const loader = document.getElementById('presenceGameLoader');
    if (loader) { loader.classList.remove('show', 'complete'); loader.style.pointerEvents = 'none'; }
  });
  await page.locator('#skPlanGrid .sk-plan-day').first().waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(150);
  const report = await page.evaluate(({ expectedTomorrow, expectedCounts }) => {
    const schedule = JSON.parse(localStorage.getItem('pd_setup_schedule') || '{}');
    const allDaily = JSON.parse(localStorage.getItem('pd_daily_by_date') || '{}');
    const tomorrow = allDaily['2026-08-31'] || [];
    const names = tomorrow.filter((item) => item.on !== false).map((item) => item.name);
    const cards = [...document.querySelectorAll('#skPlanGrid .sk-plan-day')];
    const buttons = [...document.querySelectorAll('#skTomorrow,#m-setupkit .sk-sub button,#m-setupkit .sk-page.on button')].filter((el) => el.getBoundingClientRect().height > 0);
    const rosterOrder = JSON.parse(localStorage.getItem('pd_weekly') || '[]');
    const roleAccess = {
      member: canSetupKit({ uid: 'member', name: '멤버', role: 'IC', status: 'active' }),
      leader: canSetupKit({ uid: 'leader', name: '리더', role: 'LR', status: 'active' }),
      founder: canSetupKit(me),
    };
    return {
      cardCount: cards.length,
      counts: Object.keys(schedule).sort().map((ds) => schedule[ds].length),
      tomorrowNames: names,
      tomorrowAllRows: tomorrow.length,
      weeklyCount: rosterOrder.length,
      weeklyFirst: rosterOrder.slice(0, 5),
      threePerLine: [...document.querySelectorAll('#skPlanGrid .sk-plan-names')].every((pre) => pre.textContent.split('\n').every((line) => line.trim().split(/\s{2,}/).filter(Boolean).length <= 3)),
      copyText: cards[0]?.querySelector('.sk-plan-names')?.textContent || '',
      roleAccess,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      clippedCards: cards.filter((el) => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).length,
      undersizedButtons: innerWidth <= 1024 ? buttons.map((el) => ({ label: el.textContent.trim(), h: Math.round(el.getBoundingClientRect().height) })).filter((x) => x.h < 44) : [],
      expectedTomorrow,
      expectedCounts,
    };
  }, { expectedTomorrow, expectedCounts });
  report.errors = errors;
  reports.push({ viewport, ...report });
  await page.screenshot({ path: `/tmp/presence-setup-roster-${viewport.name}.png`, fullPage: false });
  const bad = report.cardCount !== 7 || JSON.stringify(report.counts) !== JSON.stringify(expectedCounts) || JSON.stringify(report.tomorrowNames) !== JSON.stringify(expectedTomorrow) || report.tomorrowAllRows !== 21 || report.weeklyCount !== 21 || !report.threePerLine || report.horizontalOverflow || report.clippedCards || report.undersizedButtons.length || report.roleAccess.member || report.roleAccess.leader || !report.roleAccess.founder || errors.length;
  if (bad) failures.push({ viewport, ...report });
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ reports, failures }, null, 2));
if (failures.length) process.exit(1);
