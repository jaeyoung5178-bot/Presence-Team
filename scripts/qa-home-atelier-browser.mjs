import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const cases = [
  { name: 'mobile-member', width: 390, height: 844, uid: 'qa-member', role: 'IC', founder: false },
  { name: 'tablet-leader', width: 1024, height: 768, uid: 'qa-leader', role: 'LR', founder: false },
  { name: 'desktop-admin', width: 1440, height: 900, uid: 'admin', role: 'AOP', founder: true },
];
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const failures = [];
const reports = [];

for (const fixture of cases) {
  const page = await browser.newPage({ viewport: { width: fixture.width, height: fixture.height }, deviceScaleFactor: 1 });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(baseUrl) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    return route.abort();
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const value = message.text();
    if (value.includes('Failed to load resource: net::ERR_FAILED')) return;
    errors.push(value);
  });
  await page.goto(`${baseUrl}/?qaUser=${fixture.founder ? 'admin' : fixture.role === 'LR' ? 'leader' : 'member'}&v=atelier-qa`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForTimeout(700);
  await page.evaluate((user) => {
    window.__adminOff = false;
    window.eval(`me={uid:${JSON.stringify(user.uid)},name:${JSON.stringify(user.founder ? '임재영' : user.role === 'LR' ? '고윤경' : '김수민')},id:${JSON.stringify(user.uid)},role:${JSON.stringify(user.role)},status:'active',test:true}`);
    window.eval("state=state||{}");
    window.eval("state.users=state.users||{}");
    window.eval(`state.users[${JSON.stringify(user.uid)}]=me`);
    window.eval("state.waters=state.waters||{}");
    window.eval("state.callbackProfiles=state.callbackProfiles||{}");
    window.eval("state.pr=Number(state.pr)||18");
    const lobby = document.getElementById('presenceEntryLobby');
    const loader = document.getElementById('presenceGameLoader');
    const auth = document.getElementById('authGate');
    const app = document.getElementById('app');
    const home = document.getElementById('m-home');
    if (lobby) lobby.classList.remove('show');
    if (loader) loader.classList.remove('show', 'complete');
    if (auth) auth.classList.add('hidden');
    if (app) app.classList.remove('hidden');
    document.body.classList.add('app-on');
    if (typeof window.goTab === 'function') window.goTab('home');
    if (home) {
      home.classList.add('active');
      home.style.cssText = 'display:block!important;visibility:visible!important;position:relative!important;';
    }
    if (typeof window.renderPresenceAtelierHome === 'function') window.renderPresenceAtelierHome();
    if (window.PresenceHomeTreePremium) window.PresenceHomeTreePremium.refresh();
  }, fixture);
  await page.waitForTimeout(1100);
  const report = await page.evaluate((founder) => {
    const scene = document.getElementById('homeSceneSec');
    const tree = document.getElementById('treeSecHome');
    const card = document.getElementById('homeAtelierCard');
    const dock = document.getElementById('homeQuickDock');
    const sceneRect = scene && scene.getBoundingClientRect();
    const broken = [...document.querySelectorAll('#homeSceneSec img')]
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.getAttribute('src'));
    const uniqueIds = ['homeSceneSec', 'treeSecHome', 'treeSvg', 'waterBtn', 'homeQuickDock']
      .every((id) => document.querySelectorAll(`#${id}`).length === 1);
    return {
      bodyMode: document.body.classList.contains('presence-atelier-home'),
      scene: !!scene,
      treeParent: !!(tree && tree.parentElement === card),
      dockParent: !!(dock && dock.parentElement && dock.parentElement.id === 'homeAtelierQuickslotHost'),
      premiumTree: !!document.querySelector('#treeSvg[data-premium-tree]'),
      companionCount: document.querySelectorAll('#treeSecHome .atelier-waterer').length,
      founderSummary: !!document.querySelector('[data-founder-only="true"]'),
      founderExpected: founder,
      uniqueIds,
      broken,
      sceneOverflow: !!(scene && scene.scrollWidth > scene.clientWidth + 1),
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      width: sceneRect && Math.round(sceneRect.width),
    };
  }, fixture.founder);
  const screenshot = `/tmp/presence-home-atelier-${fixture.name}.png`;
  await page.locator('#m-home').screenshot({ path: screenshot, fullPage: true, timeout: 20000 });
  reports.push({ fixture, report, errors, screenshot });
  if (!report.bodyMode || !report.scene || !report.treeParent || !report.dockParent || !report.premiumTree ||
      report.companionCount !== 1 || report.founderSummary !== fixture.founder || !report.uniqueIds ||
      report.broken.length || report.sceneOverflow || report.pageOverflow || errors.length) {
    failures.push({ fixture, report, errors });
  }
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ reports, failures }, null, 2));
if (failures.length) process.exit(1);
