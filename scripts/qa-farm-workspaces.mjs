import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
];
const tabs = ['today', 'teamtree', 'manual', 'sale', 'admin'];
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const reports = [];
const failures = [];

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
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
  await page.goto(`${baseUrl}/?qaUser=admin&v=farm-workspace-qa`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.__adminOff = false;
    window.eval("me={uid:'admin',name:'임재영',id:'admin',role:'AOP',status:'active',test:true}");
    window.eval('state=state||{}');
    window.eval('state.users=state.users||{}');
    window.eval("state.users.admin=me");
    const lobby = document.getElementById('presenceEntryLobby');
    const loader = document.getElementById('presenceGameLoader');
    const auth = document.getElementById('authGate');
    const app = document.getElementById('app');
    if (lobby) lobby.classList.remove('show');
    if (loader) loader.classList.remove('show', 'complete');
    if (auth) auth.classList.add('hidden');
    if (app) app.classList.remove('hidden');
    document.body.classList.add('app-on');
    if (typeof window.buildRail === 'function') window.buildRail();
  });

  for (const tab of tabs) {
    await page.evaluate((name) => {
      if (typeof window.goTab === 'function') window.goTab(name);
    }, tab);
    await page.waitForTimeout(350);
    const report = await page.evaluate((name) => {
      const panel = document.getElementById(`m-${name}`);
      const rect = panel && panel.getBoundingClientRect();
      const broken = panel ? [...panel.querySelectorAll('img')]
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.getAttribute('src')) : [];
      const interactiveTooSmall = panel ? [...panel.querySelectorAll('button:not([hidden]),a:not([hidden]),input:not([type="hidden"]),select,textarea')]
        .filter((element) => {
          const style = getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && (box.width < 32 || box.height < 32);
        }).length : 0;
      return {
        tab: name,
        active: !!(panel && panel.classList.contains('active')),
        visible: !!(rect && rect.width > 0 && rect.height > 0),
        authHidden: getComputedStyle(document.getElementById('authGate')).display === 'none',
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        panelOverflow: !!(panel && panel.scrollWidth > panel.clientWidth + 1),
        broken,
        interactiveTooSmall,
      };
    }, tab);
    const screenshot = `/tmp/presence-farm-${viewport.name}-${tab}.png`;
    await page.screenshot({ path: screenshot, fullPage: false });
    reports.push({ viewport, report, screenshot });
    if (!report.active || !report.visible || !report.authHidden || report.pageOverflow || report.panelOverflow || report.broken.length) {
      failures.push({ viewport, report });
    }
  }
  if (errors.length) failures.push({ viewport, errors });
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ reports, failures }, null, 2));
if (failures.length) process.exit(1);
