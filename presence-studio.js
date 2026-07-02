/* ============================================================================
 *  Presence Studio — 관리 토대 v2  (기존 index.html 무수정 · 덧붙이기 전용)
 *  ---------------------------------------------------------------------------
 *  v2 변경점
 *   - [삭제] 홈 위젯 순서/표시 기능 → 앱에 이미 있는 네이티브 '🧩 홈 배치'와 충돌하여 제거.
 *           (홈 배치·접기는 앱 본체가 담당. 이 모듈은 더 이상 홈 DOM을 건드리지 않음)
 *   - [수정] 네이티브 '🧩 홈 배치' 버튼이 데스크톱에서 안 뜨던 문제 →
 *           앱이 열어둔 window.__homeArrangeSync 를 주기적으로 호출해 표시를 갱신 (본체 무수정).
 *   - [유지] Design Studio(테마 엔진): 색·톤·라운드·그림자·밀도·폰트. 저장 시 팀/개인 선택.
 *   - [추가] 테마 프리셋: 기본/옥스팜 그린/행사·캠페인/교육/리쿠르팅/차분 — 원클릭 분위기 전환.
 *
 *  붙이는 법:  index.html 의  </body>  바로 앞에  <script src="presence-studio.js"></script>
 * ==========================================================================*/
(function () {
  'use strict';
  if (window.__presenceStudio) return;
  window.__presenceStudio = true;

  /* ---- 안전 헬퍼 (앱 것이 있으면 재사용, 없으면 폴백) ---- */
  var LS = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function toast(m) { try { if (typeof window.toast === 'function') return window.toast(m); } catch (e) {} }
  function hasDB() { return window.DB && typeof window.DB.set === 'function' && typeof window.DB.on === 'function'; }

  // 소유자(임재영 AOP)에게만 편집 노출 — 네이티브 홈배치와 동일 기준(isOwnerAccount) 우선
  function canManage() {
    try { if (typeof window.isOwnerAccount === 'function' && window.me) return !!window.isOwnerAccount(window.me); } catch (e) {}
    try { if (typeof window.isFounder === 'function' && window.me) return !!window.isFounder(window.me); } catch (e) {}
    return document.body.classList.contains('can-mod');
  }

  /* ---- Theme 계약 (기본값 = 기존 :root 와 동일 → 되돌리기가 원상복구) ---- */
  var DEFAULTS = { g1: '#7c3aed', g2: '#6366f1', g3: '#06b6d4', radius: 16, shadow: 55, density: 'comfortable', disp: 'Space Grotesk', tone: 'default' };

  var TONES = {
    darker:    { ink: '#080A0D', surface: '#14171D', card: '#1B1F27', card2: '#22262F', line: '#282D36' },
    'default': { ink: '#0E1013', surface: '#1B1E25', card: '#232730', card2: '#2A2F39', line: '#30353F' },
    slate:     { ink: '#101722', surface: '#1A2431', card: '#22303F', card2: '#293848', line: '#33455A' },
    lighter:   { ink: '#15181F', surface: '#22262F', card: '#2B303B', card2: '#333945', line: '#3B424F' }
  };
  var TONE_LABEL = { darker: '더 어둡게', 'default': '기본', slate: '슬레이트', lighter: '살짝 밝게' };
  var FONTS = ['Space Grotesk', 'Pretendard', 'Jua'];
  var FONT_LABEL = { 'Space Grotesk': 'Grotesk (기본)', 'Pretendard': 'Pretendard (또렷)', 'Jua': 'Jua (둥근·친근)' };

  /* ---- 테마 프리셋 (원클릭 분위기 전환) ---- */
  var PRESETS = [
    { k: 'default', label: '기본',        emoji: '⚪', t: { g1: '#7c3aed', g2: '#6366f1', g3: '#06b6d4', radius: 16, shadow: 55, density: 'comfortable', disp: 'Space Grotesk', tone: 'default' } },
    { k: 'oxfam',   label: '옥스팜 그린',  emoji: '🌿', t: { g1: '#2F9E44', g2: '#5CBC2E', g3: '#8AE05C', radius: 16, shadow: 50, density: 'comfortable', disp: 'Space Grotesk', tone: 'default' } },
    { k: 'event',   label: '행사·캠페인',  emoji: '🎉', t: { g1: '#F2568A', g2: '#8b5cf6', g3: '#22d3ee', radius: 22, shadow: 80, density: 'spacious',    disp: 'Jua',           tone: 'default' } },
    { k: 'edu',     label: '교육',        emoji: '📘', t: { g1: '#3B82F6', g2: '#6366f1', g3: '#38BDF8', radius: 14, shadow: 40, density: 'comfortable', disp: 'Pretendard',    tone: 'slate' } },
    { k: 'recruit', label: '리쿠르팅',    emoji: '🧡', t: { g1: '#F2856A', g2: '#E6B052', g3: '#F2C94C', radius: 18, shadow: 60, density: 'comfortable', disp: 'Space Grotesk', tone: 'default' } },
    { k: 'calm',    label: '차분(집중)',  emoji: '🌙', t: { g1: '#4C6EF5', g2: '#5C7CFA', g3: '#3BC9DB', radius: 12, shadow: 35, density: 'compact',     disp: 'Pretendard',    tone: 'darker' } }
  ];

  var draft = null, savedTeam = null, savedLocal = null, studioOpen = false;

  function clampTheme(t) {
    t = t || {};
    return {
      g1: /^#[0-9a-fA-F]{6}$/.test(t.g1) ? t.g1 : DEFAULTS.g1,
      g2: /^#[0-9a-fA-F]{6}$/.test(t.g2) ? t.g2 : DEFAULTS.g2,
      g3: /^#[0-9a-fA-F]{6}$/.test(t.g3) ? t.g3 : DEFAULTS.g3,
      radius: Math.min(28, Math.max(4, +t.radius || DEFAULTS.radius)),
      shadow: Math.min(100, Math.max(0, t.shadow == null ? DEFAULTS.shadow : +t.shadow)),
      density: ['compact', 'comfortable', 'spacious'].indexOf(t.density) >= 0 ? t.density : DEFAULTS.density,
      disp: FONTS.indexOf(t.disp) >= 0 ? t.disp : DEFAULTS.disp,
      tone: TONES[t.tone] ? t.tone : DEFAULTS.tone
    };
  }
  function lighten(hex, pct) {
    try {
      var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      r = Math.min(255, Math.round(r + (255 - r) * pct / 100));
      g = Math.min(255, Math.round(g + (255 - g) * pct / 100));
      b = Math.min(255, Math.round(b + (255 - b) * pct / 100));
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    } catch (e) { return hex; }
  }
  function styleEl() {
    var el = document.getElementById('ps-theme-vars');
    if (!el) { el = document.createElement('style'); el.id = 'ps-theme-vars'; document.head.appendChild(el); }
    return el;
  }
  function applyTheme(t) {
    t = clampTheme(t); draft = t;
    var tone = TONES[t.tone] || TONES['default'], sh = t.shadow / 100;
    var grad = 'linear-gradient(135deg,' + t.g1 + ',' + t.g2 + ',' + t.g3 + ')';
    var gradSoft = 'linear-gradient(135deg,' + lighten(t.g1, 12) + ',' + lighten(t.g2, 12) + ',' + lighten(t.g3, 12) + ')';
    styleEl().textContent =
      ':root{' +
        '--ink:' + tone.ink + ';--surface:' + tone.surface + ';--card:' + tone.card + ';--card-2:' + tone.card2 + ';--line:' + tone.line + ';' +
        '--g1:' + t.g1 + ';--g2:' + t.g2 + ';--g3:' + t.g3 + ';--grad:' + grad + ';--grad-soft:' + gradSoft + ';' +
        '--radius:' + t.radius + 'px;--radius-lg:' + (t.radius + 6) + 'px;' +
        '--shadow:0 ' + (8 + Math.round(sh * 16)) + 'px ' + (20 + Math.round(sh * 26)) + 'px -12px rgba(0,0,0,' + (0.3 + sh * 0.4).toFixed(2) + ');' +
        '--disp:\'' + t.disp + '\',\'Pretendard\',sans-serif;' +
      '}' +
      'body.ps-density-compact .sec{padding-top:0!important;margin-bottom:12px!important;line-height:1.5!important}' +
      'body.ps-density-spacious .sec{margin-bottom:34px!important;line-height:1.72!important}';
    document.body.classList.remove('ps-density-compact', 'ps-density-spacious');
    if (t.density !== 'comfortable') document.body.classList.add('ps-density-' + t.density);
  }
  function activeTheme() { return savedLocal || savedTeam || DEFAULTS; }
  function reloadAndApply() { applyTheme(activeTheme()); }

  function initTheme() {
    savedLocal = LS.get('ps_theme_local');
    var cached = LS.get('ps_theme_team_cache'); if (cached) savedTeam = cached;
    reloadAndApply();
    if (hasDB()) {
      try {
        window.DB.on('config/theme', function (v) {
          savedTeam = v ? clampTheme(v) : null;
          if (savedTeam) LS.set('ps_theme_team_cache', savedTeam); else LS.del('ps_theme_team_cache');
          reloadAndApply(); if (studioOpen) renderStudio();
        });
      } catch (e) {}
    }
  }
  function saveTheme(scope) {
    var t = clampTheme(draft);
    if (scope === 'team') {
      if (hasDB()) { try { window.DB.set('config/theme', t); } catch (e) {} }
      LS.set('ps_theme_team_cache', t); LS.del('ps_theme_local');
      savedTeam = t; savedLocal = null; toast('🎨 팀 전체에 디자인 적용됨');
    } else {
      LS.set('ps_theme_local', t); savedLocal = t; toast('🎨 이 기기에만 디자인 적용됨');
    }
    reloadAndApply();
  }

  /* ---- UI ---- */
  function injectCss() {
    if (document.getElementById('ps-ui-css')) return;
    var s = document.createElement('style'); s.id = 'ps-ui-css';
    s.textContent = [
      /* 편집 도크 — 왼쪽 아래(오른쪽 네이티브 플로팅 스택과 겹치지 않도록) */
      '#ps-dock{position:fixed;left:14px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:9600;display:none;flex-direction:column;gap:9px;align-items:flex-start}',
      '@media(min-width:980px){#ps-dock{left:20px;bottom:20px}}',
      '.ps-fab{display:inline-flex;align-items:center;gap:7px;border:none;cursor:pointer;color:#fff;font-weight:800;font-size:12.5px;',
      'padding:11px 15px;border-radius:999px;background:linear-gradient(135deg,#6a5cf0,#8b5cf6);box-shadow:0 8px 22px -8px rgba(90,70,220,.65);font-family:inherit}',
      '.ps-fab.alt{background:var(--grad,#6366f1);box-shadow:0 8px 22px -8px rgba(99,102,241,.6)}',
      '.ps-fab:active{transform:scale(.97)}',
      '#ps-ov{position:fixed;inset:0;z-index:99998;display:none;background:rgba(6,7,10,.55);backdrop-filter:blur(3px)}',
      '#ps-ov.on{display:block}',
      '#ps-panel{position:fixed;top:0;right:0;height:100%;width:min(440px,100%);background:var(--surface,#1B1E25);',
      'border-left:1px solid var(--line,#30353F);box-shadow:-24px 0 60px -20px rgba(0,0,0,.6);',
      'display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s cubic-bezier(.4,0,.2,1);font-family:inherit}',
      '#ps-ov.on #ps-panel{transform:none}',
      '.ps-hd{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid var(--line,#30353F)}',
      '.ps-hd h3{font-family:var(--disp);font-size:16px;font-weight:800;color:var(--cream,#F2EFE8);margin:0;flex:1}',
      '.ps-hd .sub{font-size:11px;color:var(--faint,#6B7280);font-weight:600}',
      '.ps-x{border:none;background:var(--card,#232730);color:var(--muted,#A2ABB9);width:32px;height:32px;border-radius:9px;cursor:pointer;font-size:16px}',
      '.ps-body{flex:1;overflow-y:auto;padding:16px 16px 28px}',
      '.ps-row{margin-bottom:18px}',
      '.ps-row>label{display:block;font-size:12.5px;color:var(--muted,#A2ABB9);font-weight:700;margin-bottom:8px}',
      '.ps-presets{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}',
      '.ps-preset{border:1px solid var(--line,#30353F);background:var(--card,#232730);color:var(--cream,#F2EFE8);',
      'font-size:12px;font-weight:700;padding:10px 6px;border-radius:11px;cursor:pointer;font-family:inherit;text-align:center;line-height:1.35}',
      '.ps-preset .e{display:block;font-size:17px;margin-bottom:3px}',
      '.ps-preset.on{border-color:transparent;background:var(--grad,#6366f1);color:#fff}',
      '.ps-seg{display:flex;gap:6px;flex-wrap:wrap}',
      '.ps-seg button{border:1px solid var(--line,#30353F);background:var(--card,#232730);color:var(--cream,#F2EFE8);',
      'font-size:12.5px;font-weight:600;padding:8px 11px;border-radius:9px;cursor:pointer;font-family:inherit}',
      '.ps-seg button.on{background:var(--grad,#6366f1);color:#fff;border-color:transparent}',
      '.ps-colors{display:flex;gap:10px}.ps-colors .c{flex:1;text-align:center}',
      '.ps-colors .c span{display:block;font-size:11px;color:var(--muted,#A2ABB9);margin-bottom:5px}',
      '.ps-colors input[type=color]{width:100%;height:40px;border:1px solid var(--line,#30353F);border-radius:10px;background:var(--card,#232730);cursor:pointer;padding:3px}',
      '.ps-range{display:flex;align-items:center;gap:12px}',
      '.ps-range input[type=range]{flex:1;accent-color:var(--g2,#6366f1)}',
      '.ps-range .v{font-family:var(--mono,monospace);font-size:12px;color:var(--cream,#F2EFE8);min-width:44px;text-align:right}',
      '.ps-hint{font-size:11.5px;color:var(--faint,#6B7280);margin-top:6px;line-height:1.5}',
      '.ps-foot{border-top:1px solid var(--line,#30353F);padding:13px 16px calc(13px + env(safe-area-inset-bottom,0px));display:flex;gap:9px}',
      '.ps-btn{flex:1;border:none;border-radius:11px;padding:13px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}',
      '.ps-btn.pri{background:var(--grad,#6366f1);color:#fff}',
      '.ps-btn.gho{background:none;border:1px solid var(--line,#30353F);color:var(--muted,#A2ABB9)}',
      '.ps-sheet{position:absolute;inset:0;display:none;align-items:flex-end;background:rgba(0,0,0,.4)}',
      '.ps-sheet.on{display:flex}',
      '.ps-sheet .in{width:100%;background:var(--surface,#1B1E25);border-top:1px solid var(--line,#30353F);border-radius:18px 18px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px))}',
      '.ps-sheet h4{font-family:var(--disp);color:var(--cream,#F2EFE8);font-size:15px;margin:0 0 4px}',
      '.ps-sheet p{color:var(--faint,#6B7280);font-size:12px;margin:0 0 14px}'
    ].join('');
    document.head.appendChild(s);
  }

  function ensureOverlay() {
    if (document.getElementById('ps-ov')) return;
    var ov = document.createElement('div'); ov.id = 'ps-ov';
    ov.innerHTML =
      '<div id="ps-panel" role="dialog" aria-label="디자인 스튜디오">' +
        '<div class="ps-hd"><div style="flex:1"><h3>🎨 Design Studio</h3><span class="sub">색·라운드·폰트 — 코드 없이 수정</span></div><button class="ps-x" id="ps-close">✕</button></div>' +
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
  }

  function seg(cur, opts) {
    return opts.map(function (o) { return '<button data-v="' + o[0] + '" class="' + (String(o[0]) === String(cur) ? 'on' : '') + '">' + o[1] + '</button>'; }).join('');
  }
  function matchPreset(t) {
    for (var i = 0; i < PRESETS.length; i++) {
      var p = clampTheme(PRESETS[i].t), c = clampTheme(t);
      if (p.g1 === c.g1 && p.g2 === c.g2 && p.g3 === c.g3 && p.radius === c.radius && p.shadow === c.shadow && p.density === c.density && p.disp === c.disp && p.tone === c.tone) return PRESETS[i].k;
    }
    return null;
  }

  function renderStudio() {
    ensureOverlay();
    var t = clampTheme(draft || activeTheme());
    var curP = matchPreset(t);
    var body = document.getElementById('ps-body'), foot = document.getElementById('ps-foot');
    body.innerHTML =
      '<div class="ps-row"><label>분위기 프리셋 — 원클릭 전환</label><div class="ps-presets" id="ps-presets">' +
        PRESETS.map(function (p) { return '<button class="ps-preset ' + (curP === p.k ? 'on' : '') + '" data-k="' + p.k + '"><span class="e">' + p.emoji + '</span>' + p.label + '</button>'; }).join('') +
      '</div><div class="ps-hint">행사·교육·리쿠르팅 등 상황에 맞는 분위기를 한 번에. 고른 뒤 아래에서 미세조정도 됩니다.</div></div>' +
      '<div class="ps-row"><label>강조 색 · 그라디언트 3단계</label><div class="ps-colors">' +
        '<div class="c"><span>Primary</span><input type="color" id="ps-g1" value="' + t.g1 + '"></div>' +
        '<div class="c"><span>Middle</span><input type="color" id="ps-g2" value="' + t.g2 + '"></div>' +
        '<div class="c"><span>Accent</span><input type="color" id="ps-g3" value="' + t.g3 + '"></div>' +
      '</div></div>' +
      '<div class="ps-row"><label>배경 톤</label><div class="ps-seg" id="ps-tone">' + seg(t.tone, Object.keys(TONES).map(function (k) { return [k, TONE_LABEL[k]]; })) + '</div></div>' +
      '<div class="ps-row"><label>모서리 둥글기</label><div class="ps-range"><input type="range" id="ps-radius" min="4" max="28" value="' + t.radius + '"><span class="v" id="ps-radius-v">' + t.radius + 'px</span></div></div>' +
      '<div class="ps-row"><label>그림자 강도</label><div class="ps-range"><input type="range" id="ps-shadow" min="0" max="100" value="' + t.shadow + '"><span class="v" id="ps-shadow-v">' + t.shadow + '</span></div></div>' +
      '<div class="ps-row"><label>글자·간격 밀도</label><div class="ps-seg" id="ps-density">' + seg(t.density, [['compact', '촘촘히'], ['comfortable', '기본'], ['spacious', '여유롭게']]) + '</div></div>' +
      '<div class="ps-row"><label>제목 폰트</label><div class="ps-seg" id="ps-disp">' + seg(t.disp, FONTS.map(function (f) { return [f, FONT_LABEL[f]]; })) + '</div></div>';

    body.querySelectorAll('#ps-presets .ps-preset').forEach(function (b) {
      b.onclick = function () { var p = PRESETS.filter(function (x) { return x.k === b.dataset.k; })[0]; if (p) { draft = clampTheme(p.t); applyTheme(draft); renderStudio(); toast(p.emoji + ' ' + p.label + ' 미리보기 (저장 전)'); } };
    });
    ['g1', 'g2', 'g3'].forEach(function (id) { body.querySelector('#ps-' + id).oninput = function (e) { draft[id] = e.target.value; applyTheme(draft); refreshPresetHi(); }; });
    bindSeg('ps-tone', function (v) { draft.tone = v; applyTheme(draft); renderStudio(); });
    bindSeg('ps-density', function (v) { draft.density = v; applyTheme(draft); renderStudio(); });
    bindSeg('ps-disp', function (v) { draft.disp = v; applyTheme(draft); renderStudio(); });
    var rr = body.querySelector('#ps-radius'); rr.oninput = function (e) { draft.radius = +e.target.value; body.querySelector('#ps-radius-v').textContent = draft.radius + 'px'; applyTheme(draft); refreshPresetHi(); };
    var sr = body.querySelector('#ps-shadow'); sr.oninput = function (e) { draft.shadow = +e.target.value; body.querySelector('#ps-shadow-v').textContent = draft.shadow; applyTheme(draft); refreshPresetHi(); };

    foot.innerHTML = '<button class="ps-btn gho" id="ps-reset">기본값</button><button class="ps-btn pri" id="ps-save">저장</button>';
    foot.querySelector('#ps-reset').onclick = function () { draft = clampTheme(DEFAULTS); applyTheme(draft); renderStudio(); toast('기본 디자인으로 되돌림 (저장 전)'); };
    foot.querySelector('#ps-save').onclick = openSaveSheet;
  }
  function refreshPresetHi() {
    var curP = matchPreset(draft);
    document.querySelectorAll('#ps-presets .ps-preset').forEach(function (b) { b.classList.toggle('on', b.dataset.k === curP); });
  }
  function bindSeg(id, onPick) { var box = document.getElementById(id); if (!box) return; box.querySelectorAll('button').forEach(function (b) { b.onclick = function () { onPick(b.dataset.v); }; }); }
  function openSaveSheet() { document.getElementById('ps-sheet').classList.add('on'); }
  function closeSaveSheet() { document.getElementById('ps-sheet').classList.remove('on'); }

  function openStudio() {
    ensureOverlay(); injectCss();
    draft = clampTheme(activeTheme()); studioOpen = true; renderStudio();
    document.getElementById('ps-ov').classList.add('on');
    var st = document.getElementById('ps-sheet');
    if (!st.__bound) {
      st.__bound = true;
      document.getElementById('ps-save-team').onclick = function () { saveTheme('team'); closeSaveSheet(); };
      document.getElementById('ps-save-local').onclick = function () { saveTheme('local'); closeSaveSheet(); };
      document.getElementById('ps-save-cancel').onclick = closeSaveSheet;
    }
  }
  function closeStudio() { studioOpen = false; document.getElementById('ps-ov').classList.remove('on'); reloadAndApply(); }

  /* ---- 홈 배치: 데스크톱에서도 확실히 열기 (네이티브 타이밍/탭 조건 우회) ---- */
  function psHomeArrange() {
    try { if (typeof window.goTab === 'function') window.goTab('home'); } catch (e) {}   // curTab='home' 확정
    setTimeout(function () {
      try { if (typeof window.__homeArrangeSync === 'function') window.__homeArrangeSync(); } catch (e) {}
      var fab = document.getElementById('homeArrangeFab');
      if (fab) {
        fab.style.display = 'inline-flex'; try { fab.click(); } catch (e) {}
        setTimeout(function () {
          if (!document.body.classList.contains('home-editing')) {
            try { if (typeof window.__homeArrangeSync === 'function') window.__homeArrangeSync(); } catch (e) {}
            var f2 = document.getElementById('homeArrangeFab'); if (f2) { f2.style.display = 'inline-flex'; try { f2.click(); } catch (e) {} }
            setTimeout(function () { if (!document.body.classList.contains('home-editing')) toast('홈 화면에서 한 번 더 눌러 주세요'); }, 250);
          }
        }, 320);
      } else { toast('홈 배치 기능을 찾지 못했어요 — 새로고침 후 다시 시도해 주세요'); }
    }, 320);
  }

  function ensureLauncher() {
    if (document.getElementById('ps-dock')) return;
    var dock = document.createElement('div'); dock.id = 'ps-dock';
    var ha = document.createElement('button'); ha.id = 'ps-home'; ha.className = 'ps-fab'; ha.innerHTML = '🧩 홈배치'; ha.onclick = psHomeArrange;
    var de = document.createElement('button'); de.id = 'ps-launch'; de.className = 'ps-fab alt'; de.innerHTML = '🎨 디자인'; de.onclick = openStudio;
    dock.appendChild(ha); dock.appendChild(de);
    document.body.appendChild(dock);
  }
  function syncLauncher() { var d = document.getElementById('ps-dock'); if (d) d.style.display = canManage() ? 'flex' : 'none'; }

  /* ---- 부팅 ---- */
  function start() {
    try { injectCss(); } catch (e) {}
    try { initTheme(); } catch (e) {}
    try { ensureLauncher(); } catch (e) {}
    window.openDesignStudio = openStudio;
    window.openHomeArrange = psHomeArrange;
    window.__presenceStudioVersion = 3;
    setInterval(function () {
      try { syncLauncher(); } catch (e) {}
      try { if (typeof window.__homeArrangeSync === 'function') window.__homeArrangeSync(); } catch (e) {}
    }, 1500);
    try { syncLauncher(); } catch (e) {}
    try { if (typeof window.__homeArrangeSync === 'function') window.__homeArrangeSync(); } catch (e) {}
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(start, 300);
  else window.addEventListener('DOMContentLoaded', function () { setTimeout(start, 300); });
})();
