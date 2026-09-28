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
  const team = { sea: { key: 'sea', theme: 'sea', tier: 'TL', teamName: '윤채영', leaderUid: 'admin', leaderName: '임재영', status: 'passed', curWeek: 2, target: 1000000, createdTs: Date.now() - 14 * 86400000, weeks: { '1': { status: 'hit', entries: {} }, '2': { status: 'hit', entries: {} } } } };
  localStorage.setItem('pjmock_pj_v1', JSON.stringify({ journey: { teams: team } }));
});
await page.route(/(firebaseio\.com|firebasedatabase\.app|identitytoolkit|securetoken|gstatic\.com\/firebasejs|googleapis\.com\/(?!css))/, route => route.abort());

const people = {
  member: { uid: 'member', id: 'member', name: '일반팀원', role: 'IC', status: 'active' },
  leader: { uid: 'leader', id: 'leader', name: '서리더', role: 'LR', status: 'active' },
  tl: { uid: 'umqna7jpj', id: 'tl', name: '윤채영', role: 'TL', status: 'active' },
  admin: { uid: 'admin', id: 'admin', name: '임재영', role: 'AOP', status: 'active' },
  other: { uid: 'umqn54ujf', id: 'other', name: '고윤경', role: 'TL', status: 'active' },
};

async function fixture(role, { adminOff = false, dates = {}, cheers = { seed: { emoji: '👏', updatedAt: Date.now() } } } = {}) {
  await page.evaluate(({ role, people, adminOff, dates, cheers }) => {
    window.PresencePromotionJourney.dispose();
    window.PresenceWorkspace.dispose();
    window.__qaWrites = [];
    window.__qaFail = false;
    window.__qaWatch = new Map();
    window.__qaErrors = new Map();
    window.__qaStore = { workspacePromotionMilestones: {}, workspacePromotionCheers: { presenceOP: structuredClone(cheers) } };
    for (const [uid, record] of Object.entries(dates)) window.__qaStore.workspacePromotionMilestones[uid] = { TL: record };
    const get = path => path.split('/').reduce((value, key) => value?.[key], window.__qaStore);
    DB.on = (path, callback, onError) => {
      window.__qaWatch.set(path, callback);
      window.__qaErrors.set(path, onError);
      queueMicrotask(() => { if (window.__qaWatch.get(path) === callback) callback(structuredClone(get(path) || null)); });
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
    DB.update = async (path, patch) => DB.set(path, { ...(get(path) || {}), ...patch });
    DB.get = async path => get(path) || null;
    window.__firebaseReady = true;
    window.__adminOff = adminOff;
    window.__previewRole = '';
    window.__presenceWorkspaceBaseReady = { users: true, sales: true };
    state.users = structuredClone(people);
    state.dossier = {};
    state.sales = {};
    state.extraMembers = [];
    state.removedMembers = [];
    me = state.users[role];
    document.getElementById('authGate')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    document.body.classList.add('app-on');
    document.querySelectorAll('#presenceGameLoader,#presenceEntryLobby,#presenceLoader').forEach(element => element.remove());
    window.__pj.boot(); buildRail(); goTab('journey'); window.__pj.jRender();
  }, { role, people, adminOff, dates, cheers });
  try { await page.waitForFunction(() => !!document.getElementById('pjMilestones') && !!document.getElementById('pjNextPromotion'), null, { timeout: 4000 }); }
  catch (error) {
    const debug = await page.evaluate(() => ({ role: me?.role, uid: me?.uid, tab: curTab, journeyVisible: tabVisible('journey'), journeyMeta: TABMETA.journey && { label: TABMETA.journey.l, gate: String(TABMETA.journey.g) }, active: document.getElementById('m-journey')?.className, text: document.getElementById('m-journey')?.textContent.slice(0, 350), watched: [...window.__qaWatch.keys()], errors: window.__qaWrites }));
    throw new Error(`Journey fixture did not render: ${JSON.stringify(debug)}; ${error.message}`);
  }
  await page.waitForTimeout(120);
  await page.evaluate(() => { window.__qaWrites = []; });
}

async function checkGeometry(label) {
  const result = await page.evaluate(() => {
    const sections = [...document.querySelectorAll('#pjMilestones,#pjNextPromotion')];
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
      ['chae-tl', '#pjMilestones [data-pjm-uid="umqna7jpj"]'],
      ['ko-tl', '#pjMilestones [data-pjm-uid="umqn54ujf"]'],
      ['cheers', '#pjNextPromotion'],
    ]) {
      if (!await page.locator(selector).count()) continue;
      await page.evaluate(selector => { const element = document.querySelector(selector); window.scrollTo({ top: Math.max(0, scrollY + element.getBoundingClientRect().top - 190), behavior: 'instant' }); }, selector);
      await page.waitForTimeout(100);
      await page.locator(selector).screenshot({ path: `${output}/${name}-${suffix}.png` });
    }
    return;
  }
  await page.locator('#pjMilestones').screenshot({ path: `${output}/${name}-milestones.png` });
  await page.locator('#pjNextPromotion').screenshot({ path: `${output}/${name}-cheers.png` });
}
const promotionWrites = () => page.evaluate(() => window.__qaWrites.filter(write => /^workspacePromotion(Milestones|Cheers)\//.test(write.path) || write.path.startsWith('journey/teams/')));

try {
  await page.goto(`${base}/?qa=promotion-journey-${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.PresencePromotionJourney && !!window.PresenceWorkspace && !!window.__pj?.jRender);
  for (const [role, width, height] of [['member',390,844],['leader',390,844],['tl',390,844],['admin',390,844],['member',1024,768],['leader',1024,768],['tl',1024,768],['admin',1024,768],['member',1440,900],['leader',1440,900],['tl',1440,900],['admin',1440,900],['admin',360,800]]) {
    await page.setViewportSize({ width, height });
    await fixture(role);
    assert.equal(await page.evaluate(() => curTab), 'journey', `${role}/${width} journey accessible`);
    assert.equal(await page.locator('#pjMilestones [data-pjm-uid]').count(), 2);
    assert.match(await page.locator('#pjMilestones').textContent(), /윤채영/);
    assert.match(await page.locator('#pjMilestones').textContent(), /고윤경/);
    assert.equal(await page.locator('#pjMilestones .pjm-date').filter({ hasText: 'TL 힛 날짜 확인 중' }).count(), 2, 'no fabricated date');
    assert.equal(await page.locator('[data-pjm-date-form]').count(), role === 'admin' ? 2 : 0, `${role}/${width} editor permission`);
    assert.equal(await page.locator('#pjNextPromotion [data-pjm-cheer]').count(), 4);
    assert.deepEqual(await promotionWrites(), [], 'read-only initial render');
    await checkGeometry(`${role}/${width}`);
    if (width <= 390) {
      await checkReachable('#pjNextPromotion [data-pjm-cheer="💚"]', `${role}/${width} lower cheer`);
      if (role === 'admin') await checkReachable('[data-pjm-date-form="umqn54ujf"] button', `${role}/${width} second date editor`);
    }
    if ((role === 'member' && width === 390) || (role === 'admin' && [360,390,1440].includes(width))) await capture(`${role}-${width}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await fixture('member');
  assert.equal(await page.locator('[data-pjm-cheer="👏"] strong').textContent(), '1');
  await page.locator('[data-pjm-cheer="👏"]').click();
  await page.waitForFunction(() => window.__qaWrites.some(write => write.path === 'workspacePromotionCheers/presenceOP/member'));
  let write = (await promotionWrites()).at(-1);
  assert.equal(write.path, 'workspacePromotionCheers/presenceOP/member');
  assert.equal(write.value.emoji, '👏');
  assert.equal(await page.locator('[data-pjm-cheer="👏"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-pjm-cheer="👏"] strong').textContent(), '2', 'count comes from subscribed collection');
  await page.locator('[data-pjm-cheer="👏"]').click();
  await page.waitForFunction(() => window.__qaWrites.filter(write => /^workspacePromotion(Milestones|Cheers)\//.test(write.path)).length === 2);
  assert.equal((await promotionWrites()).at(-1).value, null, 'second click removes only own cheer');
  assert.equal(await page.locator('[data-pjm-cheer="👏"] strong').textContent(), '1');
  await page.evaluate(() => { window.__qaFail = true; });
  await page.locator('[data-pjm-cheer="🔥"]').click();
  await page.waitForTimeout(120);
  assert.equal((await promotionWrites()).length, 2, 'failed cheer creates no write');
  assert.equal(await page.locator('[data-pjm-cheer="🔥"]').getAttribute('aria-pressed'), 'false');
  assert.match(await page.locator('#pjmCheerStatus').textContent(), /네트워크 오류/);
  await page.evaluate(() => {
    window.__qaFail = false;
    window.__qaStore.workspacePromotionCheers.presenceOP.remote = { emoji: '🚀', updatedAt: Date.now() };
    window.__qaWatch.get('workspacePromotionCheers/presenceOP')?.(structuredClone(window.__qaStore.workspacePromotionCheers.presenceOP));
  });
  assert.equal(await page.locator('[data-pjm-cheer="🚀"] strong').textContent(), '1', 'server refresh updates count');

  await fixture('admin', { dates: { umqna7jpj: { status: 'completed', hitDate: '2026-09-15', updatedBy: 'admin', updatedAt: Date.now() } } });
  assert.match(await page.locator('[data-pjm-uid="umqna7jpj"] .pjm-date').textContent(), /2026\.09\.15/);
  await page.evaluate(() => {
    window.__qaErrors.get('workspacePromotionMilestones/umqna7jpj/TL')?.(new Error('milestone read failed'));
    window.__qaErrors.get('workspacePromotionCheers/presenceOP')?.(new Error('cheer read failed'));
  });
  assert.match(await page.locator('[data-pjm-uid="umqna7jpj"] .pjm-date').textContent(), /확인 중/, 'milestone read error does not retain stale date');
  assert.match(await page.locator('#pjMilestones .pjm-status.is-error').textContent(), /milestone read failed/);
  assert.match(await page.locator('#pjmCheerStatus.is-error').textContent(), /응원 기록을 읽지 못했습니다/);
  assert.equal(await page.locator('[data-pjm-cheer="👏"] strong').textContent(), '…', 'cheer read error does not retain stale count');
  assert.equal(await page.locator('[data-pjm-cheer]:disabled').count(), 4, 'cheers disabled until fresh collection');
  assert.deepEqual(await promotionWrites(), [], 'read failures do not write');
  await page.evaluate(() => {
    const now = Date.now;
    Date.now = () => now() + 11000;
    window.__pj.jRender();
    Date.now = now;
  });
  await page.waitForFunction(() => document.querySelector('[data-pjm-uid="umqna7jpj"] .pjm-date')?.textContent.includes('2026.09.15') && !document.querySelector('#pjmCheerStatus')?.classList.contains('is-error'));
  assert.equal(await page.locator('[data-pjm-cheer="👏"] strong').textContent(), '1', 'fresh collection restores counts');
  assert.equal(await page.locator('#pjMilestones .pjm-status.is-error').count(), 0, 'read error clears after recovery');
  assert.deepEqual(await promotionWrites(), [], 'recovery remains read-only');

  await fixture('member');
  await page.evaluate(() => { me.status = 'inactive'; });
  await page.waitForFunction(() => !document.querySelector('#pjMilestones,#pjNextPromotion'), null, { timeout: 2500 });
  assert.equal(await page.locator('#pjMilestones,#pjNextPromotion').count(), 0, 'inactive actor guard clears Journey controls');
  assert.deepEqual(await page.evaluate(() => [...window.__qaWatch.keys()].filter(path => /^workspacePromotion(Milestones|Cheers)\//.test(path))), [], 'inactive actor detaches Journey listeners');
  await page.evaluate(() => { me.status = 'active'; window.__pj.jRender(); });
  await page.waitForFunction(() => !!document.querySelector('#pjMilestones') && !!document.querySelector('#pjNextPromotion'));
  assert.equal(await page.locator('[data-pjm-cheer="👏"] strong').textContent(), '1', 'same UID activation resubscribes');
  await page.evaluate(() => { window.__previewRole = 'IC'; });
  await page.waitForFunction(() => !document.querySelector('#pjMilestones,#pjNextPromotion'), null, { timeout: 2500 });
  assert.equal(await page.locator('#pjMilestones,#pjNextPromotion').count(), 0, 'preview guard clears Journey controls');
  await page.evaluate(() => { window.__previewRole = ''; window.__pj.jRender(); });
  await page.waitForFunction(() => !!document.querySelector('#pjMilestones') && !!document.querySelector('#pjNextPromotion'));
  assert.equal(await page.locator('[data-pjm-cheer="👏"] strong').textContent(), '1', 'preview exit resubscribes');
  assert.deepEqual(await promotionWrites(), [], 'status and preview changes do not write');

  await fixture('admin', { adminOff: true });
  assert.equal(await page.locator('[data-pjm-date-form]').count(), 0, 'admin OFF hides date editor');
  await page.evaluate(() => { window.__adminOff = false; window.__previewRole = 'IC'; window.__pj.jRender(); });
  assert.equal(await page.locator('[data-pjm-date-form]').count(), 0, 'preview hides date editor');
  await fixture('admin');
  assert.equal(await page.evaluate(() => PresencePromotionJourney.validDate('2026-02-30')), false, 'invalid calendar date rejected');
  const form = page.locator('[data-pjm-date-form="umqna7jpj"]');
  await form.locator('[name=hitDate]').fill('2026-10-01');
  assert.equal(await form.locator('[name=hitDate]').evaluate(element => element.validity.rangeOverflow), true, 'future date invalid');
  assert.deepEqual(await promotionWrites(), []);
  await form.locator('[name=hitDate]').fill('2026-09-15');
  await page.evaluate(() => { window.__qaFail = true; });
  await form.locator('button[type=submit]').click();
  await page.waitForTimeout(120);
  assert.deepEqual(await promotionWrites(), [], 'failed date save writes nothing');
  assert.match(await page.locator('[data-pjm-uid="umqna7jpj"] .pjm-date').textContent(), /확인 중/);
  await page.evaluate(() => { window.__qaFail = false; });
  await form.locator('button[type=submit]').click();
  await page.waitForFunction(() => window.__qaWrites.some(write => write.path === 'workspacePromotionMilestones/umqna7jpj/TL'));
  write = (await promotionWrites()).at(-1);
  assert.deepEqual({ status: write.value.status, hitDate: write.value.hitDate, updatedBy: write.value.updatedBy }, { status: 'completed', hitDate: '2026-09-15', updatedBy: 'admin' });
  assert.match(await page.locator('[data-pjm-uid="umqna7jpj"] .pjm-date').textContent(), /2026\.09\.15/);
  assert.match(await page.locator('[data-pjm-uid="umqn54ujf"] .pjm-date').textContent(), /확인 중/, 'other candidate date remains unknown');
  await capture('admin-390-confirmed');

  const legacyBefore = await page.evaluate(() => localStorage.getItem('pjmock_pj_v1'));
  await page.locator('.pj-jcard').first().click();
  await page.waitForFunction(() => !!document.querySelector('#m-journey .pj-banner-lg'));
  assert.match(await page.locator('.pj-banner-lg + .pjm-legacy-note').textContent(), /윤채영.*2026\.09\.15/);
  assert.equal(await page.locator('#pjMilestones [data-pjm-uid]').count(), 1, 'detail shows matching candidate only');
  assert.equal(await page.evaluate(() => localStorage.getItem('pjmock_pj_v1')), legacyBefore, 'new feature does not change legacy journey records');

  await page.evaluate(() => { me = state.users.member; window.__pj.jRender(); });
  assert.equal(await page.locator('[data-pjm-date-form]').count(), 0, 'UID switch clears admin editor');
  await page.evaluate(() => { PresencePromotionJourney.dispose(); me = null; });
  assert.equal(await page.locator('#pjMilestones,#pjNextPromotion').count(), 0, 'logout disposal clears personal controls');
  assert.deepEqual(await page.evaluate(() => [...window.__qaWatch.keys()].filter(path => /^workspacePromotion(Milestones|Cheers)\//.test(path))), [], 'logout detaches promotion listeners');
  assert.deepEqual(pageErrors, [], 'page errors');
  console.log('PASS promotion Journey: actual index navigation, 4 roles, dates, read errors/recovery, cheers, revocation/reactivation, legacy match, 360/390/1024/1440 geometry');
} finally {
  await browser.close();
}
