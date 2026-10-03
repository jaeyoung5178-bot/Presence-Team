import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4187';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
await page.route(/firebasedatabase\.app|firebaseio\.com|script\.google\.com/, route => route.abort());
await page.goto(`${base}/?qa=recap-studio`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => !!window.PresenceExecutiveRecap && typeof window.prcProductivityOf === 'function');
await page.waitForFunction(() => [...document.styleSheets].some(sheet => sheet.href && sheet.href.includes('presence-executive-recap.css')));
await page.waitForTimeout(400);
pageErrors.length = 0;

const roles = [
  { key: 'member', actor: { uid: 'ic', name: '일반팀원', role: 'IC', status: 'active' }, access: null },
  { key: 'tl', actor: { uid: 'umqn54ujf', name: '고윤경', role: 'TL', status: 'active' }, access: { uid: 'umqn54ujf', scope: 'team', teamKey: 'fuse' } },
  { key: 'admin', actor: { uid: 'admin', name: '임재영', role: 'AOP', status: 'active' }, access: { uid: 'admin', scope: 'all' } },
];
const viewports = [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }];
const failures = [];
const results = [];

async function install(role) {
  await page.evaluate(({ role }) => {
    const users = {
      admin: { uid: 'admin', name: '임재영', role: 'AOP', status: 'active' },
      umqn54ujf: { uid: 'umqn54ujf', name: '고윤경', role: 'TL', status: 'active' },
      fuse1: { uid: 'fuse1', name: '권영웅', role: 'LR', status: 'active' },
      umqna7jpj: { uid: 'umqna7jpj', name: '윤채영', role: 'TL', status: 'active' },
      wave1: { uid: 'wave1', name: '민병준', role: 'LR', status: 'active' },
      ic: { uid: 'ic', name: '일반팀원', role: 'IC', status: 'active' },
    };
    const roster = {
      fuse: {
        umqn54ujf: { uid: 'umqn54ujf', name: '고윤경', role: 'TL', activeFrom: '2026-01-01' },
        fuse1: { uid: 'fuse1', name: '권영웅', role: 'LR', activeFrom: '2026-01-01' },
      },
      youngwave: {
        umqna7jpj: { uid: 'umqna7jpj', name: '윤채영', role: 'TL', activeFrom: '2026-01-01' },
        wave1: { uid: 'wave1', name: '민병준', role: 'LR', activeFrom: '2026-01-01' },
      },
    };
    const septemberPays = ['2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25'];
    const octoberPays = ['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30'];
    const pays = [...septemberPays, ...octoberPays];
    const weekly = {};
    pays.forEach((pay, index) => {
      weekly[pay] = {
        umqn54ujf: { uid: 'umqn54ujf', name: '고윤경', role: 'TL', payDate: pay, payType: 'performance', netPayment: 1200000 + index * 100000, rejectCLCount: index % 2, rejectSWCount: 0, resubmitCLCount: 0, resubmitSWCount: 0 },
        fuse1: { uid: 'fuse1', name: '권영웅', role: 'LR', payDate: pay, payType: 'performance', netPayment: 900000 + index * 80000, rejectCLCount: 0, rejectSWCount: index === 2 ? 1 : 0, resubmitCLCount: 0, resubmitSWCount: 0 },
        umqna7jpj: { uid: 'umqna7jpj', name: '윤채영', role: 'TL', payDate: pay, payType: 'performance', netPayment: 1000000, rejectCLCount: 0, rejectSWCount: 0 },
        wave1: { uid: 'wave1', name: '민병준', role: 'LR', payDate: pay, payType: 'performance', netPayment: 800000, rejectCLCount: 0, rejectSWCount: 0 },
      };
    });
    const fuseWeekly = {}, waveWeekly = {};
    pays.forEach(pay => {
      fuseWeekly[pay] = { umqn54ujf: weekly[pay].umqn54ujf, fuse1: weekly[pay].fuse1 };
      waveWeekly[pay] = { umqna7jpj: weekly[pay].umqna7jpj, wave1: weekly[pay].wave1 };
    });
    const sales = {};
    const names = ['고윤경', '권영웅', '윤채영', '민병준'];
    pays.map(pay => prcWeekInfo(pay).ed).forEach((date, i) => names.forEach((name, j) => {
      sales[`${date}|${name}`] = { date, name, count: 2 + ((i + j) % 4), checked: true };
    }));
    state.users = structuredClone(users);
    state.sales = sales;
    state.weeklyProfitRecaps = weekly;
    state.profitMonthlyBep = {};
    state.recapStudioAccess = role.access ? structuredClone(role.access) : null;
    state.recapStudioTeams = {
      fuse: { roster: structuredClone(roster.fuse), weekly: structuredClone(fuseWeekly), bep: {} },
      youngwave: { roster: structuredClone(roster.youngwave), weekly: structuredClone(waveWeekly), bep: {} },
    };
    state.recapStudioTeam = role.key === 'tl' ? structuredClone(state.recapStudioTeams.fuse) : null;
    state.recapStudioTeamKey = role.key === 'tl' ? 'fuse' : '';
    state.recapStudioError = '';
    me = structuredClone(role.actor);
    window.__recapStudioAuthAccess = role.access ? structuredClone(role.access) : null;
    DB.set = async () => {};
    DB.update = async () => {};
    DB.get = async () => null;
    DB.on = () => () => {};
    window.PresenceExecutiveRecap.reset();
    let qaStyle = document.getElementById('qaRecapStudioStyle');
    if (!qaStyle) { qaStyle = document.createElement('style'); qaStyle.id = 'qaRecapStudioStyle'; document.head.appendChild(qaStyle); }
    qaStyle.textContent = 'html.qa-recap-studio body>*:not(#qaStudio),html.qa-recap-studio #authGate,html.qa-recap-studio #presenceEntryLobby,html.qa-recap-studio #presenceGameLoader{display:none!important}html.qa-recap-studio,html.qa-recap-studio body{background:#f7f9fc!important;overflow-x:hidden!important}html.qa-recap-studio #qaStudio{position:relative;z-index:2147483647;min-height:100vh}';
    document.documentElement.classList.add('qa-recap-studio');
    let stage = document.getElementById('qaStudio');
    if (!stage) { stage = document.createElement('main'); stage.id = 'qaStudio'; document.body.appendChild(stage); }
    stage.setAttribute('style', 'display:block!important;max-width:1360px;margin:0 auto;padding:12px');
    stage.innerHTML = '<div id="tlhExecutiveRecapMount"></div>';
    document.body.classList.add('app-on');
    window.PresenceExecutiveRecap.render('tlhExecutiveRecapMount', { actor: me, config: { teamKey: role.key === 'admin' ? 'presence' : 'fuse', teamName: role.key === 'admin' ? 'Presence' : 'FUSE', kind: role.key === 'admin' ? 'aop' : 'team' } });
  }, { role });
}

for (const role of roles) {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await install(role);
    if (role.key !== 'member') await page.locator('[data-ers-action="toggle"]').click({ force: true });
    await page.waitForTimeout(60);
    const row = await page.evaluate(roleKey => {
      const visible = element => !!element && getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0;
      const shell = document.querySelector('.ers-shell');
      const periodGrid = document.querySelector('.ers-periods');
      const periodStyle = periodGrid ? getComputedStyle(periodGrid) : null;
      const buttons = [...document.querySelectorAll('.ers-shell button,.ers-shell select,.ers-shell input')].filter(visible).map(element => ({ name: element.textContent.trim() || element.getAttribute('aria-label') || element.id, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
      const rects = [...document.querySelectorAll('.ers-team-summary-card,.ers-kpi,.ers-card')].filter(visible).map(element => ({ name: element.className, top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right }));
      const overlap = rects.some((a, index) => rects.slice(index + 1).some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2));
      return {
        roleKey,
        shell: !!shell,
        text: shell?.textContent.replace(/\s+/g, ' ').trim() || '',
        scopeOptions: [...document.querySelectorAll('#ersScope option')].map(option => option.textContent.trim()),
        teamCards: [...document.querySelectorAll('.ers-team-summary-card')].map(card => ({ scope: card.dataset.scope, status: card.dataset.status, text: card.textContent.replace(/\s+/g, ' ').trim(), selected: card.classList.contains('is-selected') })),
        people: [...document.querySelectorAll('.ers-members tbody th b')].map(element => element.textContent.trim()),
        periods: [...document.querySelectorAll('.ers-period')].map(element => element.textContent.trim()),
        periodGap: periodStyle ? Number.parseFloat(periodStyle.columnGap || periodStyle.gap || '0') : 0,
        buttonSizes: buttons,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        overlap,
        chartScroll: !!document.querySelector('.ers-chart-scroll[role="region"][tabindex="0"]'),
        rotatedLabels: [...document.querySelectorAll('.ers-donut-label')].some(label => /rotate/i.test(label.getAttribute('transform') || '')),
        mountedContext: !!window.PresenceExecutiveRecap.state.context,
      };
    }, role.key);
    results.push({ role: role.key, viewport: `${viewport.width}x${viewport.height}`, ...row });
    if (role.key === 'member') {
      if (row.shell || row.text || row.mountedContext) failures.push(`${role.key}/${viewport.width}: privileged Studio DOM/context exposed`);
      continue;
    }
    if (!row.shell || row.periods.join('|') !== 'Weekly|Monthly|Quarterly|Yearly') failures.push(`${role.key}/${viewport.width}: launcher or period tabs missing`);
    if (row.periodGap < 8) failures.push(`${role.key}/${viewport.width}: adjacent period target gap below 8px (${row.periodGap}px)`);
    if (!['Actual Income', 'Net Sales', 'Reject Rate', 'AVG', 'Net / CL / SW', 'PERFORMANCE & RECAP SUPPORT'].every(token => row.text.includes(token))) failures.push(`${role.key}/${viewport.width}: dashboard essentials missing`);
    if (row.overflow || row.overlap || row.rotatedLabels || !row.chartScroll) failures.push(`${role.key}/${viewport.width}: overflow/overlap/rotation/scroll-region regression`);
    if (viewport.width <= 1024 && row.buttonSizes.some(item => item.width < 44 || item.height < 44)) failures.push(`${role.key}/${viewport.width}: target below 44px`);
    if (role.key === 'tl' && (row.scopeOptions.length || row.teamCards.length !== 1 || row.teamCards[0]?.scope !== 'fuse' || row.people.some(name => ['윤채영', '민병준'].includes(name)) || !row.people.includes('고윤경') || !row.people.includes('권영웅'))) failures.push(`${role.key}/${viewport.width}: exact-team boundary failed`);
    if (role.key === 'admin' && (!['Presence', 'FUSE', 'YOUNG WAVE', '개인'].every(option => row.scopeOptions.includes(option)) || row.teamCards.map(card => card.scope).join('|') !== 'presence|fuse|youngwave')) failures.push(`${role.key}/${viewport.width}: admin scope selector/cards missing`);
    if (role.key !== 'member' && (viewport.width === 390 || viewport.width === 1440)) await page.screenshot({ path: `/tmp/presence-recap-studio-${role.key}-${viewport.width}.png`, fullPage: true });
  }
}

await page.setViewportSize({ width: 390, height: 844 });
await install(roles[2]);
await page.locator('[data-ers-action="toggle"]').click({ force: true });
await page.locator('#ersAnchor').evaluate(input => {
  input.value = '2026-09';
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(100);
const septemberCards = await page.evaluate(() => [...document.querySelectorAll('.ers-team-summary-card')].map(card => ({ scope: card.dataset.scope, status: card.dataset.status, text: card.textContent.replace(/\s+/g, ' ').trim() })));
if (septemberCards.length !== 3 || septemberCards.some(card => card.status !== 'ready' || !['세일즈', '필드일', 'AVG', 'Actual Income', 'Reject Rate'].every(token => card.text.includes(token)) || card.text.includes('—'))) failures.push(`admin/september: three non-empty team cards missing (${JSON.stringify(septemberCards)})`);
for (const scope of ['fuse', 'youngwave']) {
  await page.locator(`.ers-team-summary-card[data-scope="${scope}"]`).click({ force: true });
  await page.waitForTimeout(60);
  const switched = await page.evaluate(scopeName => ({ select: document.getElementById('ersScope')?.value, title: document.querySelector('.ers-dashboard-title h2')?.textContent.trim(), selected: document.querySelector(`.ers-team-summary-card[data-scope="${scopeName}"]`)?.getAttribute('aria-pressed') }), scope);
  const expectedTitle = scope === 'fuse' ? 'FUSE' : 'YOUNG WAVE';
  if (switched.select !== scope || switched.title !== expectedTitle || switched.selected !== 'true') failures.push(`admin/september: ${scope} card did not switch detailed scope (${JSON.stringify(switched)})`);
}
await page.evaluate(() => {
  state.users.zero = { uid: 'zero', name: '무실적팀원', role: 'LR', status: 'active' };
  state.recapStudioTeams.youngwave = { roster: { zero: { uid: 'zero', name: '무실적팀원', role: 'LR', activeFrom: '2026-01-01' } }, weekly: {}, bep: {} };
  window.PresenceExecutiveRecap.invalidate();
});
await page.waitForTimeout(60);
const zeroState = await page.locator('.ers-team-summary-card[data-scope="youngwave"]').evaluate(card => ({ status: card.dataset.status, text: card.textContent.replace(/\s+/g, ' ').trim() }));
if (zeroState.status !== 'zero' || !zeroState.text.includes('실적 0 · 정상 집계') || !zeroState.text.includes('₩0')) failures.push(`admin/september: true zero state is not explicit (${JSON.stringify(zeroState)})`);
await page.evaluate(() => { delete state.recapStudioTeams.youngwave; window.PresenceExecutiveRecap.invalidate(); });
await page.waitForTimeout(60);
const missingState = await page.locator('.ers-team-summary-card[data-scope="youngwave"]').evaluate(card => ({ status: card.dataset.status, text: card.textContent.replace(/\s+/g, ' ').trim() }));
if (missingState.status !== 'missing' || !missingState.text.includes('미러 연결 필요') || !missingState.text.includes('—')) failures.push(`admin/september: missing mirror state is not distinct (${JSON.stringify(missingState)})`);

await install(roles[1]);
await page.evaluate(() => window.PresenceExecutiveRecap.reset());
const zeroized = await page.evaluate(() => ({ html: document.getElementById('tlhExecutiveRecapMount')?.innerHTML || '', context: window.PresenceExecutiveRecap.state.context, hostId: window.PresenceExecutiveRecap.state.hostId }));
if (zeroized.html || zeroized.context || zeroized.hostId) failures.push('logout reset did not clear privileged DOM/state');
if (pageErrors.length) failures.push(...pageErrors.map(error => `pageerror: ${error}`));

await writeFile('/tmp/presence-recap-studio-ui-results.json', JSON.stringify(results, null, 2));
await browser.close();
if (failures.length) throw new Error(failures.join('\n'));
console.log(JSON.stringify({ pass: true, cases: results.length, results: '/tmp/presence-recap-studio-ui-results.json' }));
