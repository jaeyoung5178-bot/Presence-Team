/* ============================================================================
 *  Presence Studio — 관리 토대 v4  (기존 index.html 무수정 · 덧붙이기 전용)
 *  ---------------------------------------------------------------------------
 *  ⚠ 캐시 회피용으로 파일명을 새로 줬습니다(ps-hub.js). index.html 의 스크립트 한 줄을
 *     <script src="ps-hub.js"></script> 로 바꿔주세요. (새 이름은 캐시된 적이 없어 항상 최신)
 *
 *  v4 변경점
 *   - [핵심] '🧩 홈배치' 를 네이티브 버튼에 기대지 않고 직접 처리.
 *           내 편집창에서 순서를 바꾸면 앱의 정식 경로(window.__applyHomeOrder + homeOrder)로
 *           저장 → 팀 전체 동기화. 데스크톱에서 네이티브 버튼이 안 뜨는 문제와 완전히 무관.
 *   - [유지] Design Studio(테마) · 테마 프리셋 · 팀/개인 저장.
 *   - goTab 을 가로채지 않음 → 네이티브 홈배치와 충돌 없음.
 * ==========================================================================*/
(function () {
  'use strict';
  if (window.__presenceStudio) return;
  window.__presenceStudio = true;
  window.__presenceStudioVersion = 4;

  var LS = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function toast(m) { try { if (typeof window.toast === 'function') return window.toast(m); } catch (e) {} }
  function hasDB() { return window.DB && typeof window.DB.set === 'function' && typeof window.DB.on === 'function'; }
  function canManage() {
    try { if (typeof window.isOwnerAccount === 'function' && window.me) return !!window.isOwnerAccount(window.me); } catch (e) {}
    try { if (typeof window.isFounder === 'function' && window.me) return !!window.isFounder(window.me); } catch (e) {}
    return document.body.classList.contains('can-mod');
  }

  /* ═══════════ 테마 엔진 ═══════════ */
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
  var PRESETS = [
    { k: 'default', label: '기본',       emoji: '⚪', t: { g1: '#7c3aed', g2: '#6366f1', g3: '#06b6d4', radius: 16, shadow: 55, density: 'comfortable', disp: 'Space Grotesk', tone: 'default' } },
    { k: 'oxfam',   label: '옥스팜 그린', emoji: '🌿', t: { g1: '#2F9E44', g2: '#5CBC2E', g3: '#8AE05C', radius: 16, shadow: 50, density: 'comfortable', disp: 'Space Grotesk', tone: 'default' } },
    { k: 'event',   label: '행사·캠페인', emoji: '🎉', t: { g1: '#F2568A', g2: '#8b5cf6', g3: '#22d3ee', radius: 22, shadow: 80, density: 'spacious',    disp: 'Jua',           tone: 'default' } },
    { k: 'edu',     label: '교육',       emoji: '📘', t: { g1: '#3B82F6', g2: '#6366f1', g3: '#38BDF8', radius: 14, shadow: 40, density: 'comfortable', disp: 'Pretendard',    tone: 'slate' } },
    { k: 'recruit', label: '리쿠르팅',   emoji: '🧡', t: { g1: '#F2856A', g2: '#E6B052', g3: '#F2C94C', radius: 18, shadow: 60, density: 'comfortable', disp: 'Space Grotesk', tone: 'default' } },
    { k: 'calm',    label: '차분(집중)', emoji: '🌙', t: { g1: '#4C6EF5', g2: '#5C7CFA', g3: '#3BC9DB', radius: 12, shadow: 35, density: 'compact',     disp: 'Pretendard',    tone: 'darker' } }
  ];
  var draft = null, savedTeam = null, savedLocal = null, studioOpen = false, mode = 'design';

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
    try { var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      r = Math.min(255, Math.round(r + (255 - r) * pct / 100)); g = Math.min(255, Math.round(g + (255 - g) * pct / 100)); b = Math.min(255, Math.round(b + (255 - b) * pct / 100));
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    } catch (e) { return hex; }
  }
  function styleEl() { var el = document.getElementById('ps-theme-vars'); if (!el) { el = document.createElement('style'); el.id = 'ps-theme-vars'; document.head.appendChild(el); } return el; }
  function applyTheme(t) {
    t = clampTheme(t); draft = t;
    var tone = TONES[t.tone] || TONES['default'], sh = t.shadow / 100;
    var grad = 'linear-gradient(135deg,' + t.g1 + ',' + t.g2 + ',' + t.g3 + ')';
    var gradSoft = 'linear-gradient(135deg,' + lighten(t.g1, 12) + ',' + lighten(t.g2, 12) + ',' + lighten(t.g3, 12) + ')';
    styleEl().textContent =
      ':root{--ink:' + tone.ink + ';--surface:' + tone.surface + ';--card:' + tone.card + ';--card-2:' + tone.card2 + ';--line:' + tone.line + ';' +
      '--g1:' + t.g1 + ';--g2:' + t.g2 + ';--g3:' + t.g3 + ';--grad:' + grad + ';--grad-soft:' + gradSoft + ';' +
      '--radius:' + t.radius + 'px;--radius-lg:' + (t.radius + 6) + 'px;' +
      '--shadow:0 ' + (8 + Math.round(sh * 16)) + 'px ' + (20 + Math.round(sh * 26)) + 'px -12px rgba(0,0,0,' + (0.3 + sh * 0.4).toFixed(2) + ');' +
      '--disp:\'' + t.disp + '\',\'Pretendard\',sans-serif;}' +
      'body.ps-density-compact .sec{padding-top:0!important;margin-bottom:12px!important;line-height:1.5!important}' +
      'body.ps-density-spacious .sec{margin-bottom:34px!important;line-height:1.72!important}';
    document.body.classList.remove('ps-density-compact', 'ps-density-spacious');
    if (t.density !== 'comfortable') document.body.classList.add('ps-density-' + t.density);
  }
  function activeTheme() { return savedLocal || savedTeam || DEFAULTS; }
  function reloadAndApply() { applyTheme(activeTheme()); }
  function initTheme() {
    savedLocal = LS.get('ps_theme_local'); var cached = LS.get('ps_theme_team_cache'); if (cached) savedTeam = cached;
    reloadAndApply();
    if (hasDB()) { try { window.DB.on('config/theme', function (v) { savedTeam = v ? clampTheme(v) : null; if (savedTeam) LS.set('ps_theme_team_cache', savedTeam); else LS.del('ps_theme_team_cache'); reloadAndApply(); if (studioOpen && mode === 'design') renderPanel(); }); } catch (e) {} }
  }
  function saveTheme(scope) {
    var t = clampTheme(draft);
    if (scope === 'team') { if (hasDB()) { try { window.DB.set('config/theme', t); } catch (e) {} } LS.set('ps_theme_team_cache', t); LS.del('ps_theme_local'); savedTeam = t; savedLocal = null; toast('🎨 팀 전체에 디자인 적용됨'); }
    else { LS.set('ps_theme_local', t); savedLocal = t; toast('🎨 이 기기에만 디자인 적용됨'); }
    reloadAndApply();
  }

  /* ═══════════ 홈배치 (앱 정식 경로 사용, 네이티브 버튼과 무관) ═══════════ */
  var HA_DEFAULT = ['treeSecHome', 'coopSec', 'homeDashSec', 'todaySec', 'celebSec', 'praiseSec', 'attendSec', 'quickSec', 'gbSec', 'fxSec'];
  var HA_LABEL = {
    treeSecHome: '🌳 Presence 나무', coopSec: '🤝 협업', homeDashSec: '📊 홈 대시보드', todaySec: '📋 오늘',
    celebSec: '🎂 축하·기념일', praiseSec: '👏 칭찬', attendSec: '☀️ 출근현황', quickSec: '⚡ 퀵 링크',
    gbSec: '📖 방명록', fxSec: '✨ 이펙트(관리자)'
  };
  var haOrder = null, haSaved = null;

  function haContainer() { return document.querySelector('#m-home > .wrap'); }
  function haLiveSecs() { var c = haContainer(); if (!c) return []; return Array.prototype.filter.call(c.children, function (el) { return el.tagName === 'SECTION' && el.classList.contains('sec') && el.id; }).map(function (el) { return el.id; }); }
  function haCurrentOrder() {
    var live = haLiveSecs();
    if (live.length) { // 실제 DOM 순서 + 기본목록의 누락분 보강
      HA_DEFAULT.forEach(function (id) { if (live.indexOf(id) < 0 && document.getElementById(id)) live.push(id); });
      return live;
    }
    return HA_DEFAULT.filter(function (id) { return document.getElementById(id); });
  }
  function haApplyLive(order) { // 앱의 정식 적용 함수 우선, 없으면 자체 DOM 재배치
    try { if (typeof window.__applyHomeOrder === 'function') { window.__applyHomeOrder(order); return; } } catch (e) {}
    var c = haContainer(); if (!c) return; order.forEach(function (id) { var el = document.getElementById(id); if (el && el.parentNode === c) c.appendChild(el); });
  }
  function haPersist(order) {
    try { if (window.state) window.state.homeOrder = order && order.length ? order : null; } catch (e) {}
    if (hasDB()) { try { window.DB.set('homeOrder', order && order.length ? order : null); } catch (e) {} }
  }

  /* ═══════════ UI ═══════════ */
  function injectCss() {
    if (document.getElementById('ps-ui-css')) return;
    var s = document.createElement('style'); s.id = 'ps-ui-css';
    s.textContent = [
      '#ps-dock{position:fixed;top:14px;right:356px;z-index:9600;display:none;flex-direction:row;gap:8px;align-items:center}',
      '@media(max-width:1100px){#ps-dock{top:64px;right:12px}}',
      '#ps-dock .ps-fab{width:34px;height:34px;padding:0;justify-content:center;border-radius:50%;font-size:16px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13);box-shadow:none}',
      '#ps-dock .ps-fab:hover{background:rgba(255,255,255,.16)}',
      '@media(min-width:980px){#ps-dock{top:14px}}',
      '.ps-fab{display:inline-flex;align-items:center;gap:7px;border:none;cursor:pointer;color:#fff;font-weight:800;font-size:12.5px;padding:11px 15px;border-radius:999px;background:linear-gradient(135deg,#6a5cf0,#8b5cf6);box-shadow:0 8px 22px -8px rgba(90,70,220,.65);font-family:inherit}',
      '.ps-fab.alt{background:var(--grad,#6366f1);box-shadow:0 8px 22px -8px rgba(99,102,241,.6)}',
      '.ps-fab:active{transform:scale(.97)}',
      '#ps-ov{position:fixed;inset:0;z-index:99998;display:none;background:rgba(6,7,10,.55);backdrop-filter:blur(3px)}',
      '#ps-ov.on{display:block}',
      '#ps-panel{position:fixed;top:0;right:0;height:100%;width:min(440px,100%);background:var(--surface,#1B1E25);border-left:1px solid var(--line,#30353F);box-shadow:-24px 0 60px -20px rgba(0,0,0,.6);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s cubic-bezier(.4,0,.2,1);font-family:inherit}',
      '#ps-ov.on #ps-panel{transform:none}',
      '.ps-hd{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid var(--line,#30353F)}',
      '.ps-hd h3{font-family:var(--disp);font-size:16px;font-weight:800;color:var(--cream,#F2EFE8);margin:0}',
      '.ps-hd .sub{font-size:11px;color:var(--faint,#6B7280);font-weight:600}',
      '.ps-x{border:none;background:var(--card,#232730);color:var(--muted,#A2ABB9);width:32px;height:32px;border-radius:9px;cursor:pointer;font-size:16px}',
      '.ps-body{flex:1;overflow-y:auto;padding:16px 16px 28px}',
      '.ps-row{margin-bottom:18px}',
      '.ps-row>label{display:block;font-size:12.5px;color:var(--muted,#A2ABB9);font-weight:700;margin-bottom:8px}',
      '.ps-presets{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}',
      '.ps-preset{border:1px solid var(--line,#30353F);background:var(--card,#232730);color:var(--cream,#F2EFE8);font-size:12px;font-weight:700;padding:10px 6px;border-radius:11px;cursor:pointer;font-family:inherit;text-align:center;line-height:1.35}',
      '.ps-preset .e{display:block;font-size:17px;margin-bottom:3px}',
      '.ps-preset.on{border-color:transparent;background:var(--grad,#6366f1);color:#fff}',
      '.ps-seg{display:flex;gap:6px;flex-wrap:wrap}',
      '.ps-seg button{border:1px solid var(--line,#30353F);background:var(--card,#232730);color:var(--cream,#F2EFE8);font-size:12.5px;font-weight:600;padding:8px 11px;border-radius:9px;cursor:pointer;font-family:inherit}',
      '.ps-seg button.on{background:var(--grad,#6366f1);color:#fff;border-color:transparent}',
      '.ps-colors{display:flex;gap:10px}.ps-colors .c{flex:1;text-align:center}',
      '.ps-colors .c span{display:block;font-size:11px;color:var(--muted,#A2ABB9);margin-bottom:5px}',
      '.ps-colors input[type=color]{width:100%;height:40px;border:1px solid var(--line,#30353F);border-radius:10px;background:var(--card,#232730);cursor:pointer;padding:3px}',
      '.ps-range{display:flex;align-items:center;gap:12px}',
      '.ps-range input[type=range]{flex:1;accent-color:var(--g2,#6366f1)}',
      '.ps-range .v{font-family:var(--mono,monospace);font-size:12px;color:var(--cream,#F2EFE8);min-width:44px;text-align:right}',
      '.ps-hint{font-size:11.5px;color:var(--faint,#6B7280);margin-top:6px;line-height:1.5}',
      '.ps-wlist{list-style:none;margin:0;padding:0}',
      '.ps-wi{display:flex;align-items:center;gap:10px;background:var(--card,#232730);border:1px solid var(--line,#30353F);border-radius:11px;padding:11px 12px;margin-bottom:8px}',
      '.ps-wi.over{border-color:var(--g2,#6366f1)}.ps-wi.drag{opacity:.4}',
      '.ps-wi .nm{flex:1;font-size:14px;font-weight:600;color:var(--cream,#F2EFE8)}',
      '.ps-wi .idx{font-family:var(--mono,monospace);font-size:11px;color:var(--faint,#6B7280);min-width:20px}',
      '.ps-mv{display:flex;gap:5px}',
      '.ps-mv button{width:32px;height:32px;border:none;border-radius:8px;background:rgba(124,108,240,.16);color:#c9c2ff;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit}',
      '.ps-mv button:disabled{opacity:.28;cursor:default}',
      '.ps-grip{cursor:grab;color:var(--faint,#6B7280);font-size:16px;touch-action:none;user-select:none}',
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
      '<div id="ps-panel" role="dialog">' +
        '<div class="ps-hd"><div style="flex:1"><h3 id="ps-title">🎨 Design Studio</h3><span class="sub" id="ps-subtitle"></span></div><button class="ps-x" id="ps-close">✕</button></div>' +
        '<div class="ps-body" id="ps-body"></div>' +
        '<div class="ps-foot" id="ps-foot"></div>' +
        '<div class="ps-sheet" id="ps-sheet"><div class="in"><h4>어디에 적용할까요?</h4><p>같은 디자인을 팀 전체가 보게 할지, 이 기기에만 적용할지 선택하세요.</p>' +
          '<div style="display:flex;gap:9px"><button class="ps-btn pri" id="ps-save-team">팀 전체 적용</button><button class="ps-btn gho" id="ps-save-local">내 화면에만</button></div>' +
          '<button class="ps-btn gho" id="ps-save-cancel" style="width:100%;margin-top:9px">취소</button></div></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) closePanel(); });
    document.getElementById('ps-close').onclick = closePanel;
    var st = document.getElementById('ps-sheet');
    document.getElementById('ps-save-team').onclick = function () { saveTheme('team'); st.classList.remove('on'); };
    document.getElementById('ps-save-local').onclick = function () { saveTheme('local'); st.classList.remove('on'); };
    document.getElementById('ps-save-cancel').onclick = function () { st.classList.remove('on'); };
  }

  function seg(cur, opts) { return opts.map(function (o) { return '<button data-v="' + o[0] + '" class="' + (String(o[0]) === String(cur) ? 'on' : '') + '">' + o[1] + '</button>'; }).join(''); }
  function matchPreset(t) {
    for (var i = 0; i < PRESETS.length; i++) { var p = clampTheme(PRESETS[i].t), c = clampTheme(t); if (p.g1 === c.g1 && p.g2 === c.g2 && p.g3 === c.g3 && p.radius === c.radius && p.shadow === c.shadow && p.density === c.density && p.disp === c.disp && p.tone === c.tone) return PRESETS[i].k; }
    return null;
  }
  function bindSeg(id, cb) { var box = document.getElementById(id); if (!box) return; box.querySelectorAll('button').forEach(function (b) { b.onclick = function () { cb(b.dataset.v); }; }); }

  function renderPanel() {
    ensureOverlay();
    var title = document.getElementById('ps-title'), sub = document.getElementById('ps-subtitle');
    var body = document.getElementById('ps-body'), foot = document.getElementById('ps-foot');

    if (mode === 'arrange') {
      title.textContent = '🧩 홈 배치'; sub.textContent = '홈 카드 순서 — 드래그하거나 ▲▼';
      var rows = haOrder.map(function (id, i) {
        var el = document.getElementById(id); if (!el) return '';
        var label = HA_LABEL[id] || id;
        return '<li class="ps-wi" draggable="true" data-id="' + id + '"><span class="idx">' + (i + 1) + '</span>' +
          '<span class="grab ps-grip" aria-hidden="true">⠿</span><span class="nm">' + label + '</span>' +
          '<span class="ps-mv"><button class="up" ' + (i === 0 ? 'disabled' : '') + '>▲</button><button class="dn" ' + (i === haOrder.length - 1 ? 'disabled' : '') + '>▼</button></span></li>';
      }).join('');
      body.innerHTML = '<div class="ps-hint" style="margin-bottom:12px">순서를 바꾸면 화면에 바로 반영됩니다. 저장을 누르면 팀 전체에 적용돼요.</div><ul class="ps-wlist" id="ps-wlist">' + rows + '</ul>';
      var ul = document.getElementById('ps-wlist');
      ul.querySelectorAll('.up').forEach(function (b) { b.onclick = function () { haMove(b.closest('.ps-wi').dataset.id, -1); }; });
      ul.querySelectorAll('.dn').forEach(function (b) { b.onclick = function () { haMove(b.closest('.ps-wi').dataset.id, 1); }; });
      haBindDrag(ul);
      foot.innerHTML = '<button class="ps-btn gho" id="ps-ha-reset">기본순서</button><button class="ps-btn pri" id="ps-ha-save">저장</button>';
      foot.querySelector('#ps-ha-reset').onclick = function () { haOrder = HA_DEFAULT.filter(function (id) { return document.getElementById(id); }); haApplyLive(haOrder); renderPanel(); toast('기본 순서로 되돌림 (저장 전)'); };
      foot.querySelector('#ps-ha-save').onclick = function () { haApplyLive(haOrder); haPersist(haOrder); haSaved = haOrder.slice(); toast('✓ 홈 배치를 저장했어요 — 팀원 모두에게 반영돼요'); closePanel(true); };
      return;
    }

    // design
    title.textContent = '🎨 Design Studio'; sub.textContent = '색·라운드·폰트 — 코드 없이 수정';
    var t = clampTheme(draft || activeTheme()), curP = matchPreset(t);
    body.innerHTML =
      '<div class="ps-row"><label>분위기 프리셋 — 원클릭 전환</label><div class="ps-presets" id="ps-presets">' +
        PRESETS.map(function (p) { return '<button class="ps-preset ' + (curP === p.k ? 'on' : '') + '" data-k="' + p.k + '"><span class="e">' + p.emoji + '</span>' + p.label + '</button>'; }).join('') +
      '</div><div class="ps-hint">행사·교육·리쿠르팅 등 상황에 맞는 분위기를 한 번에.</div></div>' +
      '<div class="ps-row"><label>강조 색 · 그라디언트 3단계</label><div class="ps-colors">' +
        '<div class="c"><span>Primary</span><input type="color" id="ps-g1" value="' + t.g1 + '"></div>' +
        '<div class="c"><span>Middle</span><input type="color" id="ps-g2" value="' + t.g2 + '"></div>' +
        '<div class="c"><span>Accent</span><input type="color" id="ps-g3" value="' + t.g3 + '"></div></div></div>' +
      '<div class="ps-row"><label>배경 톤</label><div class="ps-seg" id="ps-tone">' + seg(t.tone, Object.keys(TONES).map(function (k) { return [k, TONE_LABEL[k]]; })) + '</div></div>' +
      '<div class="ps-row"><label>모서리 둥글기</label><div class="ps-range"><input type="range" id="ps-radius" min="4" max="28" value="' + t.radius + '"><span class="v" id="ps-radius-v">' + t.radius + 'px</span></div></div>' +
      '<div class="ps-row"><label>그림자 강도</label><div class="ps-range"><input type="range" id="ps-shadow" min="0" max="100" value="' + t.shadow + '"><span class="v" id="ps-shadow-v">' + t.shadow + '</span></div></div>' +
      '<div class="ps-row"><label>글자·간격 밀도</label><div class="ps-seg" id="ps-density">' + seg(t.density, [['compact', '촘촘히'], ['comfortable', '기본'], ['spacious', '여유롭게']]) + '</div></div>' +
      '<div class="ps-row"><label>제목 폰트</label><div class="ps-seg" id="ps-disp">' + seg(t.disp, FONTS.map(function (f) { return [f, FONT_LABEL[f]]; })) + '</div></div>';
    body.querySelectorAll('#ps-presets .ps-preset').forEach(function (b) { b.onclick = function () { var p = PRESETS.filter(function (x) { return x.k === b.dataset.k; })[0]; if (p) { draft = clampTheme(p.t); applyTheme(draft); renderPanel(); toast(p.emoji + ' ' + p.label + ' 미리보기 (저장 전)'); } }; });
    ['g1', 'g2', 'g3'].forEach(function (id) { body.querySelector('#ps-' + id).oninput = function (e) { draft[id] = e.target.value; applyTheme(draft); hiPreset(); }; });
    bindSeg('ps-tone', function (v) { draft.tone = v; applyTheme(draft); renderPanel(); });
    bindSeg('ps-density', function (v) { draft.density = v; applyTheme(draft); renderPanel(); });
    bindSeg('ps-disp', function (v) { draft.disp = v; applyTheme(draft); renderPanel(); });
    var rr = body.querySelector('#ps-radius'); rr.oninput = function (e) { draft.radius = +e.target.value; body.querySelector('#ps-radius-v').textContent = draft.radius + 'px'; applyTheme(draft); hiPreset(); };
    var sr = body.querySelector('#ps-shadow'); sr.oninput = function (e) { draft.shadow = +e.target.value; body.querySelector('#ps-shadow-v').textContent = draft.shadow; applyTheme(draft); hiPreset(); };
    foot.innerHTML = '<button class="ps-btn gho" id="ps-reset">기본값</button><button class="ps-btn pri" id="ps-save">저장</button>';
    foot.querySelector('#ps-reset').onclick = function () { draft = clampTheme(DEFAULTS); applyTheme(draft); renderPanel(); toast('기본 디자인으로 되돌림 (저장 전)'); };
    foot.querySelector('#ps-save').onclick = function () { document.getElementById('ps-sheet').classList.add('on'); };
  }
  function hiPreset() { var c = matchPreset(draft); document.querySelectorAll('#ps-presets .ps-preset').forEach(function (b) { b.classList.toggle('on', b.dataset.k === c); }); }

  function haMove(id, dir) {
    var i = haOrder.indexOf(id); if (i < 0) return; var j = i + dir; if (j < 0 || j >= haOrder.length) return;
    var tmp = haOrder[i]; haOrder[i] = haOrder[j]; haOrder[j] = tmp; haApplyLive(haOrder); renderPanel();
  }
  function haBindDrag(ul) {
    var dragId = null;
    ul.querySelectorAll('.ps-wi').forEach(function (li) {
      li.addEventListener('dragstart', function () { dragId = li.dataset.id; li.classList.add('drag'); });
      li.addEventListener('dragend', function () { li.classList.remove('drag'); ul.querySelectorAll('.ps-wi').forEach(function (x) { x.classList.remove('over'); }); });
      li.addEventListener('dragover', function (e) { e.preventDefault(); li.classList.add('over'); });
      li.addEventListener('dragleave', function () { li.classList.remove('over'); });
      li.addEventListener('drop', function (e) { e.preventDefault(); li.classList.remove('over'); var tgt = li.dataset.id; if (!dragId || dragId === tgt) return; haOrder.splice(haOrder.indexOf(dragId), 1); haOrder.splice(haOrder.indexOf(tgt), 0, dragId); haApplyLive(haOrder); renderPanel(); });
    });
  }

  function openStudio() { ensureOverlay(); injectCss(); mode = 'design'; draft = clampTheme(activeTheme()); studioOpen = true; renderPanel(); document.getElementById('ps-ov').classList.add('on'); }
  function openHomeArrange() {
    ensureOverlay(); injectCss(); mode = 'arrange'; studioOpen = true;
    haOrder = haCurrentOrder(); haSaved = haOrder.slice();
    renderPanel(); document.getElementById('ps-ov').classList.add('on');
  }
  function closePanel(saved) {
    studioOpen = false; document.getElementById('ps-ov').classList.remove('on');
    if (mode === 'design') reloadAndApply();
    else if (mode === 'arrange' && !saved && haSaved) { haApplyLive(haSaved); }  // 저장 안 하면 원복
  }

  function ensureLauncher() {
    if (document.getElementById('ps-dock')) return;
    var dock = document.createElement('div'); dock.id = 'ps-dock';
    var ha = document.createElement('button'); ha.className = 'ps-fab'; ha.innerHTML = '🧩'; ha.title = '홈배치'; ha.onclick = openHomeArrange;
    var de = document.createElement('button'); de.className = 'ps-fab alt'; de.innerHTML = '🎨'; de.title = '디자인'; de.onclick = openStudio;
    dock.appendChild(ha); dock.appendChild(de); document.body.appendChild(dock);
  }
  function syncLauncher() { var d = document.getElementById('ps-dock'); if (d) d.style.display = canManage() ? 'flex' : 'none'; }

  function start() {
    try { injectCss(); } catch (e) {}
    try { initTheme(); } catch (e) {}
    try { ensureLauncher(); } catch (e) {}
    window.openDesignStudio = openStudio; window.openHomeArrange = openHomeArrange;
    setInterval(function () { try { syncLauncher(); } catch (e) {} }, 1500);
    try { syncLauncher(); } catch (e) {}
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(start, 300);
  else window.addEventListener('DOMContentLoaded', function () { setTimeout(start, 300); });
})();

/* ============================================================================
 * Presence 개인 콜백싯 × 팀원 생명주기 브리지 v1
 * - 로그인 UID 기준 개인 링크만 노출
 * - 신입/승급/퇴사 상태를 Hub가 읽을 memberDirectory에 동기화
 * - 퇴사자는 활성 화면과 개인 링크에서 제거하고 최소 감사 로그만 보존
 * ==========================================================================*/
(function () {
  'use strict';
  if (window.__presenceMemberBridge) return;
  window.__presenceMemberBridge = true;

  var installed = false, subscribed = false;
  var knownCallbackGids = {
    '임재영': '1335812619',
    '천리안': '1537634904',
    '장하영': '73952701',
    '박상현': '888568669'
  };
  var callbackBook = '1S0aN-uLSiJl1CeLkgVz12tHWaL123i58tURgT1J63w4';

  function clean(v) { return String(v || '').replace(/\s/g, ''); }
  function safe(v) { return String(v == null ? '' : v).replace(/[&<>\"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function manager() { try { return !!me && (isOwnerAccount(me) || isFounder(me)); } catch (e) { return false; } }
  function live() { try { return !!LIVE && DB && typeof DB.set === 'function'; } catch (e) { return false; } }
  function currentUser() { try { return me || null; } catch (e) { return null; } }
  function users() { try { return Object.values(state.users || {}).filter(Boolean); } catch (e) { return []; } }
  function roleSection(role) { return /^(LR|TL|AOP|OP|O)$/.test(String(role || '')) ? 'LEADER' : 'IC'; }
  function active(u) { return !!u && u.status !== 'retired' && u.status !== 'rejected'; }
  function injectBridgeCss() {
    if (document.getElementById('pcb-css')) return;
    var style = document.createElement('style'); style.id = 'pcb-css';
    style.textContent = '.pcb-card,.pcb-admin{margin:0 0 18px;padding:20px;border:1px solid color-mix(in srgb,var(--g2,#6366f1) 28%,var(--line,#30353f));border-radius:16px;background:linear-gradient(145deg,color-mix(in srgb,var(--card,#232730) 92%,var(--g2,#6366f1)),var(--card,#232730));box-shadow:0 16px 38px -30px rgba(0,0,0,.8)}.pcb-top{display:flex;align-items:center;justify-content:space-between;gap:18px}.pcb-top span,.pcb-admin>div>span{display:block;color:var(--g3,#4fd1c5);font-size:9px;font-weight:900;letter-spacing:.18em}.pcb-top h3,.pcb-admin h3{margin:5px 0 4px;color:var(--cream,#f2efe8);font-size:17px}.pcb-top p,.pcb-admin p{margin:0;color:var(--muted,#a2abb9);font-size:11px;line-height:1.55}.pcb-top a,.pcb-top button,.pcb-form button{flex:0 0 auto;border:0;border-radius:10px;padding:10px 13px;background:var(--grad,#6366f1);color:#fff;font:inherit;font-size:11px;font-weight:900;text-decoration:none;cursor:pointer}.pcb-card iframe{width:100%;height:390px;margin-top:16px;border:0;border-radius:12px;background:#fff}.pcb-pending{display:flex;gap:8px;align-items:center;margin-top:14px;padding:12px 13px;border-radius:11px;background:rgba(255,255,255,.045);color:var(--muted,#a2abb9);font-size:10px}.pcb-pending b{color:var(--cream,#f2efe8);white-space:nowrap}.pcb-form{display:grid;grid-template-columns:180px 180px minmax(240px,1fr) auto;gap:8px;margin-top:14px}.pcb-form select,.pcb-form input{min-width:0;border:1px solid var(--line,#30353f);border-radius:10px;padding:10px;background:rgba(0,0,0,.16);color:var(--cream,#f2efe8);font:inherit;font-size:11px}.pcb-admin>small{display:block;margin-top:9px;color:var(--faint,#6b7280);font-size:9px}@media(max-width:800px){.pcb-top{align-items:flex-start;flex-direction:column}.pcb-top a,.pcb-top button{width:100%;text-align:center}.pcb-card iframe{height:310px}.pcb-form{grid-template-columns:1fr}.pcb-pending{align-items:flex-start;flex-direction:column}}';
    document.head.appendChild(style);
  }
  function linkValue(u) {
    if (!u) return '';
    var links = (typeof state !== 'undefined' && state.callbackLinks) || {};
    var raw = links[u.uid] || links[clean(u.name)] || links[u.name];
    if (raw && typeof raw === 'object') raw = raw.url;
    if (raw) return String(raw);
    var gid = knownCallbackGids[clean(u.name)];
    return gid ? 'https://docs.google.com/spreadsheets/d/' + callbackBook + '/edit#gid=' + gid : '';
  }
  function englishName(u) {
    var d = ((typeof state !== 'undefined' && state.memberDirectory) || {})[u && u.uid] || {};
    return String(d.englishName || (u && (u.englishName || u.enName)) || (u && u.id) || '').trim();
  }
  function payload(u, overrides) {
    return Object.assign({
      uid: u.uid,
      name: u.name || '',
      englishName: englishName(u),
      role: u.role || 'IC',
      hubSection: active(u) ? roleSection(u.role) : null,
      status: u.status || 'active',
      callbackUrl: active(u) ? linkValue(u) : null,
      updatedAt: new Date().toISOString(),
      source: 'presence-workbook'
    }, overrides || {});
  }
  function syncOne(u, overrides) {
    if (!u || !u.uid || !manager() || !live()) return;
    var next = payload(u, overrides);
    state.memberDirectory = state.memberDirectory || {};
    state.memberDirectory[u.uid] = next;
    DB.set('memberDirectory/' + u.uid, next);
  }
  function audit(type, u, before, after) {
    if (!manager() || !live() || !u) return;
    var id = Date.now() + '_' + String(u.uid || clean(u.name) || 'member');
    DB.set('memberLifecycleLog/' + id, {
      type: type, uid: u.uid || '', name: u.name || '', before: before || null,
      after: after || null, by: (currentUser() || {}).name || '관리자', at: new Date().toISOString()
    });
  }
  function syncAll() { if (manager()) users().forEach(function (u) { syncOne(u); }); }

  function callbackCardHtml(id, compact) {
    var u = currentUser(); if (!u || !active(u)) return '';
    var url = linkValue(u), label = safe(u.name || '내') + '님의 콜백싯';
    return '<section class="pcb-card" id="' + id + '"><div class="pcb-top"><div><span>PERSONAL CALLBACK</span><h3>📝 ' + label + '</h3><p>로그인한 본인의 콜백싯만 표시됩니다. 다른 팀원의 주소는 노출되지 않습니다.</p></div>' +
      (url ? '<a href="' + safe(url) + '" target="_blank" rel="noopener noreferrer">새 창에서 열기 ↗</a>' : '<button type="button" onclick="openPersonalCallback()">내 기록 열기</button>') + '</div>' +
      (url && !compact ? '<iframe title="' + label + '" loading="lazy" src="' + safe(url.replace(/\/edit(?:#.*)?$/, '/edit?rm=minimal')) + '"></iframe>' : '') +
      (!url ? '<div class="pcb-pending"><b>개인 링크 연결 대기</b><span>계정용 콜백싯 창은 준비되어 있습니다. 관리자가 주소를 연결하면 여기와 검색에 즉시 나타납니다.</span></div>' : '') + '</section>';
  }
  function injectCards() {
    var cb = document.getElementById('callbackBody');
    if (cb && !document.getElementById('pcb-callback')) cb.insertAdjacentHTML('afterbegin', callbackCardHtml('pcb-callback', false));
    var journal = document.getElementById('cbBody');
    if (journal && !document.getElementById('pcb-journal')) journal.insertAdjacentHTML('afterbegin', callbackCardHtml('pcb-journal', false));
  }
  window.openPersonalCallback = function () {
    var u = currentUser(), url = linkValue(u);
    try { if (typeof hsClose === 'function') hsClose(); } catch (e) {}
    if (url) { window.open(url, '_blank', 'noopener,noreferrer'); return; }
    try { if (typeof goTab === 'function') goTab(u && roleSection(u.role) === 'LEADER' ? 'cbjournal' : 'callback'); } catch (e) {}
    try { if (typeof toast === 'function') toast('개인 콜백싯 주소가 아직 연결되지 않았어요'); } catch (e) {}
  };

  function connectionAdminHtml() {
    if (!manager()) return '';
    var list = users().filter(active).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ko'); });
    return '<section class="pcb-admin" id="pcb-admin"><div><span>MEMBER CONNECTION</span><h3>개인 콜백싯 · 허브 영문명 연결</h3><p>팀원을 선택한 뒤 본인 전용 주소와 허브에 표시할 영문명을 저장하세요.</p></div><div class="pcb-form"><select id="pcb-user" onchange="pcbPick(this.value)"><option value="">팀원 선택</option>' + list.map(function (u) { return '<option value="' + safe(u.uid) + '">' + safe(u.name) + ' · ' + safe(u.role || 'IC') + '</option>'; }).join('') + '</select><input id="pcb-en" placeholder="영문명 (예: Lim Jae Young)"><input id="pcb-url" type="url" placeholder="개인 콜백싯 주소"><button onclick="pcbSave()">연결 저장</button></div><small>신입은 가입 승인 즉시 기본 IC로 생성되며, 주소가 없어도 개인 콜백 창은 먼저 만들어집니다.</small></section>';
  }
  function injectAdmin() {
    if (!manager() || document.getElementById('pcb-admin')) return;
    var host = document.getElementById('memberAdminBody') || document.querySelector('#m-admin .wrap') || document.querySelector('#m-admin .sec');
    if (host) host.insertAdjacentHTML('beforeend', connectionAdminHtml());
  }
  window.pcbPick = function (uid) {
    var u = users().filter(function (x) { return x.uid === uid; })[0];
    var en = document.getElementById('pcb-en'), url = document.getElementById('pcb-url');
    if (en) en.value = u ? englishName(u) : '';
    if (url) url.value = u ? linkValue(u) : '';
  };
  window.pcbSave = function () {
    if (!manager()) return;
    var uid = (document.getElementById('pcb-user') || {}).value;
    var u = users().filter(function (x) { return x.uid === uid; })[0];
    if (!u) { try { toast('팀원을 먼저 선택해 주세요'); } catch (e) {} return; }
    var url = String((document.getElementById('pcb-url') || {}).value || '').trim();
    var en = String((document.getElementById('pcb-en') || {}).value || '').trim();
    if (url && !/^https:\/\//i.test(url)) { try { toast('https:// 로 시작하는 주소를 입력해 주세요'); } catch (e) {} return; }
    state.callbackLinks = state.callbackLinks || {}; state.callbackLinks[uid] = url ? { url: url, updatedAt: new Date().toISOString() } : null;
    if (live()) DB.set('callbackLinks/' + uid, state.callbackLinks[uid]);
    state.memberDirectory = state.memberDirectory || {}; state.memberDirectory[uid] = Object.assign({}, state.memberDirectory[uid] || {}, { englishName: en });
    syncOne(u, { englishName: en, callbackUrl: url || null }); audit('connection_updated', u, null, { englishName: en, callbackUrl: url || null });
    try { toast(u.name + '님의 개인 연결을 저장했어요'); } catch (e) {}
    injectCards();
  };

  function wrap(name, after) {
    var fn = window[name]; if (typeof fn !== 'function' || fn.__pcbWrap) return;
    window[name] = function () { var args = arguments, before = after.before ? after.before.apply(this, args) : null; var result = fn.apply(this, args); after.call(this, args, before); return result; };
    window[name].__pcbWrap = true;
  }
  function install() {
    if (installed || typeof state === 'undefined') return false;
    installed = true;
    wrap('renderCallback', function () { setTimeout(injectCards, 0); });
    wrap('renderCbjournal', function () { setTimeout(injectCards, 0); });
    wrap('renderAdmin', function () { setTimeout(injectAdmin, 0); });
    wrap('hsRender', function () {
      var q = String((document.getElementById('hsInput') || {}).value || '').replace(/\s/g, '').toLowerCase();
      if (!/콜백|callback/.test(q)) return;
      var box = document.getElementById('hsRes'); if (!box || box.querySelector('[data-personal-callback]')) return;
      box.insertAdjacentHTML('afterbegin', '<div class="hs-item hl" data-personal-callback="1" onclick="openPersonalCallback()"><span class="he">🔗</span><span>내 콜백싯 사이트</span><span class="hg">개인 연결</span></div>');
    });
    wrap('approve', Object.assign(function (args, before) { var u = state.users && state.users[args[0]]; if (u && u.status === 'active') { syncOne(u); audit('member_activated', u, before, payload(u)); } }, { before: function (uid) { var u = state.users && state.users[uid]; return u ? payload(u) : null; } }));
    wrap('changeRole', Object.assign(function (args, before) { var u = state.users && state.users[args[0]]; if (u && before && before.role !== u.role) { syncOne(u); audit('role_changed', u, before, payload(u)); } }, { before: function (uid) { var u = state.users && state.users[uid]; return u ? payload(u) : null; } }));
    wrap('retireMember', Object.assign(function (args, before) { var u = users().filter(function (x) { return clean(x.name) === clean(args[0]); })[0]; if (!u || u.status !== 'retired') return; if (live()) DB.set('callbackLinks/' + u.uid, null); if (state.callbackLinks) delete state.callbackLinks[u.uid]; syncOne(u, { status: 'retired', hubSection: null, callbackUrl: null }); audit('member_retired', u, before, payload(u, { status: 'retired', hubSection: null, callbackUrl: null })); }, { before: function (name) { var u = users().filter(function (x) { return clean(x.name) === clean(name); })[0]; return u ? payload(u) : null; } }));
    wrap('rehireMember', Object.assign(function (args, before) { var u = users().filter(function (x) { return clean(x.name) === clean(args[0]); })[0]; if (u && u.status === 'active') { syncOne(u); audit('member_rehired', u, before, payload(u)); } }, { before: function (name) { var u = users().filter(function (x) { return clean(x.name) === clean(name); })[0]; return u ? payload(u) : null; } }));
    setTimeout(function () { injectCards(); injectAdmin(); syncAll(); }, 600);
    return true;
  }
  function subscribe() {
    if (subscribed || !live()) return; subscribed = true;
    try { DB.on('callbackLinks', function (v) { state.callbackLinks = v || {}; injectCards(); }); } catch (e) {}
    try { DB.on('memberDirectory', function (v) { state.memberDirectory = v || {}; injectAdmin(); }); } catch (e) {}
  }
  function start() { injectBridgeCss(); if (!install()) return; setTimeout(subscribe, 1200); setInterval(function () { subscribe(); injectCards(); injectAdmin(); }, 2500); }
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(start, 900);
  else window.addEventListener('DOMContentLoaded', function () { setTimeout(start, 900); });
})();


/* ============================================================================
 * Presence 비서실 × 워크북 · 면담 브리핑 v1
 * 상담 원본은 비서실, 워크북은 리더 범위의 읽기 전용 화면만 제공한다.
 * ==========================================================================*/
(function () {
  'use strict';
  if (window.__presenceCounselBriefing) return;
  window.__presenceCounselBriefing = true;
  var selectedName = '', subscribed = false;

  function clean(v) { return String(v || '').replace(/\s/g, ''); }
  function safe(v) { return String(v == null ? '' : v).replace(/[&<>\"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function dossierOf(name) {
    var target = clean(name), ds = (typeof state !== 'undefined' && state.dossier) || {};
    for (var k in ds) { var d = ds[k] || {}; if (clean(k) === target || clean(d.name) === target) return d; }
    return {};
  }
  function canRead() {
    try { return !!me && (isOwnerAccount(me) || isFounder(me)); } catch (e) { return false; }
  }
  function members() {
    if (!canRead() || typeof rosterMembers !== 'function') return [];
    return rosterMembers();
  }
  function notesOf(name) {
    var target = clean(name), users = (typeof state !== 'undefined' && state.users) || {}, u = Object.values(users).filter(function (x) { return x && clean(x.name) === target; })[0], uid = u && u.uid, out = [];
    var notes = (typeof state !== 'undefined' && state.assistantMemberNotes) || {};
    for (var groupName in notes) { var group = notes[groupName] || {}; for (var id in group) { var n = group[id] || {}; if ((uid && n.memberUid === uid) || clean(n.name || groupName) === target) out.push(Object.assign({ id: id }, n)); } }
    return out.sort(function (a, b) { return String(b.createdAt || b.t || '').localeCompare(String(a.createdAt || a.t || '')); });
  }
  function dateAgo(days) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - days); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function salesOf(name, start, end) {
    var total = 0, days = {}, sales = (typeof state !== 'undefined' && state.sales) || {};
    for (var k in sales) { var e = sales[k] || {}; if (e.date >= start && e.date <= end && clean(e.name) === clean(name) && !e.na && !e.rally) { total += Number(e.count || 0); if (Number(e.count || 0) > 0) days[e.date] = 1; } }
    return { total: total, days: Object.keys(days).length };
  }
  function incomeOf(name, start, end) {
    var total = 0, seen = false, weekly = (typeof state !== 'undefined' && state.incomeWk) || {};
    for (var week in weekly) if (week >= start && week <= end) { var people = weekly[week] || {}; for (var key in people) if (clean(key) === clean(name)) { var value = Number(people[key]); if (Number.isFinite(value)) { total += value; seen = true; } } }
    if (seen) return { value: total, label: '최근 30일', source: '주간 인컴 합계' };
    var monthly = (typeof state !== 'undefined' && state.salesMeta) || {}, months = Object.keys(monthly).filter(function (m) { return m <= end.slice(0, 7); }).sort().reverse();
    for (var i = 0; i < months.length; i++) { var month = months[i], rows = monthly[month] || {}; for (var n in rows) if (clean(n) === clean(name)) { var raw = (rows[n] || {}).income, v = Number(raw); if (raw !== '' && raw != null && Number.isFinite(v)) return { value: v, label: month.slice(5) + '월 기록', source: '월별 인컴' }; } }
    return { value: null, label: '기록 없음', source: '인컴 데이터' };
  }
  function callbacksOf(name, start, end) {
    var target = clean(name), users = (typeof state !== 'undefined' && state.users) || {}, u = Object.values(users).filter(function (x) { return x && clean(x.name) === target; })[0], uid = u && u.uid, list = [];
    var sheets = (typeof state !== 'undefined' && state.callbackSheets) || {};
    for (var ownerUid in sheets) { var days = sheets[ownerUid] || {}; for (var date in days) { var r = days[date] || {}, owner = clean((r.info || {}).name || (users[ownerUid] || {}).name); if (date >= start && date <= end && !r.deleted && ((uid && ownerUid === uid) || owner === target)) list.push({ date: date, record: r }); } }
    list.sort(function (a, b) { return b.date.localeCompare(a.date); });
    var counts = { contact: 0, stop: 0, presentation: 0, close: 0, rehash: 0 };
    list.forEach(function (x) { var logs = Array.isArray(x.record.logs) ? x.record.logs : Object.values(x.record.logs || {}); logs.forEach(function (l) { var type = l && String(l.type || '').toLowerCase(); if (Object.prototype.hasOwnProperty.call(counts, type)) counts[type]++; }); });
    return { records: list, counts: counts, latest: list[0] || null };
  }
  function fmtDate(v) { if (!v) return '날짜 없음'; var d = new Date(v); if (Number.isNaN(d.getTime())) return String(v); return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }); }
  function cell(label, value, full) { if (!value) return ''; return '<div class="cs-note-cell' + (full ? ' full' : '') + '"><b>' + safe(label) + '</b>' + safe(value) + '</div>'; }
  function noteHtml(n) {
    var tags = [n.sessionType, n.mood, n.planDate ? ('후속 ' + n.planDate) : ''].filter(Boolean).map(function (x) { return '<span class="cs-tag">' + safe(x) + '</span>'; }).join('');
    return '<article class="cs-note"><div class="cs-note-top"><div class="cs-note-topic">' + safe(n.topic || '상담 기록') + '</div><div class="cs-note-meta">' + fmtDate(n.createdAt || n.t) + '</div></div><div class="cs-note-tags">' + tags + '</div><div class="cs-note-grid">' + cell('현재 상황', n.situation, true) + cell('상담 목표', n.goal) + cell('강점', n.strength) + cell('관찰 위험', n.risk) + cell('전달한 피드백', n.feedback) + cell('합의한 행동', n.action, true) + cell('다음 확인', n.followUp, true) + '</div></article>';
  }
  function avatar(name, cls) { var inner = safe((name || '?').slice(0, 1)); try { inner = avInner(name); } catch (e) {} var color = '#5CBC2E'; try { color = avColor(name); } catch (e) {} return '<span class="' + cls + '" style="background:' + color + '">' + inner + '</span>'; }
  function money(v) { try { return won(v); } catch (e) { return Number(v || 0).toLocaleString('ko-KR'); } }

  function render() {
    var box = document.getElementById('counselBody'); if (!box || !canRead()) return;
    var list = members();
    if (!list.length) { box.innerHTML = '<div class="cs-empty">열람할 수 있는 팀원이 아직 연결되지 않았어요.<br>Team Tree에서 상위 리더와 팀을 먼저 연결해 주세요.</div>'; return; }
    if (!list.some(function (u) { return u.name === selectedName; })) selectedName = (list.filter(function (u) { return u.name !== me.name; })[0] || list[0]).name;
    var name = selectedName, start = dateAgo(29), end = dateAgo(0), sales = salesOf(name, start, end), income = incomeOf(name, start, end), callbacks = callbacksOf(name, start, end), notes = notesOf(name), latest = callbacks.latest && callbacks.latest.record, site = latest && latest.info && latest.info.site;
    var previous = salesOf(name, dateAgo(59), dateAgo(30)), delta = sales.total - previous.total, trend = delta === 0 ? '이전 30일과 동일' : (delta > 0 ? '이전보다 +' + delta : '이전보다 ' + delta);
    var people = list.map(function (u) { var count = notesOf(u.name).length, role = (typeof ROLE_LABEL !== 'undefined' && ROLE_LABEL[u.role]) || u.role || 'IC'; return '<button class="cs-person' + (u.name === name ? ' on' : '') + '" data-name="' + safe(u.name) + '">' + avatar(u.name, 'av') + '<span class="nm">' + safe(u.name) + '<small>' + safe(role) + '</small></span><span class="cs-note-dot">' + count + '</span></button>'; }).join('');
    var noteList = notes.length ? notes.slice(0, 12).map(noteHtml).join('') : '<div class="cs-empty">아직 비서실에 저장된 상담 기록이 없어요.<br>상담 전 브리핑을 확인한 뒤 비서실에서 첫 기록을 남겨 주세요.</div>';
    box.innerHTML = '<div class="cs-shell"><aside class="cs-side"><div class="cs-side-h"><span>팀원</span><small>' + list.length + '명 · 관리자 전체 열람</small></div><input class="cs-search" placeholder="이름 검색" aria-label="팀원 이름 검색"><div class="cs-people" id="counselPeople">' + people + '</div></aside><div class="cs-main"><div class="cs-head"><div class="cs-title">' + avatar(name, 'av') + '<div><h3>' + safe(name) + ' · 면담 브리핑</h3><p>' + start + ' ~ ' + end + ' · Firebase 실시간 연결</p></div></div><a class="cs-open" href="https://presence-ai-assistant.jaeyoung5178.chatgpt.site/members" target="_blank" rel="noopener noreferrer">🔐 비서실에서 작성·수정</a></div><div class="cs-kpis"><div class="cs-kpi"><div class="l">최근 30일 세일즈</div><div class="v">' + sales.total + '건</div><div class="s">' + trend + '</div></div><div class="cs-kpi"><div class="l">필드 활동일</div><div class="v">' + sales.days + '일</div><div class="s">활동일 평균 ' + (sales.days ? (sales.total / sales.days).toFixed(2) : '0.00') + '</div></div><div class="cs-kpi"><div class="l">' + income.label + ' 인컴</div><div class="v">' + (income.value == null ? '—' : '₩' + money(income.value)) + '</div><div class="s">' + income.source + '</div></div><div class="cs-kpi"><div class="l">콜백싯 기록</div><div class="v">' + callbacks.records.length + '일</div><div class="s">' + (site ? '최근 ' + safe(site) : '최근 사이트 없음') + '</div></div></div><div class="cs-flow"><div class="cs-flow-h"><span>콜백싯 활동 흐름</span><small>최근 30일 실제 기록</small></div><div class="cs-steps"><div class="cs-step"><b>' + callbacks.counts.contact + '</b><span>CONTACT</span></div><div class="cs-step"><b>' + callbacks.counts.stop + '</b><span>STOP</span></div><div class="cs-step"><b>' + callbacks.counts.presentation + '</b><span>PRESENT</span></div><div class="cs-step"><b>' + callbacks.counts.close + '</b><span>CLOSE</span></div><div class="cs-step"><b>' + callbacks.counts.rehash + '</b><span>REHASH</span></div></div></div><div class="cs-section-h"><span>최근 상담 기록</span><small>' + notes.length + '건 · 최신순 · 읽기 전용</small></div><div class="cs-notes">' + noteList + '</div></div></div>';
    box.querySelectorAll('.cs-person').forEach(function (b) { b.onclick = function () { selectedName = b.dataset.name; render(); }; });
    var search = box.querySelector('.cs-search'); if (search) search.oninput = function () { var q = clean(search.value).toLowerCase(); box.querySelectorAll('.cs-person').forEach(function (b) { b.style.display = !q || clean(b.dataset.name).toLowerCase().indexOf(q) >= 0 ? '' : 'none'; }); };
  }

  function injectCss() {
    if (document.getElementById('cs-briefing-css')) return;
    var s = document.createElement('style'); s.id = 'cs-briefing-css'; s.textContent = [
      '.cs-shell{display:grid;grid-template-columns:minmax(210px,280px) 1fr;gap:18px;align-items:start}',
      '.cs-privacy{display:flex;gap:11px;align-items:flex-start;padding:13px 15px;margin:0 0 16px;border:1px solid rgba(92,188,46,.25);background:rgba(92,188,46,.08);border-radius:14px;color:var(--cream);font-size:12.5px;line-height:1.65}.cs-privacy b{color:var(--green-soft)}',
      '.cs-side,.cs-main{border:1px solid var(--line);background:rgba(255,255,255,.025);border-radius:16px;padding:14px}.cs-side-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;color:var(--cream);font-size:13px;font-weight:800}.cs-side-h small{font-size:10.5px;color:var(--faint);font-weight:650}',
      '.cs-search{width:100%;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--cream);padding:10px 11px;margin-bottom:9px;font:inherit;font-size:12.5px;outline:none}.cs-search:focus{border-color:rgba(92,188,46,.65)}',
      '.cs-people{display:flex;flex-direction:column;gap:6px;max-height:620px;overflow:auto}.cs-person{width:100%;display:flex;align-items:center;gap:10px;border:1px solid transparent;background:transparent;color:var(--cream);border-radius:11px;padding:9px 10px;text-align:left;cursor:pointer}.cs-person:hover{background:rgba(255,255,255,.04)}.cs-person.on{border-color:rgba(92,188,46,.34);background:rgba(92,188,46,.11)}',
      '.cs-person .av{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:12px;font-weight:900;overflow:hidden;flex:none}.cs-person .av img,.cs-title .av img{width:100%;height:100%;object-fit:cover}.cs-person .nm{min-width:0;flex:1;font-size:12.5px;font-weight:800}.cs-person .nm small{display:block;color:var(--faint);font-size:10.5px;margin-top:2px;font-weight:650}.cs-note-dot{min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:rgba(92,188,46,.16);color:var(--green-soft);font-size:10px;display:grid;place-items:center;font-weight:850}',
      '.cs-head{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-bottom:14px}.cs-title{display:flex;align-items:center;gap:10px;min-width:0}.cs-title .av{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;color:#fff;font-size:17px;font-weight:900;overflow:hidden;flex:none}.cs-title h3{font-size:17px;color:var(--cream);margin:0}.cs-title p{font-size:11.5px;color:var(--muted);margin:3px 0 0}.cs-open{border:0;border-radius:11px;background:var(--green);color:#10220b;padding:10px 13px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap;text-decoration:none}',
      '.cs-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:14px}.cs-kpi{border:1px solid var(--line);background:var(--card);border-radius:13px;padding:12px;min-height:82px}.cs-kpi .l{color:var(--faint);font-size:10.5px;font-weight:750}.cs-kpi .v{color:var(--cream);font-size:20px;font-weight:900;margin-top:7px;letter-spacing:-.5px}.cs-kpi .s{color:var(--muted);font-size:10px;margin-top:3px}',
      '.cs-flow{border:1px solid var(--line);background:var(--card);border-radius:13px;padding:13px;margin-bottom:14px}.cs-flow-h{display:flex;justify-content:space-between;gap:8px;color:var(--cream);font-size:12.5px;font-weight:850;margin-bottom:10px}.cs-flow-h small{color:var(--faint);font-size:10.5px;font-weight:650}.cs-steps{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.cs-step{background:rgba(255,255,255,.035);border-radius:9px;padding:9px 5px;text-align:center}.cs-step b{display:block;color:var(--cream);font-size:15px}.cs-step span{display:block;color:var(--faint);font-size:9.5px;margin-top:3px}',
      '.cs-section-h{display:flex;align-items:center;justify-content:space-between;margin:3px 0 9px;color:var(--cream);font-size:13px;font-weight:900}.cs-section-h small{font-size:10.5px;color:var(--faint);font-weight:650}.cs-notes{display:flex;flex-direction:column;gap:9px}.cs-note{border:1px solid var(--line);background:var(--card);border-radius:13px;padding:13px}.cs-note-top{display:flex;align-items:flex-start;justify-content:space-between;gap:9px}.cs-note-topic{color:var(--cream);font-size:13px;font-weight:900}.cs-note-meta{color:var(--faint);font-size:10.5px;white-space:nowrap}.cs-note-tags{display:flex;flex-wrap:wrap;gap:5px;margin:7px 0}.cs-tag{border:1px solid rgba(92,188,46,.25);background:rgba(92,188,46,.08);color:var(--green-soft);border-radius:999px;padding:3px 7px;font-size:9.5px;font-weight:750}.cs-note-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.cs-note-cell{background:rgba(255,255,255,.025);border-radius:9px;padding:9px;color:var(--muted);font-size:11.5px;line-height:1.55}.cs-note-cell b{display:block;color:var(--faint);font-size:9.5px;margin-bottom:3px}.cs-note-cell.full{grid-column:1/-1}.cs-empty{padding:32px 16px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:13px;font-size:12.5px;line-height:1.7}',
      '@media(max-width:760px){.cs-shell{grid-template-columns:1fr}.cs-people{max-height:220px}.cs-kpis{grid-template-columns:1fr 1fr}.cs-note-grid{grid-template-columns:1fr}.cs-note-cell.full{grid-column:auto}.cs-head{align-items:flex-start;flex-direction:column}.cs-open{width:100%;text-align:center}}'
    ].join(''); document.head.appendChild(s);
  }
  function injectPanel() {
    if (document.getElementById('m-counsel')) return;
    var panel = document.createElement('div'); panel.className = 'mpanel'; panel.id = 'm-counsel';
    panel.innerHTML = '<div class="wrap"><section class="sec"><div class="sec-head"><h2>🫶 면담 기록</h2><span class="ko">상담 전 한눈에 보는 팀원 브리핑</span><span class="meta">관리자 전용 · 읽기 전용</span></div><div class="cs-privacy"><span>🔐</span><div><b>상담 기록은 관리자 계정에서만 열람할 수 있습니다.</b><br>워크북에서는 최근 성과와 상담 내용을 읽기만 할 수 있으며 작성·수정·후속 조치는 비밀번호가 필요한 Presence 비서실에서 진행합니다.</div></div><div id="counselBody"></div></section></div>';
    var meeting = document.getElementById('m-meeting'), main = document.querySelector('#app main'); if (meeting && meeting.parentNode) meeting.parentNode.insertBefore(panel, meeting); else if (main) main.appendChild(panel);
  }
  function addNavigation() {
    try {
      var lead = NAV.filter(function (g) { return g.k === 'lead'; })[0]; if (lead && lead.tabs.indexOf('counsel') < 0) lead.tabs.splice(Math.max(0, lead.tabs.indexOf('cbjournal')), 0, 'counsel');
      TABMETA.counsel = { e: '🫶', l: '면담 기록', g: function () { return canRead(); } };
      window.__counselNavReady = !!(lead && TABMETA.counsel);
    } catch (e) { window.__counselLastError = 'navigation: ' + String(e && e.message || e); }
  }
  function wrapGoTab() {
    if (typeof window.goTab !== 'function' || window.goTab.__counselWrap) return;
    var original = window.goTab; window.goTab = function () { var r = original.apply(this, arguments); try { if (typeof curTab !== 'undefined' && curTab === 'counsel') render(); } catch (e) {} return r; }; window.goTab.__counselWrap = true;
  }
  function subscribe() {
    if (subscribed) return;
    try {
      if (typeof DB === 'undefined' || typeof DB.on !== 'function' || String(DB.on).replace(/\s/g, '') === 'on(){}') return;
      state.callbackSheets = state.callbackSheets || {}; state.assistantMemberNotes = state.assistantMemberNotes || {};
      DB.on('callbacksheets', function (v) { state.callbackSheets = v || {}; if (typeof curTab !== 'undefined' && curTab === 'counsel') render(); });
      DB.on('assistantMemberNotes', function (v) { state.assistantMemberNotes = v || {}; if (typeof curTab !== 'undefined' && curTab === 'counsel') render(); });
      subscribed = true;
    } catch (e) {}
  }
  function install() {
    try { if (typeof NAV === 'undefined' || typeof TABMETA === 'undefined' || typeof state === 'undefined') return false; injectCss(); injectPanel(); window.renderCounsel = render; addNavigation(); wrapGoTab(); subscribe(); try { if (typeof buildRail === 'function' && typeof me !== 'undefined' && me) buildRail(); } catch (railError) { window.__counselLastError = 'rail: ' + String(railError && railError.message || railError); } return true; } catch (e) { window.__counselLastError = 'install: ' + String(e && e.message || e); return false; }
  }
  var attempts = 0, timer = setInterval(function () { attempts++; var ready = install(); subscribe(); if (ready && subscribed && attempts > 3) clearInterval(timer); if (attempts > 40) clearInterval(timer); }, 300);
})();
