import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const js = await readFile(new URL('../assets/presence-admin-home.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../assets/presence-admin-home.css', import.meta.url), 'utf8');

for (const token of [
  'global.PresenceAdminHome',
  "go('survey')",
  "afterAdmin('#newMemberIn', true)",
  "afterAdmin('.mem-rows', false)",
  "afterAdmin('#departedBody', false)",
  'openPendingApprovals',
  'pendingApprovalUsers',
  'promotionRecords',
]) assert.ok(js.includes(token), `missing Admin Home contract: ${token}`);

for (const token of [
  '.pah-shell',
  '.pah-action:focus-visible',
  '@media (min-width:640px) and (max-width:1199px)',
  '@media (max-width:639px)',
  '@media (prefers-reduced-motion:reduce)',
  'min-height:116px',
]) assert.ok(css.includes(token), `missing responsive CSS contract: ${token}`);

class FakeButton {
  constructor(action) {
    this.dataset = { pahAction: action };
    this.listeners = {};
  }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  click() { this.listeners.click?.(); }
}

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.hidden = false;
    this.attributes = {};
    this.buttons = [];
    this._html = '';
    this.focused = 0;
    this.scrolled = 0;
  }
  set innerHTML(value) {
    this._html = String(value);
    this.buttons = [...this._html.matchAll(/data-pah-action="([^"]+)"/g)].map((match) => new FakeButton(match[1]));
  }
  get innerHTML() { return this._html; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  querySelectorAll(selector) { return selector === '[data-pah-action]' ? this.buttons : []; }
  scrollIntoView() { this.scrolled += 1; }
  focus() { this.focused += 1; }
}

const mount = new FakeElement('adminHomeMount');
const targets = {
  '#newMemberIn': new FakeElement('newMemberIn'),
  '.mem-rows': new FakeElement('memberRows'),
  '#departedBody': new FakeElement('departedBody'),
  '#pendList': new FakeElement('pendList'),
};
const tabCalls = [];
let approvalCalls = 0;
const context = {
  console,
  document: {
    getElementById(id) { return id === 'adminHomeMount' ? mount : null; },
    querySelector(selector) { return targets[selector] || null; },
  },
  setTimeout(fn) { fn(); return 1; },
  clearTimeout() {},
  matchMedia() { return { matches: true }; },
  goTab(name) { tabCalls.push(name); },
  openPendingApprovals() { approvalCalls += 1; },
  pendingApprovalUsers() { return [{ uid: 'pending-a', status: 'pending' }]; },
  promotionRecords() { return [{ uid: 'survey-a', status: 'pending' }]; },
  isFounder(actor) { return actor?.uid === 'admin'; },
  isTestBot(user) { return user?.test === true; },
};
context.window = context;
vm.createContext(context);
vm.runInContext(js, context, { filename: 'presence-admin-home.js' });

assert.ok(context.PresenceAdminHome, 'module was not exported');
const snapshot = {
  users: {
    admin: { uid: 'admin', name: '임재영', role: 'AOP', status: 'active' },
    member: { uid: 'member', name: '팀원', role: 'IC', status: 'active' },
    bot: { uid: 'bot', name: '테스트', role: 'IC', status: 'active', test: true },
    pending: { uid: 'pending', name: '가입대기', role: 'IC', status: 'pending' },
  },
  removedMembers: ['퇴사자'],
};
const admin = snapshot.users.admin;

assert.equal(context.PresenceAdminHome.render('adminHomeMount', { actor: admin, state: snapshot }), true);
assert.equal(mount.hidden, false);
assert.equal(mount.attributes['data-pah-ready'], 'true');
assert.match(mount.innerHTML, /ADMIN HOME · OPERATIONS/);
assert.match(mount.innerHTML, /설문 보기/);
assert.match(mount.innerHTML, /신입 등록/);
assert.match(mount.innerHTML, /권한 관리/);
assert.match(mount.innerHTML, /퇴사자 관리/);
assert.match(mount.innerHTML, /가입 승인/);
assert.match(mount.innerHTML, /ACTIVE TEAM[\s\S]*2<small>명/);

const button = (action) => mount.buttons.find((item) => item.dataset.pahAction === action);
button('survey').click();
assert.equal(tabCalls.at(-1), 'survey');
button('new-member').click();
assert.equal(tabCalls.at(-1), 'admin');
assert.equal(targets['#newMemberIn'].focused, 1);
assert.equal(targets['#newMemberIn'].scrolled, 1);
button('permissions').click();
assert.equal(targets['.mem-rows'].scrolled, 1);
button('departed').click();
assert.equal(targets['#departedBody'].scrolled, 1);
button('approvals').click();
assert.equal(approvalCalls, 1);

for (const actor of [
  { uid: 'leader', name: '리더', role: 'TL', status: 'active' },
  { uid: 'member', name: '팀원', role: 'IC', status: 'active' },
]) {
  assert.equal(context.PresenceAdminHome.render(mount, { actor, state: snapshot }), false);
  assert.equal(mount.innerHTML, '', `${actor.role} received privileged markup`);
  assert.equal(mount.hidden, true);
}

context.isFounder = () => false;
assert.equal(context.PresenceAdminHome.render(mount, { actor: admin, state: snapshot }), false, 'preview/admin-off founder check was bypassed');
assert.equal(mount.innerHTML, '');

context.isFounder = (actor) => actor?.uid === 'admin';
context.PresenceAdminHome.render(mount, { actor: admin, state: snapshot });
context.PresenceAdminHome.reset(mount);
assert.equal(mount.innerHTML, '');
assert.equal(mount.hidden, true);

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ reducedMotion: 'reduce' });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
await page.setContent('<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>html,body{margin:0;min-height:100%;background:#e9edf3}body{padding:20px}#adminHomeMount{width:min(1320px,100%);margin:auto}</style><style>' + css + '</style></head><body><main id="adminHomeMount"></main></body></html>');
await page.addScriptTag({ content: `
  window.me={uid:'admin',name:'임재영',role:'AOP',status:'active'};
  window.state={users:{admin:me,a:{uid:'a',name:'팀원',role:'IC',status:'active'},p:{uid:'p',name:'가입대기',role:'IC',status:'pending'}},promotionSurveys:{a:{TL:{status:'pending'}}},removedMembers:['퇴사자']};
  window.isFounder=(actor)=>actor&&actor.uid==='admin';
  window.isTestBot=(actor)=>!!(actor&&actor.test);
  window.pendingApprovalUsers=()=>Object.values(state.users).filter((user)=>user.status==='pending');
  window.promotionRecords=()=>[{status:'pending'}];
  window.goTab=()=>{};
  window.openPendingApprovals=()=>{};
` });
await page.addScriptTag({ content: js });

const viewports = [
  { width: 390, height: 844, columns: [1, 1, 1, 1, 1] },
  { width: 1024, height: 768, columns: [3, 2] },
  { width: 1440, height: 900, columns: [5] },
];
for (const viewport of viewports) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.evaluate(() => window.PresenceAdminHome.render('adminHomeMount', { actor: window.me, state: window.state }));
  const geometry = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.pah-action')];
    const rows = [];
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      let row = rows.find((item) => Math.abs(item.top - rect.top) < 2);
      if (!row) { row = { top: rect.top, count: 0 }; rows.push(row); }
      row.count += 1;
    });
    const clipped = [...document.querySelectorAll('.pah-shell h2,.pah-shell h3,.pah-action-copy strong,.pah-action-copy small')]
      .filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 2)
      .map((element) => element.textContent.trim());
    return {
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
      rows: rows.sort((a, b) => a.top - b.top).map((row) => row.count),
      cards: cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
      }),
      clipped,
    };
  });
  assert.ok(geometry.pageOverflow <= 1, `${viewport.width}px has horizontal overflow: ${geometry.pageOverflow}`);
  assert.deepEqual(geometry.rows, viewport.columns, `${viewport.width}px action grid is not balanced`);
  assert.deepEqual(geometry.clipped, [], `${viewport.width}px clips key text`);
  for (const card of geometry.cards) {
    assert.ok(card.width >= 44 && card.height >= 44, `${viewport.width}px has an undersized action`);
    assert.ok(card.left >= -0.5 && card.right <= viewport.width + 0.5, `${viewport.width}px card escapes viewport`);
  }
}

await page.evaluate(() => window.PresenceAdminHome.render('adminHomeMount', { actor: { uid: 'tl', name: '팀장', role: 'TL', status: 'active' }, state: window.state }));
assert.deepEqual(await page.evaluate(() => ({ children: document.getElementById('adminHomeMount').childElementCount, hidden: document.getElementById('adminHomeMount').hidden })), { children: 0, hidden: true });
await browser.close();
assert.deepEqual(pageErrors, [], `browser errors: ${pageErrors.join(' | ')}`);

console.log('PASS Admin Home module: auth, real actions, pending data, and 390/1024/1440 geometry');
