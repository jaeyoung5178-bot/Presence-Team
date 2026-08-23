import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:8765';
const fixtures = [
  { name: 'phone-member', width: 390, height: 844, role: 'IC', survey: 'IC', user: '모바일회원' },
  { name: 'tablet-leader', width: 1024, height: 768, role: 'LR', survey: 'LR', user: '태블릿리더' },
  { name: 'desktop-admin', width: 1440, height: 900, role: 'AOP', survey: 'TL', user: '임재영' },
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
  await page.goto(`${baseUrl}/?qa=promotion-auth-${fixture.name}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(700);
  await page.evaluate((f) => {
    window.eval(`me={uid:'qa-${f.role}',name:'${f.user}',id:'qa-${f.role}',role:'${f.role}',status:'active',surveys:{}}`);
    window.eval(`authState={view:'survey',draft:null,surveyKey:'${f.survey}',surveyCtx:'gate',sel:{}}`);
    document.getElementById('app')?.classList.add('hidden');
    const gate = document.getElementById('authGate');
    gate?.classList.remove('hidden');
    gate?.setAttribute('aria-hidden', 'false');
    window.renderAuth();
  }, fixture);
  await page.waitForTimeout(100);
  const report = await page.evaluate(() => {
    const card = document.querySelector('#authGate .auth-card');
    const button = document.getElementById('surveySubmitBtn');
    const rect = card.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const firstInteractive = document.querySelector('#svForm input, #svForm textarea, #svForm .opt');
    const firstRect = firstInteractive?.getBoundingClientRect();
    return {
      title: document.querySelector('#authView .auth-h')?.textContent?.trim() || '',
      gateVisible: getComputedStyle(document.getElementById('authGate')).display !== 'none',
      cardInsideViewport: rect.left >= -1 && rect.right <= innerWidth + 1,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      submitTarget: { width: Math.round(buttonRect.width), height: Math.round(buttonRect.height) },
      firstTargetHeight: Math.round(firstRect?.height || 0),
      updateGuarded: window._updSafe() === false,
    };
  });
  report.fixture = fixture.name;
  report.errors = errors;
  reports.push(report);
  if (!report.title || !report.gateVisible || !report.cardInsideViewport || report.horizontalOverflow || report.submitTarget.height < 44 || report.firstTargetHeight < 44 || !report.updateGuarded || errors.length) failures.push(report);
  await page.screenshot({ path: `/tmp/presence-promotion-auth-${fixture.name}.png`, fullPage: false });
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ reports, failures }, null, 2));
if (failures.length) process.exit(1);
