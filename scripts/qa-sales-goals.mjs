import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.goto(`${baseUrl}/?qa=sales-goals`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.locator('#authGate:not(.hidden) .auth-card').waitFor({ state: 'visible', timeout: 20000 });

await page.evaluate(() => {
  window.__firebaseReady = true;
  window.showPresenceEntryLobby = () => false;
  window.__presenceEntryPass = true;
  const meUser = { uid: 'qa-goal', name: '목표테스터', id: 'goal', loginKey: 'goal', role: 'LR', status: 'active', surveys: {} };
  state.users = { 'qa-goal': meUser };
  state.managers = [];
  state.extraMembers = [];
  state.removedMembers = [];
  state.memberInfo = { '목표테스터': { join: '2026-01-01', left: null } };
  state.sales = {
    '2026-08-31|목표테스터': { date: '2026-08-31', name: '목표테스터', role: 'LR', count: 3, checked: true, t: 1 },
    '2026-09-01|목표테스터': { date: '2026-09-01', name: '목표테스터', role: 'LR', count: 2, checked: true, t: 1 },
    '2026-09-02|목표테스터': { date: '2026-09-02', name: '목표테스터', role: 'LR', count: 3, checked: true, t: 1 },
  };
  state.salesGoals = {};
  window.__qaGoalWrites = [];
  DB.set = async (path, value) => { window.__qaGoalWrites.push({ path, value }); };
  DB.update = async () => {};
  DB.get = async () => null;
  DB.on = () => () => {};
  me = meUser;
  continueLogin(meUser);
  saleEditDate = '2026-09-03';
  saleCalMonth = '2026-09';
  saleAdminTargetName = meUser.name;
  saleLoadDraft();
  document.querySelectorAll('.mpanel').forEach((panel) => panel.classList.remove('active'));
  document.getElementById('m-sale').classList.add('active');
  renderSales();
});

await page.evaluate(async () => {
  setSaleView('monthly');
  document.getElementById('saleGoalInput').value = '30';
  await saveSalesGoal();
});

const desktop = await page.evaluate(() => {
  const target = saleTargetUser();
  const plan = saleGoalPlan(target, '2026-09');
  setSaleView('weekly');
  const weeklyText = document.getElementById('saleWeeklyPanel').textContent;
  setSaleView('daily');
  saleDraft = 1;
  saleDraftNA = false;
  saleEditing = true;
  renderSaleEditor();
  return {
    tabs: ['Daily', 'Weekly', 'Monthly'].map((name) => document.getElementById(`saleTab${name}`)?.textContent.trim()),
    storedGoal: saleGoalValue('qa-goal', '2026-09'),
    plan: { goal: plan.goal, sales: plan.sales, days: plan.dates.length, targetSum: Object.values(plan.daily).reduce((a, b) => a + b, 0), weekTargetSum: plan.weeks.reduce((a, w) => a + w.target, 0) },
    weeklyText,
    weeklyDays: [...document.querySelectorAll('#saleWeeklyPanel .sale-daily-card')].map((el) => ({
      date: el.querySelector('span')?.textContent.trim(),
      value: el.querySelector('b')?.textContent.trim(),
    })),
    daily: {
      now: document.getElementById('saleDailyGoalNow')?.textContent,
      target: document.getElementById('saleDailyGoalTarget')?.textContent,
      pct: document.getElementById('saleDailyGoalPct')?.textContent,
      width: document.getElementById('saleDailyGoalFill')?.style.width,
    },
    paths: window.__qaGoalWrites.map((x) => x.path),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
  };
});
await page.evaluate(() => setSaleView('weekly'));
await page.screenshot({ path: '/tmp/presence-sales-week-boundary-desktop.png', fullPage: false });

await page.setViewportSize({ width: 1024, height: 768 });
await page.evaluate(() => setSaleView('weekly'));
await page.waitForTimeout(100);
const tablet = await page.evaluate(() => ({
  horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
  dayCount: document.querySelectorAll('#saleWeeklyPanel .sale-daily-card').length,
  text: document.getElementById('saleWeeklyPanel').textContent,
}));

await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => setSaleView('monthly'));
await page.waitForTimeout(100);
const phone = await page.evaluate(() => ({
  horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
  buttons: [...document.querySelectorAll('.sale-mini-tabs button,.sale-goal-editor button')].map((el) => ({ text: el.textContent.trim(), height: Math.round(el.getBoundingClientRect().height) })),
  monthVisible: !document.getElementById('saleMonthlyPanel').hidden,
}));
await page.screenshot({ path: '/tmp/presence-sales-goals-phone.png', fullPage: false });
await page.evaluate(() => setSaleView('weekly'));
await page.waitForTimeout(100);
const phoneWeekly = await page.evaluate(() => ({
  horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
  dayCount: document.querySelectorAll('#saleWeeklyPanel .sale-daily-card').length,
  text: document.getElementById('saleWeeklyPanel').textContent,
}));
await page.screenshot({ path: '/tmp/presence-sales-week-boundary-phone.png', fullPage: false });

const failures = [];
const rules = JSON.parse(await readFile(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;
if (JSON.stringify(desktop.tabs) !== JSON.stringify(['데일리', '위클리', '먼슬리'])) failures.push('Sales mini tabs are missing');
if (desktop.storedGoal !== 30 || desktop.plan.goal !== 30 || desktop.plan.sales !== 5 || desktop.plan.days !== 30 || desktop.plan.targetSum !== 30 || desktop.plan.weekTargetSum !== 30) failures.push('Monthly goal or automatic weekly/daily distribution is incorrect');
if (!desktop.weeklyText.includes('위클리 목표') || !desktop.weeklyText.includes('월–일 7일 기준') || !desktop.weeklyText.includes('현재 세일즈8건') || desktop.weeklyDays.length !== 7 || desktop.weeklyDays[0].date !== '08.31' || desktop.weeklyDays[0].value !== '3 / 0') failures.push('Cross-month Monday sales are missing from the Monday-Sunday weekly total');
if (desktop.daily.now !== '1' || desktop.daily.target !== '1' || desktop.daily.pct !== '100%' || desktop.daily.width !== '100%') failures.push('Live daily goal gauge did not update from the draft');
if (!desktop.paths.includes('salesGoals/qa-goal/2026-09')) failures.push('Monthly goal was not saved to the expected scoped path');
if (!rules.salesGoals?.$uid?.['.write']?.includes('managerAccess') || !rules.salesGoals?.$uid?.$month?.['.validate']?.includes("child('goal')")) failures.push('Sales goal database permissions or validation are missing');
if (desktop.horizontalOverflow || tablet.horizontalOverflow || tablet.dayCount !== 7 || !tablet.text.includes('현재 세일즈8건') || phone.horizontalOverflow || !phone.monthVisible || phone.buttons.some((x) => x.height < 44) || phoneWeekly.horizontalOverflow || phoneWeekly.dayCount !== 7 || !phoneWeekly.text.includes('현재 세일즈8건')) failures.push('Sales goal responsive gate failed');
if (errors.length) failures.push('Browser page errors occurred');

await browser.close();
console.log(JSON.stringify({ desktop, tablet, phone, phoneWeekly, errors, failures }, null, 2));
if (failures.length) process.exit(1);
