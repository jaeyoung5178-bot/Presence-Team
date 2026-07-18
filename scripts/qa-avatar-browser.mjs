import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
];
const failures = [];
const reports = [];
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(baseUrl) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    return route.abort();
  });
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const value = msg.text();
    if (value.includes('Failed to load resource: net::ERR_FAILED')) return;
    errors.push(value);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/?v=avatar-responsive-${viewport.name}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    window.__adminOff = false;
    window.eval("me={uid:'admin',name:'임재영',role:'AOP',status:'active',test:true}");
    window.eval("state.petProfiles={'admin':{color:'sun',feather:'legacy-spike',equipped:{prop:'prop_tube_0'},updatedAt:2}}");
    if (typeof window.renderPetShop === 'function') window.renderPetShop();
    if (typeof window.buildRail === 'function') window.buildRail();
    const lobby = document.getElementById('presenceEntryLobby');
    const loader = document.getElementById('presenceGameLoader');
    const auth = document.getElementById('authGate');
    if (lobby) lobby.classList.remove('show');
    if (loader) loader.classList.remove('show', 'complete');
    if (auth) auth.classList.add('hidden');
    document.body.classList.add('app-on');
    const panel = document.getElementById('m-petshop');
    if (panel) {
      document.body.appendChild(panel);
      panel.classList.add('active');
      panel.style.cssText = 'display:block!important;visibility:visible!important;position:relative!important;';
    }
  });
  await page.waitForTimeout(900);
  const report = await page.evaluate(() => {
    const host = document.querySelector('#m-petshop .ps-shell');
    const stage = document.querySelector('#asStage .presence-game-pet');
    const images = [...document.querySelectorAll('#m-petshop img')];
    const admin = document.querySelector('[data-group="admin"]');
    return {
      owner: window.__PRESENCE_AVATAR_STUDIO_SINGLE_OWNER === true,
      studio: host && host.dataset.avatarStudio,
      stagePresent: !!stage,
      basePresent: !!(stage && stage.querySelector('.pgp-base,.pgp-master')),
      forbiddenTone: !!(stage && stage.querySelector('.pgp-tone')),
      forbiddenProp: !!(stage && stage.querySelector('.pgp-prop')),
      brokenImages: images.filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.getAttribute('src')),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      adminVisible: !!(admin && getComputedStyle(admin).display !== 'none'),
    };
  });
  const screenshot = `/tmp/presence-avatar-${viewport.name}.png`;
  await page.locator('#m-petshop').screenshot({ path: screenshot, timeout: 10000 });
  reports.push({ viewport, report, errors, screenshot });
  if (!report.owner || report.studio !== '4' || !report.stagePresent || !report.basePresent || report.forbiddenTone || report.forbiddenProp || report.brokenImages.length || report.overflow || errors.length) {
    failures.push({ viewport, report, errors });
  }
  if (viewport.name === 'desktop' && !report.adminVisible) failures.push({ viewport, reason: 'Admin workspace is not visible for the founder fixture' });
  await page.close();
}

await browser.close();
if (failures.length) {
  console.error(JSON.stringify({ failures, reports }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ reports }, null, 2));
