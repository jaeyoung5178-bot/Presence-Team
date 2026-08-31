import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const output = process.env.PRESENCE_QA_OUTPUT || '/tmp/presence-sales-clear-qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const surfaces = [{ name: 'mobile', width: 390, height: 844 }, { name: 'tablet', width: 1024, height: 768 }, { name: 'desktop', width: 1440, height: 900 }];
const roles = [{ name: 'member', role: 'IC' }, { name: 'leader', role: 'LR' }, { name: 'manager', role: 'TL', manager: true }, { name: 'admin', role: 'AOP', admin: true }];

try {
  for (const surface of surfaces) for (const role of roles) {
    const fixture = { ...surface, ...role, label: `${surface.name}-${role.name}` };
    const page = await browser.newPage({ viewport: surface, timezoneId: 'Asia/Seoul' });
    // Scheduled onboarding/survey notices are unrelated to this sales editor test.
    await page.addLocatorHandler(page.locator('.modal.on').first(), async () => {
      await page.evaluate(() => document.querySelectorAll('.modal.on').forEach(el => closeModal(el.id)));
    });
    const errors = [];
    const sheetRequests = [];
    page.on('pageerror', e => errors.push(e.message));
    // No real member, Firebase write, or Apps Script write is used in this suite.
    await page.route(/firebasedatabase\.app|firebaseio\.com|script\.google\.com/, route => {
      const url = new URL(route.request().url()), q = url.searchParams;
      if (url.hostname === 'script.google.com' && q.get('callback')) {
        if (q.get('action') === 'write') sheetRequests.push(Object.fromEntries(q));
        return route.fulfill({ contentType: 'application/javascript', body: `${q.get('callback')}(${q.get('action') === 'write' ? '{"ok":true,"written":true}' : '{}'});` });
      }
      return route.fulfill({ contentType: 'application/json', body: 'null' });
    });
    await page.goto(`${baseUrl}/?qa=sales-clear-${fixture.label}-${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#authGate:not(.hidden) .auth-card').waitFor({ timeout: 20000 });
    await page.evaluate(f => {
      window.__firebaseReady = true;
      window.showPresenceEntryLobby = () => false;
      window.__presenceEntryPass = true;
      window.__adminOff = false;
      window.__previewRole = null;
      ['showAnnounceIfNew', 'maybeShowGiftPopup', 'maybeGiftStartPopup', 'maybeShowWelcome', 'schedulePromotionSurveyPopup', 'maybeDemoFarmGift', 'showRewardReminder', 'recallOnboardNotifs', 'onboardNudge', 'leaderOnboardNudge'].forEach(name => { window[name] = () => {}; });
      const current = { uid: f.admin ? 'admin' : `qa-clear-${f.name}`, name: '검수회원', id: `qa-clear-${f.name}`, role: f.role, status: 'active', surveys: { [f.role]: { answers: { firstField: '2026-08-25', qa: 'done' }, t: Date.now() } } };
      const other = { uid: 'qa-clear-other', name: '검수대상', id: 'qa-clear-other', role: 'LR', status: 'active', surveys: { IC: { answers: { firstField: '2026-08-25' }, t: Date.now() } } };
      state.users = { [current.uid]: current, [other.uid]: other };
      state.managers = f.manager ? [current.name] : [];
      state.extraMembers = []; state.removedMembers = []; state.promotionSurveys = {}; state.settings = {};
      state.sales = {};
      for (const user of [current, other]) {
        for (const [date, count, na] of [['2026-08-25', 5, false], ['2026-08-26', 0, true], [TODAY, 0, false]]) {
          state.sales[`${date}|${user.name}`] = { name: user.name, role: user.role, date, count, na, checked: true, t: 1 };
        }
      }
      window.__writes = []; window.__posts = []; window.__sheetCells = [];
      DB.set = async (path, value) => {
        if (!path.startsWith('sales/')) return;
        if (window.__failWrite) throw new Error('Expected QA connection failure');
        if (window.__holdWrite) await new Promise(resolve => { window.__releaseWrite = resolve; });
        window.__writes.push({ path, value });
      };
      DB.update = async () => {}; DB.get = async () => null;
      DB.tx = async (_path, fn) => ({ committed: true, snapshot: fn(null) });
      window.postWebhook = payload => window.__posts.push(payload);
      window.effectiveWebhook = () => 'https://script.google.com/macros/s/qa/exec';
      window.startAutoPull = () => {};
      me = current; continueLogin(current); goTab('sale');
      window.__targetName = f.admin || f.manager ? other.name : current.name;
      if (f.admin || f.manager) { document.getElementById('aseUser').value = other.name; aseSelectUser(); }
      salePickDate(TODAY);
      document.querySelectorAll('.modal.on').forEach(el => el.classList.remove('on'));
      const loader = document.getElementById('presenceGameLoader');
      if (loader) { loader.classList.remove('show', 'complete'); loader.style.pointerEvents = 'none'; }
      window.__initialSales = JSON.stringify(state.sales);
    }, fixture);
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
    await page.locator('#saleClear').scrollIntoViewIfNeeded();
    const geometry = await page.locator('#saleClear').evaluate(el => {
      const r = el.getBoundingClientRect(), save = document.getElementById('saleDone').getBoundingClientRect();
      const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { width: r.width, height: r.height, gap: r.top - save.bottom, covered: !el.contains(at), overflow: document.documentElement.scrollWidth > innerWidth + 1, enabled: !el.disabled };
    });
    assert.ok(geometry.enabled && geometry.width >= 44 && geometry.height >= 44 && geometry.gap >= 8 && !geometry.covered && !geometry.overflow, `${fixture.label}: clear button geometry ${JSON.stringify(geometry)}`);
    if (role.manager) await page.screenshot({ path: `${output}/${surface.name}-manager-before.png` });

    // Cancel does not change state, totals, or persistence.
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#saleClear').click();
    assert.ok(await page.evaluate(() => JSON.stringify(state.sales) === window.__initialSales));

    // Clear an explicit zero with a real button click and target/date confirmation.
    let confirmation = '';
    page.once('dialog', dialog => { confirmation = dialog.message(); return dialog.accept(); });
    await page.locator('#saleClear').click();
    await page.waitForFunction(() => !saleSaveBusy && state.sales[`${TODAY}|${window.__targetName}`]?.cleared);
    assert.ok(confirmation.includes('미입력 빈칸') && confirmation.includes(await page.evaluate(() => window.__targetName)));
    const zero = await page.evaluate(() => {
      const e = state.sales[`${TODAY}|${window.__targetName}`], day = document.querySelector('.sale-cal-days button.sel');
      const changed = Object.keys(state.sales).filter(k => JSON.stringify(state.sales[k]) !== JSON.stringify(JSON.parse(window.__initialSales)[k]));
      return { recorded: saleEntryIsRecorded(e), work: saleEntryCountsAsWork(e), changed, expectedKey: `${TODAY}|${window.__targetName}`, label: day.getAttribute('aria-label'), className: day.className, clearDisabled: document.getElementById('saleClear').disabled, recap: prcSalesBetween(window.__targetName, '2026-08-01', TODAY), post: window.__posts.at(-1), write: window.__writes.at(-1) };
    });
    assert.equal(zero.recorded, false); assert.equal(zero.work, false);
    assert.deepEqual(zero.changed, [zero.expectedKey]);
    assert.ok(zero.label.includes('미입력') && !/\b(has|zero|na)\b/.test(zero.className) && zero.clearDisabled);
    assert.deepEqual(zero.recap, { sales: 5, days: 1 });
    assert.equal(zero.post.count, ''); assert.equal(zero.post.status, '미입력'); assert.equal(zero.post.cleared, true);
    assert.equal(zero.write.value.checked, false); assert.equal(zero.write.value.cleared, true);
    await page.waitForFunction(() => sheetSyncState === 'ok');
    assert.equal(sheetRequests.at(-1).count, ''); assert.equal(sheetRequests.at(-1).clear, '1');

    const persistence = await page.evaluate(() => {
      const snapshot = {};
      Object.values(state.sales).forEach(e => { (snapshot[e.date] ||= {})[nk(e.name)] = e; });
      state.sales = saleRecordsFromSnapshot(snapshot); // Same deserializer used after reload/realtime updates.
      const stale = { [TODAY]: { [window.__targetName]: 'NA' } };
      const automatic = importSheetData(stale, { silent: true, fillOnly: true });
      const manual = importSheetData(stale, { silent: true, fillOnly: false });
      const positive = importSheetData({ [TODAY]: { [window.__targetName]: 5 } }, { silent: true });
      return { automatic, manual, positive, recorded: saleEntryIsRecorded(state.sales[`${TODAY}|${window.__targetName}`]) };
    });
    assert.deepEqual(persistence, { automatic: 0, manual: 0, positive: 0, recorded: false });

    // A failed clear retains the original NA and does not export a blank.
    await page.evaluate(() => { salePickDate('2026-08-26'); window.__failWrite = true; window.__beforeFailure = window.__posts.length; });
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#saleClear').click();
    await page.waitForFunction(() => !saleSaveBusy);
    assert.ok(await page.evaluate(() => state.sales[`2026-08-26|${window.__targetName}`].na && window.__posts.length === window.__beforeFailure && !document.getElementById('saleClear').disabled));
    await page.evaluate(() => { window.__failWrite = false; });
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#saleClear').click();
    assert.ok(await page.evaluate(() => state.sales[`2026-08-26|${window.__targetName}`].cleared));

    // Clear positive first-field sales without losing the first-field marker.
    await page.evaluate(() => { salePickDate('2026-08-25'); window.__holdWrite = true; });
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#saleClear').click();
    await page.waitForFunction(() => saleSaveBusy && !!window.__releaseWrite);
    const pending = await page.evaluate(async () => {
      const n = window.__writes.length;
      await clearSaleRecord(); await commitSale(); // Repeated mutations are ignored while busy.
      return { busy: saleSaveBusy, disabled: document.getElementById('saleClear').disabled && document.getElementById('saleDone').disabled, unchanged: window.__writes.length === n };
    });
    assert.deepEqual(pending, { busy: true, disabled: true, unchanged: true });
    await page.evaluate(() => { window.__holdWrite = false; window.__releaseWrite(); });
    await page.waitForFunction(() => !saleSaveBusy);
    assert.ok(await page.evaluate(() => document.querySelector('.sale-cal-days button.sel').textContent.includes('첫필드!')));
    assert.deepEqual(await page.evaluate(() => prcSalesBetween(window.__targetName, '2026-08-01', TODAY)), { sales: 0, days: 0 });

    // Explicitly saving again removes the clear marker and records a real zero.
    await page.locator('#saleDone').click();
    assert.ok(await page.evaluate(() => {
      const e = state.sales[`2026-08-25|${window.__targetName}`];
      return e.checked === true && !e.cleared && e.count === 0 && saleEntryIsRecorded(e);
    }));
    // Future NA can also be cleared, even though future sales cannot be saved.
    await page.evaluate(async () => { salePickDate(saleNAFutureLimit()); toggleSaleNA(); await commitSale(); });
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#saleClear').click();
    assert.ok(await page.evaluate(() => !saleEntryIsRecorded(state.sales[`${saleNAFutureLimit()}|${window.__targetName}`])));

    if (!role.admin && !role.manager) {
      assert.ok(await page.evaluate(() => {
        saleAdminTargetName = '검수대상'; salePickDate(TODAY);
        return saleTargetUser().uid === me.uid && state.sales[`${TODAY}|검수대상`].checked && getComputedStyle(document.getElementById('adminSaleEdit')).display === 'none';
      }));
    }
    await page.evaluate(() => salePickDate(TODAY));
    await page.locator('#saleClear').scrollIntoViewIfNeeded();
    if (role.manager) await page.screenshot({ path: `${output}/${surface.name}-manager-after.png` });
    assert.deepEqual(errors, [], `${fixture.label}: page errors`);
    console.log(`PASS ${fixture.label}: cancel, zero/NA/positive/future clear, scope, rollback, busy, restore, sync, responsive`);
    if (role.admin && surface.name === 'desktop') {
      const recap = await page.evaluate(() => {
        state.users = { [me.uid]: me };
        me.surveys[me.role].answers.firstField = '2026-07-27';
        state.sales = {}; state.weeklyProfitRecaps = {};
        const put = (date, count, extra = {}) => { state.sales[`${date}|${me.name}`] = { date, count, name: me.name, role: me.role, ...extra }; };
        put('2026-07-27', 0, { checked: true });
        put('2026-08-03', 0, { na: true });
        put('2026-08-04', 0); // Not explicitly checked: still blank.
        put('2026-08-05', 0, { cleared: true });
        put('2026-07-26', 100, { checked: true }); // Before the period/first field.
        put('2026-08-24', 100, { checked: true }); // Next month's pay period.
        const zero = prcAdminAgg('2026-08', '2026-08', '');
        put('2026-07-28', 6, { checked: true });
        const pays = prcPayDates('2026-08', '2026-08');
        for (const pay of [...pays, '2026-09-04']) state.weeklyProfitRecaps[pay] = { [me.uid]: { uid: me.uid, payDate: pay, netPayment: pay.startsWith('2026-08') ? 100 : 99999, payType: 'performance', updatedAt: 1 } };
        const totals = prcAdminAgg('2026-08', '2026-08', '').totals;
        return { zero: { rows: zero.rows.length, days: zero.totals.fieldDays, sales: zero.totals.sales, avg: zero.totals.avg }, totals: { days: totals.fieldDays, sales: totals.sales, avg: totals.avg, income: totals.income }, pays, period: prcPeriodForPays(pays) };
      });
      assert.deepEqual(recap.zero, { rows: 1, days: 1, sales: 0, avg: 0 });
      assert.deepEqual(recap.totals, { days: 2, sales: 6, avg: 3, income: 400 });
      assert.deepEqual(recap.pays, ['2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28']);
      assert.deepEqual(recap.period, { from: '2026-07-27', to: '2026-08-23' });
      console.log('PASS AUGUST_RECAP: explicit zero-only member included, NA/blank/cleared excluded, 4 paydays, aligned period, AVG', recap);
    }
    await page.close();
  }
} finally { await browser.close(); }
