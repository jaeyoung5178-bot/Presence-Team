import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const output = process.env.PRESENCE_QA_OUTPUT || '/tmp/presence-home-pending-qa';
const review = '/Users/jaeyoung5178/Documents/ChatGPT/Presence Work Book/design-review/implemented/20260928-mobile-focus';
const finalReview = '/Users/jaeyoung5178/Documents/ChatGPT/Presence Work Book/design-review/implemented/20260928-home-pending';
await mkdir(output, { recursive: true });
await mkdir(review, { recursive: true });
await mkdir(finalReview, { recursive: true });

// The fixture remains offline. These source checks bind its simulated snapshot delivery
// to the production callback contract instead of silently testing a different update path.
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.match(html, /rawOn=\(p,cb,onError\)=>fb\.onValue\([\s\S]*?finally\{window\.PresenceWorkspace\?\.schedule\(\);\}/);
assert.match(html, /DB\.on\('sales',v=>\{[\s\S]*?__presenceWorkspaceBaseReady\|\|[\s\S]*?\.sales=true/);
assert.match(html, /DB\.on\('users',v=>\{[\s\S]*?__presenceWorkspaceBaseReady\|\|[\s\S]*?\.users=true/);

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route(/(firebaseio\.com|firebasedatabase\.app|identitytoolkit|securetoken|gstatic\.com\/firebasejs|googleapis\.com\/(?!css))/, route => route.abort());

const user = (uid, name, role, extra = {}) => ({ uid, name, id: uid, role, status: 'active', surveys: {}, ...extra });
const users = {
  admin: user('admin', '임재영', 'AOP'),
  fuse: user('umqn54ujf', '고윤경', 'TL'),
  wave: user('umqna7jpj', '윤채영', 'TL'),
  missing: user('missing', '미제출퓨즈', 'IC'),
  cleared: user('cleared', '삭제퓨즈', 'IC'),
  zero: user('zero', '영건퓨즈', 'IC'),
  na: user('na', '엔에이퓨즈', 'IC'),
  rally: user('rally', '랠리퓨즈', 'IC'),
  other: user('other', '미제출웨이브', 'IC'),
  legacy: user('legacy', '레거시퓨즈', 'IC', { status: undefined }),
  inactive: user('inactive', '휴면팀원', 'IC', { status: 'inactive' }),
  departed: user('departed', '퇴사팀원', 'IC'),
  future: user('future', '미래팀원', 'IC'),
  bot: user('bot', '테스트', 'IC', { test: true }),
};
const dossier = {
  고윤경: { teamName: 'Fuse', upline: '임재영' }, 윤채영: { teamName: 'Young wave', upline: '임재영' },
  미제출퓨즈: { teamName: 'Fuse', upline: '고윤경' }, 삭제퓨즈: { teamName: 'Fuse', upline: '고윤경' },
  영건퓨즈: { teamName: 'Fuse', upline: '고윤경' }, 엔에이퓨즈: { teamName: 'Fuse', upline: '고윤경' },
  랠리퓨즈: { teamName: 'Fuse', upline: '고윤경' }, 미제출웨이브: { teamName: 'Young wave', upline: '윤채영' },
  레거시퓨즈: { teamName: 'Fuse', upline: '고윤경' },
  휴면팀원: { teamName: 'Fuse', upline: '고윤경' }, 퇴사팀원: { teamName: 'Fuse', upline: '고윤경' },
  미래팀원: { teamName: 'Fuse', upline: '고윤경' }, 테스트: { teamName: 'Fuse', upline: '고윤경' },
};

async function render(role = 'admin', ready = true) {
  await page.evaluate(({ role, ready, users, dossier }) => {
    window.PresenceWorkspace.dispose();
    window.__presenceWorkspaceBaseReady = { users: ready, sales: ready };
    window.__adminOff = false;
    window.__previewRole = '';
    window.__firebaseReady = false;
    window.__qaWrites = window.__qaWrites || [];
    DB.set = async (path, value) => { window.__qaWrites.push({ path, value }); };
    DB.update = async (path, value) => { window.__qaWrites.push({ path, value }); };
    DB.on = () => () => {};
    DB.get = async () => null;
    state.users = structuredClone(users);
    state.dossier = structuredClone(dossier);
    state.extraMembers = [];
    state.removedMembers = [];
    state.memberInfo = {};
    ALLOWED_MEMBERS = ['레거시퓨즈', '휴면팀원', '퇴사팀원', '미래팀원'];
    DEPARTED_MEMBERS = ['퇴사팀원'];
    const date = PresenceWorkspace.core.dateKey();
    const tomorrow = PresenceWorkspace.core.add(date, 1);
    state.memberInfo[nk('미래팀원')] = { join: tomorrow };
    state.sales = Object.fromEntries([
      ['임재영', { count: 1, checked: true }], ['고윤경', { count: 1, checked: true }],
      ['윤채영', { count: 1, checked: true }], ['삭제퓨즈', { count: 3, checked: true, cleared: true }],
      ['영건퓨즈', { count: 0, checked: true }], ['엔에이퓨즈', { na: true }],
      ['랠리퓨즈', { rally: true }],
    ].map(([name, entry]) => [date + '|' + name, { date, name, ...entry }]));
    me = state.users[role];
    document.getElementById('authGate')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    document.body.classList.add('app-on');
    document.querySelectorAll('#presenceGameLoader,#presenceEntryLobby,#presenceLoader').forEach(el => el.remove());
    buildRail(); goTab('home'); PresenceWorkspace.render('home');
  }, { role, ready, users, dossier });
  await page.waitForTimeout(100);
  // Legacy home setup may provision callback profiles. Measure only subsequent
  // pending-status reads and updates, which must remain read-only.
  await page.evaluate(() => { window.__qaWrites = []; });
}

async function snapshot() {
  return page.evaluate(() => ({
    title: document.querySelector('#workspaceHome .pw-home-primary h2')?.textContent.trim() || '',
    hint: document.querySelector('#workspaceHome .pw-home-primary p')?.textContent.trim() || '',
    names: [...document.querySelectorAll('#pwHomePending .pw-home-pending-list li')].map(el => el.textContent.trim()),
    pendingRegion: !!document.getElementById('pwHomePending'),
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    writes: window.__qaWrites.filter(write => /^(sales|users|workspace)/.test(write.path)),
  }));
}

try {
  await page.goto(base + '/?qa=home-pending-' + Date.now(), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.PresenceWorkspace && !!document.getElementById('workspaceHome'));

  await render('admin', false);
  let stateNow = await snapshot();
  assert.match(stateNow.title, /불러오는 중/);
  assert.equal(stateNow.pendingRegion, false, 'loading must never flash an all-submitted status or names');
  await page.evaluate(() => {
    window.__presenceWorkspaceBaseReady.users = true;
    PresenceWorkspace.schedule();
  });
  await page.waitForTimeout(100);
  assert.match((await snapshot()).title, /불러오는 중/, 'users alone is insufficient');
  await page.evaluate(() => {
    window.__presenceWorkspaceBaseReady.sales = true;
    PresenceWorkspace.schedule();
  });
  await page.waitForTimeout(100);
  stateNow = await snapshot();
  assert.match(stateNow.title, /4명 결과 제출대기/);
  assert.deepEqual(stateNow.names.toSorted(), ['삭제퓨즈', '미제출퓨즈', '미제출웨이브', '레거시퓨즈'].toSorted());
  assert.deepEqual(stateNow.writes, []);

  for (const [role, expected] of [
    ['admin', ['삭제퓨즈', '미제출퓨즈', '미제출웨이브', '레거시퓨즈']],
    ['fuse', ['삭제퓨즈', '미제출퓨즈', '레거시퓨즈']],
    ['wave', ['미제출웨이브']],
    ['zero', []],
  ]) for (const width of [360, 390, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 360 ? 800 : width === 390 ? 844 : width === 1024 ? 768 : 900 });
    await render(role);
    const result = await snapshot();
    assert.deepEqual(result.names.toSorted(), expected.toSorted(), `${role}/${width} scoped pending names`);
    assert.equal(result.overflow, false, `${role}/${width} horizontal overflow`);
    if (role === 'zero') assert.equal(result.pendingRegion, false, 'member must not see team pending DOM');
    else assert.match(result.title, new RegExp(`^${expected.length}명 결과 제출대기$`));
    if (role === 'admin') {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${review}/home-pending-v11-admin-${width}.png` });
      if (width === 390) {
        await page.screenshot({ path: `${finalReview}/admin-mobile.png`, fullPage: true });
        await page.locator('#workspaceHome .pw-home-primary').screenshot({ path: `${finalReview}/pending-card.png` });
      }
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await render('admin');
  for (const [flag, value] of [['__adminOff', true], ['__previewRole', 'IC']]) {
    await page.evaluate(({ flag, value }) => { window[flag] = value; PresenceWorkspace.render('home'); }, { flag, value });
    assert.equal((await snapshot()).pendingRegion, false, `${flag} must clear privileged names`);
    await page.evaluate(flag => { window[flag] = flag === '__previewRole' ? '' : false; PresenceWorkspace.render('home'); }, flag);
    assert.equal((await snapshot()).names.length, 4);
  }
  await page.evaluate(() => { me = state.users.zero; PresenceWorkspace.render('home'); });
  assert.equal((await snapshot()).pendingRegion, false, 'UID switch must remove admin names');
  await page.evaluate(() => { PresenceWorkspace.dispose(); window.__qaDisposedCount = document.querySelectorAll('#pwHomePending').length; me = state.users.admin; PresenceWorkspace.render('home'); });
  assert.equal(await page.evaluate(() => window.__qaDisposedCount), 0, 'logout dispose must clear the prior list');
  assert.equal((await snapshot()).names.length, 4, 'relogin may use still-live base snapshots');

  // Emulate the data update performed by DB.on('sales'), followed by rawOn's schedule().
  await page.evaluate(() => {
    const date = PresenceWorkspace.core.dateKey();
    state.sales[date + '|미제출퓨즈'] = { date, name: '미제출퓨즈', count: 0, checked: true };
    PresenceWorkspace.schedule();
  });
  await page.waitForTimeout(100);
  assert.deepEqual((await snapshot()).names.toSorted(), ['삭제퓨즈', '미제출웨이브', '레거시퓨즈'].toSorted());
  await page.evaluate(() => {
    const date = PresenceWorkspace.core.dateKey();
    state.sales[date + '|삭제퓨즈'] = { date, name: '삭제퓨즈', na: true };
    state.sales[date + '|미제출웨이브'] = { date, name: '미제출웨이브', rally: true };
    state.sales[date + '|레거시퓨즈'] = { date, name: '레거시퓨즈', count: 0, checked: true };
    PresenceWorkspace.schedule();
  });
  await page.waitForTimeout(100);
  stateNow = await snapshot();
  assert.equal(stateNow.pendingRegion, false);
  assert.match(stateNow.title, /모두 제출/);
  assert.deepEqual(stateNow.writes, []);

  await render('admin');
  await page.evaluate(() => {
    const date = PresenceWorkspace.core.dateKey();
    for (let i = 0; i < 24; i++) {
      const uid = 'long' + i, name = '긴이름검증_' + i + '_' + '가나다라마바사아자차카타파하'.repeat(2);
      state.users[uid] = { uid, id: uid, name, role: 'IC', status: 'active', surveys: {} };
      state.dossier[name] = { teamName: 'Fuse', upline: '고윤경' };
    }
    PresenceWorkspace.render('home');
  });
  stateNow = await snapshot();
  assert.equal(stateNow.names.length, 28);
  const summary = page.locator('#pwHomePendingMore summary');
  assert.equal(await summary.count(), 1);
  assert.ok((await summary.boundingBox()).height >= 44, 'expand summary touch target is at least 44px');
  await summary.click();
  assert.equal(await page.locator('#pwHomePendingMore').getAttribute('open'), '');
  await page.evaluate(() => PresenceWorkspace.render('home'));
  assert.equal(await page.locator('#pwHomePendingMore').getAttribute('open'), '', 'expanded state survives realtime render');
  for (const width of [360, 390, 1024, 1440]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : width === 1024 ? 768 : 900 });
    const layout = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: innerWidth,
      summary: document.querySelector('#pwHomePendingMore summary').getBoundingClientRect().height,
      chips: [...document.querySelectorAll('#pwHomePending li')].filter(el => el.scrollWidth > el.clientWidth + 1).length,
    }));
    assert.ok(layout.page <= layout.viewport + 1, `${width}: document overflow ${JSON.stringify(layout)}`);
    assert.equal(layout.chips, 0, `${width}: name chip clipping`);
    assert.ok(layout.summary >= 44, `${width}: undersized expand target`);
  }
  assert.deepEqual((await snapshot()).writes, [], 'reading pending status never writes');
  assert.deepEqual(errors, [], 'browser page errors');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output + '/admin-390-expanded.png' });
  console.log('PASS home pending names: readiness, status semantics, scopes, access, realtime, expansion, 360/390/1024/1440 layout, no writes');
} finally {
  await browser.close();
}
