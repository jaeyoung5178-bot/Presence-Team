import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const cases = [
  { name: 'phone-member', width: 390, height: 844, role: 'IC', founder: false },
  { name: 'tablet-leader', width: 1024, height: 768, role: 'LR', founder: false },
  { name: 'desktop-admin', width: 1440, height: 900, role: 'AOP', founder: true },
];

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const failures = [];
const reports = [];

for (const fixture of cases) {
  const page = await browser.newPage({ viewport: fixture, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text());
  });
  await page.goto(`${baseUrl}/?qaUser=${fixture.founder ? 'admin' : fixture.role === 'LR' ? 'leader' : 'member'}&v=approved-world`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForTimeout(650);
  const login = await page.evaluate(() => ({
    visible: getComputedStyle(document.getElementById('authGate')).display !== 'none',
    title: getComputedStyle(document.querySelector('#authGate > .auth-card'), '::before').content,
    background: getComputedStyle(document.getElementById('authGate')).backgroundImage,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  await page.screenshot({ path: `/tmp/presence-approved-login-${fixture.name}.png`, fullPage: false });

  await page.evaluate((user) => {
    window.__adminOff = false;
    window.eval(`me={uid:'qa',name:'${user.founder ? '임재영' : user.role === 'LR' ? '고윤경' : '김수민'}',id:'qa',role:'${user.role}',status:'active',test:true}`);
    window.eval('state=state||{}');
    const auth = document.getElementById('authGate');
    const app = document.getElementById('app');
    if (auth) auth.classList.add('hidden');
    if (app) app.classList.remove('hidden');
    document.body.classList.add('app-on');
    if (typeof window.goTab === 'function') window.goTab('home');
    window.openPresenceVillageWorld();
  }, fixture);
  await page.waitForTimeout(450);
  const village = await page.evaluate(() => {
    const world = document.getElementById('presenceVillageWorld');
    const rect = world.getBoundingClientRect();
    return {
      visible: !world.hidden && getComputedStyle(world).display !== 'none',
      width: Math.round(rect.width), height: Math.round(rect.height),
      farmer: world.querySelector('.pv-profile-copy b')?.textContent || '',
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      background: getComputedStyle(world).backgroundImage,
      adminVisible: [...world.querySelectorAll('[data-admin="true"]')].some((node) => !node.hidden),
    };
  });
  await page.screenshot({ path: `/tmp/presence-approved-village-${fixture.name}.png`, fullPage: false });

  await page.evaluate(() => window.openPresenceTreeWorld());
  await page.waitForTimeout(300);
  const tree = await page.evaluate(() => {
    const world = document.getElementById('presenceTreeWorld');
    const rect = world.getBoundingClientRect();
    return { visible: !world.hidden, width: Math.round(rect.width), height: Math.round(rect.height), background: getComputedStyle(world).backgroundImage };
  });
  await page.screenshot({ path: `/tmp/presence-approved-tree-${fixture.name}.png`, fullPage: false });

  await page.evaluate(() => { window.closePresenceTreeWorld(); window.openApprovedAtelier(); });
  await page.waitForTimeout(450);
  const atelier = await page.evaluate(() => {
    const world = document.getElementById('presenceAvatarAtelierWorld');
    const rect = world?.getBoundingClientRect();
    const broken = [...document.querySelectorAll('#presenceAvatarAtelierWorld img')].filter((img) => img.complete && !img.naturalWidth).map((img) => img.src);
    return { visible: !!world && !world.hidden, width: Math.round(rect?.width || 0), height: Math.round(rect?.height || 0), broken };
  });
  await page.screenshot({ path: `/tmp/presence-approved-atelier-${fixture.name}.png`, fullPage: false });

  const report = { fixture, login, village, tree, atelier, errors };
  reports.push(report);
  if (!login.visible || !login.title.includes('Work Book') || login.overflow || !village.visible || village.width !== fixture.width || village.height !== fixture.height || village.overflow || !village.background.includes('village-dashboard-approved') || village.adminVisible !== fixture.founder || !tree.visible || !tree.background.includes('home-tree-approved') || !atelier.visible || atelier.broken.length || errors.length) failures.push(report);
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ reports, failures }, null, 2));
if (failures.length) process.exit(1);
