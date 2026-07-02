/* ============================================================================
 *  Presence Studio — 관리 토대 v1  (기존 index.html 무수정 · 덧붙이기 전용)
 *  ---------------------------------------------------------------------------
 *  붙이는 법:  index.html 의  </body>  바로 앞에 아래 한 줄만 추가
 *      <script src="presence-studio.js"></script>
 *  (또는 이 파일 내용을 <script> ... </script> 로 감싸 그대로 붙여도 됨)
 *
 *  이 모듈이 하는 일
 *   1) Theme Engine  — 색/라운드/그림자/폰트/밀도/배경톤을 CSS 변수로 실시간 적용
 *   2) Design Studio — 슬라이더·색상 버튼만으로 수정, 즉시 미리보기, 저장 시 팀/개인 선택
 *   3) 홈 위젯 관리   — 표시/숨김 · 드래그 순서변경 · '홈 간소화' 원클릭 프리셋(되돌리기)
 *
 *  저장 위치 (theme.json 계약)
 *   - 팀 공유 :  Firebase  config/theme   ·  config/homeLayout
 *   - 개인    :  localStorage  ps_theme_local
 *  관리자(소유자)에게만 편집 버튼이 보임.  기존 화면/로직은 그대로 유지됨.
 * ==========================================================================*/
(function () {
  'use strict';
  if (window.__presenceStudio) return;          // 중복 로드 방지
  window.__presenceStudio = true;

  /* ---------------------------------------------------------------------- */
  /*  안전 헬퍼 — 앱의 것이 있으면 재사용, 없으면 자체 폴백 (부팅 파괴 금지)      */
  /* ---------------------------------------------------------------------- */
  var LS = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function toast(m) { try { if (typeof window.toast === 'function') return window.toast(m); } catch (e) {} }
  function hasDB() { return window.DB && typeof window.DB.set === 'function' && typeof window.DB.on === 'function'; }

  // 소유자/관리자만 편집 UI 노출
  function canManage() {
    try {
      if (typeof window.isFounder === 'function' && window.me) return !!window.isFounder(window.me);
    } catch (e) {}
    return document.body.classList.contains('can-mod');
  }

  /* ---------------------------------------------------------------------- */
  /*  Theme 계약 — 기본값은 기존 :root 와 100% 동일 (되돌리기가 원상복구되도록)    */
  /* ---------------------------------------------------------------------- */
  var DEFAULTS = {
    g1: '#7c3aed', g2: '#6366f1', g3: '#06b6d4',   // 그라디언트 3단계 = Primary/Accent
    radius: 16,                                     // --radius (px)
    shadow: 55,                                     // 그림자 강도 0~100
    density: 'comfortable',                         // compact | comfortable | spacious
    disp: 'Space Grotesk',                          // 디스플레이 폰트 (이미 로드된 3종 중)
    tone: 'default'                                 // 배경 톤 프리셋
  };

  // 배경 톤 프리셋 — ink/surface/card/card-2/line 를 한 벌로 (가독성 안전 범위)
  var TONES = {
    darker:   { ink: '#080A0D', surface: '#14171D', card: '#1B1F27', card2: '#22262F', line: '#282D36' },
    'default':{ ink: '#0E1013', surface: '#1B1E25', card: '#232730', card2: '#2A2F39', line: '#30353F' },
    slate:    { ink: '#101722', surface: '#1A2431', card: '#22303F', card2: '#293848', line: '#33455A' },
    lighter:  { ink: '#15181F', surface: '#22262F', card: '#2B303B', card2: '#333945', line: '#3B424F' }
  };
  var TONE_LABEL = { darker: '더 어둡게', 'default': '기본', slate: '슬레이트', lighter: '살짝 밝게' };

  var FONTS = ['Space Grotesk', 'Pretendard', 'Jua'];   // index.html <head> 에 이미 로드됨
  var FONT_LABEL = { 'Space Grotesk': 'Grotesk (기본)', 'Pretendard': 'Pretendard (또렷)', 'Jua': 'Jua (둥근·친근)' };

  /* 현재 화면에 실제 적용 중인 draft (미리보기)와, 마지막으로 저장된 값 */
  var draft = null, savedTeam = null, savedLocal = null;

  function clampTheme(t) {
    t = t || {};
    var out = {};
    out.g1 = /^#[0-9a-fA-F]{6}$/.test(t.g1) ? t.g1 : DEFAULTS.g1;
    out.g2 = /^#[0-9a-fA-F]{6}$/.test(t.g2) ? t.g2 : DEFAULTS.g2;
    out.g3 = /^#[0-9a-fA-F]{6}$/.test(t.g3) ? t.g3 : DEFAULTS.g3;
    out.radius = Math.min(28, Math.max(4, +t.radius || DEFAULTS.radius));
    out.shadow = Math.min(100, Math.max(0, t.shadow == null ? DEFAULTS.shadow : +t.shadow));
    out.density = ['compact', 'comfortable', 'spacious'].indexOf(t.density) >= 0 ? t.density : DEFAULTS.density;
    out.disp = FONTS.indexOf(t.disp) >= 0 ? t.disp : DEFAULTS.disp;
    out.tone = TONES[t.tone] ? t.tone : DEFAULTS.tone;
    return out;
  }

  /* ----- 실제 적용: <style id="ps-theme-vars"> 에 변수 오버라이드를 씀 --------- */
  function styleEl() {
    var el = document.getElementById('ps-theme-vars');
    if (!el) {
      el = document.createElement('style');
      el.id = 'ps-theme-vars';
      document.head.appendChild(el);   // 메인 <style> 뒤 → :root 를 덮어씀
    }
    return el;
  }
  function applyTheme(t) {
    t = clampTheme(t);
    draft = t;
    var tone = TONES[t.tone] || TONES['default'];
    var sh = t.shadow / 100;
    var grad = 'linear-gradient(135deg,' + t.g1 + ',' + t.g2 + ',' + t.g3 + ')';
    // 살짝 밝은 소프트 그라디언트(호버용) 자동 생성
    var gradSoft = 'linear-gradient(135deg,' + lighten(t.g1, 12) + ',' + lighten(t.g2, 12) + ',' + lighten(t.g3, 12) + ')';
    var css =
      ':root{' +
        '--ink:' + tone.ink + ';--surface:' + tone.surface + ';--card:' + tone.card + ';' +
        '--card-2:' + tone.card2 + ';--line:' + tone.line + ';' +
        '--g1:' + t.g1 + ';--g2:' + t.g2 + ';--g3:' + t.g3 + ';' +
        '--grad:' + grad + ';--grad-soft:' + gradSoft + ';' +
        '--radius:' + t.radius + 'px;--radius-lg:' + (t.radius + 6) + 'px;' +
        '--shadow:0 ' + (8 + Math.round(sh * 16)) + 'px ' + (20 + Math.round(sh * 26)) + 'px -12px rgba(0,0,0,' + (0.3 + sh * 0.4).toFixed(2) + ');' +
        '--disp:\'' + t.disp + '\',\'Pretendard\',sans-serif;' +
      '}' +
      /* 밀도: 기본(comfortable)은 규칙 없음 → 원상복구 안전. 나머지만 스코프 적용 */
      'body.ps-density-compact .sec{padding-top:0!important;margin-bottom:12px!important;line-height:1.5!important}' +
      'body.ps-density-spacious .sec{margin-bottom:34px!important;line-height:1.72!important}';
    styleEl().textContent = css;

    document.body.classList.remove('ps-density-compact', 'ps-density-spacious');
    if (t.density !== 'comfortable') document.body.classList.add('ps-density-' + t.density);
  }

  // #rrggbb 를 percent 만큼 밝게
  function lighten(hex, pct) {
    try {
      var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      r = Math.min(255, Math.round(r + (255 - r) * pct / 100));
      g = Math.min(255, Math.round(g + (255 - g) * pct / 100));
      b = Math.min(255, Math.round(b + (255 - b) * pct / 100));
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    } catch (e) { return hex; }
  }

  /* ----- 로드: 팀(Firebase) 구독 + 개인(localStorage) 우선 적용 --------------- */
  function activeTheme() {
    // 개인 오버라이드가 있으면 그것이 이 기기의 최종값
    if (savedLocal) return savedLocal;
    if (savedTeam) return savedTeam;
    return DEFAULTS;
  }
  function reloadAndApply() { applyTheme(activeTheme()); }

  function initTheme() {
    savedLocal = LS.get('ps_theme_local');            // 개인
    var cachedTeam = LS.get('ps_theme_team_cache');   // 팀 캐시(오프라인 첫 페인트용)
    if (cachedTeam) savedTeam = cachedTeam;
    reloadAndApply();

    if (hasDB()) {
      try {
        window.DB.on('config/theme', function (v) {
          savedTeam = v ? clampTheme(v) : null;
          if (savedTeam) LS.set('ps_theme_team_cache', savedTeam); else LS.del('ps_theme_team_cache');
          reloadAndApply();
          if (studioOpen) renderStudio();  // 열려있으면 컨트롤도 갱신
        });
      } catch (e) {}
    }
  }

  function saveTheme(scope) {           // scope: 'team' | 'local'
    var t = clampTheme(draft);
    if (scope === 'team') {
      if (hasDB()) { try { window.DB.set('config/theme', t); } catch (e) {} }
      LS.set('ps_theme_team_cache', t);
      LS.del('ps_theme_local');          // 개인 오버라이드 해제 → 팀 버전을 봄
      savedTeam = t; savedLocal = null;
      toast('🎨 팀 전체에 디자인 적용됨');
    } else {
      LS.set('ps_theme_local', t);
      savedLocal = t;
      toast('🎨 이 기기에만 디자인 적용됨');
    }
    reloadAndApply();
  }

  /* ---------------------------------------------------------------------- */
  /*  홈 위젯 계약 — 기존 홈 섹션을 '위젯'으로 취급 (DOM 순서/표시만 제어)         */
  /* ---------------------------------------------------------------------- */
  var WIDGETS = [
    { k: 'hero',   sel: '#m-home .hero',   label: '히어로 · 팀 소개',     ess: false },
    { k: 'tree',   sel: '#treeSecHome',    label: 'Presence 나무',        ess: false },
    { k: 'coop',   sel: '#coopSec',        label: '협업 위젯',            ess: false },
    { k: 'dash',   sel: '#homeDashSec',    label: '홈 대시보드 · KPI',    ess: true  },
    { k: 'today',  sel: '#todaySec',       label: '오늘',                 ess: true  },
    { k: 'celeb',  sel: '#celebSec',       label: '축하 · 기념일',        ess: false },
    { k: 'praise', sel: '#praiseSec',      label: '칭찬',                 ess: false },
    { k: 'attend', sel: '#attendSec',      label: '출근 현황',            ess: true  },
    { k: 'quick',  sel: '#quickSec',       label: '퀵 링크',              ess: false },
    { k: 'gb',     sel: '#gbSec',          label: '방명록',               ess: false },
    { k: 'fx',     sel: '#fxSec',          label: '이펙트 · 관리자',      ess: false }
  ];
  var WMAP = {}; WIDGETS.forEach(function (w) { WMAP[w.k] = w; });

  var homeLayout = null;   // { order:[k...], off:{k:true}, prevSimplify:{...}|null }

  function defaultLayout() {
    return { order: WIDGETS.map(function (w) { return w.k; }), off: {}, prevSimplify: null };
  }
  function normalizeLayout(l) {
    l = l || {};
    var order = Array.isArray(l.order) ? l.order.filter(function (k) { return WMAP[k]; }) : [];
    WIDGETS.forEach(function (w) { if (order.indexOf(w.k) < 0) order.push(w.k); }); // 누락 위젯 뒤에 보강
    return { order: order, off: l.off || {}, prevSimplify: l.prevSimplify || null };
  }
  function homeEl(k) { try { return document.querySelector(WMAP[k].sel); } catch (e) { return null; } }
  function homeContainer() { return document.querySelector('#m-home .wrap'); }

  function applyHomeLayout() {
    var l = homeLayout || defaultLayout();
    var box = homeContainer(); if (!box) return;
    // 순서: order 대로 실제 DOM 재배치
    l.order.forEach(function (k) {
      var el = homeEl(k);
      if (el && el.parentNode === box) box.appendChild(el);   // 뒤로 밀며 순서 정렬
    });
    // 표시/숨김
    WIDGETS.forEach(function (w) {
      var el = homeEl(w.k); if (!el) return;
      if (l.off[w.k]) el.classList.add('ps-widget-off');
      else el.classList.remove('ps-widget-off');
    });
  }

  function initHomeLayout() {
    var cache = LS.get('ps_home_cache');
    homeLayout = normalizeLayout(cache);
    tryApplyHomeSoon();
    if (hasDB()) {
      try {
        window.DB.on('config/homeLayout', function (v) {
          homeLayout = normalizeLayout(v);
          LS.set('ps_home_cache', homeLayout);
          applyHomeLayout();
          if (studioOpen) renderStudio();
        });
      } catch (e) {}
    }
  }
  function saveHomeLayout() {
    var l = normalizeLayout(homeLayout);
    if (hasDB()) { try { window.DB.set('config/homeLayout', l); } catch (e) {} }
    LS.set('ps_home_cache', l);
    applyHomeLayout();
  }

  // 홈 섹션은 로그인 후 렌더되므로, 존재할 때까지 잠깐 재시도
  function tryApplyHomeSoon() {
    var n = 0;
    (function loop() {
      if (homeContainer()) { applyHomeLayout(); return; }
      if (n++ < 40) setTimeout(loop, 250);
    })();
  }

  /* '홈 간소화' 프리셋: 필수(ess) 위젯만 남기고 나머지 숨김 · 되돌리기 지원 */
  function applySimplify() {
    homeLayout = normalizeLayout(homeLayout);
    homeLayout.prevSimplify = JSON.parse(JSON.stringify(homeLayout.off || {}));  // 현재 상태 백업
    var off = {};
    WIDGETS.forEach(function (w) { if (!w.ess) off[w.k] = true; });
    homeLayout.off = off;
    saveHomeLayout();
    toast('🧹 홈을 핵심만 남겨 간소화했습니다');
  }
  function undoSimplify() {
    if (!homeLayout || !homeLayout.prevSimplify) return;
    homeLayout.off = homeLayout.prevSimplify;
    homeLayout.prevSimplify = null;
    saveHomeLayout();
    toast('↩︎ 간소화 이전으로 되돌렸습니다');
  }

  /* ---------------------------------------------------------------------- */
  /*  UI — 자체 CSS 주입 (앱 토큰 재사용, 폴백 포함)                            */
  /* ---------------------------------------------------------------------- */
  function injectCss() {
    if (document.getElementById('ps-ui-css')) return;
    var s = document.createElement('style'); s.id = 'ps-ui-css';
    s.textContent = [
      '.ps-widget-off{display:none!important}',
      /* 편집 런처 */
      '#ps-launch{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:99997;',
      'display:none;align-items:center;gap:7px;border:none;cursor:pointer;color:#fff;font-weight:800;font-size:13.5px;',
      'padding:11px 15px;border-radius:999px;background:var(--grad,#6366f1);box-shadow:0 10px 26px -10px rgba(99,102,241,.75);font-family:inherit}',
      '#ps-launch:active{transform:scale(.97)}',
      '@media(min-width:980px){#ps-launch{right:22px;bottom:22px}}',
      /* 오버레이 */
      '#ps-ov{position:fixed;inset:0;z-index:99998;display:none;background:rgba(6,7,10,.55);backdrop-filter:blur(3px)}',
      '#ps-ov.on{display:block}',
      '#ps-panel{position:fixed;top:0;right:0;height:100%;width:min(440px,100%);background:var(--surface,#1B1E25);',
      'border-left:1px solid var(--line,#30353F);box-shadow:-24px 0 60px -20px rgba(0,0,0,.6);',
      'display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s cubic-bezier(.4,0,.2,1);font-family:inherit}',
      '#ps-ov.on #ps-panel{transform:none}',
      '.ps-hd{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid var(--line,#30353F)}',
      '.ps-hd h3{font-family:var(--disp);font-size:16px;font-weight:800;color:var(--cream,#F2EFE8);margin:0;flex:1}',
      '.ps-x{border:none;background:var(--card,#232730);color:var(--muted,#A2ABB9);width:32px;height:32px;border-radius:9px;cursor:pointer;font-size:16px}',
      '.ps-tabs{display:flex;gap:5px;padding:12px 14px 0}',
      '.ps-tab{flex:1;border:1px solid var(--line,#30353F);background:none;color:var(--muted,#A2ABB9);font-weight:700;font-size:13px;',
      'padding:9px;border-radius:10px;cursor:pointer;font-family:inherit}',
      '.ps-tab.on{background:var(--grad,#6366f1);color:#fff;border-color:transparent}',
      '.ps-body{flex:1;overflow-y:auto;padding:16px 16px 28px}',
      '.ps-row{margin-bottom:18px}',
      '.ps-row>label{display:block;font-size:12.5px;color:var(--muted,#A2ABB9);font-weight:700;margin-bottom:8px}',
      '.ps-seg{display:flex;gap:6px;flex-wrap:wrap}',
      '.ps-seg button{border:1px solid var(--line,#30353F);background:var(--card,#232730);color:var(--cream,#F2EFE8);',
      'font-size:12.5px;font-weight:600;padding:8px 11px;border-radius:9px;cursor:pointer;font-family:inherit}',
      '.ps-seg button.on{background:var(--grad,#6366f1);color:#fff;border-color:transparent}',
      '.ps-colors{display:flex;gap:10px}',
      '.ps-colors .c{flex:1;text-align:center}',
      '.ps-colors .c span{display:block;font-size:11px;color:var(--muted,#A2ABB9);margin-bottom:5px}',
      '.ps-colors input[type=color]{width:100%;height:40px;border:1px solid var(--line,#30353F);border-radius:10px;background:var(--card,#232730);cursor:pointer;padding:3px}',
      '.ps-range{display:flex;align-items:center;gap:12px}',
      '.ps-range input[type=range]{flex:1;accent-color:var(--g2,#6366f1)}',
      '.ps-range .v{font-family:var(--mono,monospace);font-size:12px;color:var(--cream,#F2EFE8);min-width:44px;text-align:right}',
      '.ps-hint{font-size:11.5px;color:var(--faint,#6B7280);margin-top:6px;line-height:1.5}',
      /* 위젯 리스트 */
      '.ps-wlist{list-style:none;margin:0;padding:0}',
      '.ps-wi{display:flex;align-items:center;gap:11px;background:var(--card,#232730);border:1px solid var(--line,#30353F);',
      'border-radius:11px;padding:11px 12px;margin-bottom:8px}',
      '.ps-wi.drag{opacity:.4}.ps-wi.over{border-color:var(--g2,#6366f1)}',
      '.ps-grip{cursor:grab;color:var(--faint,#6B7280);font-size:16px;line-height:1;touch-action:none;user-select:none}',
      '.ps-wi .nm{flex:1;font-size:14px;font-weight:600;color:var(--cream,#F2EFE8)}',
      '.ps-wi .ess{font-size:9.5px;font-weight:800;color:#0E2A06;background:var(--green-soft,#8AE05C);border-radius:5px;padding:1px 5px;margin-left:6px}',
      /* 토글 스위치 */
      '.ps-sw{position:relative;width:42px;height:24px;border-radius:999px;background:var(--line,#30353F);border:none;cursor:pointer;flex:none;transition:.15s}',
      '.ps-sw.on{background:var(--grad,#6366f1)}',
      '.ps-sw::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.15s}',
      '.ps-sw.on::after{left:21px}',
      /* 하단 액션 */
      '.ps-foot{border-top:1px solid var(--line,#30353F);padding:13px 16px calc(13px + env(safe-area-inset-bottom,0px));display:flex;gap:9px}',
      '.ps-btn{flex:1;border:none;border-radius:11px;padding:13px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}',
      '.ps-btn.pri{background:var(--grad,#6366f1);color:#fff}',
      '.ps-btn.gho{background:none;border:1px solid var(--line,#30353F);color:var(--muted,#A2ABB9)}',
      /* 저장 선택 시트 */
      '.ps-sheet{position:absolute;inset:0;display:none;align-items:flex-end;background:rgba(0,0,0,.4)}',
      '.ps-sheet.on{display:flex}',
      '.ps-sheet .in{width:100%;background:var(--surface,#1B1E25);border-top:1px solid var(--line,#30353F);border-radius:18px 18px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px))}',
      '.ps-sheet h4{font-family:var(--disp);color:var(--cream,#F2EFE8);font-size:15px;margin:0 0 4px}',
      '.ps-sheet p{color:var(--faint,#6B7280);font-size:12px;margin:0 0 14px}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ----- 오버레이 DOM ----------------------------------------------------- */
  var studioOpen = false, curTab = 'design';
  function ensureOverlay() {
    if (document.getElementById('ps-ov')) return;
    var ov = document.createElement('div'); ov.id = 'ps-ov';
    ov.innerHTML =
      '<div id="ps-panel" role="dialog" aria-label="디자인 스튜디오">' +
        '<div class="ps-hd"><h3>⚙️ Design Studio</h3><button class="ps-x" id="ps-close">✕</button></div>' +
        '<div class="ps-tabs">' +
          '<button class="ps-tab on" data-t="design">디자인</button>' +
          '<button class="ps-tab" data-t="home">홈 위젯</button>' +
        '</div>' +
        '<div class="ps-body" id="ps-body"></div>' +
        '<div class="ps-foot" id="ps-foot"></div>' +
        '<div class="ps-sheet" id="ps-sheet"><div class="in">' +
          '<h4>어디에 적용할까요?</h4><p>같은 디자인을 팀 전체가 보게 할지, 이 기기에만 적용할지 선택하세요.</p>' +
          '<div style="display:flex;gap:9px">' +
            '<button class="ps-btn pri" id="ps-save-team">팀 전체 적용</button>' +
            '<button class="ps-btn gho" id="ps-save-local">내 화면에만</button>' +
          '</div>' +
          '<button class="ps-btn gho" id="ps-save-cancel" style="width:100%;margin-top:9px">취소</button>' +
        '</div></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeStudio(); });
    document.getElementById('ps-close').onclick = closeStudio;
    ov.querySelectorAll('.ps-tab').forEach(function (b) {
      b.onclick = function () { curTab = b.dataset.t; renderStudio(); };
    });
  }

  function seg(cur, opts, onPick) {           // opts: [[value,label]...]
    return opts.map(function (o) {
      return '<button data-v="' + o[0] + '" class="' + (String(o[0]) === String(cur) ? 'on' : '') + '">' + o[1] + '</button>';
    }).join('');
  }

  function renderStudio() {
    ensureOverlay();
    document.querySelectorAll('.ps-tab').forEach(function (b) { b.classList.toggle('on', b.dataset.t === curTab); });
    var body = document.getElementById('ps-body');
    var foot = document.getElementById('ps-foot');

    if (curTab === 'design') {
      var t = clampTheme(draft || activeTheme());
      body.innerHTML =
        '<div class="ps-row"><label>강조 색 · 그라디언트 3단계</label><div class="ps-colors">' +
          '<div class="c"><span>Primary</span><input type="color" id="ps-g1" value="' + t.g1 + '"></div>' +
          '<div class="c"><span>Middle</span><input type="color" id="ps-g2" value="' + t.g2 + '"></div>' +
          '<div class="c"><span>Accent</span><input type="color" id="ps-g3" value="' + t.g3 + '"></div>' +
        '</div><div class="ps-hint">버튼·배지·강조선에 쓰이는 대표 색입니다. 바꾸면 즉시 화면에 미리보기됩니다.</div></div>' +

        '<div class="ps-row"><label>배경 톤</label><div class="ps-seg" id="ps-tone">' +
          seg(t.tone, Object.keys(TONES).map(function (k) { return [k, TONE_LABEL[k]]; })) + '</div></div>' +

        '<div class="ps-row"><label>모서리 둥글기</label><div class="ps-range">' +
          '<input type="range" id="ps-radius" min="4" max="28" value="' + t.radius + '">' +
          '<span class="v" id="ps-radius-v">' + t.radius + 'px</span></div></div>' +

        '<div class="ps-row"><label>그림자 강도</label><div class="ps-range">' +
          '<input type="range" id="ps-shadow" min="0" max="100" value="' + t.shadow + '">' +
          '<span class="v" id="ps-shadow-v">' + t.shadow + '</span></div></div>' +

        '<div class="ps-row"><label>글자·간격 밀도</label><div class="ps-seg" id="ps-density">' +
          seg(t.density, [['compact', '촘촘히'], ['comfortable', '기본'], ['spacious', '여유롭게']]) + '</div></div>' +

        '<div class="ps-row"><label>제목 폰트</label><div class="ps-seg" id="ps-disp">' +
          seg(t.disp, FONTS.map(function (f) { return [f, FONT_LABEL[f]]; })) + '</div></div>';

      // 바인딩
      ['g1', 'g2', 'g3'].forEach(function (id) {
        body.querySelector('#ps-' + id).oninput = function (e) { draft[id] = e.target.value; applyTheme(draft); };
      });
      bindSeg('ps-tone', function (v) { draft.tone = v; applyTheme(draft); renderStudio(); });
      bindSeg('ps-density', function (v) { draft.density = v; applyTheme(draft); renderStudio(); });
      bindSeg('ps-disp', function (v) { draft.disp = v; applyTheme(draft); renderStudio(); });
      var rr = body.querySelector('#ps-radius');
      rr.oninput = function (e) { draft.radius = +e.target.value; body.querySelector('#ps-radius-v').textContent = draft.radius + 'px'; applyTheme(draft); };
      var sr = body.querySelector('#ps-shadow');
      sr.oninput = function (e) { draft.shadow = +e.target.value; body.querySelector('#ps-shadow-v').textContent = draft.shadow; applyTheme(draft); };

      foot.innerHTML =
        '<button class="ps-btn gho" id="ps-reset">기본값</button>' +
        '<button class="ps-btn pri" id="ps-save">저장</button>';
      foot.querySelector('#ps-reset').onclick = function () {
        draft = clampTheme(DEFAULTS); applyTheme(draft); renderStudio(); toast('기본 디자인으로 되돌림 (아직 저장 전)');
      };
      foot.querySelector('#ps-save').onclick = openSaveSheet;

    } else {
      // 홈 위젯 탭
      var l = normalizeLayout(homeLayout);
      var rows = l.order.map(function (k) {
        var w = WMAP[k]; var on = !l.off[k];
        return '<li class="ps-wi" draggable="true" data-k="' + k + '">' +
          '<span class="ps-grip" aria-hidden="true">⠿</span>' +
          '<span class="nm">' + w.label + (w.ess ? '<span class="ess">핵심</span>' : '') + '</span>' +
          '<button class="ps-sw ' + (on ? 'on' : '') + '" data-k="' + k + '" aria-label="표시 토글"></button>' +
        '</li>';
      }).join('');
      body.innerHTML =
        '<div class="ps-hint" style="margin-bottom:12px">⠿ 를 잡고 끌어 순서를 바꾸고, 스위치로 첫 화면 표시 여부를 정하세요. 변경은 저장을 눌러야 팀에 반영됩니다.</div>' +
        '<ul class="ps-wlist" id="ps-wlist">' + rows + '</ul>' +
        '<div class="ps-hint" style="margin-top:6px">‘핵심’ 위젯(오늘·대시보드·출근)은 첫 화면에 두는 것을 권장합니다.</div>';

      // 스위치
      body.querySelectorAll('.ps-sw').forEach(function (b) {
        b.onclick = function () {
          var k = b.dataset.k;
          homeLayout = normalizeLayout(homeLayout);
          if (homeLayout.off[k]) delete homeLayout.off[k]; else homeLayout.off[k] = true;
          b.classList.toggle('on'); applyHomeLayout();
        };
      });
      bindDrag(body.querySelector('#ps-wlist'));

      foot.innerHTML =
        (l.prevSimplify ?
          '<button class="ps-btn gho" id="ps-simpl">간소화 되돌리기</button>' :
          '<button class="ps-btn gho" id="ps-simpl">홈 간소화</button>') +
        '<button class="ps-btn pri" id="ps-savehome">저장</button>';
      foot.querySelector('#ps-simpl').onclick = function () {
        if (normalizeLayout(homeLayout).prevSimplify) undoSimplify(); else applySimplify();
        renderStudio();
      };
      foot.querySelector('#ps-savehome').onclick = function () {
        saveHomeLayout(); toast('🏠 홈 구성을 팀에 저장했습니다');
      };
    }
  }

  function bindSeg(id, onPick) {
    var box = document.getElementById(id); if (!box) return;
    box.querySelectorAll('button').forEach(function (b) { b.onclick = function () { onPick(b.dataset.v); }; });
  }

  /* HTML5 드래그로 위젯 순서변경 */
  function bindDrag(ul) {
    if (!ul) return;
    var dragK = null;
    ul.querySelectorAll('.ps-wi').forEach(function (li) {
      li.addEventListener('dragstart', function () { dragK = li.dataset.k; li.classList.add('drag'); });
      li.addEventListener('dragend', function () { li.classList.remove('drag'); ul.querySelectorAll('.ps-wi').forEach(function (x) { x.classList.remove('over'); }); });
      li.addEventListener('dragover', function (e) { e.preventDefault(); li.classList.add('over'); });
      li.addEventListener('dragleave', function () { li.classList.remove('over'); });
      li.addEventListener('drop', function (e) {
        e.preventDefault(); li.classList.remove('over');
        var tgt = li.dataset.k; if (!dragK || dragK === tgt) return;
        homeLayout = normalizeLayout(homeLayout);
        var o = homeLayout.order; o.splice(o.indexOf(dragK), 1);
        o.splice(o.indexOf(tgt), 0, dragK);
        homeLayout.order = o; applyHomeLayout(); renderStudio();
      });
    });
  }

  function openSaveSheet() { document.getElementById('ps-sheet').classList.add('on'); }
  function closeSaveSheet() { document.getElementById('ps-sheet').classList.remove('on'); }

  function openStudio() {
    ensureOverlay(); injectCss();
    draft = clampTheme(activeTheme());
    homeLayout = normalizeLayout(homeLayout);
    curTab = 'design'; studioOpen = true;
    renderStudio();
    document.getElementById('ps-ov').classList.add('on');
    // 저장 시트 버튼 (한 번만)
    var st = document.getElementById('ps-sheet');
    if (!st.__bound) {
      st.__bound = true;
      document.getElementById('ps-save-team').onclick = function () { saveTheme('team'); closeSaveSheet(); };
      document.getElementById('ps-save-local').onclick = function () { saveTheme('local'); closeSaveSheet(); };
      document.getElementById('ps-save-cancel').onclick = closeSaveSheet;
    }
  }
  function closeStudio() {
    studioOpen = false;
    document.getElementById('ps-ov').classList.remove('on');
    // 저장 안 한 디자인 미리보기는 마지막 저장값으로 원복
    reloadAndApply();
  }

  /* ----- 편집 런처 (관리자에게만) ---------------------------------------- */
  function ensureLauncher() {
    if (document.getElementById('ps-launch')) return;
    var b = document.createElement('button'); b.id = 'ps-launch';
    b.innerHTML = '✏️ 편집';
    b.onclick = openStudio;
    document.body.appendChild(b);
  }
  function syncLauncher() {
    var b = document.getElementById('ps-launch'); if (!b) return;
    b.style.display = canManage() ? 'inline-flex' : 'none';
  }

  /* ---------------------------------------------------------------------- */
  /*  부팅 — 앱 로직 이후에 안전하게 시작                                       */
  /* ---------------------------------------------------------------------- */
  function start() {
    try { injectCss(); } catch (e) {}
    try { initTheme(); } catch (e) {}
    try { initHomeLayout(); } catch (e) {}
    try { ensureLauncher(); } catch (e) {}
    // goTab('home') 후 홈 레이아웃 재적용 (기존 함수 감싸기 · 반환값 보존)
    try {
      if (typeof window.goTab === 'function' && !window.goTab.__psWrapped) {
        var _g = window.goTab;
        window.goTab = function (name) {
          var r = _g.apply(this, arguments);
          if (name === 'home') { try { applyHomeLayout(); } catch (e) {} }
          return r;
        };
        window.goTab.__psWrapped = true;
      }
    } catch (e) {}
    // 로그인/관리자모드 변화 감지 → 런처 노출 갱신
    setInterval(syncLauncher, 1500);
    syncLauncher();
    // 외부에서 열 수 있는 진입점
    window.openDesignStudio = openStudio;
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(start, 300);
  } else {
    window.addEventListener('DOMContentLoaded', function () { setTimeout(start, 300); });
  }
})();
