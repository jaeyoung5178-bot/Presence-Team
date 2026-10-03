import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4187/';
const sources = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../preview.html', import.meta.url), 'utf8'),
]);

for (const [offset, source] of sources.entries()) {
  const name = offset === 0 ? 'index.html' : 'preview.html';
  assert.match(source, /<link rel="stylesheet" href="assets\/presence-admin-home\.css\?v=[^"]+">/, `${name}: Admin Home CSS asset missing`);
  assert.match(source, /<script src="assets\/presence-admin-home\.js\?v=[^"]+"><\/script>/, `${name}: Admin Home JS asset missing`);
  assert.match(source, /<div class="mpanel active" id="m-home"><div class="wrap">\s*<div id="adminHomeMount" hidden><\/div>/, `${name}: mount is not the first Home child`);

  const goTabStart = source.indexOf('function goTab(name){');
  const routeGuard = source.indexOf("window.PresenceAdminHome.guardRoute(name,me,'adminHomeMount')", goTabStart);
  const visibilityGuard = source.indexOf('if(!tabVisible(name))', goTabStart);
  assert.ok(goTabStart >= 0 && routeGuard > goTabStart && routeGuard < visibilityGuard, `${name}: direct-route guard must run before tab visibility`);

  const defaults = source.match(/goTab\(isFounder\(me\)\?'adminhome':/g) || [];
  assert.ok(defaults.length >= 2, `${name}: both login paths must default founders to Admin Home`);

  const logoutStart = source.indexOf('async function logout(){');
  const logoutEnd = source.indexOf('\n}', logoutStart);
  const logoutBody = source.slice(logoutStart, logoutEnd + 2);
  const resetAt = logoutBody.indexOf("window.PresenceAdminHome?.reset?.('adminHomeMount')");
  const clearActorAt = logoutBody.indexOf('me=null');
  assert.ok(resetAt >= 0 && clearActorAt > resetAt, `${name}: logout must reset Admin Home before clearing actor`);

  const invalidations = source.match(/window\.PresenceAdminHome\?\.invalidate\?\.\(\)/g) || [];
  assert.ok(invalidations.length >= 3, `${name}: live state invalidation wiring is incomplete`);
}

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const context = await browser.newContext({
  reducedMotion: 'reduce',
  serviceWorkers: 'block',
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
const localFailures = [];
const localBadResponses = [];
let blockedFirebase = 0;

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('ERR_BLOCKED_BY_CLIENT')) consoleErrors.push(message.text());
});
page.on('requestfailed', (request) => {
  if (request.url().startsWith(baseUrl)) localFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'failed'}`);
});
page.on('response', (response) => {
  if (response.url().startsWith(baseUrl) && response.status() >= 400) localBadResponses.push(`${response.status()} ${response.url()}`);
});

await page.route('**/*', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.hostname === 'www.gstatic.com' && url.pathname.includes('/firebasejs/')) {
    blockedFirebase += 1;
    await route.abort('blockedbyclient');
    return;
  }
  if (url.origin === new URL(baseUrl).origin) {
    await route.continue();
    return;
  }
  if (request.resourceType() === 'stylesheet') {
    await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return;
  }
  if (request.resourceType() === 'script') {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    return;
  }
  if (url.hostname === 'api.open-meteo.com') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        current: { precipitation: 0, rain: 0, showers: 0, snowfall: 0, weather_code: 0, is_day: 1 },
        daily: {
          sunrise: ['2026-10-03T06:30'],
          sunset: ['2026-10-03T18:15'],
          time: ['2026-10-03'],
          weather_code: [0],
          temperature_2m_max: [23],
          temperature_2m_min: [15],
          precipitation_probability_max: [0],
        },
      }),
    });
    return;
  }
  await route.fulfill({ status: 204, contentType: 'text/plain', body: '' });
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
await page.waitForFunction(() => window.PresenceAdminHome && typeof goTab === 'function', null, { timeout: 15_000 });
await page.waitForTimeout(350);
assert.ok(blockedFirebase > 0, 'Firebase network was not blocked by the integration harness');

await page.evaluate(() => {
  window.__pahScrollLog = [];
  window.__pahFocusLog = [];
  if (!window.__pahNativeScrollIntoView) window.__pahNativeScrollIntoView = Element.prototype.scrollIntoView;
  if (!window.__pahNativeFocus) window.__pahNativeFocus = HTMLElement.prototype.focus;
  Element.prototype.scrollIntoView = function scrollIntoViewForAdminHomeQa(options) {
    window.__pahScrollLog.push({ id: this.id || '', className: typeof this.className === 'string' ? this.className : '' });
    try { return window.__pahNativeScrollIntoView.call(this, options); } catch (_) { return undefined; }
  };
  HTMLElement.prototype.focus = function focusForAdminHomeQa(options) {
    window.__pahFocusLog.push({ id: this.id || '', connected: this.isConnected });
    try { return window.__pahNativeFocus.call(this, options); } catch (_) { return window.__pahNativeFocus.call(this); }
  };
});

async function enterAdminHome() {
  await page.evaluate(() => {
    const admin = { uid: 'admin', id: 'presence-admin', name: '임재영', role: 'AOP', status: 'active', surveys: {} };
    const active = { uid: 'active-member', id: 'active-member', name: '김팀원', role: 'IC', status: 'active', surveys: {} };
    const pending = { uid: 'pending-member', id: 'pending-member', name: '가입대기', role: 'IC', status: 'pending', surveys: {} };
    state.users = { admin, [active.uid]: active, [pending.uid]: pending };
    state.extraMembers = [];
    state.removedMembers = ['퇴사자'];
    state.memberInfo = { retired: { name: '퇴사자', left: true } };
    state.promotionSurveys = {
      [active.uid]: {
        TL: { uid: active.uid, name: active.name, role: 'IC', surveyKey: 'TL', status: 'pending', token: 'qa-token', createdAt: Date.now() },
      },
    };
    me = admin;
    window.__adminOff = false;
    window.__previewRole = null;
    document.body.classList.add('app-on', 'can-mod', 'can-daily');
    document.getElementById('app').classList.remove('hidden');
    const gate = document.getElementById('authGate');
    gate.classList.add('hidden');
    gate.setAttribute('aria-hidden', 'true');
    const lobby = document.getElementById('presenceEntryLobby');
    if (lobby) { lobby.classList.remove('show'); lobby.setAttribute('aria-hidden', 'true'); }
    window.hidePresenceLoader?.();
    buildRail();
    goTab('adminhome');
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => document.querySelectorAll('#adminHomeMount .pah-action').length === 5 && document.getElementById('adminHomeMount').dataset.pahMode === 'admin');
  await page.waitForTimeout(280);
}

function overlap(a, b) {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

async function inspectAdminGeometry(width) {
  const geometry = await page.evaluate(() => {
    const rect = (element) => {
      const r = element.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const visible = (element) => {
      const style = getComputedStyle(element);
      const r = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    const cards = [...document.querySelectorAll('#adminHomeMount .pah-action')].filter(visible);
    const switches = [...document.querySelectorAll('#adminHomeMount .pah-mode-switch button')].filter(visible);
    const rows = [];
    cards.forEach((card) => {
      const r = rect(card);
      let row = rows.find((entry) => Math.abs(entry.top - r.top) < 2);
      if (!row) { row = { top: r.top, count: 0 }; rows.push(row); }
      row.count += 1;
    });
    const chrome = [...document.querySelectorAll('header.top,nav.rail,.botbar')].filter(visible).map((element) => ({ selector: element.className || element.id, rect: rect(element) }));
    const clipped = [...document.querySelectorAll('#adminHomeMount h2,#adminHomeMount h3,#adminHomeMount .pah-action-copy strong,#adminHomeMount .pah-action-copy small')]
      .filter(visible)
      .filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 2)
      .map((element) => element.textContent.trim());
    return {
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
      viewportHeight: innerHeight,
      mount: rect(document.getElementById('adminHomeMount')),
      cards: cards.map(rect),
      switches: switches.map(rect),
      rows: rows.sort((a, b) => a.top - b.top).map((row) => row.count),
      chrome,
      clipped,
      workspaceDisplay: getComputedStyle(document.getElementById('workspaceHome')).display,
      adminClass: document.getElementById('m-home').classList.contains('pah-admin-active'),
      mode: document.getElementById('adminHomeMount').dataset.pahMode,
      actionCount: cards.length,
    };
  });

  assert.ok(geometry.pageOverflow <= 1, `${width}px: horizontal overflow ${geometry.pageOverflow}px`);
  assert.equal(geometry.mode, 'admin', `${width}px: Admin Home is not the default mode`);
  assert.equal(geometry.actionCount, 5, `${width}px: real action count changed`);
  assert.equal(geometry.workspaceDisplay, 'none', `${width}px: workspace Home remained visible under Admin Home`);
  assert.equal(geometry.adminClass, true, `${width}px: explicit Admin Home state class is absent`);
  assert.deepEqual(geometry.clipped, [], `${width}px: clipped Admin Home copy`);
  assert.ok(geometry.mount.left >= -0.5 && geometry.mount.right <= width + 0.5, `${width}px: mount escapes viewport`);
  for (const target of [...geometry.cards, ...geometry.switches]) {
    assert.ok(target.width >= 44 && target.height >= 44, `${width}px: target below 44px (${target.width}×${target.height})`);
  }
  for (let i = 0; i < geometry.cards.length; i += 1) {
    for (let j = i + 1; j < geometry.cards.length; j += 1) assert.equal(overlap(geometry.cards[i], geometry.cards[j]), 0, `${width}px: action cards overlap`);
  }
  for (const card of geometry.cards) {
    if (card.bottom <= 0 || card.top >= geometry.viewportHeight) continue;
    for (const layer of geometry.chrome) {
      if (String(layer.selector).includes('botbar')) continue;
      assert.ok(overlap(card, layer.rect) <= 1, `${width}px: fixed chrome covers an action card (${JSON.stringify({ card, layer })})`);
    }
  }
  if (width <= 1024) {
    const [left, right] = geometry.switches.sort((a, b) => a.left - b.left);
    assert.ok(left && right && right.left - left.right >= 8 - 0.5, `${width}px: mode targets have less than 8px separation`);
  }
  return geometry;
}

const viewportExpectations = new Map([
  [390, [1, 1, 1, 1, 1]],
  [1024, [3, 2]],
  [1440, [5]],
]);

for (const [width, rows] of viewportExpectations) {
  const height = width === 390 ? 844 : (width === 1024 ? 768 : 900);
  await page.setViewportSize({ width, height });
  await enterAdminHome();
  const geometry = await inspectAdminGeometry(width);
  assert.deepEqual(geometry.rows, rows, `${width}px: unbalanced integrated action grid`);
  if (width === 390) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(80);
    const mobileEnd = await page.evaluate(() => {
      const last = [...document.querySelectorAll('#adminHomeMount .pah-action')].at(-1).getBoundingClientRect();
      const bar = document.querySelector('.botbar').getBoundingClientRect();
      return { lastBottom: last.bottom, barTop: bar.top };
    });
    assert.ok(mobileEnd.lastBottom <= mobileEnd.barTop - 8 + 0.5, `390px: final action cannot clear bottom navigation (${JSON.stringify(mobileEnd)})`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(80);
  }
  if (width === 390 || width === 1440) {
    await page.screenshot({ path: `/tmp/presence-admin-home-integrated-${width}.png`, fullPage: true });
  }
}

await page.setViewportSize({ width: 1024, height: 768 });
await enterAdminHome();
await page.locator('#adminHomeMount [data-pah-mode="general"]').click();
const generalMode = await page.evaluate(() => ({
  mode: document.getElementById('adminHomeMount').dataset.pahMode,
  privilegedChildren: document.querySelectorAll('#adminHomeMount .pah-action').length,
  adminClass: document.getElementById('m-home').classList.contains('pah-admin-active'),
  normalHomeDisplay: getComputedStyle(document.getElementById('workspaceHome')).display,
  normalHomeHeight: document.getElementById('workspaceHome').getBoundingClientRect().height,
}));
assert.equal(generalMode.mode, 'general');
assert.equal(generalMode.privilegedChildren, 0);
assert.equal(generalMode.adminClass, false);
assert.notEqual(generalMode.normalHomeDisplay, 'none');
assert.ok(generalMode.normalHomeHeight > 0, 'general switch did not reveal normal Home geometry');

await page.locator('#adminHomeMount [data-pah-mode="admin"]').click();
await page.locator('#adminHomeMount [data-pah-action="survey"]').click();
assert.deepEqual(await page.evaluate(() => ({
  tab: curTab,
  targetActive: document.getElementById('m-survey').classList.contains('active'),
  workspaceHistory: history.state?.presenceWorkspace,
  historyTab: history.state?.tab,
})), { tab: 'survey', targetActive: true, workspaceHistory: true, historyTab: 'survey' });
await page.goBack();
await page.waitForFunction(() => curTab === 'home' && document.getElementById('adminHomeMount').dataset.pahMode === 'admin' && document.querySelectorAll('#adminHomeMount .pah-action').length === 5);

await page.locator('#adminHomeMount [data-pah-action="new-member"]').click();
await page.waitForFunction(() => curTab === 'admin' && document.getElementById('newMemberIn'));
await page.waitForTimeout(180);
const newMemberFocus = await page.evaluate(() => {
  const input = document.getElementById('newMemberIn');
  return {
    activeId: document.activeElement?.id || '',
    focusLog: window.__pahFocusLog,
    connected: input?.isConnected || false,
    disabled: input?.disabled || false,
    rect: input ? { width: input.getBoundingClientRect().width, height: input.getBoundingClientRect().height } : null,
    display: input ? getComputedStyle(input).display : '',
    visibility: input ? getComputedStyle(input).visibility : '',
    hiddenAncestor: input ? !!input.closest('[hidden],[inert]') : false,
    panelActive: document.getElementById('m-admin')?.classList.contains('active') || false,
  };
});
assert.equal(newMemberFocus.activeId, 'newMemberIn', `new-member action did not focus the real input (${JSON.stringify(newMemberFocus)})`);
await page.goBack();
await page.waitForFunction(() => curTab === 'home' && document.getElementById('adminHomeMount').dataset.pahMode === 'admin');

for (const [action, selector] of [['permissions', '.mem-rows'], ['departed', '#departedBody']]) {
  await page.evaluate(() => { window.__pahScrollLog = []; });
  await page.locator(`#adminHomeMount [data-pah-action="${action}"]`).click();
  await page.waitForFunction(() => curTab === 'admin');
  assert.ok(await page.evaluate((target) => {
    const element = document.querySelector(target);
    return !!element && window.__pahScrollLog.some((entry) => (target[0] === '#' ? entry.id === target.slice(1) : entry.className.split(/\s+/).includes(target.slice(1))));
  }, selector), `${action} did not scroll its real target`);
  await page.goBack();
  await page.waitForFunction(() => curTab === 'home' && document.getElementById('adminHomeMount').dataset.pahMode === 'admin');
}

await page.evaluate(() => { window.__pahScrollLog = []; });
await page.locator('#adminHomeMount [data-pah-action="approvals"]').click();
await page.waitForFunction(() => curTab === 'admin');
await page.waitForTimeout(160);
assert.ok(await page.evaluate(() => !!document.getElementById('pendList') && window.__pahScrollLog.some((entry) => entry.id === 'pendList')), 'approval action did not use the real pending approvals target');

for (const actor of [
  { uid: 'tl-direct', id: 'tl-direct', name: '팀리더', role: 'TL', status: 'active', surveys: {} },
  { uid: 'member-direct', id: 'member-direct', name: '일반팀원', role: 'IC', status: 'active', surveys: {} },
]) {
  const denied = await page.evaluate((nextActor) => {
    state.users[nextActor.uid] = nextActor;
    me = nextActor;
    goTab('adminhome');
    const mount = document.getElementById('adminHomeMount');
    return {
      tab: curTab,
      children: mount.childElementCount,
      hidden: mount.hidden,
      hasMode: mount.hasAttribute('data-pah-mode'),
      adminClass: document.getElementById('m-home').classList.contains('pah-admin-active'),
      normalHomeDisplay: getComputedStyle(document.getElementById('workspaceHome')).display,
    };
  }, actor);
  assert.equal(denied.tab, 'home', `${actor.role}: direct Admin Home route did not fall back`);
  assert.equal(denied.children, 0, `${actor.role}: direct Admin Home route leaked privileged DOM`);
  assert.equal(denied.hidden, true, `${actor.role}: Admin Home mount remained visible`);
  assert.equal(denied.hasMode, false, `${actor.role}: Admin Home mode marker leaked`);
  assert.equal(denied.adminClass, false, `${actor.role}: Admin Home state class leaked`);
  assert.notEqual(denied.normalHomeDisplay, 'none', `${actor.role}: workspace Home was not restored`);
}

await enterAdminHome();
await page.evaluate(async () => { await logout(); });
assert.deepEqual(await page.evaluate(() => {
  const mount = document.getElementById('adminHomeMount');
  return {
    actorCleared: me === null,
    children: mount.childElementCount,
    hidden: mount.hidden,
    hasMode: mount.hasAttribute('data-pah-mode'),
    adminClass: document.getElementById('m-home').classList.contains('pah-admin-active'),
    appHidden: document.getElementById('app').classList.contains('hidden'),
  };
}), { actorCleared: true, children: 0, hidden: true, hasMode: false, adminClass: false, appHidden: true });

await browser.close();

assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(' | ')}`);
assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join(' | ')}`);
assert.deepEqual(localFailures, [], `local asset failures: ${localFailures.join(' | ')}`);
assert.deepEqual(localBadResponses, [], `local bad responses: ${localBadResponses.join(' | ')}`);

console.log('PASS Admin Home integration: static wiring, real index actions, Back, role guard, logout, and 390/1024/1440 responsive geometry');
console.log('Screenshots: /tmp/presence-admin-home-integrated-390.png, /tmp/presence-admin-home-integrated-1440.png');
