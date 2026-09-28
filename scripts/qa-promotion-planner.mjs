import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = (process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4177').replace(/\/$/, '');
const output = process.env.PRESENCE_QA_OUTPUT || '/Users/jaeyoung5178/Documents/ChatGPT/Presence Work Book/design-review/implemented/20260928-promotion-plan';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
await page.route(/(firebaseio\.com|firebasedatabase\.app|identitytoolkit|securetoken|gstatic\.com\/firebasejs|googleapis\.com\/(?!css))/, route => route.abort());

const users = {
  ic: { uid: 'ic', name: '일반팀원', id: 'ic', role: 'IC', status: 'active' },
  lr: { uid: 'lr', name: '서리더', id: 'lr', role: 'LR', status: 'active' },
  tl: { uid: 'tl', name: '팀리더', id: 'tl', role: 'TL', status: 'active' },
  admin: { uid: 'admin', name: '임재영', id: 'admin', role: 'AOP', status: 'active' },
  direct: { uid: 'direct', name: '직속리더', id: 'direct', role: 'LR', status: 'active' },
  nested: { uid: 'nested', name: '하위리더', id: 'nested', role: 'TL', status: 'active' },
  cousin: { uid: 'cousin', name: '다른팀리더', id: 'cousin', role: 'LR', status: 'active' },
  childIC: { uid: 'childIC', name: '하위팀원', id: 'childIC', role: 'IC', status: 'active' },
  inactive: { uid: 'inactive', name: '휴면리더', id: 'inactive', role: 'LR', status: 'inactive' },
};
const dossier = {
  서리더: { teamName: 'Fuse', upline: '임재영' },
  팀리더: { teamName: 'Fuse', upline: '임재영' },
  직속리더: { teamName: 'Fuse', upline: '서리더' },
  하위리더: { teamName: 'Fuse', upline: '직속리더' },
  다른팀리더: { teamName: 'Wave', upline: '임재영' },
  하위팀원: { teamName: 'Fuse', upline: '직속리더' },
  휴면리더: { teamName: 'Fuse', upline: '서리더' },
};

async function fixture(role, { plan = null, week = null, adminOff = true } = {}) {
  await page.evaluate(({ role, users, dossier, plan, week, adminOff }) => {
    window.PresenceWorkspace.dispose();
    window.__qaWrites = [];
    window.__qaFail = false;
    window.__qaWatch = new Map();
    window.__qaStore = { workspaceSelfPromotions: {} };
    const weekKey = window.PresencePromotionCore.weekKey(new Date());
    if (plan) window.__qaStore.workspaceSelfPromotions[role] = { plan, weeks: week ? { [weekKey]: week } : {} };
    const get = path => path.split('/').reduce((value, key) => value?.[key], window.__qaStore);
    DB.on = (path, callback) => {
      window.__qaWatch.set(path, callback);
      queueMicrotask(() => { if (window.__qaWatch.get(path) === callback) callback(structuredClone(get(path) || null)); });
      return () => window.__qaWatch.delete(path);
    };
    DB.set = async (path, value) => {
      if (window.__qaFail) throw new Error('연결이 끊겼습니다. 다시 시도해 주세요.');
      window.__qaWrites.push({ path, value: structuredClone(value) });
      const segments = path.split('/'); const last = segments.pop();
      let target = window.__qaStore;
      for (const segment of segments) target = target[segment] ||= {};
      target[last] = structuredClone(value);
      for (const [watched, callback] of window.__qaWatch) if (path === watched || path.startsWith(watched + '/')) callback(structuredClone(get(watched)));
    };
    DB.update = async (path, value) => DB.set(path, { ...(get(path) || {}), ...value });
    DB.get = async path => get(path) || null;
    window.__firebaseReady = true;
    window.__adminOff = adminOff;
    window.__previewRole = '';
    window.__presenceWorkspaceBaseReady = { users: true, sales: true };
    state.users = structuredClone(users);
    state.dossier = structuredClone(dossier);
    state.sales = {};
    state.extraMembers = [];
    state.removedMembers = [];
    state.memberInfo = {};
    me = state.users[role];
    document.getElementById('authGate')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    document.body.classList.add('app-on');
    document.querySelectorAll('#presenceGameLoader,#presenceEntryLobby,#presenceLoader').forEach(el => el.remove());
    buildRail(); goTab('learnhub'); window.PresenceWorkspace.render('learnhub');
  }, { role, users, dossier, plan, week, adminOff });
  await page.waitForTimeout(180);
  await page.evaluate(() => { window.__qaWrites = []; });
}

async function capture(name) {
  const selector = name.includes('home') ? '#ppHomeCard' : '#pwPersonalPromotion';
  const screenshotStyle = await page.addStyleTag({ content: '#app .botbar{visibility:hidden!important}' });
  await page.locator(selector).screenshot({ path: `${output}/${name}-card.png` });
  await screenshotStyle.evaluate(element => element.remove());
  await page.evaluate(selector => {
    const element = document.querySelector(selector);
    if (element) window.scrollTo({ top: Math.max(0, scrollY + element.getBoundingClientRect().top - 190), behavior: 'instant' });
  }, selector);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${output}/${name}.png` });
}
async function stateNow() {
  return page.evaluate(() => ({
    tab: curTab,
    progress: !!document.getElementById('pwPersonalPromotion'),
    home: !!document.getElementById('ppHomeCard'),
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    writes: window.__qaWrites || [],
  }));
}
async function checkGeometry(label) {
  const geometry = await page.evaluate(() => {
    const card = document.querySelector('#pwPersonalPromotion');
    const visible = element => { const style = getComputedStyle(element), box = element.getBoundingClientRect(); return style.display !== 'none' && style.visibility !== 'hidden' && box.width && box.height; };
    const controls = [...(card?.querySelectorAll('button,input,select') || [])].filter(visible).map(element => {
      const box = (element.type === 'checkbox' ? element.closest('label') : element).getBoundingClientRect();
      return { name: element.name || element.textContent.trim(), left: box.left, right: box.right, width: box.width, height: box.height };
    });
    return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, card: card?.getBoundingClientRect().toJSON(), controls };
  });
  assert.ok(geometry.scrollWidth <= geometry.width + 1, `${label}: page overflow ${JSON.stringify(geometry)}`);
  assert.ok(geometry.card.left >= -1 && geometry.card.right <= geometry.width + 1, `${label}: planner clipped`);
  assert.deepEqual(geometry.controls.filter(control => control.width < 43.5 || control.height < 43.5 || control.left < -1 || control.right > geometry.width + 1), [], `${label}: undersized/clipped controls`);
}
async function checkVisibleHeading(selector, label) {
  await page.waitForTimeout(420);
  const position = await page.evaluate(selector => {
    const element = document.querySelector(selector);
    const box = element?.getBoundingClientRect();
    const chrome = [...document.querySelectorAll('#app .top,#app #subRail')].filter(node => {
      const style = getComputedStyle(node);
      return style.display !== 'none' && (style.position === 'fixed' || style.position === 'sticky');
    });
    return { top: box?.top, bottom: box?.bottom, viewport: innerHeight, headerBottom: Math.max(0, ...chrome.map(node => node.getBoundingClientRect().bottom)) };
  }, selector);
  assert.ok(position.top >= position.headerBottom - 2 && position.top < position.viewport - 90, `${label}: heading hidden behind header or outside viewport ${JSON.stringify(position)}`);
}

try {
  await page.goto(`${base}/?qa=promotion-planner-${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.PresenceWorkspace && !!window.PresencePromotionPlanner && !!window.PresencePromotionCore);
  const today = await page.evaluate(() => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); });
  const due = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 90); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); });
  const basicPlan = { version: 1, targetRole: 'TL', startDate: today, due, targetFirstLeaders: 2, targetTotalLeaders: 2, baselineFirstLeaders: 1, baselineTotalLeaders: 2, homeReminder: false, guide: { bookings: 30, showups: 10, starters: 3, callsMin: 3, callsMax: 5 }, updatedBy: 'lr', updatedAt: Date.now() };
  for (const [role, width, height] of [['ic',390,844],['lr',360,800],['lr',390,844],['tl',1024,768],['admin',1440,900]]) {
    await page.setViewportSize({ width, height });
    await fixture(role);
    const view = await stateNow();
    assert.equal(view.progress, role !== 'ic', `${role}/${width} visibility`);
    assert.equal(view.overflow, false, `${role}/${width} overflow`);
    assert.deepEqual(view.writes, [], `${role}/${width} read-only initial view`);
    if (role !== 'ic') {
      await checkGeometry(`${role}/${width}`);
      assert.equal(await page.locator('#ppPlanForm').count(), 0, 'new plan starts compact');
      await page.locator('[data-pp-action=create-plan]').click();
      assert.equal(await page.locator('#ppPlanForm [name=homeReminder]').isChecked(), false, 'reminder defaults off');
      await checkGeometry(`${role}/${width} expanded`);
      if (role === 'lr' && width === 390) await capture('lr-390-plan-empty');
      if (role === 'tl') await capture('tl-1024-plan-empty');
      if (role === 'admin') await capture('admin-1440-plan-empty');
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await fixture('lr');
  await page.locator('[data-pp-action=create-plan]').click();
  assert.equal(await page.locator('#ppPlanForm [name=targetRole]').inputValue(), 'TL');
  await page.locator('#ppPlanForm [name=homeReminder]').check();
  await page.evaluate(() => window.PresenceWorkspace.schedule());
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#ppPlanForm [name=homeReminder]').isChecked(), true, 'unsaved reminder draft survives watch rerender');
  await page.locator('#ppPlanForm [name=homeReminder]').uncheck();
  await page.locator('#ppPlanForm [name=bookings]').fill('7');
  await page.evaluate(() => window.PresenceWorkspace.schedule());
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#ppPlanForm [name=bookings]').inputValue(), '7', 'unsaved draft survives watch rerender');
  await page.locator('#ppPlanForm [name=bookings]').fill('30');
  await page.locator('#ppPlanForm [name=callsMin]').fill('6');
  await page.locator('#ppPlanForm [name=callsMax]').fill('5');
  await page.locator('#ppPlanForm button[type=submit]').click();
  await page.waitForTimeout(100);
  assert.equal((await stateNow()).writes.length, 0, 'invalid guide cannot write');
  await page.locator('#ppPlanForm [name=callsMin]').fill('3');
  const yesterday = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); });
  await page.locator('#ppPlanForm [name=due]').fill(yesterday);
  assert.equal(await page.locator('#ppPlanForm [name=due]').evaluate(element => element.validity.rangeUnderflow), true, 'past due date rejected by form');
  assert.equal((await stateNow()).writes.length, 0);
  await page.locator('#ppPlanForm [name=due]').fill(due);
  await page.evaluate(() => { window.__qaFail = true; });
  await page.locator('#ppPlanForm button[type=submit]').click();
  await page.waitForTimeout(100);
  assert.equal((await stateNow()).writes.length, 0, 'failed save cannot write');
  assert.doesNotMatch(await page.locator('#ppPlanForm [data-pp-status]').textContent(), /서버에 저장했습니다/);
  await page.evaluate(() => { window.__qaFail = false; });
  await page.locator('#ppPlanForm button[type=submit]').click();
  await page.waitForFunction(() => window.__qaWrites.some(write => write.path === 'workspaceSelfPromotions/lr/plan'));
  const planWrite = await page.evaluate(() => window.__qaWrites.find(write => write.path === 'workspaceSelfPromotions/lr/plan'));
  assert.equal(planWrite.value.targetRole, 'TL');
  assert.equal(planWrite.value.targetFirstLeaders, 2);
  assert.equal(planWrite.value.targetTotalLeaders, 2);
  assert.equal(planWrite.value.homeReminder, false);
  assert.equal(await page.locator('#ppWeekForm').count(), 0, 'weekly log starts compact after plan save');
  assert.match(await page.locator('#pwPersonalPromotion').textContent(), /퍼스트 리더 1명/);
  assert.match(await page.locator('#pwPersonalPromotion .pp-requirements').textContent(), /1 \/ 2/);
  const leaderCountsBeforeWeek = await page.locator('#pwPersonalPromotion .pp-requirements').textContent();
  const weeklyGuideBefore = await page.locator('#pwPersonalPromotion .pp-weekly').textContent();
  await checkVisibleHeading('#pwPersonalPromotion h2', 'post-save plan overview');
  await capture('lr-390-plan-saved');

  await page.locator('[data-pp-action=log-week]').click();
  await page.locator('#ppWeekForm [name=calls]').fill('18');
  await page.locator('#ppWeekForm [name=bookingsWeek]').fill('4');
  await page.locator('#ppWeekForm [name=showupsWeek]').fill('2');
  await page.locator('#ppWeekForm [name=startersWeek]').fill('1');
  await page.locator('#ppWeekForm [name=calling]').check();
  await page.locator('#ppWeekForm [name=confirmation]').check();
  await page.evaluate(() => window.PresenceWorkspace.schedule());
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#ppWeekForm [name=bookingsWeek]').inputValue(), '4', 'weekly draft survives rerender');
  await page.locator('#ppWeekForm button[type=submit]').click();
  await page.waitForFunction(() => window.__qaWrites.some(write => write.path.startsWith('workspaceSelfPromotions/lr/weeks/')));
  const weekWrite = await page.evaluate(() => window.__qaWrites.find(write => write.path.startsWith('workspaceSelfPromotions/lr/weeks/')));
  assert.equal(weekWrite.value.bookings, 4);
  assert.equal(weekWrite.value.calls, 18);
  assert.equal(weekWrite.value.actions.calling, true);
  assert.equal(weekWrite.value.actions.confirmation, true);
  assert.equal(weekWrite.value.actions.onboarding, false);
  assert.equal(await page.locator('#pwPersonalPromotion .pp-requirements').textContent(), leaderCountsBeforeWeek, 'self-reported actions cannot create leaders');
  assert.notEqual(await page.locator('#pwPersonalPromotion .pp-weekly').textContent(), weeklyGuideBefore, 'saved bookings recalculate weekly calling guide');
  await capture('lr-390-week-saved');

  await page.evaluate(() => goTab('home'));
  assert.equal((await stateNow()).home, false, 'Home reminder remains hidden by default');
  await page.evaluate(() => goTab('learnhub'));
  await page.locator('#ppHomeReminder').check();
  await page.waitForFunction(() => window.__qaWrites.some(write => write.path === 'workspaceSelfPromotions/lr/plan' && write.value.homeReminder));
  await page.evaluate(() => goTab('home'));
  assert.equal((await stateNow()).home, true, 'opted-in Home reminder appears');
  assert.match(await page.locator('#ppHomeCard .pp-home-stages').textContent(), /부킹4 \/ 30/);
  assert.equal(await page.locator('#ppHomeCard .pp-meter').count(), 4, 'Home has four actual progress gauges');
  assert.equal(await page.locator('#ppHomeCard .pp-check-meter').getAttribute('aria-valuenow'), '2', 'two checked actions make 2/4 progress');
  await page.waitForTimeout(300);
  await capture('lr-390-home-optin');
  await page.locator('#ppHomeCard [data-pp-action=open]').click();
  assert.equal((await stateNow()).tab, 'learnhub', 'Home CTA opens Progress');
  assert.equal(await page.locator('#ppWeekForm').count(), 1, 'Home CTA opens weekly form');
  await checkVisibleHeading('#ppWeekForm h3', 'Home CTA weekly log');
  await page.locator('#ppHomeReminder').uncheck();
  await page.waitForTimeout(120);
  await page.evaluate(() => goTab('home'));
  assert.equal((await stateNow()).home, false, 'disabled Home reminder hides');

  await fixture('lr', { plan: basicPlan });
  await page.evaluate(() => { window.__previewRole = 'IC'; window.PresenceWorkspace.render('learnhub'); });
  assert.equal((await stateNow()).progress, false, 'role preview hides own plan');
  const previewWrites = await page.evaluate(async () => { try { await PresenceWorkspace.promotionSave('plan', {}, null); } catch (e) {} return window.__qaWrites; });
  assert.deepEqual(previewWrites, [], 'role preview cannot write');
  await page.evaluate(() => { window.__previewRole = ''; PresenceWorkspace.render('learnhub'); });
  assert.equal((await stateNow()).progress, true);
  await page.evaluate(() => { me = state.users.ic; PresenceWorkspace.render('learnhub'); });
  assert.equal((await stateNow()).progress, false, 'UID switch clears previous leader plan');
  await page.evaluate(() => { PresenceWorkspace.dispose(); });
  assert.equal(await page.locator('#pwPersonalPromotion').count(), 0, 'dispose clears private planner DOM');

  await fixture('ic', { plan: basicPlan });
  assert.equal((await stateNow()).progress, false, 'IC with stale saved plan stays hidden');
  await page.evaluate(() => goTab('home'));
  assert.equal((await stateNow()).home, false, 'IC with stale saved plan has no Home card');
  assert.deepEqual(await page.evaluate(async () => { try { await PresenceWorkspace.promotionSave('plan', {}, null); } catch (e) {} return window.__qaWrites; }), [], 'IC cannot write saved plan');

  await page.setViewportSize({ width: 1440, height: 900 });
  await fixture('admin', { adminOff: true });
  await page.locator('[data-pp-action=create-plan]').click();
  await page.locator('#ppPlanForm button[type=submit]').click();
  await page.waitForFunction(() => window.__qaWrites.some(write => write.path === 'workspaceSelfPromotions/admin/plan'));
  const adminWrite = await page.evaluate(() => window.__qaWrites.find(write => write.path === 'workspaceSelfPromotions/admin/plan'));
  assert.equal(adminWrite.value.targetRole, 'OP', 'admin OFF still permits own AOP plan');
  assert.equal(adminWrite.value.targetFirstLeaders, 4);
  assert.equal(adminWrite.value.targetTotalLeaders, 10);
  assert.deepEqual((await stateNow()).writes.map(write => write.path), ['workspaceSelfPromotions/admin/plan'], 'old coach plan remains untouched');
  await page.evaluate(() => { window.__adminOff = false; goTab('home'); });
  assert.ok(await page.locator('#pwHomePending').count() > 0, 'daily Home pending list survives promotion planner integration');

  await page.evaluate(plan => {
    window.__qaStore.workspaceSelfPromotions.lr = { plan: { ...plan, updatedBy: 'lr' }, weeks: {} };
    window.__qaWatch.get('workspaceSelfPromotions/lr')?.(structuredClone(window.__qaStore.workspaceSelfPromotions.lr));
    goTab('supporthub');
  }, basicPlan);
  await page.locator('#pwSupportUid').selectOption('lr');
  assert.match(await page.locator('.pp-readonly').textContent(), /서리더님의 TL 목표/);
  assert.equal(await page.locator('.pp-readonly input,.pp-readonly button').count(), 0, 'coach view is read-only');
  assert.deepEqual((await stateNow()).writes.map(write => write.path), ['workspaceSelfPromotions/admin/plan'], 'coach viewing creates no writes');
  assert.deepEqual(pageErrors, [], 'browser errors');
  console.log('PASS promotion planner: role scope, defaults, validation/failure, own writes, weekly log, Home opt-in, preview/UID disposal, responsive geometry');
} finally {
  await browser.close();
}
