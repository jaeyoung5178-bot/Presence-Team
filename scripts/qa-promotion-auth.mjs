import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const fixtures = [
  { name: 'phone-member', width: 390, height: 844, role: 'LR', survey: 'LR', user: '모바일회원', admin: false },
  { name: 'tablet-leader', width: 1024, height: 768, role: 'TL', survey: 'TL', user: '태블릿리더', admin: false },
  { name: 'desktop-admin', width: 1440, height: 900, role: 'AOP', survey: 'TL', user: '임재영', admin: true },
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
  await page.goto(`${baseUrl}/?qa=promotion-invite-${fixture.name}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#authGate:not(.hidden) .auth-card').waitFor({ state: 'visible', timeout: 20000 });

  const loginResult = await page.evaluate((f) => {
    DB.set = async () => {};
    DB.update = async () => {};
    DB.get = async () => null;
    DB.tx = async (_path, fn) => ({ committed: true, snapshot: fn(null) });
    DB.updatePromotionAccount = async () => {};
    window.showPresenceEntryLobby = () => false;
    window.__presenceEntryPass = true;
    const current = {
      uid: f.admin ? 'admin' : `qa-${f.role}`,
      name: f.user,
      id: f.admin ? 'admin-qa' : `qa-${f.role}`,
      role: f.role,
      status: 'active',
      surveys: f.admin ? { TL: { answers: { qa: 'done' }, t: Date.now() } } : {},
    };
    const target = f.admin ? { uid: 'qa-target', name: '승진대상자', id: 'qa-target', role: f.survey, status: 'active', surveys: {} } : current;
    const invite = { uid: target.uid, name: target.name, role: target.role, surveyKey: f.survey, token: `qatoken${f.name.replace(/-/g, '')}123456`, status: 'pending', createdAt: Date.now(), createdBy: 'admin', completedAt: 0 };
    state.users = { [current.uid]: current, [target.uid]: target };
    state.promotionSurveys = { [target.uid]: { [f.survey]: invite } };
    me = current;
    continueLogin(current);
    const app = document.getElementById('app');
    const gate = document.getElementById('authGate');
    const result = {
      loginAllowed: !!app && !app.classList.contains('hidden') && document.body.classList.contains('app-on'),
      gateHiddenAfterLogin: !!gate && gate.classList.contains('hidden'),
      invite,
    };
    document.querySelectorAll('.modal.on').forEach((el) => el.classList.remove('on'));
    showPromotionInfo(invite, f.admin ? 'admin' : 'target');
    return result;
  }, fixture);

  await page.waitForTimeout(150);
  const popupReport = await page.evaluate(() => {
    const modal = document.getElementById('promotionSurveyModal');
    const box = modal.querySelector('.promo-survey-box');
    const rect = box.getBoundingClientRect();
    const buttons = [...box.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().height));
    return {
      popupVisible: modal.classList.contains('on'),
      title: document.getElementById('promotionSurveyTitle')?.textContent?.trim() || '',
      boxInsideViewport: rect.left >= -1 && rect.right <= innerWidth + 1,
      boxRect: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), viewport: innerWidth },
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      buttonMinHeight: buttons.length ? Math.min(...buttons) : 0,
      linkVisible: !!document.getElementById('promotionSurveyLinkInput'),
    };
  });

  let formReport = { notTarget: fixture.admin };
  if (!fixture.admin) {
    await page.getByRole('button', { name: '설문 참여하기' }).click();
    await page.waitForTimeout(80);
    formReport = await page.evaluate(() => {
      const card = document.querySelector('#authGate .auth-card');
      const submit = document.getElementById('surveySubmitBtn');
      const rect = card.getBoundingClientRect();
      const submitRect = submit.getBoundingClientRect();
      const first = document.querySelector('#svForm input, #svForm textarea, #svForm .opt');
      const firstRect = first?.getBoundingClientRect();
      return {
        promotionContext: authState.surveyCtx === 'promotion',
        appStillLoggedIn: document.body.classList.contains('app-on') && !document.getElementById('app').classList.contains('hidden'),
        formInsideViewport: rect.left >= -1 && rect.right <= innerWidth + 1,
        submitTargetHeight: Math.round(submitRect.height),
        firstTargetHeight: Math.round(firstRect?.height || 0),
        hasLaterButton: [...document.querySelectorAll('#authView button')].some((b) => b.textContent.includes('나중에 작성')),
      };
    });
  }

  let completionReport = null;
  if (fixture.name === 'phone-member') {
    await page.evaluate(() => {
      document.querySelectorAll('#svForm input.svtext').forEach((el) => { el.value = el.type === 'date' ? '2026-08-27' : (el.inputMode === 'numeric' ? '010-1234-5678' : 'qa@example.com'); });
      document.querySelectorAll('#svForm textarea').forEach((el) => { el.value = '승진 설문 화면 검수 응답입니다.'; });
      document.querySelectorAll('#svForm .opts').forEach((wrap) => { const first = wrap.querySelector('.opt'); if (first) first.click(); });
    });
    await page.getByRole('button', { name: '설문 제출하기' }).click();
    await page.waitForTimeout(120);
    completionReport = await page.evaluate(() => ({
      completionPopup: document.getElementById('promotionSurveyModal').classList.contains('on') && document.getElementById('promotionSurveyTitle')?.textContent.includes('완료되었어요'),
      loginStillAllowed: document.body.classList.contains('app-on') && !document.getElementById('app').classList.contains('hidden'),
      status: state.promotionSurveys[me.uid]?.LR?.status,
      surveySaved: !!me.surveys?.LR?.answers && Object.keys(me.surveys.LR.answers).length > 0,
    }));
  }

  const report = { fixture: fixture.name, loginResult, popupReport, formReport, completionReport, errors };
  reports.push(report);
  const failed = !loginResult.loginAllowed || !loginResult.gateHiddenAfterLogin || !popupReport.popupVisible || !popupReport.title || !popupReport.boxInsideViewport || popupReport.horizontalOverflow || popupReport.buttonMinHeight < 42 || !popupReport.linkVisible || errors.length || (!fixture.admin && (!formReport.promotionContext || !formReport.appStillLoggedIn || !formReport.formInsideViewport || formReport.submitTargetHeight < 44 || formReport.firstTargetHeight < 44 || !formReport.hasLaterButton)) || (completionReport && (!completionReport.completionPopup || !completionReport.loginStillAllowed || completionReport.status !== 'completed' || !completionReport.surveySaved));
  if (failed) failures.push(report);
  await page.screenshot({ path: `/tmp/presence-promotion-invite-${fixture.name}.png`, fullPage: false });
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ reports, failures }, null, 2));
if (failures.length) process.exit(1);
