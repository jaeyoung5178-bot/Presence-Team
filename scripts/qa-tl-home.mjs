import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseUrl = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const nodeUrl = baseUrl.includes('?') ? `${baseUrl}&qa=tl-home` : `${baseUrl}/?qa=tl-home`;
const outputDir = new URL('../output/qa-tl-home/', import.meta.url);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const pageErrors = [];
const consoleErrors = [];
const browserPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
browserPage.on('pageerror', (error) => pageErrors.push(error.message));
browserPage.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
await browserPage.goto(nodeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await browserPage.waitForFunction(() => typeof window.renderTLHome === 'function' && document.getElementById('tlHomeRoot'), null, { timeout: 30000 });

const fixtures = {
  users: {
    admin: { uid: 'admin', name: '임재영', id: 'aop', role: 'AOP', status: 'active', surveys: {} },
    umqn54ujf: { uid: 'umqn54ujf', name: '고윤경', id: 'fuse', role: 'TL', status: 'active', surveys: {} },
    umqna7jpj: { uid: 'umqna7jpj', name: '윤채영', id: 'wave', role: 'TL', status: 'active', surveys: {} },
    fuse1: { uid: 'fuse1', name: '권영웅', id: 'fuse1', role: 'LR', status: 'active', surveys: {} },
    fuse2: { uid: 'fuse2', name: '김하진', id: 'fuse2', role: 'IC', status: 'active', surveys: {} },
    wave1: { uid: 'wave1', name: '민병준', id: 'wave1', role: 'LR', status: 'active', surveys: {} },
    wave2: { uid: 'wave2', name: '손예진', id: 'wave2', role: 'LR', status: 'active', surveys: {} },
    ic: { uid: 'ic', name: '일반팀원', id: 'ic', role: 'IC', status: 'active', surveys: {} },
  },
  dossier: {
    고윤경: { teamName: 'Fuse', upline: '임재영' }, 권영웅: { teamName: 'Fuse', upline: '고윤경' }, 김하진: { teamName: 'Fuse', upline: '고윤경' },
    윤채영: { teamName: 'Young wave', upline: '임재영' }, 민병준: { teamName: 'Young wave', upline: '윤채영' }, 손예진: { teamName: 'Blin', upline: '윤채영' }, 일반팀원: { teamName: 'Presence', upline: '임재영' },
  },
  sales: {
    '2026-08-24|고윤경': { date: '2026-08-24', name: '고윤경', count: 2, checked: true },
    '2026-08-25|권영웅': { date: '2026-08-25', name: '권영웅', count: 3, checked: true },
    '2026-08-26|김하진': { date: '2026-08-26', name: '김하진', count: 0, checked: true },
    '2026-08-27|민병준': { date: '2026-08-27', name: '민병준', count: 4, checked: true },
    '2026-08-28|손예진': { date: '2026-08-28', name: '손예진', count: 1, checked: true },
    '2026-08-31|고윤경': { date: '2026-08-31', name: '고윤경', count: 1, checked: true },
    '2026-09-01|권영웅': { date: '2026-09-01', name: '권영웅', count: 4, checked: true },
    '2026-09-02|김하진': { date: '2026-09-02', name: '김하진', count: 0, checked: true },
    '2026-09-01|민병준': { date: '2026-09-01', name: '민병준', count: 2, checked: true },
  },
  teamCalendarEvents: {
    fuse_night: { date: '2026-09-10', title: 'FUSE 팀 나잇', time: '19:00', type: 'team', teamKey: 'fuse', teamName: 'FUSE', createdBy: 'umqn54ujf', leaderName: '고윤경', createdAt: 1, updatedAt: 1 },
    fuse_strategy: { date: '2026-09-10', title: '월간 세일즈 전략 회의와 신규 팀원 온보딩 준비', time: '14:30', type: 'team', teamKey: 'fuse', teamName: 'FUSE', createdBy: 'umqn54ujf', leaderName: '고윤경', createdAt: 2, updatedAt: 2 },
    wave_visit: { date: '2026-09-10', title: 'YOUNG WAVE 합동 트레이닝', time: '16:00', type: 'team', teamKey: 'youngwave', teamName: 'YOUNG WAVE', createdBy: 'umqna7jpj', leaderName: '윤채영', createdAt: 3, updatedAt: 3 },
    presence_dinner: { date: '2026-09-10', title: '제임스 회장님과 OP급 디너 미팅', time: '18:00', type: 'business', teamKey: 'presence', teamName: 'Presence', createdBy: 'admin', leaderName: '임재영', createdAt: 4, updatedAt: 4 },
    wave_dinner: { date: '2026-09-12', title: 'OP 디너 미팅', time: '18:30', type: 'business', teamKey: 'youngwave', teamName: 'YOUNG WAVE', createdBy: 'umqna7jpj', leaderName: '윤채영', createdAt: 2, updatedAt: 2 },
    presence_meeting: { date: '2026-09-15', title: 'Presence 리더 회의', time: '10:00', type: 'team', teamKey: 'presence', teamName: 'Presence', createdBy: 'admin', leaderName: '임재영', createdAt: 3, updatedAt: 3 },
  },
};

async function installFixture(uid, useEnterApp = false) {
  await browserPage.evaluate(({ fixtures, uid, useEnterApp }) => {
    state.users = structuredClone(fixtures.users);
    state.dossier = structuredClone(fixtures.dossier);
    state.sales = structuredClone(fixtures.sales);
    state.extraMembers = [];
    state.removedMembers = [];
    state.memberInfo = {};
    state.teamWeeklyOps = {
      '2026-09-07': {
        fuse: { weekStart: '2026-09-07', weekEnd: '2026-09-13', teamKey: 'fuse', teamName: 'FUSE', leaderUid: 'umqn54ujf', leaderName: '고윤경', targetSales: 20, targetAvg: 2, hc: 2, fieldDays: 10, schedule: {}, updatedAt: 10 },
        youngwave: { weekStart: '2026-09-07', weekEnd: '2026-09-13', teamKey: 'youngwave', teamName: 'YOUNG WAVE', leaderUid: 'umqna7jpj', leaderName: '윤채영', targetSales: 18, targetAvg: 2, hc: 2, fieldDays: 9, schedule: {}, updatedAt: 11 },
      },
    };
    state.teamCalendarEvents = structuredClone(fixtures.teamCalendarEvents);
    state.teamLeaderAccess = {};
    tlHomeDrafts = {};
    tlHomeWeekStart = '2026-09-07';
    tlHomeSubscribed = false;
    tlCalendarMonth = '2026-09-01';
    tlCalendarSelectedDate = '2026-09-10';
    tlCalendarEditId = '';
    tlhResultDetailsOpen = {};
    window.__qaWrites = [];
    window.__qaLobbyCalls = 0;
    window.__qaLoaderCalls = 0;
    DB.set = async (path, value) => { window.__qaWrites.push({ path, value }); };
    DB.update = async () => {};
    DB.get = async () => null;
    DB.on = () => () => {};
    window.showPresenceEntryLobby = () => { window.__qaLobbyCalls++; return true; };
    window.showPresenceLoader = () => { window.__qaLoaderCalls++; };
    window.hidePresenceLoader = () => {};
    window.maybeAskFirstField = () => {};
    me = state.users[uid];
    document.getElementById('authGate')?.classList.add('hidden');
    document.getElementById('presenceGameLoader')?.classList.remove('show', 'complete');
    document.getElementById('presenceEntryLobby')?.classList.remove('show');
    document.getElementById('app')?.classList.remove('hidden');
    document.body.classList.add('app-on');
    if (useEnterApp) {
      window.__presenceEntryPass = false;
      window.__qaOldRenderAll = renderAll;
      renderAll = () => {};
      startAutoPull = () => {};
      subCbjournal = () => {};
      enterApp();
    } else {
      buildRail();
      if (isTlHomeUser(me)) goTab('tlhome'); else goTab('home');
      renderTLHome();
    }
  }, { fixtures, uid, useEnterApp });
  if (useEnterApp) await browserPage.waitForTimeout(130);
}

const failures = [];
await installFixture('umqn54ujf', true);
const instant = await browserPage.evaluate(() => ({ tab: curTab, lobbyCalls: window.__qaLobbyCalls, loaderCalls: window.__qaLoaderCalls, panelActive: document.getElementById('m-tlhome').classList.contains('active') }));
if (instant.tab !== 'tlhome' || instant.lobbyCalls !== 0 || instant.loaderCalls !== 0 || !instant.panelActive) failures.push('TL 로그인 즉시 진입 또는 로더/로비 우회 실패');

const viewports = [
  { name: 'compact-phone', width: 360, height: 800 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
];
const roles = [
  { name: 'member', uid: 'ic' },
  { name: 'leader', uid: 'umqn54ujf' },
  { name: 'admin', uid: 'admin' },
];
const matrix = [];
for (const role of roles) {
  for (const viewport of viewports) {
    await browserPage.setViewportSize({ width: viewport.width, height: viewport.height });
    await installFixture(role.uid, false);
    if (role.name === 'member') await browserPage.evaluate(() => goTab('tlhome'));
    await browserPage.waitForTimeout(60);
    await browserPage.evaluate(() => document.querySelectorAll('.modal.on').forEach((el) => el.classList.remove('on')));
    if (role.name !== 'member') {
      await browserPage.evaluate(() => {
        const cfg = tlHomeConfig(me);
        const keys = cfg.kind === 'aop' ? ['last-presence', 'live-presence', 'last-youngwave', 'last-fuse'] : [`last-${cfg.teamKey}`, `live-${cfg.teamKey}`];
        keys.forEach((key) => { tlhResultDetailsOpen[key] = true; });
        renderTLHome();
      });
    }
    const result = await browserPage.evaluate((roleName) => {
      const visible = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
      const overlappingChildren = (selector) => [...document.querySelectorAll(selector)].flatMap((parent) => {
        const children = [...parent.children].filter(visible);
        return children.flatMap((a, i) => children.slice(i + 1).filter((b) => {
          const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
          return Math.min(ar.right, br.right) - Math.max(ar.left, br.left) > 1 && Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top) > 1;
        }).map((b) => `${selector}:${a.className || a.tagName}/${b.className || b.tagName}`));
      });
      const touch = [...document.querySelectorAll('#m-tlhome.active button,#tlHomeEntryBtn.show')].map((el) => ({ text: el.textContent.trim(), h: Math.round(el.getBoundingClientRect().height), w: Math.round(el.getBoundingClientRect().width) }));
      const lineCount = (el) => { const range = document.createRange(); range.selectNodeContents(el); return new Set([...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0).map((r) => Math.round(r.top))).size; };
      const singleLineSelectors = '.tlh-cal-download,.tlh-cal-nav strong,.tlh-week-nav b,.tlh-card-head h3,.tlh-submit-meta strong,.tlh-plan-metric strong,.tlh-agenda-head h3,.tlh-performance-top small';
      const lineWrapIssues = [...document.querySelectorAll(singleLineSelectors)].filter(visible).filter((el) => lineCount(el) > 1).map((el) => el.textContent.trim());
      const clippedControls = [...document.querySelectorAll('#m-tlhome.active input,#m-tlhome.active select,#m-tlhome.active button')].filter(visible).filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).map((el) => el.textContent.trim() || el.id || el.tagName);
      const layoutOverlaps = ['.tlh-event-form-grid','.tlh-event-form-actions','.tlh-submit-meta','.tlh-plan-metrics','.tlh-result-member','.tlh-performance-kpis','.tlh-performance-metrics','.tlh-performance-foot','.tlh-live-total-values'].flatMap(overlappingChildren);
      const escapedControls = [...document.querySelectorAll('.tlh-event-field input,.tlh-event-field select')].filter(visible).filter((el) => { const r=el.getBoundingClientRect(), p=el.closest('.tlh-event-form').getBoundingClientRect(); return r.left<p.left-1||r.right>p.right+1; }).map((el) => el.id);
      return {
        roleName,
        tab: curTab,
        buttonVisible: visible(document.getElementById('tlHomeEntryBtn')),
        rootText: document.getElementById('tlHomeRoot').textContent,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        touch,
        memberNames: [...document.querySelectorAll('.tlh-member b')].map((el) => el.textContent.trim()),
        inputValues: [document.getElementById('tlhTargetSales')?.value, document.getElementById('tlhTargetAvg')?.value],
        lineWrapIssues,
        clippedControls,
        layoutOverlaps,
        escapedControls,
        detailToggleCount: document.querySelectorAll('[data-tlh-result-toggle]').length,
        openDetailCount: [...document.querySelectorAll('[data-tlh-result-toggle]')].filter((el) => el.getAttribute('aria-expanded') === 'true').length,
        detailNames: [...document.querySelectorAll('.tlh-result-person b')].map((el) => el.textContent.trim()),
        presenceLastFirst: document.querySelector('#tlhResultPanel-last-presence .tlh-result-person b')?.textContent.trim() || '',
        presenceLiveFirst: document.querySelector('#tlhResultPanel-live-presence .tlh-result-person b')?.textContent.trim() || '',
        liveTotalText: document.querySelector('#tlhResultPanel-live-presence .tlh-live-total')?.textContent.trim() || document.querySelector('[id^="tlhResultPanel-live-"] .tlh-live-total')?.textContent.trim() || '',
        combinedLastMetricCount: document.querySelectorAll('.tlh-performance-card:first-child .tlh-performance-metrics>div').length,
        legacyLiveVisible: !!document.querySelector('.tlh-live-table'),
        resultHeadings: [...document.querySelectorAll('.tlh-section-head h2,.tlh-submit-top>b')].map((el) => el.textContent.trim()),
      };
    }, role.name);
    matrix.push({ role: role.name, viewport: viewport.name, ...result });
    if (role.name !== 'member') await browserPage.screenshot({ path: new URL(`${role.name}-${viewport.name}.png`, outputDir).pathname, fullPage: true });
    if (role.name === 'leader' && viewport.name === 'phone') {
      await browserPage.locator('.tlh-hero').screenshot({ path: new URL('phone-hero.png', outputDir).pathname });
      await browserPage.locator('.tlh-performance-kpis').screenshot({ path: new URL('phone-performance.png', outputDir).pathname });
      await browserPage.locator('.tlh-calendar-layout').screenshot({ path: new URL('phone-team-calendar.png', outputDir).pathname });
      await browserPage.locator('.tlh-event-form').screenshot({ path: new URL('phone-event-form.png', outputDir).pathname });
      await browserPage.locator('.tlh-grid').screenshot({ path: new URL('phone-field-plan.png', outputDir).pathname });
    }
  }
}

for (const row of matrix) {
  if (row.overflow) failures.push(`${row.role}/${row.viewport}: 가로 오버플로`);
  if (row.role === 'member') {
    if (row.buttonVisible || row.tab === 'tlhome' || row.rootText.trim()) failures.push(`${row.role}/${row.viewport}: 일반 팀원 권한 가드 실패`);
  } else {
    if (!row.buttonVisible || row.tab !== 'tlhome' || !row.rootText.includes('지난주 결과') || !row.rootText.includes('팀 AVG') || !row.rootText.includes('타겟 세일즈')) failures.push(`${row.role}/${row.viewport}: TL Home 핵심 UI 누락`);
    if (row.viewport !== 'desktop' && row.touch.some((x) => x.h < 44 || x.w < 44)) failures.push(`${row.role}/${row.viewport}: 44px 터치 타깃 미달`);
    if (row.lineWrapIssues.length) failures.push(`${row.role}/${row.viewport}: 단일행 핵심 정보 줄바꿈 ${row.lineWrapIssues.join(', ')}`);
    if (row.clippedControls.length) failures.push(`${row.role}/${row.viewport}: 입력/버튼 내부 잘림 ${row.clippedControls.join(', ')}`);
    if (row.layoutOverlaps.length) failures.push(`${row.role}/${row.viewport}: 레이아웃 요소 겹침 ${row.layoutOverlaps.join(', ')}`);
    if (row.escapedControls.length) failures.push(`${row.role}/${row.viewport}: 폼 경계 이탈 ${row.escapedControls.join(', ')}`);
    const expectedDetails = row.role === 'admin' ? 4 : 2;
    if (row.detailToggleCount !== expectedDetails || row.openDetailCount !== expectedDetails) failures.push(`${row.role}/${row.viewport}: 팀원별 상세 토글 수 또는 펼침 상태 오류`);
    if (row.combinedLastMetricCount !== 3 || row.legacyLiveVisible || !row.liveTotalText.includes('현재 팀 합계') || !row.liveTotalText.includes('현재 AVG')) failures.push(`${row.role}/${row.viewport}: 지난주 통합 카드 또는 이번 주 LIVE 합계 누락`);
  }
  if (row.role === 'leader' && row.memberNames.some((name) => ['윤채영', '민병준', '손예진', '일반팀원'].includes(name))) failures.push(`${row.role}/${row.viewport}: 다른 팀 구성원 노출`);
  if (row.role === 'leader' && row.detailNames.some((name) => ['윤채영', '민병준', '손예진', '일반팀원'].includes(name))) failures.push(`${row.role}/${row.viewport}: 상세 결과에 다른 팀 구성원 노출`);
  if (row.role === 'admin' && (row.presenceLastFirst !== '임재영' || row.presenceLiveFirst !== '임재영')) failures.push(`${row.role}/${row.viewport}: Presence 상세 명단에서 임재영 AOP가 맨 위가 아님`);
  if (row.role !== 'member' && (!row.rootText.includes('팀 일정') || !row.rootText.includes('FUSE 팀 나잇') || !row.rootText.includes('OP 디너 미팅') || !row.rootText.includes('Presence 리더 회의') || !row.rootText.includes('이미지 다운로드'))) failures.push(`${row.role}/${row.viewport}: TL 공용 월간 캘린더 누락`);
  if (row.role === 'admin' && (!row.rootText.includes('FUSE') || !row.rootText.includes('YOUNG WAVE') || !row.rootText.includes('지난주 확정 실적') || !row.rootText.includes('차주 운영 계획') || !row.rootText.includes('팀 AVG1.67') || !row.rootText.includes('목표 AVG2.00') || !row.rootText.includes('팀 제출 필드 일정 불러오기') || row.resultHeadings.indexOf('Presence 전체 결과') > row.resultHeadings.indexOf('YOUNG WAVE 전체 결과') || row.resultHeadings.indexOf('YOUNG WAVE 전체 결과') > row.resultHeadings.indexOf('FUSE 전체 결과'))) failures.push(`${row.role}/${row.viewport}: Presence→YOUNG WAVE→FUSE 결과 계층 또는 팀별 계획 UI 누락`);
}

await browserPage.setViewportSize({ width: 390, height: 844 });
await installFixture('umqn54ujf', false);
const detailToggleQa = await browserPage.evaluate(() => {
  const button = document.getElementById('tlhResultToggle-last-fuse');
  const before = button?.getAttribute('aria-expanded');
  button?.click();
  const opened = document.getElementById('tlhResultToggle-last-fuse')?.getAttribute('aria-expanded');
  const names = [...document.querySelectorAll('#tlhResultPanel-last-fuse .tlh-result-person b')].map((el) => el.textContent.trim());
  document.getElementById('tlhResultToggle-last-fuse')?.click();
  const closed = document.getElementById('tlhResultToggle-last-fuse')?.getAttribute('aria-expanded');
  const hidden = document.getElementById('tlhResultPanel-last-fuse')?.hidden;
  return { before, opened, closed, hidden, names };
});
if (detailToggleQa.before !== 'false' || detailToggleQa.opened !== 'true' || detailToggleQa.closed !== 'false' || !detailToggleQa.hidden || !detailToggleQa.names.includes('권영웅') || detailToggleQa.names.includes('민병준')) failures.push('팀원별 상세보기 열기/닫기 또는 팀 권한 필터 실패');

const liveToggleQa = await browserPage.evaluate(() => {
  const button = document.getElementById('tlhResultToggle-live-fuse');
  const before = button?.getAttribute('aria-expanded');
  button?.click();
  const opened = document.getElementById('tlhResultToggle-live-fuse')?.getAttribute('aria-expanded');
  const panel = document.getElementById('tlhResultPanel-live-fuse');
  const names = [...panel.querySelectorAll('.tlh-result-person b')].map((el) => el.textContent.trim());
  const total = panel.querySelector('.tlh-live-total')?.textContent.trim();
  document.getElementById('tlhResultToggle-live-fuse')?.click();
  return { before, opened, closed: document.getElementById('tlhResultToggle-live-fuse')?.getAttribute('aria-expanded'), hidden: document.getElementById('tlhResultPanel-live-fuse')?.hidden, names, total };
});
if (liveToggleQa.before !== 'false' || liveToggleQa.opened !== 'true' || liveToggleQa.closed !== 'false' || !liveToggleQa.hidden || !liveToggleQa.total.includes('세일즈 5건') || !liveToggleQa.total.includes('현재 AVG 1.67') || liveToggleQa.names.includes('민병준')) failures.push('이번 주 LIVE 상세보기·실시간 합계 또는 팀 권한 필터 실패');

await installFixture('umqna7jpj', false);
const waveScopeQa = await browserPage.evaluate(() => {
  document.getElementById('tlhResultToggle-last-youngwave')?.click();
  return {
    title: document.querySelector('.tlh-section-head h2')?.textContent.trim(),
    detailNames: [...document.querySelectorAll('#tlhResultPanel-last-youngwave .tlh-result-person b')].map((el) => el.textContent.trim()),
    scheduleNames: [...document.querySelectorAll('.tlh-member b')].map((el) => el.textContent.trim()),
    toggleCount: document.querySelectorAll('[data-tlh-result-toggle]').length,
  };
});
if (waveScopeQa.title !== 'YOUNG WAVE 전체 결과' || waveScopeQa.toggleCount !== 2 || !waveScopeQa.detailNames.includes('민병준') || !waveScopeQa.detailNames.includes('손예진') || waveScopeQa.detailNames.some((name) => ['고윤경','권영웅','김하진'].includes(name)) || waveScopeQa.scheduleNames.some((name) => ['고윤경','권영웅','김하진'].includes(name))) failures.push('YOUNG WAVE 팀 결과·일정 권한 범위 실패');

await browserPage.setViewportSize({ width: 1440, height: 900 });
await installFixture('umqn54ujf', false);
await browserPage.evaluate(() => {
  const buttons = document.querySelectorAll('.tlh-day');
  buttons[0].click();
  buttons[1].click();
  tlhTargetInput('sales', 10);
});
const calc = await browserPage.evaluate(async () => {
  const cfg = tlHomeConfig(me), draft = tlhDraft(cfg, '2026-09-07'), counts = tlhPlanCounts(draft);
  const targetSales = draft.targetSales, targetAvg = draft.targetAvg;
  await tlhSave();
  tlhTargetInput('avg', 3);
  const reverse = tlhDraft(cfg, '2026-09-07');
  return { counts, targetSales, targetAvg, reverseSales: reverse.targetSales, writes: window.__qaWrites };
});
if (calc.counts.hc !== 1 || calc.counts.fieldDays !== 2 || calc.targetSales !== 10 || calc.targetAvg !== 5 || calc.reverseSales !== 6) failures.push('HC/필드일/세일즈↔AVG 계산 실패');
if (!calc.writes.some((x) => x.path === 'teamWeeklyOps/2026-09-07/fuse' && x.value.hc === 1 && x.value.fieldDays === 2)) failures.push('FUSE 저장 경로 또는 payload 실패');

await browserPage.evaluate(async () => {
  tlCalendarMonth = '2026-09-01';
  tlhSelectCalendarDate('2026-09-18');
  document.getElementById('tlhEventTitle').value = '신규 팀 미팅';
  document.getElementById('tlhEventTime').value = '20:00';
  document.getElementById('tlhEventType').value = 'business';
  await tlhSaveCalendarEvent();
});
const downloadPromise = browserPage.waitForEvent('download');
await browserPage.evaluate(() => tlhDownloadCalendar());
const calendarDownload = await downloadPromise;
await calendarDownload.saveAs(new URL('calendar-2026-09.png', outputDir).pathname);
const calendarQa = await browserPage.evaluate(() => ({ writes: window.__qaWrites.filter((x) => x.path.startsWith('teamCalendarEvents/')) }));
calendarQa.download = { download: calendarDownload.suggestedFilename(), href: 'blob:download' };
if (!calendarQa.writes.some((x) => x.value?.date === '2026-09-18' && x.value?.title === '신규 팀 미팅' && x.value?.teamKey === 'fuse' && x.value?.type === 'business')) failures.push('TL 공용 일정 저장 경로 또는 payload 실패');
if (!calendarQa.download?.download?.includes('Presence_Calendar_2026-09.png') || !String(calendarQa.download?.href || '').startsWith('blob:')) failures.push('월간 캘린더 PNG 다운로드 실패');

const rules = JSON.parse(await readFile(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;
if (!rules.teamLeaderAccess || !rules.teamWeeklyOps || !rules.teamWeeklyOps.$weekStart?.$teamKey?.['.write']?.includes('teamLeaderAccess') || !rules.teamCalendarEvents?.$eventId?.['.write']?.includes('createdBy')) failures.push('TL Home Firebase 권한 규칙 누락');
if (pageErrors.length) failures.push(`브라우저 pageerror: ${pageErrors.join(' | ')}`);
if (consoleErrors.some((x) => !x.includes('Firebase') && !x.includes('ERR_'))) failures.push(`브라우저 console error: ${consoleErrors.join(' | ')}`);

console.log(JSON.stringify({ instant, matrix: matrix.map(({ rootText, touch, memberNames, ...rest }) => ({ ...rest, touchMin: touch.length ? Math.min(...touch.map((x) => Math.min(x.h, x.w))) : null, members: memberNames })), detailToggleQa, liveToggleQa, waveScopeQa, calc, calendarQa, pageErrors, consoleErrors, failures }, null, 2));
await browser.close();
if (failures.length) process.exitCode = 1;
