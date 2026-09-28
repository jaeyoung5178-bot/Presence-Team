import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const output = process.env.PRESENCE_QA_OUTPUT || '/Users/jaeyoung5178/Documents/ChatGPT/Presence Work Book/design-review/implemented/20260928-recap-pending';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route(/(firebaseio\.com|firebasedatabase\.app|identitytoolkit|securetoken|gstatic\.com\/firebasejs|googleapis\.com\/(?!css))/, route => route.abort());
await page.goto(base + '/?qa=recap-pending', { waitUntil: 'domcontentloaded', timeout: 60000 });

const fixtures = () => {
  const u = (uid, name, role, extra = {}) => ({ uid, id: uid, name, role, status: 'active', surveys: {}, ...extra });
  const users = {
    admin: u('admin', '임재영', 'AOP'),
    fuse: u('umqn54ujf', '고윤경', 'TL'),
    wave: u('umqna7jpj', '윤채영', 'TL'),
    done: u('done', '완료퓨즈', 'IC'),
    savedZero: u('savedZero', '영원퓨즈', 'IC'),
    missing: u('missing', '미작성퓨즈', 'IC'),
    zero: u('zero', '영건퓨즈', 'IC'),
    legacy: u('legacy', '레거시퓨즈', 'IC', { status: undefined }),
    noWork: u('noWork', '신입퓨즈', 'IC'),
    na: u('na', '엔에이퓨즈', 'IC'),
    rally: u('rally', '랠리퓨즈', 'IC'),
    cleared: u('cleared', '삭제퓨즈', 'IC'),
    waveMissing: u('waveMissing', '미작성웨이브', 'IC'),
    retired: u('retired', '퇴사퓨즈', 'IC', { status: 'retired' }),
    bot: u('bot', '테스트봇', 'IC', { test: true }),
  };
  const dossier = Object.fromEntries(Object.values(users).map(user => [user.name, {
    teamName: user.uid === 'umqna7jpj' || user.uid === 'waveMissing' ? 'Young wave' : 'Fuse',
    upline: user.uid === 'waveMissing' ? '윤채영' : user.uid === 'umqna7jpj' || user.uid === 'umqn54ujf' ? '임재영' : '고윤경',
  }]));
  const sales = {};
  for (const user of [users.admin, users.fuse, users.wave, users.done, users.savedZero, users.missing, users.legacy, users.waveMissing, users.retired, users.bot]) {
    sales['2026-07-15|' + user.name] = { name: user.name, date: '2026-07-15', count: 1, checked: true };
  }
  sales['2026-07-15|' + users.zero.name] = { name: users.zero.name, date: '2026-07-15', count: 0, checked: true };
  sales['2026-07-15|' + users.na.name] = { name: users.na.name, date: '2026-07-15', na: true };
  sales['2026-07-15|' + users.rally.name] = { name: users.rally.name, date: '2026-07-15', rally: true };
  sales['2026-07-15|' + users.cleared.name] = { name: users.cleared.name, date: '2026-07-15', count: 2, checked: true, cleared: true };
  return { users, dossier, sales };
};

async function setup(role, ready = true) {
  await page.evaluate(({ role, ready, fixture }) => {
    window.__firebaseReady = true;
    window.__adminOff = false;
    window.__previewRole = null;
    window.__managerAccessUid = role === 'fuse' || role === 'wave' ? fixture.users[role].uid : '';
    window.__presenceWorkspaceBaseReady = { users: ready, sales: ready };
    window.__qaWrites = [];
    DB.set = async (path, value) => { window.__qaWrites.push({ path, value }); };
    DB.update = async (path, value) => { window.__qaWrites.push({ path, value }); };
    state.users = fixture.users;
    state.dossier = fixture.dossier;
    state.sales = fixture.sales;
    state.memberInfo = {};
    state.removedMembers = [];
    state.extraMembers = [];
    state.managers = ['고윤경', '윤채영'];
    state.weeklyProfitRecaps = {
      '2026-08-07': {
        admin: { uid: 'admin', netPayment: 0 },
        done: { uid: 'done', netPayment: 5000 },
        savedZero: { uid: 'savedZero', netPayment: 0 },
        fuse: { uid: 'umqn54ujf', netPayment: 0 },
        wave: { uid: 'umqna7jpj', netPayment: 0 },
      },
    };
    me = fixture.users[role];
    prcPendingRecapReadyUid = ready ? me.uid : '';
    prcPendingExpanded = false;
    prcAdminFrom = '2026-08';
    prcAdminTo = '2026-08';
    prcAdminPreset = 'month';
    prcAdminScope = 'team';
    document.getElementById('authGate')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    document.body.classList.add('app-on');
    document.querySelectorAll('.mpanel').forEach(el => el.classList.remove('active'));
    document.getElementById('m-recap')?.classList.add('active');
    document.querySelectorAll('#presenceGameLoader,#presenceEntryLobby,#presenceLoader').forEach(el => el.remove());
    renderProfitRecapAdminView();
  }, { role, ready, fixture: fixtures() });
}
const card = () => page.locator('#profitRecapAdminView .prp-card');
const text = () => card().innerText();
const names = () => page.locator('#profitRecapAdminView .prp-name').allInnerTexts();
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const viewports = [[390, 844], [1024, 768], [1440, 900], [360, 800]];

try {
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    for (const role of ['admin', 'fuse', 'wave', 'done']) {
      await setup(role);
      if (role === 'done') {
        assert.equal(await card().count(), 0, 'member sees no pending card');
        continue;
      }
      assert.ok((await overflow()) <= 1, role + ' ' + width + ' horizontal overflow');
      const got = await names();
      if (role === 'admin') {
        assert.ok(got.includes('미작성퓨즈') && got.includes('미작성웨이브') && got.includes('레거시퓨즈'));
        assert.ok(!got.includes('신입퓨즈') && !got.includes('엔에이퓨즈') && !got.includes('랠리퓨즈') && !got.includes('삭제퓨즈'));
      } else if (role === 'fuse') {
        assert.ok(got.includes('미작성퓨즈') && !got.includes('미작성웨이브'), 'fuse list: '+JSON.stringify(got));
      } else {
        assert.ok(got.includes('미작성웨이브') && !got.includes('미작성퓨즈'));
      }
      assert.ok(!(await text()).includes('영원퓨즈'), 'saved zero payment counts complete');
      assert.equal(await card().locator('img[alt=""][width="64"][height="64"]').count(), 1);
      await card().locator('.prp-art').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.querySelectorAll('#profitRecapAdminView .prp-art')].every(el => el.complete && el.naturalWidth > 0), { timeout: 10000 });
      assert.ok(await card().locator('.prp-art').evaluate(el => el.complete && el.naturalWidth > 0), 'decorative art loads');
      if (width === 390 && role === 'admin') {
        const toggle = card().locator('.prp-more summary');
        assert.ok((await toggle.boundingBox()).height >= 44, 'mobile expansion target');
        await toggle.click();
        assert.ok((await names()).includes('영건퓨즈'), 'expanded names visible');
      }
      await page.screenshot({ path: output + '/recap-' + role + '-' + width + '.png', fullPage: false });
    }
  }
  await setup('admin', false);
  assert.match(await text(), /불러오는 중/);
  await page.screenshot({ path: output + '/recap-loading-390.png' });
  await setup('admin');
  const duplicate = await page.evaluate(() => {
    const prior = state.sales;
    state.sales = saleRecordsFromSnapshot({ '2026-07-15': {
      first: { name: '삭제퓨즈', count: 2, checked: true },
      latest: { name: '삭제퓨즈', count: 0, checked: false, cleared: true },
    } });
    const result = prcPendingRecapMembers('2026-08');
    state.sales = prior;
    return result;
  });
  assert.equal(duplicate.eligible, 0, 'latest cleared duplicate removes field-work evidence');
  await page.evaluate(() => { state.weeklyProfitRecaps['2026-08-14'] = { missing: { uid: 'missing', netPayment: 0 } }; renderRecap(); });
  assert.ok(!(await names()).includes('미작성퓨즈'), 'live saved-zero update removes pending name');
  await page.evaluate(() => { delete state.weeklyProfitRecaps['2026-08-14']; prcAdminSetRange('from', '2026-07'); });
  assert.match(await text(), /2026년 8월 리캡 미작성/, 'custom range status follows chosen end month');
  await page.evaluate(() => prcAdminSetMonth('2026-10'));
  assert.match(await text(), /아직 시작하지 않은 월이에요/);
  await page.screenshot({ path: output + '/recap-future-390.png' });
  await setup('admin');
  await page.evaluate(() => { state.weeklyProfitRecaps = {}; prcAdminSetMonth('2026-06'); });
  assert.match(await text(), /아직 필드 근무 이력이 있는 팀원이 없어요/);
  await page.screenshot({ path: output + '/recap-no-eligible-390.png' });
  await page.evaluate(() => { prcAdminSetMonth('2026-08'); Object.values(state.users).forEach(u => { if (u?.uid) (state.weeklyProfitRecaps['2026-08-07'] ||= {})[u.uid] = { uid: u.uid, netPayment: 0 }; }); renderProfitRecapAdminView(); });
  assert.match(await text(), /모두 한 건 이상 기록했어요/);
  await page.screenshot({ path: output + '/recap-all-recorded-390.png' });
  await page.evaluate(() => { window.__previewRole = 'IC'; renderProfitRecapAdminView(); });
  assert.equal(await card().count(), 0, 'preview hides privileged card');
  await page.evaluate(() => { window.__previewRole = null; window.__adminOff = true; renderProfitRecapAdminView(); });
  assert.equal(await card().count(), 0, 'admin OFF hides privileged card');
  assert.deepEqual(await page.evaluate(() => window.__qaWrites), [], 'status view performs no writes');
  assert.deepEqual(errors, []);
  console.log('Recap pending QA passed. Screenshots: ' + output);
} finally {
  await browser.close();
}
