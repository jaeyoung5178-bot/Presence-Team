import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const fixtures = [
  { name: 'phone-member', width: 390, height: 844, uid: 'qa-login-ic', user: '로그인회원', role: 'IC' },
  { name: 'tablet-leader', width: 1024, height: 768, uid: 'qa-login-lr', user: '로그인리더', role: 'LR' },
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
  await page.goto(`${baseUrl}/?qa=login-reliability-${fixture.name}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#authGate:not(.hidden) .auth-card').waitFor({ state: 'visible', timeout: 20000 });

  await page.evaluate((f) => {
    window.__firebaseReady = true;
    window.showPresenceEntryLobby = () => false;
    window.__presenceEntryPass = true;
    window.__adminOff = false;
    window.__previewRole = null;
    const current = { uid: f.uid, name: f.user, id: `id-${f.name}`, loginKey: `id-${f.name}`, role: f.role, status: 'active', surveys: f.role === 'IC' ? { IC: { answers: { firstField: '2026-08-01' }, t: Date.now() } } : {} };
    const target = { uid: 'qa-promotion-target', name: '승급테스트봇', id: 'qa-promotion-target', loginKey: 'qa-promotion-target', role: 'IC', status: 'active', surveys: { IC: { answers: { firstField: '2026-08-01' }, t: Date.now() } } };
    state.users = { [current.uid]: current, ...(f.admin ? { [target.uid]: target } : {}) };
    state.extraMembers = f.admin ? [target.name] : [];
    state.promotionSurveys = {};
    DB.set = async () => {};
    DB.update = async () => {};
    DB.get = async () => null;
    DB.tx = async (_path, fn) => ({ committed: true, snapshot: fn(null) });
    DB.logout = async () => {};
    DB.updatePromotionAccount = async () => {};
    DB.login = async () => { await new Promise((resolve) => setTimeout(resolve, 35)); return current; };
    goLogin();
  }, fixture);

  await page.locator('#liId').fill(`id-${fixture.name}`);
  await page.locator('#liPw').fill('fixture-password');
  await page.locator('#loginSubmitBtn').click();
  await page.waitForTimeout(180);

  const loginReport = await page.evaluate(() => {
    const button = document.getElementById('loginSubmitBtn');
    const app = document.getElementById('app');
    const gate = document.getElementById('authGate');
    return {
      entered: document.body.classList.contains('app-on') && !app.classList.contains('hidden'),
      gateHidden: gate.classList.contains('hidden'),
      loginUnlocked: !loginInFlight && (!button || !button.disabled),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });

  let promotionReport = null;
  if (fixture.admin) {
    promotionReport = await page.evaluate(async () => {
      const admin = me;
      const target = state.users['qa-promotion-target'];
      await changeRole(target.uid, 'LR');
      const invite = state.promotionSurveys[target.uid]?.LR;
      const promotionState = { role: target.role, inviteStatus: invite?.status, inviteToken: invite?.token || '' };
      me = target;
      window.__presenceEntryPass = true;
      continueLogin(target);
      const targetEntered = document.body.classList.contains('app-on') && document.getElementById('authGate').classList.contains('hidden');
      const surveyDidNotGate = authState.view !== 'survey';
      me = admin;
      return { ...promotionState, targetEntered, surveyDidNotGate };
    });
  }

  const report = { fixture: fixture.name, loginReport, promotionReport, errors };
  const failed = !loginReport.entered || !loginReport.gateHidden || !loginReport.loginUnlocked || loginReport.horizontalOverflow || errors.length || (promotionReport && (promotionReport.role !== 'LR' || promotionReport.inviteStatus !== 'pending' || promotionReport.inviteToken.length < 12 || !promotionReport.targetEntered || !promotionReport.surveyDidNotGate));
  reports.push(report);
  if (failed) failures.push(report);
  await page.close();
}

const recoveryPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const recoveryErrors = [];
recoveryPage.on('pageerror', (error) => recoveryErrors.push(error.message));
await recoveryPage.goto(`${baseUrl}/?qa=login-recovery-error`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await recoveryPage.locator('#authGate:not(.hidden) .auth-card').waitFor({ state: 'visible', timeout: 20000 });
await recoveryPage.evaluate(() => {
  window.__firebaseReady = true;
  DB.cancelLogin = () => {};
  DB.login = async () => { const error = new Error('simulated timeout'); error.code = 'network/timeout'; throw error; };
  goLogin();
});
await recoveryPage.locator('#liId').fill('retry-user');
await recoveryPage.locator('#liPw').fill('retry-password');
await recoveryPage.locator('#loginSubmitBtn').click();
await recoveryPage.waitForTimeout(100);
const manualRecovery = await recoveryPage.evaluate(() => ({
  gateVisible: !document.getElementById('authGate').classList.contains('hidden'),
  buttonEnabled: !document.getElementById('loginSubmitBtn').disabled,
  idPreserved: document.getElementById('liId').value === 'retry-user',
  passwordPreserved: document.getElementById('liPw').value === 'retry-password',
  retryMessage: document.getElementById('authMsg').textContent.includes('다시 눌러 주세요'),
  loginUnlocked: !loginInFlight,
}));

const staleAutoSession = await recoveryPage.evaluate(async () => {
  lsSet('presence_remember', true);
  lsSet('presence_auth_policy', AUTH_POLICY_VERSION);
  lsSet('presence_lastauth', Date.now());
  lsSet('presence_sess', { uid: 'stale-user', t: Date.now() });
  DB.restoreSession = async () => { const error = new Error('stale restore'); error.code = 'network/timeout'; throw error; };
  DB.logout = () => new Promise(() => {});
  const started = performance.now();
  const restored = await tryAutoLogin();
  const durationMs = Math.round(performance.now() - started);
  renderAuth();
  return { restored, durationMs, sessionCleared: !lsGet('presence_sess'), gateVisible: !document.getElementById('authGate').classList.contains('hidden') };
});
const recoveryReport = { fixture: 'phone-recovery', manualRecovery, staleAutoSession, errors: recoveryErrors };
const recoveryFailed = !manualRecovery.gateVisible || !manualRecovery.buttonEnabled || !manualRecovery.idPreserved || !manualRecovery.passwordPreserved || !manualRecovery.retryMessage || !manualRecovery.loginUnlocked || staleAutoSession.restored !== false || !staleAutoSession.sessionCleared || !staleAutoSession.gateVisible || staleAutoSession.durationMs > 4500 || recoveryErrors.length;
reports.push(recoveryReport);
if (recoveryFailed) failures.push(recoveryReport);
await recoveryPage.close();

await browser.close();
console.log(JSON.stringify({ reports, failures }, null, 2));
if (failures.length) process.exit(1);
