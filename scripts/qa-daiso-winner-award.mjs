import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const output = process.env.PRESENCE_QA_OUTPUT || '/tmp/presence-daiso-winner-qa';
const announcementText = '다이소 컴페티션 우승자는 바로~ 다이소를 가장 많이 이용했을거 같은 "손예진 리더"입니다. 많이 축하해주세요~';
await mkdir(output, { recursive: true });

const fixtures = [
  { name: 'phone-winner', width: 390, height: 844, uid: 'qa-sonyejin', user: '손예진', role: 'LR', recipient: true },
  { name: 'tablet-leader', width: 1024, height: 768, uid: 'qa-leader', user: '검수리더', role: 'TL', announcement: true },
  { name: 'desktop-admin', width: 1440, height: 900, uid: 'admin', user: '임재영', role: 'AOP', admin: true },
];

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  for (const fixture of fixtures) {
    const page = await browser.newPage({ viewport: fixture, timezoneId: 'Asia/Seoul' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/firebasedatabase\.app|firebaseio\.com|script\.google\.com/, route => route.fulfill({ contentType: 'application/json', body: 'null' }));
    await page.goto(`${baseUrl}/?qa=daiso-winner-${fixture.name}-${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('#authGate:not(.hidden) .auth-card').waitFor({ timeout: 20000 });

    await page.evaluate(f => {
      window.__firebaseReady = true;
      window.showPresenceEntryLobby = () => false;
      window.__presenceEntryPass = true;
      window.__adminOff = false;
      window.__previewRole = null;
      ['maybeShowGiftPopup', 'maybeGiftStartPopup', 'maybeShowWelcome', 'schedulePromotionSurveyPopup', 'maybeDemoFarmGift', 'showRewardReminder', 'recallOnboardNotifs', 'onboardNudge', 'leaderOnboardNudge'].forEach(name => { window[name] = () => {}; });
      const current = { uid: f.uid, name: f.user, id: `qa-${f.name}`, role: f.role, status: 'active', surveys: { [f.role]: { answers: { qa: 'done', firstField: '2026-08-01' }, t: Date.now() } } };
      const winner = f.recipient ? current : { uid: 'qa-sonyejin', name: '손예진', id: 'qa-winner', role: 'LR', status: 'active', surveys: { LR: { answers: { qa: 'done', firstField: '2026-08-01' }, t: Date.now() } } };
      const other = { uid: 'qa-other', name: '검수회원', id: 'qa-other', role: 'IC', status: 'active', surveys: { IC: { answers: { qa: 'done', firstField: '2026-08-01' }, t: Date.now() } } };
      state.users = { [current.uid]: current, [winner.uid]: winner, [other.uid]: other };
      state.extraMembers = []; state.removedMembers = []; state.managers = []; state.promotionSurveys = {}; state.settings = {}; state.sales = {}; state.daisoRecruitDaily = {};
      state.notifs = {};
      state.daisoCompetition = {};
      state.popupAnnounce = null;
      window.__updates = [];
      DB.update = async (path, value) => { window.__updates.push({ path, value }); };
      DB.set = async () => {}; DB.get = async () => null;
      DB.tx = async (_path, fn) => ({ committed: true, snapshot: fn(null) });
      me = current;
      continueLogin(current);
      goTab('comp');
      const loader = document.getElementById('presenceGameLoader');
      if (loader) { loader.classList.remove('show', 'complete'); loader.style.pointerEvents = 'none'; }
      document.querySelectorAll('.modal.on').forEach(el => el.classList.remove('on'));
      if (f.recipient) {
        const t = Date.now();
        state.notifs[winner.uid] = [{ type: 'daisoGift', awardId: DAISO_AWARD_ID, msg: '손예진 리더님의 우승을 축하드립니다! 다이소 2만원 상품권이 도착했어요.', amount: 20000, t, read: false, target: { tab: 'comp' } }];
        state.daisoCompetition.award = { id: DAISO_AWARD_ID, winnerUid: winner.uid, winnerName: winner.name, prize: '다이소 2만원 상품권', completedAt: t };
        renderDaisoCompetition(); renderBell(); renderNotifList(); openModal('notifModal');
      }
      if (f.announcement) {
        state.popupAnnounce = { id: DAISO_AWARD_ID, text: DAISO_AWARD_ANNOUNCEMENT, by: '임재영', t: Date.now(), winner: true, accountScoped: true };
        localStorage.removeItem('presence_ann_ack_' + current.uid);
        showAnnounceIfNew();
      }
    }, fixture);
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
    await page.waitForTimeout(120);

    if (fixture.admin) {
      const button = page.getByRole('button', { name: '우승자에게 쿠폰 증정하기' });
      await button.scrollIntoViewIfNeeded();
      const before = await button.evaluate(el => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height, overflow: document.documentElement.scrollWidth > innerWidth + 1 }; });
      assert.ok(before.width >= 44 && before.height >= 44 && !before.overflow, `admin button geometry ${JSON.stringify(before)}`);
      await page.screenshot({ path: `${output}/${fixture.name}-before.png`, fullPage: true });
      page.once('dialog', dialog => dialog.accept());
      await button.click();
      await page.waitForFunction(() => state.daisoCompetition?.award?.completedAt && !daisoAwardBusy);
      const awarded = await page.evaluate(async () => {
        const firstUpdateCount = window.__updates.length;
        const firstNotifCount = state.notifs['qa-sonyejin'].filter(n => n.type === 'daisoGift' && n.awardId === DAISO_AWARD_ID).length;
        document.querySelectorAll('.modal.on').forEach(el => el.classList.remove('on'));
        await awardDaisoWinner();
        const admin = me, other = state.users['qa-other'], winner = state.users['qa-sonyejin'];
        localStorage.removeItem('presence_ann_ack_' + other.uid);
        localStorage.removeItem('presence_ann_ack_' + winner.uid);
        me = other; showAnnounceIfNew(); const otherSaw = document.getElementById('annModal').classList.contains('on'); ackAnnounce();
        me = winner; showAnnounceIfNew(); const winnerSaw = document.getElementById('annModal').classList.contains('on'); ackAnnounce();
        me = admin;
        return {
          firstUpdateCount,
          updateCountAfterRepeat: window.__updates.length,
          rootUpdate: window.__updates[0],
          firstNotifCount,
          announcement: state.popupAnnounce,
          statusText: document.getElementById('daisoCompPanel').textContent,
          otherSaw, winnerSaw,
        };
      });
      assert.equal(awarded.firstUpdateCount, 1);
      assert.equal(awarded.updateCountAfterRepeat, 1);
      assert.equal(awarded.firstNotifCount, 1);
      assert.equal(awarded.rootUpdate.path, '');
      assert.ok(awarded.rootUpdate.value['notifs/qa-sonyejin']);
      assert.ok(awarded.rootUpdate.value['daisoCompetition/award']?.completedAt);
      assert.equal(awarded.rootUpdate.value.popupAnnounce.text, announcementText);
      assert.equal(awarded.announcement.accountScoped, true);
      assert.ok(awarded.statusText.includes('지급·발표 완료'));
      assert.ok(awarded.otherSaw && awarded.winnerSaw);
      await page.evaluate(() => document.querySelectorAll('.modal.on').forEach(el => el.classList.remove('on')));
      await page.screenshot({ path: `${output}/${fixture.name}-after.png`, fullPage: true });
    } else if (fixture.recipient) {
      const report = await page.evaluate(() => {
        const card = document.querySelector('.notif-item.daiso-gift'), ticket = card?.querySelector('.daiso-ticket'), rect = card?.getBoundingClientRect();
        return { text: card?.textContent || '', ticket: ticket?.getAttribute('aria-label') || '', unread: card?.classList.contains('unread'), button: !!document.querySelector('.dc-award-btn'), inside: !!rect && rect.left >= -1 && rect.right <= innerWidth + 1, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      assert.ok(report.text.includes('20,000원') && report.text.includes('다이소 컴페티션 우승 상품권'));
      assert.equal(report.ticket, '다이소 2만원 상품권');
      assert.ok(report.unread && !report.button && report.inside && !report.overflow);
      await page.screenshot({ path: `${output}/${fixture.name}.png`, fullPage: true });
    } else {
      const report = await page.evaluate(() => ({ text: document.getElementById('annText')?.textContent || '', title: document.querySelector('#annModal .ann-title')?.textContent || '', visible: document.getElementById('annModal')?.classList.contains('on'), button: !!document.querySelector('.dc-award-btn'), overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
      assert.equal(report.text, announcementText);
      assert.ok(report.visible && report.title.includes('우승자 발표') && !report.button && !report.overflow);
      await page.screenshot({ path: `${output}/${fixture.name}.png`, fullPage: true });
    }
    assert.deepEqual(errors, [], `${fixture.name}: page errors`);
    console.log(`PASS ${fixture.name}: permissions, responsive layout, coupon, announcement, idempotency`);
    await page.close();
  }
} finally {
  await browser.close();
}
