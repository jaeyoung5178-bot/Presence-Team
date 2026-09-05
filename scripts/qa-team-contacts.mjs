import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const output = process.env.PRESENCE_QA_OUTPUT || '/tmp/presence-team-contacts-qa';
const photoPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8Dwn4GBgYGJAQoAHgQCAf6vNvQAAAAASUVORK5CYII=', 'base64');
await mkdir(output, { recursive: true });

const fixtures = [
  { name: 'phone-manager', width: 390, height: 844, uid: 'qa-manager', user: '검수매니저', role: 'TL', manager: true, save: true },
  { name: 'tablet-manager', width: 1024, height: 768, uid: 'qa-manager', user: '검수매니저', role: 'TL', manager: true },
  { name: 'desktop-manager', width: 1440, height: 900, uid: 'qa-manager', user: '검수매니저', role: 'TL', manager: true },
  { name: 'phone-admin', width: 390, height: 844, uid: 'admin', user: '임재영', role: 'AOP', admin: true },
  { name: 'tablet-admin', width: 1024, height: 768, uid: 'admin', user: '임재영', role: 'AOP', admin: true },
  { name: 'desktop-admin', width: 1440, height: 900, uid: 'admin', user: '임재영', role: 'AOP', admin: true },
  { name: 'phone-member', width: 390, height: 844, uid: 'qa-member-view', user: '일반팀원', role: 'IC' },
  { name: 'tablet-member', width: 1024, height: 768, uid: 'qa-member-view', user: '일반팀원', role: 'IC' },
  { name: 'desktop-member', width: 1440, height: 900, uid: 'qa-member-view', user: '일반팀원', role: 'IC' },
];

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  for (const fixture of fixtures) {
    const page = await browser.newPage({ viewport: fixture, timezoneId: 'Asia/Seoul' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/firebasedatabase\.app|firebaseio\.com|script\.google\.com/, route => route.fulfill({ contentType: 'application/json', body: 'null' }));
    await page.goto(`${baseUrl}/?qa=team-contacts-${fixture.name}-${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('#authGate:not(.hidden) .auth-card').waitFor({ timeout: 20000 });

    await page.evaluate(f => {
      window.__firebaseReady = true;
      window.showPresenceEntryLobby = () => false;
      window.__presenceEntryPass = true;
      window.__adminOff = false;
      window.__previewRole = f.manager ? 'MANAGER' : null;
      ['maybeShowGiftPopup', 'maybeGiftStartPopup', 'maybeShowWelcome', 'schedulePromotionSurveyPopup', 'maybeDemoFarmGift', 'showRewardReminder', 'recallOnboardNotifs', 'onboardNudge', 'leaderOnboardNudge'].forEach(name => { window[name] = () => {}; });
      const current = { uid: f.uid, name: f.user, id: `qa-${f.name}`, role: f.role, status: 'active', surveys: { [f.role]: { answers: { firstField: '2026-08-01' }, t: Date.now() } } };
      const target = { uid: 'qa-contact-target', name: '김프레젠스', id: 'qa-contact-target', role: 'LR', status: 'active', surveys: { IC: { answers: { firstField: '2026-08-01', phone: '01098765432' }, t: Date.now() }, LR: { answers: { leaderHit: '2026-08-20' }, t: Date.now() } } };
      state.users = { [current.uid]: current, [target.uid]: target };
      state.teamContacts = {};
      state.extraMembers = []; state.removedMembers = []; state.managers = f.manager ? [current.name] : []; state.promotionSurveys = {}; state.settings = {}; state.sales = {}; state.notifs = {};
      window.__contactWrites = [];
      DB.set = async (path, value) => { window.__contactWrites.push({ path, value }); };
      DB.update = async () => {}; DB.get = async () => null; DB.on = () => {};
      window._teamContactsSub = true;
      me = current;
      continueLogin(current);
      const loader = document.getElementById('presenceGameLoader');
      if (loader) { loader.classList.remove('show', 'complete'); loader.style.pointerEvents = 'none'; }
      document.querySelectorAll('.modal.on').forEach(el => el.classList.remove('on'));
    }, fixture);
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
    await page.waitForTimeout(120);
    await page.evaluate(f => { window.__presenceNavBusy = 0; if (f.manager || f.admin) selectGroup('people'); else goTab('contacts'); }, fixture);
    await page.waitForTimeout(80);
    const navState = await page.evaluate(() => ({ curTab, curGroup, peopleTabs: NAV.find(x => x.k === 'people')?.tabs || [], visiblePeopleTabs: NAV.find(x => x.k === 'people')?.tabs.filter(tabVisible) || [], contactVisible: tabVisible('contacts'), manager: canManageTeamRecords(me), panelClass: document.getElementById('m-contacts')?.className || '' }));

    if (!fixture.manager && !fixture.admin) {
      const denied = await page.evaluate(() => ({
        tab: curTab,
        panel: document.getElementById('m-contacts')?.classList.contains('active'),
        nav: !!document.querySelector('[data-tab="contacts"]'),
      }));
      assert.equal(denied.tab, 'home');
      assert.equal(denied.panel, false);
      assert.equal(denied.nav, false);
      await page.screenshot({ path: `${output}/${fixture.name}.png`, fullPage: true });
    } else {
      assert.equal(navState.curTab, 'contacts', JSON.stringify(navState));
      await page.locator('#m-contacts.active #teamContactsBody').waitFor();
      const surveyLinked = await page.evaluate(() => ({ card: document.getElementById('teamContactList')?.textContent || '', count: document.getElementById('teamContactCount')?.textContent || '', resolved: resolvedTeamContact(state.users['qa-contact-target']) }));
      assert.equal(surveyLinked.resolved.phone, '010-9876-5432');
      assert.equal(surveyLinked.resolved.source, 'survey');
      assert.ok(surveyLinked.card.includes('김프레젠스') && surveyLinked.card.includes('010-9876-5432') && surveyLinked.card.includes('설문 연동'));
      assert.ok(surveyLinked.count.includes('1명') && surveyLinked.count.includes('설문 자동 연동'));
      if (fixture.save) {
        await page.selectOption('#teamContactUser', 'qa-contact-target');
        assert.equal(await page.inputValue('#teamContactPhone'), '010-9876-5432');
        await page.locator('#teamContactPhotoInput').setInputFiles({ name: 'profile.png', mimeType: 'image/png', buffer: photoPng });
        await page.waitForFunction(() => typeof teamContactDraftPhoto === 'string' && teamContactDraftPhoto.startsWith('data:image/jpeg'));
        await page.fill('#teamContactPhone', '01012345678');
        await page.locator('#teamContactPhone').evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })));
        await page.click('#teamContactSave');
        await page.waitForFunction(() => !teamContactSaving && state.teamContacts?.['qa-contact-target']?.phone === '010-1234-5678');
        const saved = await page.evaluate(() => ({ record: state.teamContacts['qa-contact-target'], writes: window.__contactWrites, card: document.getElementById('teamContactList')?.textContent || '' }));
        assert.equal(saved.record.name, '김프레젠스');
        assert.equal(saved.record.role, 'LR');
        assert.equal(saved.record.roleLabel, '리더(LR)');
        assert.equal(saved.record.phone, '010-1234-5678');
        assert.equal(saved.record.updatedByUid, 'qa-manager');
        assert.ok(saved.record.photo.startsWith('data:image/jpeg'));
        assert.ok(saved.card.includes('김프레젠스') && saved.card.includes('010-1234-5678'));
        if (saved.writes.some(x => x.path === 'teamContacts/qa-contact-target')) assert.equal(saved.writes.filter(x => x.path === 'teamContacts/qa-contact-target').length, 1);
      }
      const geometry = await page.evaluate(() => {
        const actions = [...document.querySelectorAll('#teamContactsBody button,#teamContactsBody a')].filter(el => el.offsetParent !== null && el.getBoundingClientRect().width > 0);
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1, minAction: Math.min(...actions.map(el => el.getBoundingClientRect().height)), actionHeights: actions.map(el => ({ text: (el.textContent || el.getAttribute('aria-label') || '').trim(), cls: el.className, height: el.getBoundingClientRect().height })), heading: document.querySelector('#m-contacts h2')?.textContent || '', cards: document.querySelectorAll('.team-contact-card').length };
      });
      assert.equal(geometry.overflow, false);
      assert.ok(geometry.minAction >= 44, `minimum action height ${geometry.minAction}: ${JSON.stringify(geometry.actionHeights)}`);
      assert.ok(geometry.heading.includes('팀원 연락처'));
      assert.equal(geometry.cards, 1);
      await page.screenshot({ path: `${output}/${fixture.name}.png`, fullPage: true });
    }
    assert.deepEqual(errors, [], `${fixture.name}: page errors`);
    console.log(`PASS ${fixture.name}: manager-only access, data binding, photo, responsive layout`);
    await page.close();
  }
} finally {
  await browser.close();
}
