import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = (process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4178').replace(/\/$/, '');
const output = process.env.PRESENCE_QA_OUTPUT || '/Users/jaeyoung5178/Documents/ChatGPT/Presence Work Book/design-review/implemented/20260928-promotion-journey';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
await page.addInitScript(() => {
  window.__PJ_MOCK = 1;
  const team = { sea: { key: 'sea', theme: 'sea', tier: 'TL', teamName: '고윤경', leaderUid: 'admin', leaderName: '임재영', status: 'passed', curWeek: 2, target: 1000000, createdTs: Date.now() - 14 * 86400000, weeks: { '1': { status: 'hit', entries: {} }, '2': { status: 'hit', entries: {} } } } };
  localStorage.setItem('pjmock_pj_v1', JSON.stringify({ journey: { teams: team } }));
});
await page.route(/(firebaseio\.com|firebasedatabase\.app|identitytoolkit|securetoken|gstatic\.com\/firebasejs|googleapis\.com\/(?!css))/, route => route.abort());

const people = {
  member: { uid: 'member', id: 'member', name: '일반팀원', role: 'IC', status: 'active' },
  leader: { uid: 'leader', id: 'leader', name: '서리더', role: 'LR', status: 'active' },
  tl: { uid: 'tl', id: 'tl', name: '팀리더', role: 'TL', status: 'active' },
  admin: { uid: 'admin', id: 'admin', name: '임재영', role: 'AOP', status: 'active' },
  chae: { uid: 'umqna7jpj', id: 'chae', name: '윤채영', role: 'TL', status: 'active' },
  other: { uid: 'umqn54ujf', id: 'other', name: '고윤경', role: 'TL', status: 'active' },
  direct: { uid: 'direct', id: 'direct', name: '직속리더', role: 'LR', status: 'active' },
  nested: { uid: 'nested', id: 'nested', name: '하위리더', role: 'LR', status: 'active' },
  cousin: { uid: 'cousin', id: 'cousin', name: '다른팀리더', role: 'LR', status: 'active' },
  inactive: { uid: 'inactive', id: 'inactive', name: '휴면리더', role: 'LR', status: 'inactive' },
};
const dossier = {
  서리더: { teamName: 'Fuse', upline: '임재영' },
  팀리더: { teamName: 'Wave', upline: '임재영' },
  윤채영: { teamName: 'Chae', upline: '임재영' },
  고윤경: { teamName: 'Chae', upline: '윤채영' },
  직속리더: { teamName: 'Fuse', upline: '서리더' },
  하위리더: { teamName: 'Fuse', upline: '직속리더' },
  다른팀리더: { teamName: 'Wave', upline: '팀리더' },
  휴면리더: { teamName: 'Fuse', upline: '서리더' },
};
const due = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
const publicPlans = {
  leader: { version: 1, targetRole: 'TL', due, updatedBy: 'leader', updatedAt: Date.now() },
  tl: { version: 1, targetRole: 'AOP', due, updatedBy: 'tl', updatedAt: Date.now() },
  inactive: { version: 1, targetRole: 'TL', due, updatedBy: 'inactive', updatedAt: Date.now() },
  stale: { version: 1, targetRole: 'OP', due, updatedBy: 'stale', updatedAt: Date.now() },
};

async function fixture(role, { adminOff = false, dates = {}, plans = publicPlans, hold = [], cheers = { presenceOP: { seed: { emoji: '👏', updatedAt: Date.now() } }, admin: {}, leader: {}, tl: {} } } = {}) {
  await page.evaluate(({ role, people, dossier, adminOff, dates, plans, hold, cheers }) => {
    window.PresencePromotionJourney.dispose();
    window.PresenceWorkspace.dispose();
    window.__qaWrites = [];
    window.__qaFail = false;
    window.__qaWatch = new Map();
    window.__qaErrors = new Map();
    window.__qaHold = new Set(hold);
    window.__qaStore = { users: structuredClone(people), dossier: structuredClone(dossier), workspacePromotionPlans: structuredClone(plans), workspacePromotionMilestones: {}, workspacePromotionCheers: structuredClone(cheers) };
    for (const [key, record] of Object.entries(dates)) {
      const [uid, tier = 'TL'] = key.split('|');
      (window.__qaStore.workspacePromotionMilestones[uid] ||= {})[tier] = record;
    }
    const get = path => path.split('/').reduce((value, key) => value?.[key], window.__qaStore);
    DB.on = (path, callback, onError) => {
      window.__qaWatch.set(path, callback);
      window.__qaErrors.set(path, onError);
      queueMicrotask(() => { if (window.__qaWatch.get(path) === callback && !window.__qaHold.has(path)) callback(structuredClone(get(path) || null)); });
      return () => { window.__qaWatch.delete(path); window.__qaErrors.delete(path); };
    };
    DB.set = async (path, value) => {
      if (window.__qaFail) throw new Error('네트워크 오류');
      window.__qaWrites.push({ path, value: structuredClone(value) });
      const segments = path.split('/'); const last = segments.pop();
      let target = window.__qaStore;
      for (const segment of segments) target = target[segment] ||= {};
      if (value === null) delete target[last]; else target[last] = structuredClone(value);
      for (const [watched, callback] of window.__qaWatch) if (path === watched || path.startsWith(watched + '/')) callback(structuredClone(get(watched) || null));
    };
    DB.update = async (path, patch) => {
      if (!path) { for (const [key, value] of Object.entries(patch)) await DB.set(key, value); return; }
      return DB.set(path, { ...(get(path) || {}), ...patch });
    };
    DB.get = async path => get(path) || null;
    window.__firebaseReady = true;
    window.__adminOff = adminOff;
    window.__previewRole = '';
    window.__presenceWorkspaceBaseReady = { users: true, sales: true };
    state.users = structuredClone(people);
    state.dossier = structuredClone(dossier);
    state.sales = {};
    state.extraMembers = [];
    state.removedMembers = [];
    me = state.users[role];
    document.getElementById('authGate')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    document.body.classList.add('app-on');
    document.querySelectorAll('#presenceGameLoader,#presenceEntryLobby,#presenceLoader').forEach(element => element.remove());
    window.__pj.boot(); buildRail(); goTab('journey'); window.__pj.jRender();
  }, { role, people, dossier, adminOff, dates, plans, hold, cheers });
  try { await page.waitForFunction(() => !!document.getElementById('pjNextPlans') && !!document.getElementById('pjHallOfFame'), null, { timeout: 4000 }); }
  catch (error) {
    const debug = await page.evaluate(() => ({ role: me?.role, uid: me?.uid, tab: curTab, journeyVisible: tabVisible('journey'), journeyMeta: TABMETA.journey && { label: TABMETA.journey.l, gate: String(TABMETA.journey.g) }, active: document.getElementById('m-journey')?.className, text: document.getElementById('m-journey')?.textContent.slice(0, 350), watched: [...window.__qaWatch.keys()], errors: window.__qaWrites }));
    throw new Error(`Journey fixture did not render: ${JSON.stringify(debug)}; ${error.message}`);
  }
  await page.waitForTimeout(120);
  await page.evaluate(() => { window.__qaWrites = []; });
}

async function checkGeometry(label) {
  const result = await page.evaluate(() => {
    const sections = [...document.querySelectorAll('#pjNextPlans,#pjHallOfFame')];
    const bounds = sections.map(section => section.getBoundingClientRect().toJSON());
    const controls = sections.flatMap(section => [...section.querySelectorAll('button,input')]).filter(element => {
      const box = element.getBoundingClientRect(), style = getComputedStyle(element);
      return box.width && box.height && style.display !== 'none' && style.visibility !== 'hidden';
    }).map(element => { const box = element.getBoundingClientRect(); return { name: element.dataset.pjmCheer || element.name || element.textContent.trim(), x: box.x, right: box.right, width: box.width, height: box.height }; });
    return { viewport: innerWidth, scroll: document.documentElement.scrollWidth, bounds, controls };
  });
  assert.ok(result.scroll <= result.viewport + 1, `${label}: page overflow ${JSON.stringify(result)}`);
  assert.ok(result.bounds.every(box => box.left >= -1 && box.right <= result.viewport + 1), `${label}: section clipped ${JSON.stringify(result.bounds)}`);
  assert.deepEqual(result.controls.filter(control => control.width < 43.5 || control.height < 43.5 || control.x < -1 || control.right > result.viewport + 1), [], `${label}: undersized or clipped controls`);
}
async function checkReachable(selector, label) {
  await page.evaluate(selector => {
    const element = document.querySelector(selector);
    if (element) window.scrollTo({ top: Math.max(0, scrollY + element.getBoundingClientRect().top - 240), behavior: 'instant' });
  }, selector);
  await page.waitForTimeout(100);
  const result = await page.locator(selector).evaluate(element => {
    const box = element.getBoundingClientRect(), nav = document.querySelector('#app .botbar')?.getBoundingClientRect();
    const x = box.left + box.width / 2, y = box.top + box.height / 2;
    return { top: box.top, bottom: box.bottom, navTop: nav?.top ?? innerHeight, hit: element.contains(document.elementFromPoint(x, y)) };
  });
  assert.ok(result.top >= 70 && result.bottom < result.navTop - 4 && result.hit, `${label}: control is covered ${JSON.stringify(result)}`);
  await page.locator(selector).click({ trial: true });
}

async function capture(name) {
  const mobile = (await page.viewportSize()).width <= 390;
  if (mobile) {
    for (const [suffix, selector] of [
      ['presence-plan', '#pjNextPlans [data-pjm-plan-uid="admin"]'],
      ['leader-plan', '#pjNextPlans [data-pjm-plan-uid="leader"]'],
      ['hall-admin-tl', '#pjHallOfFame [data-pjm-achievement="admin|TL"]'],
      ['hall-chae-tl', '#pjHallOfFame [data-pjm-achievement="umqna7jpj|TL"]'],
      ['hall-ko-tl', '#pjHallOfFame .pjm-go-card'],
      ['join', '#pjJoinJourney'],
    ]) {
      if (!await page.locator(selector).count()) continue;
      await page.evaluate(selector => { const element = document.querySelector(selector); window.scrollTo({ top: Math.max(0, scrollY + element.getBoundingClientRect().top - 190), behavior: 'instant' }); }, selector);
      await page.waitForTimeout(100);
      await page.locator(selector).screenshot({ path: `${output}/${name}-${suffix}.png` });
    }
    return;
  }
  await page.locator('#pjNextPlans').screenshot({ path: `${output}/${name}-next-plans.png` });
  await page.locator('#pjHallOfFame').screenshot({ path: `${output}/${name}-hall.png` });
}
const promotionWrites = () => page.evaluate(() => window.__qaWrites.filter(write => /^workspacePromotion(Milestones|Cheers|Plans)\//.test(write.path) || write.path.startsWith('journey/teams/')));

try {
  const qaURL = new URL(base);
  qaURL.searchParams.set('qa', `promotion-journey-${Date.now()}`);
  await page.goto(qaURL.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.PresencePromotionJourney && !!window.PresenceWorkspace && !!window.__pj?.jRender);
  for (const [role, width, height] of [['member',390,844],['leader',390,844],['tl',390,844],['admin',390,844],['member',1024,768],['leader',1024,768],['tl',1024,768],['admin',1024,768],['member',1440,900],['leader',1440,900],['tl',1440,900],['admin',1440,900],['admin',360,800]]) {
    await page.setViewportSize({ width, height });
    await fixture(role);
    assert.equal(await page.evaluate(() => curTab), 'journey', `${role}/${width} journey accessible`);
    assert.equal(await page.locator('#pjNextPlans [data-pjm-plan-uid]').count(), 3, 'Presence placeholder plus two eligible saved plans');
    assert.equal(await page.locator('[data-pjm-plan-uid="inactive"],[data-pjm-plan-uid="stale"]').count(), 0, 'inactive and unknown owners filtered');
    assert.match(await page.locator('[data-pjm-plan-uid="admin"]').textContent(), /OP 목표/);
    assert.match(await page.locator('[data-pjm-plan-uid="leader"]').textContent(), /TL 목표/);
    assert.match(await page.locator('[data-pjm-plan-uid="tl"]').textContent(), /AOP 목표/);
    assert.equal(await page.locator('#pjHallOfFame [data-pjm-achievement]').count(), 3, 'three archive cards');
    assert.equal(await page.locator('#pjHallOfFame .pjm-go-card').count(), 1, 'known Go completion moved once');
    assert.equal(await page.locator('#pjHallOfFame .pjm-hall-cards .pj-jcard').count(), 4, 'four achievements total');
    assert.match(await page.locator('#pjHallOfFame').textContent(), /임재영.*TL 완주/);
    assert.match(await page.locator('#pjHallOfFame').textContent(), /임재영.*AOP 완주/);
    assert.match(await page.locator('#pjHallOfFame').textContent(), /윤채영.*TL 완주/);
    assert.match(await page.locator('#pjHallOfFame').textContent(), /고윤경/);
    assert.match(await page.locator('#pjHallOfFame').textContent(), /힛 날짜 확인 중/, 'no fabricated hit dates');
    assert.equal(await page.locator('#pjJoinJourney').isDisabled(), role === 'member', `${role}/${width} leader-only entry`);
    assert.deepEqual(await promotionWrites(), [], 'read-only initial render');
    await checkGeometry(`${role}/${width}`);
    if (width <= 390) {
      await checkReachable('[data-pjm-plan-uid="tl"] [data-pjm-cheer="💚"]', `${role}/${width} lower cheer`);
      if (role !== 'member') await checkReachable('#pjJoinJourney', `${role}/${width} journey entry`);
    }
    if ((role === 'member' && width === 390) || (role === 'admin' && [360,390,1440].includes(width))) await capture(`${role}-${width}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await fixture('member');
  const adminCard = page.locator('[data-pjm-plan-uid="admin"]');
  const leaderCard = page.locator('[data-pjm-plan-uid="leader"]');
  const adminGauges = adminCard.locator('.pjm-leader-gauge');
  const leaderGauges = leaderCard.locator('.pjm-leader-gauge');
  assert.match(await adminGauges.nth(0).textContent(), /3\s*\/\s*4/, 'Presence first leaders use actual tree');
  assert.match(await adminGauges.nth(1).textContent(), /7\s*\/\s*10/, 'Presence total includes descendants');
  assert.match(await leaderGauges.nth(0).textContent(), /1\s*\/\s*2/, 'team first leaders differ from total');
  assert.match(await leaderGauges.nth(1).textContent(), /2\s*\/\s*2/, 'team total counts nested leaders');
  assert.doesNotMatch(await page.locator('#pjNextPlans').textContent(), /더 필요/, 'Next Plans shows ratios without shortage prose');
  assert.deepEqual(await adminCard.locator('[role=progressbar]').evaluateAll(elements => elements.map(el => [el.getAttribute('aria-valuenow'), el.getAttribute('aria-valuemax'), el.querySelector('i')?.style.width])), [['3','4','75%'],['7','10','70%']], 'honest accessible and visible gauge fill');
  assert.deepEqual(await promotionWrites(), [], 'reading plans and org writes nothing');

  await page.evaluate(() => {
    const add = [
      ['newfirst','신규직속','임재영'],
      ['newbranch','신규하위','서리더'],
      ['newdeep','신규손자','신규하위'],
    ];
    for (const [uid,name,upline] of add) {
      window.__qaStore.users[uid] = { uid, id: uid, name, role: 'LR', status: 'active' };
      window.__qaStore.dossier[name] = { teamName: 'Presence', upline };
    }
    window.__qaWatch.get('users')?.(structuredClone(window.__qaStore.users));
    window.__qaWatch.get('dossier')?.(structuredClone(window.__qaStore.dossier));
  });
  await page.waitForFunction(() => document.querySelector('[data-pjm-plan-uid="admin"]')?.textContent.includes('10 / 10'));
  assert.match(await adminCard.textContent(), /4\s*\/\s*4/);
  assert.match(await adminCard.textContent(), /인원 기준 달성/);
  assert.deepEqual(await adminCard.locator('[role=progressbar]').evaluateAll(elements => elements.map(el => [el.getAttribute('aria-valuenow'), el.querySelector('i')?.style.width])), [['4','100%'],['10','100%']], 'full gauges remain planning state');
  assert.equal(await page.locator('#pjHallOfFame .pjm-hall-cards .pj-jcard').count(), 4, 'reaching count does not invent completion');
  assert.equal(await page.evaluate(() => me.role), 'IC', 'count completion does not change actor role');
  assert.deepEqual(await promotionWrites(), []);

  await fixture('member');
  await page.evaluate(due => {
    window.__qaStore.workspacePromotionPlans.direct = { version: 1, targetRole: 'TL', due, updatedBy: 'direct', updatedAt: Date.now() };
    window.__qaWatch.get('workspacePromotionPlans')?.(structuredClone(window.__qaStore.workspacePromotionPlans));
  }, due);
  assert.equal(await page.locator('[data-pjm-plan-uid="direct"]').count(), 1, 'new public plan appears live');
  await page.evaluate(() => {
    window.__qaStore.workspacePromotionPlans.direct.targetRole = 'AOP';
    window.__qaWatch.get('workspacePromotionPlans')?.(structuredClone(window.__qaStore.workspacePromotionPlans));
  });
  assert.match(await page.locator('[data-pjm-plan-uid="direct"]').textContent(), /AOP 목표/, 'edited public plan refreshes live');
  await page.evaluate(() => {
    delete window.__qaStore.workspacePromotionPlans.direct;
    window.__qaWatch.get('workspacePromotionPlans')?.(structuredClone(window.__qaStore.workspacePromotionPlans));
  });
  assert.equal(await page.locator('[data-pjm-plan-uid="direct"]').count(), 0, 'removed public plan disappears');
  assert.deepEqual(await promotionWrites(), [], 'directory watch is read-only');

  await page.locator('[data-pjm-plan-uid="leader"] [data-pjm-cheer="👏"]').click();
  await page.waitForFunction(() => window.__qaWrites.some(write => write.path === 'workspacePromotionCheers/leader/member'));
  let write = (await promotionWrites()).at(-1);
  assert.equal(write.path, 'workspacePromotionCheers/leader/member', 'cheer is scoped to plan owner');
  assert.equal(write.value.emoji, '👏');
  assert.equal(await page.locator('[data-pjm-plan-uid="leader"] [data-pjm-cheer="👏"] strong').textContent(), '1');
  assert.equal(await page.locator('[data-pjm-plan-uid="admin"] [data-pjm-cheer="👏"] strong').textContent(), '1', 'Presence legacy count unchanged');
  assert.equal(await page.locator('[data-pjm-plan-uid="tl"] [data-pjm-cheer="👏"] strong').textContent(), '0', 'other team count unchanged');
  await page.locator('[data-pjm-plan-uid="leader"] [data-pjm-cheer="👏"]').click();
  await page.waitForFunction(() => window.__qaWrites.filter(write => write.path === 'workspacePromotionCheers/leader/member').length === 2);
  assert.equal((await promotionWrites()).at(-1).value, null, 'second press removes only own cheer');
  await page.evaluate(() => { window.__qaFail = true; });
  await page.locator('[data-pjm-plan-uid="tl"] [data-pjm-cheer="🔥"]').click();
  await page.waitForTimeout(120);
  assert.equal((await promotionWrites()).length, 2, 'failed cheer adds no write');
  assert.equal(await page.locator('[data-pjm-plan-uid="tl"] [data-pjm-cheer="🔥"]').getAttribute('aria-pressed'), 'false');
  await page.evaluate(() => {
    window.__qaFail = false;
    window.__qaStore.workspacePromotionCheers.tl.remote = { emoji: '🚀', updatedAt: Date.now() };
    window.__qaWatch.get('workspacePromotionCheers/tl')?.(structuredClone(window.__qaStore.workspacePromotionCheers.tl));
  });
  assert.equal(await page.locator('[data-pjm-plan-uid="tl"] [data-pjm-cheer="🚀"] strong').textContent(), '1', 'team cheer collection refreshes live');

  await fixture('member', { hold: ['users','dossier'] });
  assert.match(await page.locator('[data-pjm-plan-uid="admin"]').textContent(), /조직 정보 불러오는 중/, 'count waits for base snapshots');
  assert.equal(await page.locator('[data-pjm-plan-uid="admin"] [role=progressbar]').count(), 0, 'no fabricated loading counts');
  await page.evaluate(() => {
    window.__qaHold.delete('users'); window.__qaHold.delete('dossier');
    window.__qaWatch.get('users')?.(structuredClone(window.__qaStore.users));
    window.__qaWatch.get('dossier')?.(structuredClone(window.__qaStore.dossier));
  });
  await page.waitForFunction(() => document.querySelector('[data-pjm-plan-uid="admin"]')?.textContent.includes('7 / 10'));
  await page.evaluate(() => { window.__qaErrors.get('dossier')?.(new Error('org read failed')); });
  assert.match(await page.locator('[data-pjm-plan-uid="admin"]').textContent(), /조직 정보를 불러오지 못했어요/, 'read failure does not retain stale counts');
  assert.equal(await page.locator('[data-pjm-plan-uid="admin"] [role=progressbar]').count(), 0);
  await page.evaluate(() => {
    const now = Date.now; Date.now = () => now() + 11000; window.__pj.jRender(); Date.now = now;
  });
  await page.waitForFunction(() => document.querySelector('[data-pjm-plan-uid="admin"]')?.textContent.includes('7 / 10'));
  assert.deepEqual(await promotionWrites(), [], 'read retry remains read-only');
  await page.evaluate(() => { window.__qaErrors.get('workspacePromotionPlans')?.(new Error('directory read failed')); });
  assert.match(await page.locator('#pjNextPlans').textContent(), /다른 팀 계획을 불러오지 못했어요/);
  assert.equal(await page.locator('#pjNextPlans [data-pjm-plan-uid]').count(), 1, 'directory error does not retain stale team plans');
  await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 11000; window.__pj.jRender(); Date.now = now; });
  await page.waitForFunction(() => document.querySelectorAll('#pjNextPlans [data-pjm-plan-uid]').length === 3);
  await page.evaluate(() => { window.__qaErrors.get('workspacePromotionCheers/leader')?.(new Error('cheer read failed')); });
  assert.equal(await page.locator('[data-pjm-plan-uid="leader"] [data-pjm-cheer]:disabled').count(), 4, 'team cheer read failure disables only that team');
  assert.equal(await page.locator('[data-pjm-plan-uid="leader"] [data-pjm-cheer="👏"] strong').textContent(), '…', 'stale team count not shown');
  assert.equal(await page.locator('[data-pjm-plan-uid="admin"] [data-pjm-cheer]:disabled').count(), 0, 'other team cheers stay available');
  await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 11000; window.__pj.jRender(); Date.now = now; });
  await page.waitForFunction(() => !document.querySelector('[data-pjm-plan-uid="leader"] [data-pjm-cheer]')?.disabled);
  assert.deepEqual(await promotionWrites(), [], 'error and recovery create no writes');

  await fixture('admin', { adminOff: true });
  await page.locator('[data-pjm-achievement="umqna7jpj|TL"]').click();
  assert.equal(await page.locator('#pjmAchievementDialog [data-pjm-date-form]').count(), 0, 'admin OFF has no date editor');
  await page.locator('#pjmAchievementDialog [data-pjm-close]').click();
  await fixture('admin');
  await page.locator('[data-pjm-achievement="umqna7jpj|TL"]').click();
  const form = page.locator('#pjmAchievementDialog [data-pjm-date-form][data-pjm-date-uid="umqna7jpj"][data-pjm-date-tier="TL"]');
  await page.locator('#pjmAchievementDialog .pjm-date-edit summary').click();
  assert.equal(await form.count(), 1, 'admin editor inside achievement dialog');
  assert.equal(await page.evaluate(() => PresencePromotionJourney.validDate('2026-02-30')), false, 'invalid calendar date rejected');
  await form.locator('[name=hitDate]').fill('2026-10-01');
  assert.equal(await form.locator('[name=hitDate]').evaluate(el => el.validity.rangeOverflow), true, 'future date invalid');
  await form.locator('[name=hitDate]').fill('2026-09-15');
  await page.evaluate(() => { window.__qaFail = true; });
  await form.locator('button[type=submit]').click();
  await page.waitForTimeout(120);
  assert.deepEqual(await promotionWrites(), [], 'failed date save adds no milestone');
  assert.match(await page.locator('#pjmAchievementDialog [data-pjm-date-label]').textContent(), /확인 중/);
  await page.evaluate(() => { window.__qaFail = false; });
  await form.locator('button[type=submit]').click();
  await page.waitForFunction(() => window.__qaWrites.some(write => write.path === 'workspacePromotionMilestones/umqna7jpj/TL'));
  write = (await promotionWrites()).at(-1);
  assert.deepEqual({ status: write.value.status, hitDate: write.value.hitDate, updatedBy: write.value.updatedBy }, { status: 'completed', hitDate: '2026-09-15', updatedBy: 'admin' });
  assert.match(await page.locator('#pjmAchievementDialog [data-pjm-date-label]').textContent(), /2026\.09\.15/);
  await page.locator('#pjmAchievementDialog [data-pjm-close]').click();
  assert.match(await page.locator('[data-pjm-achievement="umqna7jpj|TL"]').textContent(), /2026\.09\.15/);
  assert.match(await page.locator('#pjHallOfFame .pjm-go-card').textContent(), /확인 중/, 'other completion date remains unknown');

  const legacyBefore = await page.evaluate(() => localStorage.getItem('pjmock_pj_v1'));
  await page.locator('#pjHallOfFame .pjm-go-card').click();
  await page.waitForFunction(() => !!document.querySelector('#m-journey .pj-banner-lg'));
  assert.match(await page.locator('.pjm-complete-detail').textContent(), /고윤경.*TL 완주.*확인 중/, 'Go detail matches candidate rather than creator admin');
  assert.equal(await page.locator('.pjm-complete-detail [data-pjm-date-form][data-pjm-date-uid="umqn54ujf"]').count(), 1, 'Go detail exposes only its candidate date editor');
  assert.equal(await page.evaluate(() => localStorage.getItem('pjmock_pj_v1')), legacyBefore, 'achievement does not alter legacy journey');
  await page.evaluate(() => { me = state.users.member; window.__pj.jRender(); });
  assert.equal(await page.locator('[data-pjm-date-form]').count(), 0, 'UID switch clears privileged date editor');
  await page.evaluate(() => { PresencePromotionJourney.dispose(); me = null; });
  assert.equal(await page.locator('#pjNextPlans,#pjHallOfFame,.pjm-complete-detail').count(), 0, 'logout clears Journey private DOM');
  assert.deepEqual(await page.evaluate(() => [...window.__qaWatch.keys()].filter(path => /^workspacePromotion(Milestones|Cheers|Plans)(\/|$)/.test(path))), [], 'logout detaches Journey listeners');
  assert.deepEqual(pageErrors, [], 'page errors');
  console.log('PASS v14 Journey: real index, 4 roles, public plans, org gauges, Hall of Fame, isolated cheers, dates, read recovery, 360/390/1024/1440 geometry');
} finally {
  await browser.close();
}
