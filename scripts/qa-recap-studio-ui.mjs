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
    const pays = ['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30'];
    const weekly = {};
    pays.forEach((pay, index) => {
      weekly[pay] = {
        umqn54ujf: { uid: 'umqn54ujf', name: '고윤경', role: 'TL', payDate: pay, payType: 'performance', netPayment: 1200000 + index * 100000, rejectCLCount: index % 2, rejectSWCount: 0, resubmitCLCount: 0, resubmitSWCount: 0 },
        fuse1: { uid: 'fuse1', name: '권영웅', role: 'LR', payDate: pay, payType: 'performance', netPayment: 900000 + index * 80000, rejectCLCount: 0, rejectSWCount: index === 2 ? 1 : 0, resubmitCLCount: 0, resubmitSWCount: 0 },
        umqna7jpj: { uid: 'umqna7jpj', name: '윤채영', role: 'TL', payDate: pay, payType: 'performance', netPayment: 1000000, rejectCLCount: 0, rejectSWCount: 0 },
        wave1: { uid: 'wave1', name: '민병준', role: 'LR', payDate: pay, payType: 'performance', netPayment: 800000, rejectCLCount: 0, rejectSWCount: 0 },
      };
    });
    const teamWeekly = {};
    pays.forEach(pay => { teamWeekly[pay] = { umqn54ujf: weekly[pay].umqn54ujf, fuse1: weekly[pay].fuse1 }; });
    const sales = {};
    const names = ['고윤경', '권영웅', '윤채영', '민병준'];
    ['2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13', '2026-10-20'].forEach((date, i) => names.forEach((name, j) => {
      sales[`${date}|${name}`] = { date, name, count: 2 + ((i + j) % 4), checked: true };
    }));
    state.users = structuredClone(users);
    state.sales = sales;
    state.weeklyProfitRecaps = weekly;
    state.profitMonthlyBep = {};
    state.recapStudioAccess = role.access ? structuredClone(role.access) : null;
    state.recapStudioTeams = {
      fuse: { roster: structuredClone(roster.fuse), weekly: structuredClone(teamWeekly), bep: {} },
      youngwave: { roster: structuredClone(roster.youngwave), weekly: {}, bep: {} },
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
      const rects = [...document.querySelectorAll('.ers-kpi,.ers-card')].filter(visible).map(element => ({ name: element.className, top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right }));
      const overlap = rects.some((a, index) => rects.slice(index + 1).some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2));
      return {
        roleKey,
        shell: !!shell,
        text: shell?.textContent.replace(/\s+/g, ' ').trim() || '',
        scopeOptions: [...document.querySelectorAll('#ersScope option')].map(option => option.textContent.trim()),
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
    if (role.key === 'tl' && (row.scopeOptions.length || row.people.some(name => ['윤채영', '민병준'].includes(name)) || !row.people.includes('고윤경') || !row.people.includes('권영웅'))) failures.push(`${role.key}/${viewport.width}: exact-team boundary failed`);
    if (role.key === 'admin' && !['Presence', 'FUSE', 'YOUNG WAVE', '개인'].every(option => row.scopeOptions.includes(option))) failures.push(`${role.key}/${viewport.width}: admin scope selector missing`);
    if (role.key !== 'member' && (viewport.width === 390 || viewport.width === 1440)) await page.screenshot({ path: `/tmp/presence-recap-studio-${role.key}-${viewport.width}.png`, fullPage: true });
  }
}

await install(roles[1]);
await page.evaluate(() => window.PresenceExecutiveRecap.reset());
const zeroized = await page.evaluate(() => ({ html: document.getElementById('tlhExecutiveRecapMount')?.innerHTML || '', context: window.PresenceExecutiveRecap.state.context, hostId: window.PresenceExecutiveRecap.state.hostId }));
if (zeroized.html || zeroized.context || zeroized.hostId) failures.push('logout reset did not clear privileged DOM/state');
if (pageErrors.length) failures.push(...pageErrors.map(error => `pageerror: ${error}`));

await writeFile('/tmp/presence-recap-studio-ui-results.json', JSON.stringify(results, null, 2));
await browser.close();
if (failures.length) throw new Error(failures.join('\n'));
console.log(JSON.stringify({ pass: true, cases: results.length, results: '/tmp/presence-recap-studio-ui-results.json' }));
