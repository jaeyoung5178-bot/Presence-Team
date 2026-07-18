/*
 * Presence approved avatar atelier
 *
 * The approved 16:9 artwork is the single visual foundation for the avatar
 * wardrobe. This layer intentionally lives outside #m-petshop so legacy
 * renderers cannot repaint or partially delete it.
 */
(function () {
  'use strict';

  var INSTALL_KEY = '__presenceApprovedAtelierInstalled';
  var REFRESH_KEY = '__presenceApprovedAtelierRefresh';
  var OVERLAY_ID = 'presenceAvatarAtelierWorld';
  var STYLE_ID = 'presenceApprovedAtelierStyles';
  var STORAGE_KEY = 'presenceApprovedAtelierState:v1';
  var FOUNDATION = 'assets/farm-world/approved/avatar-atelier-approved.png';

  if (window[INSTALL_KEY]) {
    if (typeof window[REFRESH_KEY] === 'function') window[REFRESH_KEY]();
    return;
  }
  window[INSTALL_KEY] = true;

  var dismissedForCycle = false;
  var lastPanelWasOpen = false;
  var refreshQueued = false;
  var lastFocus = null;

  /* Coordinates are percentages of the approved 1672 x 941 master. */
  var ITEMS = [
    { id: 'body_raincoat_0', slot: 'body', label: '크림 아틀리에 재킷', x: 13.35, y: 28.66, w: 6.93, h: 11.16 },
    { id: 'body_leader_0', slot: 'body', label: '올리브 필드 재킷', x: 20.45, y: 28.66, w: 6.93, h: 11.16 },
    { id: 'body_swimsuit_0', slot: 'body', label: '네이비 스카프 재킷', x: 27.55, y: 28.66, w: 6.93, h: 11.16 },
    { id: 'body_floral_0', slot: 'body', label: '브라운 헤리티지 재킷', x: 34.72, y: 28.66, w: 6.93, h: 11.16 },
    { id: 'head_straw_0', slot: 'head', label: '라피아 필드 햇', x: 13.35, y: 64.08, w: 6.93, h: 11.05 },
    { id: 'head_shades_0', slot: 'head', label: '네이비 아틀리에 베레', x: 20.45, y: 64.08, w: 6.93, h: 11.05 },
    { id: 'head_wig_0', slot: 'head', label: '브라운 클래식 캡', x: 27.55, y: 64.08, w: 6.93, h: 11.05 }
  ];

  function safeParse(value, fallback) {
    try { return JSON.parse(value); } catch (e) { return fallback; }
  }

  function readState() {
    var value = null;
    try { value = safeParse(localStorage.getItem(STORAGE_KEY), null); } catch (e) {}
    return value && typeof value === 'object' ? value : {};
  }

  function writeState(next) {
    var state = Object.assign({}, readState(), next || {}, { updatedAt: new Date().toISOString() });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    return state;
  }

  function currentProfile() {
    try {
      if (typeof window.presenceAvatarProfile === 'function') return window.presenceAvatarProfile() || null;
    } catch (e) {}
    return null;
  }

  function currentEquipped(item) {
    var profile = currentProfile();
    var equipped = profile && profile.equipped;
    return !!(equipped && equipped[item.slot] === item.id);
  }

  function invokeEquip(item) {
    if (!item || currentEquipped(item)) return { ok: true, source: 'already-equipped' };
    try {
      if (typeof window.equipPetItem === 'function') {
        window.equipPetItem(item.id);
        return { ok: true, source: 'equipPetItem' };
      }
      if (typeof window.petShopAction === 'function') {
        window.petShopAction(item.id);
        return { ok: true, source: 'petShopAction' };
      }
      if (typeof window.setPetAppearance === 'function') {
        window.setPetAppearance(item.id, item.slot);
        return { ok: true, source: 'setPetAppearance' };
      }
    } catch (e) {
      return { ok: false, source: 'api-error', error: e };
    }
    return { ok: false, source: 'local-storage' };
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      'body.presence-atelier-open{overflow:hidden!important;}',
      'body.presence-atelier-open #m-petshop,body.presence-atelier-open #m-avatar{visibility:hidden!important;}',
      '#'+OVERLAY_ID+'{position:fixed;inset:0;z-index:2147483000;display:grid;grid-template-rows:auto minmax(0,1fr);background:radial-gradient(circle at 50% 18%,#243142 0,#0b1724 54%,#050c14 100%);color:#f4ead8;font-family:SUIT,Pretendard,"Noto Sans KR",system-ui,sans-serif;overscroll-behavior:contain;}',
      '#'+OVERLAY_ID+'[hidden]{display:none!important;}',
      '#'+OVERLAY_ID+' *{box-sizing:border-box;}',
      '#'+OVERLAY_ID+' .paa-toolbar{position:relative;z-index:4;min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:9px clamp(12px,2vw,30px);border-bottom:1px solid rgba(213,175,105,.32);background:rgba(5,14,23,.96);box-shadow:0 10px 30px rgba(0,0,0,.28);}',
      '#'+OVERLAY_ID+' .paa-brand{display:flex;align-items:center;gap:11px;min-width:0;}',
      '#'+OVERLAY_ID+' .paa-brand-mark{width:34px;height:34px;display:grid;place-items:center;border:1px solid rgba(217,181,113,.6);border-radius:50%;background:#182738;font-size:18px;box-shadow:inset 0 0 0 3px rgba(217,181,113,.08);}',
      '#'+OVERLAY_ID+' .paa-brand-copy{min-width:0;}',
      '#'+OVERLAY_ID+' .paa-brand-copy b{display:block;font-family:"Noto Serif KR",serif;font-size:15px;line-height:1.25;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#'+OVERLAY_ID+' .paa-brand-copy small{display:block;margin-top:2px;color:#b6aa94;font-size:11px;}',
      '#'+OVERLAY_ID+' .paa-toolbar-actions{display:flex;align-items:center;gap:9px;}',
      '#'+OVERLAY_ID+' .paa-status{max-width:min(42vw,520px);font-size:12px;color:#dfc990;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#'+OVERLAY_ID+' button{font:inherit;}',
      '#'+OVERLAY_ID+' .paa-close,#'+OVERLAY_ID+' .paa-mobile-button{min-width:44px;min-height:44px;border:1px solid rgba(222,190,128,.38);border-radius:13px;background:#132234;color:#f6ead5;cursor:pointer;transition:transform .18s ease,background .18s ease,border-color .18s ease;}',
      '#'+OVERLAY_ID+' .paa-close{padding:0 15px;font-weight:850;}',
      '#'+OVERLAY_ID+' .paa-close:hover,#'+OVERLAY_ID+' .paa-close:focus-visible,#'+OVERLAY_ID+' .paa-mobile-button:hover,#'+OVERLAY_ID+' .paa-mobile-button:focus-visible{outline:none;border-color:#e6c980;background:#24364a;transform:translateY(-1px);}',
      '#'+OVERLAY_ID+' .paa-viewport{position:relative;min-height:0;display:grid;place-items:center;overflow:auto;padding:10px;scrollbar-color:#ae8d52 #0b1724;scrollbar-width:thin;}',
      '#'+OVERLAY_ID+' .paa-canvas{position:relative;flex:none;width:min(100%,calc((100dvh - 78px)*1.776833),1672px);aspect-ratio:1672/941;border:1px solid rgba(223,190,125,.4);border-radius:clamp(10px,1.1vw,20px);overflow:hidden;background:#081522;box-shadow:0 24px 70px rgba(0,0,0,.52),0 0 0 1px rgba(255,230,175,.06);isolation:isolate;}',
      '#'+OVERLAY_ID+' .paa-foundation{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:fill;user-select:none;-webkit-user-drag:none;}',
      '#'+OVERLAY_ID+' .paa-hotspot{position:absolute;z-index:2;left:calc(var(--x)*1%);top:calc(var(--y)*1%);width:calc(var(--w)*1%);height:calc(var(--h)*1%);min-width:44px;min-height:44px;border:2px solid transparent;border-radius:8px;background:transparent;color:transparent;cursor:pointer;transition:border-color .16s ease,box-shadow .16s ease,background .16s ease,transform .16s ease;}',
      '#'+OVERLAY_ID+' .paa-hotspot:hover,#'+OVERLAY_ID+' .paa-hotspot:focus-visible{outline:none;border-color:#ead18f;background:rgba(233,205,132,.09);box-shadow:0 0 0 3px rgba(7,16,25,.58),0 0 20px rgba(231,196,110,.62);transform:translateY(-1px);}',
      '#'+OVERLAY_ID+' .paa-hotspot[aria-pressed="true"]{border-color:#a5bd73;background:rgba(112,135,69,.16);box-shadow:0 0 0 3px rgba(7,16,25,.62),0 0 22px rgba(149,177,91,.72);}',
      '#'+OVERLAY_ID+' .paa-hotspot[aria-pressed="true"]:after{content:"✓";position:absolute;right:4px;top:4px;width:22px;height:22px;display:grid;place-items:center;border-radius:50%;background:#687b42;color:#fff;font:900 13px/1 system-ui;box-shadow:0 2px 8px rgba(0,0,0,.42);}',
      '#'+OVERLAY_ID+' .paa-hotspot:before{content:attr(aria-label);position:absolute;left:50%;bottom:calc(100% + 7px);max-width:170px;padding:7px 9px;border:1px solid rgba(224,192,129,.35);border-radius:8px;background:rgba(5,13,22,.95);color:#f4ead8;font-size:11px;line-height:1.25;white-space:nowrap;transform:translate(-50%,5px);opacity:0;pointer-events:none;transition:.16s ease;}',
      '#'+OVERLAY_ID+' .paa-hotspot:hover:before,#'+OVERLAY_ID+' .paa-hotspot:focus-visible:before{opacity:1;transform:translate(-50%,0);}',
      '#'+OVERLAY_ID+' .paa-apply-hotspot{position:absolute;z-index:3;left:81.55%;top:84.35%;width:16.15%;height:10.5%;min-width:84px;min-height:48px;border:2px solid transparent;border-radius:14px;background:transparent;color:transparent;cursor:pointer;}',
      '#'+OVERLAY_ID+' .paa-apply-hotspot:hover,#'+OVERLAY_ID+' .paa-apply-hotspot:focus-visible{outline:none;border-color:#f2d99e;box-shadow:0 0 0 4px rgba(8,18,28,.65),0 0 30px rgba(220,190,111,.58);}',
      '#'+OVERLAY_ID+' .paa-pan-hint,#'+OVERLAY_ID+' .paa-mobile-actions{display:none;}',
      '@media (max-width:1100px){',
      '  #'+OVERLAY_ID+'{grid-template-rows:auto auto minmax(0,1fr) auto;}',
      '  #'+OVERLAY_ID+' .paa-toolbar{min-height:54px;padding:7px 12px;}',
      '  #'+OVERLAY_ID+' .paa-brand-copy small,#'+OVERLAY_ID+' .paa-status{display:none;}',
      '  #'+OVERLAY_ID+' .paa-pan-hint{display:block;padding:7px 14px;border-bottom:1px solid rgba(213,175,105,.18);background:#0d1927;color:#cbbb9d;font-size:11px;text-align:center;}',
      '  #'+OVERLAY_ID+' .paa-viewport{display:block;padding:8px 8px 14px;scroll-snap-type:x proximity;}',
      '  #'+OVERLAY_ID+' .paa-canvas{width:1000px;max-width:none;min-width:1000px;border-radius:13px;scroll-snap-align:start;}',
      '  #'+OVERLAY_ID+' .paa-mobile-actions{position:relative;z-index:4;display:grid;grid-template-columns:1fr 1.35fr;gap:9px;padding:9px 12px calc(9px + env(safe-area-inset-bottom));border-top:1px solid rgba(213,175,105,.26);background:rgba(5,14,23,.97);}',
      '  #'+OVERLAY_ID+' .paa-mobile-button{font-weight:900;}',
      '  #'+OVERLAY_ID+' .paa-mobile-apply{background:#6d7b43;border-color:#d5c17a;color:#fff7e2;}',
      '}',
      '@media (max-width:600px){',
      '  #'+OVERLAY_ID+' .paa-brand-copy b{font-size:13px;}',
      '  #'+OVERLAY_ID+' .paa-brand-mark{width:32px;height:32px;}',
      '  #'+OVERLAY_ID+' .paa-close{padding:0 12px;font-size:13px;}',
      '  #'+OVERLAY_ID+' .paa-canvas{width:900px;min-width:900px;}',
      '  #'+OVERLAY_ID+' .paa-viewport{padding-left:6px;padding-right:6px;}',
      '}',
      '@media (prefers-reduced-motion:reduce){#'+OVERLAY_ID+' *,#'+OVERLAY_ID+' *:before,#'+OVERLAY_ID+' *:after{scroll-behavior:auto!important;transition:none!important;}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function itemButton(item, selectedId) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'paa-hotspot';
    button.dataset.itemId = item.id;
    button.setAttribute('aria-label', item.label + ' 선택');
    button.setAttribute('aria-pressed', item.id === selectedId ? 'true' : 'false');
    button.style.setProperty('--x', item.x);
    button.style.setProperty('--y', item.y);
    button.style.setProperty('--w', item.w);
    button.style.setProperty('--h', item.h);
    button.addEventListener('click', function () { selectItem(item, button); });
    return button;
  }

  function ensureOverlay() {
    var existing = document.getElementById(OVERLAY_ID);
    if (existing) return existing;
    injectStyles();
    var saved = readState();
    var overlay = document.createElement('section');
    overlay.id = OVERLAY_ID;
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '프레젠스 동물농장 나의 아틀리에');
    overlay.innerHTML = ''+
      '<header class="paa-toolbar">'+
        '<div class="paa-brand"><span class="paa-brand-mark" aria-hidden="true">P</span><span class="paa-brand-copy"><b>프레젠스 동물농장 · 나의 아틀리에</b><small>승인된 모습으로 안전하게 꾸며보세요</small></span></div>'+
        '<div class="paa-toolbar-actions"><span class="paa-status" id="paaAtelierStatus" role="status" aria-live="polite">아이템을 선택해 주세요.</span><button type="button" class="paa-close" data-paa-close>닫기</button></div>'+
      '</header>'+
      '<div class="paa-pan-hint">화면을 좌우로 밀어 아틀리에를 둘러보세요 · 아래 버튼으로 언제든 적용할 수 있어요.</div>'+
      '<div class="paa-viewport" id="paaAtelierViewport">'+
        '<div class="paa-canvas" id="paaAtelierCanvas">'+
          '<img class="paa-foundation" src="'+FOUNDATION+'" alt="프레젠스 동물농장 나의 아틀리에. 왼쪽에는 의상과 장신구, 가운데에는 병아리, 오른쪽에는 앞면·옆면·뒷면 미리보기가 있습니다." draggable="false">'+
          '<button type="button" class="paa-apply-hotspot" data-paa-apply aria-label="선택한 코디 적용하기">적용하기</button>'+
        '</div>'+
      '</div>'+
      '<footer class="paa-mobile-actions"><button type="button" class="paa-mobile-button" data-paa-close>닫기</button><button type="button" class="paa-mobile-button paa-mobile-apply" data-paa-apply>선택한 코디 적용하기</button></footer>';
    var canvas = overlay.querySelector('#paaAtelierCanvas');
    ITEMS.forEach(function (item) { canvas.appendChild(itemButton(item, saved.itemId)); });
    overlay.querySelectorAll('[data-paa-close]').forEach(function (button) { button.addEventListener('click', closeOverlay); });
    overlay.querySelectorAll('[data-paa-apply]').forEach(function (button) { button.addEventListener('click', applySelection); });
    overlay.querySelector('.paa-foundation').addEventListener('error', function () {
      hideOverlay();
      try { if (typeof window.toast === 'function') window.toast('아틀리에 화면을 다시 불러오고 있어요. 잠시 후 다시 열어 주세요.'); } catch (e) {}
      try { if (typeof window.goTab === 'function') window.goTab('home'); } catch (e) {}
    }, { once: true });
    overlay.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.preventDefault(); closeOverlay(); }
      if (event.key === 'Tab') {
        var focusable = Array.prototype.slice.call(overlay.querySelectorAll('button:not([disabled])'));
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function setStatus(message) {
    var status = document.getElementById('paaAtelierStatus');
    if (status) status.textContent = message;
  }

  function selectItem(item, button) {
    var overlay = ensureOverlay();
    overlay.querySelectorAll('.paa-hotspot').forEach(function (node) {
      node.setAttribute('aria-pressed', node === button ? 'true' : 'false');
    });
    var result = invokeEquip(item);
    writeState({ itemId: item.id, slot: item.slot, label: item.label, syncSource: result.source });
    if (result.ok) setStatus('✓ '+item.label+' 선택 완료 · 적용하기를 눌러 저장하세요.');
    else if (result.source === 'local-storage') setStatus('✓ '+item.label+' 선택을 이 기기에 안전하게 보관했어요.');
    else setStatus('선택은 보관했지만 연결이 잠시 지연되고 있어요. 적용하기로 다시 확인할게요.');
  }

  function applySelection() {
    var state = readState();
    var item = ITEMS.find(function (candidate) { return candidate.id === state.itemId; });
    if (item && !currentEquipped(item)) {
      var result = invokeEquip(item);
      writeState({ itemId: item.id, slot: item.slot, label: item.label, appliedAt: new Date().toISOString(), syncSource: result.source });
    } else {
      writeState({ appliedAt: new Date().toISOString() });
    }
    try { if (typeof window.renderPetShop === 'function') window.renderPetShop(); } catch (e) {}
    try { if (typeof window.renderPresencePersonalPet === 'function') window.renderPresencePersonalPet(); } catch (e) {}
    try { if (typeof window.renderAnimal === 'function') window.renderAnimal(); } catch (e) {}
    setStatus(state.label ? '✓ '+state.label+' 코디를 모든 화면에 적용했어요.' : '✓ 현재 모습을 안전하게 적용했어요.');
    try { if (typeof window.toast === 'function') window.toast('✨ 아틀리에 코디를 적용했어요'); } catch (e) {}
  }

  function panelIsOpen() {
    var panels = [document.getElementById('m-petshop'), document.getElementById('m-avatar')].filter(Boolean);
    return panels.some(function (panel) {
      return panel.classList.contains('active') || panel.getAttribute('aria-hidden') === 'false';
    });
  }

  function openOverlay() {
    var overlay = ensureOverlay();
    if (!overlay.hidden) return;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add('presence-atelier-open');
    var state = readState();
    setStatus(state.label ? state.label+' 선택이 보관되어 있어요.' : '아이템을 선택해 주세요.');
    window.setTimeout(function () {
      var close = overlay.querySelector('.paa-close');
      if (close) close.focus({ preventScroll: true });
      var viewport = overlay.querySelector('.paa-viewport');
      if (viewport && window.innerWidth <= 1100) viewport.scrollLeft = 0;
    }, 30);
  }

  function hideOverlay() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.hidden = true;
    document.body.classList.remove('presence-atelier-open');
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  function closeOverlay() {
    dismissedForCycle = true;
    hideOverlay();
    try {
      if (typeof window.goTab === 'function' && panelIsOpen()) window.goTab('home');
    } catch (e) {}
  }

  function refresh() {
    refreshQueued = false;
    var open = panelIsOpen();
    if (!open && lastPanelWasOpen) dismissedForCycle = false;
    lastPanelWasOpen = open;
    if (open && !dismissedForCycle) openOverlay();
    else if (!open) hideOverlay();
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(refresh);
    else window.setTimeout(refresh, 16);
  }

  window[REFRESH_KEY] = queueRefresh;

  function boot() {
    ensureOverlay();
    var observer = new MutationObserver(queueRefresh);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-hidden'] });
    window.addEventListener('popstate', queueRefresh);
    window.addEventListener('hashchange', queueRefresh);
    window.addEventListener('resize', queueRefresh, { passive: true });
    queueRefresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
