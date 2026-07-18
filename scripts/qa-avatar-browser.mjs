import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (error) => errors.push(error.message));
await page.goto('http://127.0.0.1:4173/?qaUser=leader&v=avatar-p0', { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.evaluate(() => {
  window.me = { uid: 'qa-avatar', name: 'QA', role: 'LR', status: 'active', test: true };
  window.state = { petProfiles: { 'qa-avatar': {
    color: 'sun', feather: 'legacy-spike', equipped: { prop: 'prop_tube_0' }, updatedAt: 2,
  } } };
  if (typeof window.renderPetShop === 'function') window.renderPetShop();
  const panel = document.getElementById('m-petshop');
  if (panel) {
    document.body.appendChild(panel);
    panel.classList.add('active');
    panel.style.cssText = 'display:block!important;visibility:visible!important;position:relative!important;';
  }
});
await page.waitForTimeout(1200);
const report = await page.evaluate(() => {
  const host = document.querySelector('#m-petshop .ps-shell');
  const stage = document.querySelector('#asStage .presence-game-pet');
  const images = [...document.querySelectorAll('#m-petshop img')];
  return {
    owner: window.__PRESENCE_AVATAR_STUDIO_SINGLE_OWNER === true,
    studio: host && host.dataset.avatarStudio,
    stagePresent: !!stage,
    basePresent: !!(stage && stage.querySelector('.pgp-base,.pgp-master')),
    brokenImages: images.filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.getAttribute('src')),
  };
});
await page.locator('#m-petshop').screenshot({ path: '/tmp/presence-avatar-p0.png', timeout: 10000 });
await browser.close();
if (!report.owner || report.studio !== '3' || !report.stagePresent || !report.basePresent || report.brokenImages.length || errors.length) {
  console.error(JSON.stringify({ report, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ report, errors, screenshot: '/tmp/presence-avatar-p0.png' }, null, 2));
