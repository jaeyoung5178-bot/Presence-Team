import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const output = process.env.PRESENCE_QA_OUTPUT || '/tmp/presence-recruit-add-fx-qa';
const fixtures = [
  { name: 'phone-member', width: 390, height: 844, uid: 'fx-member-1', user: '김하늘', role: 'IC' },
  { name: 'tablet-leader', width: 1024, height: 768, uid: 'fx-leader-1', user: '박서준', role: 'LR' },
  { name: 'desktop-admin', width: 1440, height: 900, uid: 'admin', user: '임재영', role: 'AOP' },
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  for (const fixture of fixtures) {
    const page = await browser.newPage({ viewport: fixture, timezoneId: 'Asia/Seoul' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()); });
    await page.route(/firebasedatabase\.app|firebaseio\.com|script\.google\.com/, route => route.fulfill({ contentType: 'application/json', body: 'null' }));
    await page.goto(`${baseUrl}/?qa=recruit-add-fx-${fixture.name}-${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('#authGate:not(.hidden) .auth-card').waitFor({ timeout: 20000 });
    await page.evaluate(f => {
      window.__firebaseReady = true;
      window.showPresenceEntryLobby = () => false;
      window.__presenceEntryPass = true;
      window.__adminOff = false;
      window.__previewRole = null;
      const current = { uid: f.uid, name: f.user, id: `fx-${f.uid}`, role: f.role, status: 'active', surveys: { [f.role]: { answers: { firstField: '2026-01-01' }, t: Date.now() } } };
      state.users = { [current.uid]: current };
      state.extraMembers = []; state.removedMembers = []; state.memberInfo = {}; state.managers = []; state.daisoRecruitDaily = {};
      DB.set = async () => {}; DB.update = async () => {}; DB.get = async () => null; DB.tx = async (_path, fn) => ({ committed: true, snapshot: fn(null) });
      me = current; pdrUid = current.uid; pdrDate = '2026-09-03'; pdrMonth = '2026-09';
      document.getElementById('authGate')?.classList.add('hidden');
      document.getElementById('app')?.classList.remove('hidden');
      document.body.classList.add('app-on');
      document.querySelectorAll('.mpanel').forEach(panel => panel.classList.remove('active'));
      document.getElementById('m-recruitdaily')?.classList.add('active');
      renderRecruitDaily();
      const loader = document.getElementById('presenceGameLoader');
      if (loader) { loader.classList.remove('show', 'complete'); loader.style.pointerEvents = 'none'; }
      document.querySelectorAll('.modal.on').forEach(modal => modal.classList.remove('on'));
      pdrAdjust('recruit', 1);
    }, fixture);
    await page.waitForTimeout(140);
    const first = await page.evaluate(() => {
      const card = document.querySelector('.pdr-stat[data-pdr-field="recruit"]'), layer = card?.querySelector('.pdr-add-fx'), button = card?.querySelector('button.plus'), rect = card?.getBoundingClientRect(), buttonRect = button?.getBoundingClientRect();
      return {
        count: card?.querySelector('.pdr-step strong')?.textContent,
        person: layer?.querySelector('.pdr-add-person')?.textContent,
        hearts: layer?.querySelectorAll('.pdr-add-heart').length || 0,
        hiddenFromA11y: layer?.getAttribute('aria-hidden'),
        pointerEvents: layer ? getComputedStyle(layer).pointerEvents : '',
        cardInside: !!rect && rect.left >= -1 && rect.right <= innerWidth + 1,
        buttonSize: buttonRect ? { width: Math.round(buttonRect.width), height: Math.round(buttonRect.height) } : null,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        seq: layer?.dataset.pdrFx || '',
      };
    });
    assert.equal(first.count, '1');
    assert.equal(first.person, '👤➕');
    assert.equal(first.hearts, 4);
    assert.equal(first.hiddenFromA11y, 'true');
    assert.equal(first.pointerEvents, 'none');
    assert.ok(first.cardInside && !first.overflow);
    assert.ok(first.buttonSize.width >= 44 && first.buttonSize.height >= 44);
    await page.screenshot({ path: `${output}/${fixture.name}.png`, fullPage: false });

    await page.evaluate(() => pdrAdjust('recruit', 1));
    await page.waitForTimeout(80);
    const repeated = await page.evaluate(() => ({
      count: document.querySelector('.pdr-stat[data-pdr-field="recruit"] .pdr-step strong')?.textContent,
      seq: document.querySelector('.pdr-stat[data-pdr-field="recruit"] .pdr-add-fx')?.dataset.pdrFx,
      layers: document.querySelectorAll('.pdr-stat[data-pdr-field="recruit"] .pdr-add-fx').length,
    }));
    assert.equal(repeated.count, '2');
    assert.notEqual(repeated.seq, first.seq);
    assert.equal(repeated.layers, 1);

    await page.waitForTimeout(1150);
    await page.evaluate(() => pdrAdjust('showup', 1));
    await page.waitForTimeout(50);
    const final = await page.evaluate(() => ({
      effectLayers: document.querySelectorAll('.pdr-add-fx').length,
      recruit: document.querySelector('.pdr-stat[data-pdr-field="recruit"] .pdr-step strong')?.textContent,
      showup: document.querySelector('.pdr-stat[data-pdr-field="showup"] .pdr-step strong')?.textContent,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.deepEqual(final, { effectLayers: 0, recruit: '2', showup: '1', overflow: false });
    assert.deepEqual(errors, [], `${fixture.name}: page errors`);
    console.log(`PASS ${fixture.name}: recruit +1 person/hearts, repeated taps, cleanup, geometry`);
    await page.close();
  }
} finally {
  await browser.close();
}
