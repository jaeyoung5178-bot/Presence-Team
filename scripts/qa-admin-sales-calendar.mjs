import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const fixtures = [
  { name: 'phone-member', width: 390, height: 844, uid: 'qa-sale-ic', user: '모바일회원', role: 'IC' },
  { name: 'tablet-leader', width: 1024, height: 768, uid: 'qa-sale-lr', user: '태블릿리더', role: 'LR' },
  { name: 'desktop-admin', width: 1440, height: 900, uid: 'admin', user: '임재영', role: 'AOP', admin: true },
];

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const reports = [];
const failures = [];

for (const fixture of fixtures) {
  const page = await browser.newPage({ viewport: fixture, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/?qa=admin-sales-calendar-${fixture.name}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#authGate:not(.hidden) .auth-card').waitFor({ state: 'visible', timeout: 20000 });

  await page.evaluate((f) => {
    window.__firebaseReady = true;
    window.showPresenceEntryLobby = () => false;
    window.__presenceEntryPass = true;
    window.__adminOff = false;
    window.__previewRole = null;
    const current = { uid: f.uid, name: f.user, id: `id-${f.name}`, loginKey: `id-${f.name}`, role: f.role, status: 'active', surveys: { [f.role]: { answers: { qa: 'done' }, t: Date.now() } } };
    const target = { uid: 'qa-yoon', name: '윤채영', id: 'ilv0815', loginKey: 'ilv0815', role: 'TL', status: 'active', surveys: {} };
    state.users = { [current.uid]: current, ...(f.admin ? { [target.uid]: target } : {}) };
    state.extraMembers = [];
    state.removedMembers = [];
    state.promotionSurveys = {};
    state.sales = {
      [`2026-08-25|${current.name}`]: { name: current.name, role: current.role, date: '2026-08-25', count: 9, t: 1 },
      '2026-08-25|윤채영': { name: '윤채영', role: 'TL', date: '2026-08-25', count: 4, t: 2 },
      '2026-08-26|윤채영': { name: '윤채영', role: 'TL', date: '2026-08-26', count: 0, na: true, t: 3 },
    };
    window.__qaDbWrites = [];
    window.__qaSheetWrites = [];
    DB.set = async (path, value) => { window.__qaDbWrites.push({ path, value }); };
    DB.update = async () => {};
    DB.get = async () => null;
    DB.tx = async (_path, fn) => ({ committed: true, snapshot: fn(null) });
    window.autoSyncCell = () => {};
    window.sendSaleToSheet = (value) => { window.__qaSheetWrites.push(value); };
    me = current;
    continueLogin(current);
    goTab('sale');
    const loader = document.getElementById('presenceGameLoader');
    if (loader) { loader.classList.remove('show', 'complete'); loader.style.pointerEvents = 'none'; }
    document.querySelectorAll('.modal.on').forEach((modal) => modal.classList.remove('on'));
  }, fixture);
  await page.waitForTimeout(160);

  let report;
  if (!fixture.admin) {
    report = await page.evaluate(() => {
      const card = document.getElementById('adminSaleEdit');
      const context = document.querySelector('.sale-cal-context')?.textContent || '';
      return {
        adminCardHidden: !card || getComputedStyle(card).display === 'none',
        ownCalendar: context.includes(me.name) && context.includes('내 기록'),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        errors: [],
      };
    });
  } else {
    await page.locator('#aseUser').selectOption({ label: '윤채영 · TL' });
    await page.locator('#aseDate').fill('2026-08-25');
    await page.evaluate(() => aseSelectUser());
    await page.waitForTimeout(80);
    const selected = await page.evaluate(() => ({
      selectedUser: document.getElementById('aseUser')?.value,
      selectedDate: document.getElementById('aseDate')?.value,
      adminCount: document.getElementById('aseCount')?.value,
      context: document.querySelector('.sale-cal-context')?.textContent || '',
      who: document.getElementById('saleWho')?.textContent || '',
      calendarLabel: document.getElementById('saleCalendar')?.getAttribute('aria-label') || '',
      selectedDayText: document.querySelector('.sale-cal-days button.sel')?.textContent || '',
    }));

    await page.evaluate(() => {
      salePickDate('2026-08-25');
      adjSale(1);
      document.querySelectorAll('.modal.on').forEach((modal) => modal.classList.remove('on'));
      const loader = document.getElementById('presenceGameLoader');
      if (loader) { loader.classList.remove('show', 'complete'); loader.style.pointerEvents = 'none'; }
    });
    await page.locator('#saleDone').click();
    await page.waitForTimeout(100);
    const saved = await page.evaluate(() => ({
      targetCount: state.sales['2026-08-25|윤채영']?.count,
      adminCount: state.sales['2026-08-25|임재영']?.count,
      dbPath: window.__qaDbWrites.at(-1)?.path || '',
      dbName: window.__qaDbWrites.at(-1)?.value?.name || '',
      sheetName: window.__qaSheetWrites.at(-1)?.name || '',
    }));

    await page.evaluate(() => salePickDate('2026-08-26'));
    await page.waitForTimeout(60);
    const na = await page.evaluate(() => ({
      countText: document.getElementById('saleCount')?.textContent || '',
      naPressed: document.getElementById('saleNA')?.getAttribute('aria-pressed'),
      adminCount: document.getElementById('aseCount')?.value,
      selectedDate: document.getElementById('aseDate')?.value,
    }));
    const geometry = await page.evaluate(() => {
      const visible = (el) => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden'; };
      const targets = [...document.querySelectorAll('#adminSaleEdit button,#adminSaleEdit input,#adminSaleEdit select,.sale-cal-head button,.sale-cal-days button:not(.blank),.sale-stepper button,#saleDone')].filter(visible);
      const undersized = targets.map((el) => { const r = el.getBoundingClientRect(); return { label: el.getAttribute('aria-label') || el.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((r) => r.w < 44 || r.h < 44);
      return { horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1, undersized };
    });
    report = { selected, saved, na, geometry, errors };
  }

  reports.push({ fixture: fixture.name, ...report, errors });
  const failed = fixture.admin
    ? report.selected.selectedUser !== '윤채영' || report.selected.selectedDate !== '2026-08-25' || report.selected.adminCount !== '4' || !report.selected.context.includes('윤채영 · TL 세일즈 달력') || !report.selected.context.includes('관리자 편집 중') || !report.selected.who.includes('윤채영 · TL') || !report.selected.calendarLabel.includes('윤채영 TL') || !report.selected.selectedDayText.includes('4건') || report.saved.targetCount !== 5 || report.saved.adminCount !== 9 || !report.saved.dbPath.includes('sales/2026-08-25/') || report.saved.dbName !== '윤채영' || report.saved.sheetName !== '윤채영' || report.na.countText !== 'NA' || report.na.naPressed !== 'true' || report.na.adminCount !== '0' || report.na.selectedDate !== '2026-08-26' || report.geometry.horizontalOverflow || report.geometry.undersized.length || errors.length
    : !report.adminCardHidden || !report.ownCalendar || report.horizontalOverflow || errors.length;
  if (failed) failures.push({ fixture: fixture.name, ...report, errors });
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ reports, failures }, null, 2));
if (failures.length) process.exit(1);
