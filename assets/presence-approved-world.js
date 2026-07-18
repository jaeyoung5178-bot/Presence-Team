(function () {
  'use strict';

  var VERSION = '20260719-approved-world-1';
  var ASSET_ROOT = 'assets/farm-world/approved/';
  var ASSETS = {
    village: ASSET_ROOT + 'village-dashboard-approved.png',
    tree: ASSET_ROOT + 'home-tree-approved.png',
    atelier: ASSET_ROOT + 'avatar-atelier-approved.png'
  };
  var STYLE_ID = 'presenceApprovedWorldStyle';
  var VILLAGE_ID = 'presenceVillageWorld';
  var TREE_ID = 'presenceTreeWorld';
  var ATELIER_ID = 'presenceApprovedAtelier';
  var observedHome = null;
  var homeObserver = null;
  var profileObserver = null;

  function user() {
    try {
      if (typeof me !== 'undefined' && me) return me;
    } catch (ignore) {}
    return null;
  }

  function roleOf(value) {
    var role = String(value || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (role === 'AOP' || role === 'TL' || role === 'LR' || role === 'IC') return role;
    return 'IC';
  }

  function canOpenAdmin() {
    var current = user();
    try {
      if (typeof isFounder === 'function' && current && isFounder(current)) return true;
    } catch (ignore) {}
    return !!(current && roleOf(current.role) === 'AOP');
  }

  function profileCopy() {
    var current = user() || {};
    var name = String(current.name || '팀 리더').trim() || '팀 리더';
    return {
      name: name,
      role: roleOf(current.role),
      label: '농장지기 ' + name + ' ' + roleOf(current.role) + '님'
    };
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      'body.presence-world-open{overflow:hidden!important}',
      '.presence-approved-world{position:fixed;inset:0;z-index:22000;isolation:isolate;overflow:hidden;background:#081a2b center/cover no-repeat;color:#fff;font-family:inherit;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .24s ease,visibility .24s ease}',
      '.presence-approved-world.is-open{opacity:1;visibility:visible;pointer-events:auto}',
      '.presence-approved-world[hidden]{display:none!important}',
      '.presence-approved-world:after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(180deg,rgba(3,15,28,.12),transparent 30%,rgba(3,14,24,.16))}',
      '.presence-approved-world button{font:inherit}',
      '.pv-skip{position:absolute;left:16px;top:-80px;z-index:8;padding:12px 16px;border-radius:12px;background:#fff;color:#10253e;font-weight:900;transition:top .18s}',
      '.pv-skip:focus{top:16px}',
      '.pv-world-nav{position:absolute;left:14.5%;right:25.5%;top:2%;z-index:6;display:flex;align-items:center;justify-content:center;gap:6px;padding:7px;border:1px solid rgba(218,190,132,.44);border-radius:15px;background:rgba(7,26,43,.9);box-shadow:0 12px 30px rgba(1,9,17,.24);backdrop-filter:blur(10px)}',
      '.pv-nav-button,.pv-hotspot,.pv-profile,.pv-action,.pv-close{min-width:44px;min-height:44px;border:1px solid rgba(220,190,126,.58);border-radius:12px;background:linear-gradient(180deg,rgba(13,40,62,.96),rgba(5,24,42,.96));color:#f8e9c8;box-shadow:0 8px 20px rgba(2,13,24,.22);cursor:pointer;transition:transform .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease}',
      '.pv-nav-button{padding:10px 15px;font-size:15px;font-weight:850;white-space:nowrap}',
      '.pv-nav-button:hover,.pv-nav-button:focus-visible,.pv-hotspot:hover,.pv-hotspot:focus-visible,.pv-profile:hover,.pv-profile:focus-visible,.pv-action:hover,.pv-action:focus-visible,.pv-close:hover,.pv-close:focus-visible{transform:translateY(-2px);border-color:#f5d58f;background:linear-gradient(180deg,rgba(41,67,55,.98),rgba(20,45,40,.98));box-shadow:0 12px 28px rgba(1,10,18,.35),0 0 0 3px rgba(245,213,143,.16);outline:0}',
      '.pv-nav-button[aria-current="page"]{background:linear-gradient(180deg,#66794b,#40502f);border-color:#f1daa5;color:#fff8e8}',
      '.pv-nav-button[data-admin="true"][hidden],.pv-hotspot[data-admin="true"][hidden]{display:none!important}',
      '.pv-profile{position:absolute;right:24.4%;top:4.7%;z-index:7;display:flex;align-items:center;gap:10px;max-width:300px;padding:8px 14px;text-align:left}',
      '.pv-profile-mark{display:grid;place-items:center;width:38px;height:38px;flex:0 0 38px;border-radius:50%;background:#f0c969;color:#173047;font-size:21px;box-shadow:inset 0 0 0 3px rgba(255,255,255,.25)}',
      '.pv-profile-copy{display:grid;gap:1px;min-width:0}',
      '.pv-profile-copy small{color:#d7c59f;font-size:11px;letter-spacing:.08em}',
      '.pv-profile-copy b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}',
      '.pv-hotspot{position:absolute;z-index:5;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;font-size:16px;font-weight:900;letter-spacing:.01em}',
      '.pv-hotspot small{display:block;color:#d8c59f;font-size:10px;font-weight:700}',
      '.pv-hotspot.people{left:19.7%;top:25.2%}',
      '.pv-hotspot.today{left:40.3%;top:21.5%}',
      '.pv-hotspot.growth{left:58.1%;top:24.5%}',
      '.pv-hotspot.profit{left:22.8%;top:53.2%}',
      '.pv-hotspot.admin{left:53.8%;top:53.2%}',
      '.pv-mobile-sheet{display:none}',
      '.pv-close{position:absolute;right:18px;top:18px;z-index:12;width:50px;height:50px;padding:0;border-radius:50%;font-size:25px;font-weight:700}',
      '.pv-action{position:absolute;z-index:8;padding:14px 22px;font-size:17px;font-weight:900}',
      '.presence-tree-world{background-image:url("' + ASSETS.tree + '")}',
      '.presence-tree-world .pv-water{left:48.5%;top:45.6%;min-width:220px;background:linear-gradient(180deg,#718551,#4d623a);border-color:#e8d8a5;color:#fffbed}',
      '.presence-tree-world .pv-tree-back{left:49.4%;top:55.2%;min-width:190px;background:rgba(8,28,45,.92)}',
      '.pv-live{position:absolute;left:50%;bottom:24px;z-index:12;max-width:min(520px,calc(100vw - 32px));transform:translateX(-50%);padding:10px 16px;border-radius:999px;background:rgba(4,23,38,.88);color:#fff6df;text-align:center;font-size:14px;box-shadow:0 12px 28px rgba(0,0,0,.28)}',
      '.presence-atelier-world{background-image:url("' + ASSETS.atelier + '")}',
      '.presence-atelier-world .pv-enter-atelier{right:2.6%;bottom:6%;min-width:260px;padding:18px 28px;background:linear-gradient(180deg,#7c8954,#58643a);border-color:#e7d198;color:#fff8e4;font-size:20px}',
      '.presence-atelier-world .pv-atelier-title{position:absolute;left:3%;top:3%;z-index:6;margin:0;max-width:55%;font-family:Georgia,"Noto Serif KR",serif;color:#f4dfb1;font-size:clamp(22px,2.5vw,41px);text-shadow:0 3px 16px rgba(0,0,0,.58)}',
      '.presence-atelier-world .pv-atelier-sub{position:absolute;left:3%;top:10%;z-index:6;margin:0;color:#d9c398;font-size:clamp(13px,1.1vw,17px)}',
      '@media(max-width:1100px){',
      ' .pv-world-nav{left:2%;right:2%;top:1.5%;gap:4px;padding:6px}',
      ' .pv-nav-button{padding:9px 11px;font-size:13px}',
      ' .pv-profile{right:2%;top:10.5%;max-width:260px}',
      ' .pv-hotspot{padding:10px 13px;font-size:14px}',
      ' .presence-tree-world .pv-water{left:44%;top:46%}',
      ' .presence-tree-world .pv-tree-back{left:45%;top:56%}',
      ' .presence-atelier-world .pv-enter-atelier{right:3%;bottom:5%;min-width:230px}',
      '}',
      '@media(max-width:700px){',
      ' .presence-approved-world{overflow:auto;background-size:auto 48vh;background-position:center top;background-color:#07192a;overscroll-behavior:contain}',
      ' .presence-approved-world:after{position:fixed;background:linear-gradient(180deg,transparent 22vh,rgba(5,20,34,.58) 43vh,#07192a 57vh)}',
      ' .pv-world-nav{position:relative;left:auto;right:auto;top:auto;margin:49vh 12px 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:12px;border-radius:20px}',
      ' .pv-nav-button{min-height:48px;padding:10px 6px;font-size:14px;white-space:normal}',
      ' .pv-profile{left:12px;right:72px;top:12px;max-width:none;min-height:52px;padding:6px 11px}',
      ' .pv-profile-mark{width:34px;height:34px;flex-basis:34px;font-size:18px}',
      ' .pv-profile-copy b{font-size:13px}',
      ' .pv-scene-hotspots{display:none}',
      ' .pv-mobile-sheet{position:relative;z-index:6;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 12px max(18px,env(safe-area-inset-bottom));padding:12px;border:1px solid rgba(218,190,132,.44);border-radius:20px;background:rgba(7,26,43,.94)}',
      ' .pv-mobile-sheet .pv-hotspot{position:relative;inset:auto;min-height:54px;padding:9px 8px;font-size:14px}',
      ' .pv-close{position:fixed;right:12px;top:12px;width:48px;height:48px}',
      ' .presence-tree-world,.presence-atelier-world{background-size:auto 44vh}',
      ' .presence-tree-world .pv-water,.presence-tree-world .pv-tree-back,.presence-atelier-world .pv-enter-atelier{position:relative;left:auto;right:auto;top:auto;bottom:auto;display:block;width:calc(100% - 24px);min-width:0;margin:0 12px 10px;min-height:52px}',
      ' .presence-tree-world .pv-water{margin-top:47vh}',
      ' .presence-tree-world .pv-tree-back{margin-bottom:max(18px,env(safe-area-inset-bottom))}',
      ' .presence-atelier-world .pv-atelier-title{position:relative;left:auto;top:auto;margin:46vh 16px 0;max-width:none;font-size:25px}',
      ' .presence-atelier-world .pv-atelier-sub{position:relative;left:auto;top:auto;margin:8px 16px 18px;font-size:15px;line-height:1.55}',
      ' .presence-atelier-world .pv-enter-atelier{margin-bottom:max(18px,env(safe-area-inset-bottom))}',
      ' .pv-live{position:fixed;bottom:max(12px,env(safe-area-inset-bottom));font-size:12px}',
      '}',
      '@media(prefers-reduced-motion:reduce){.presence-approved-world,.pv-nav-button,.pv-hotspot,.pv-profile,.pv-action,.pv-close{transition:none!important}}'
    ].join('');
    document.head.appendChild(style);
  }

  function button(className, text, label) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = className;
    el.textContent = text;
    if (label) el.setAttribute('aria-label', label);
    return el;
  }

  function announce(layer, message) {
    var live = layer && layer.querySelector('.pv-live');
    if (!live) return;
    live.textContent = message;
    live.hidden = false;
    window.clearTimeout(live._hideTimer);
    live._hideTimer = window.setTimeout(function () { live.hidden = true; }, 3200);
  }

  function updateBodyLock() {
    var open = document.querySelector('.presence-approved-world.is-open:not([hidden])');
    document.body.classList.toggle('presence-world-open', !!open);
  }

  function closeLayer(id) {
    var layer = document.getElementById(id);
    if (!layer) return;
    layer.classList.remove('is-open');
    layer.setAttribute('aria-hidden', 'true');
    window.setTimeout(function () {
      if (!layer.classList.contains('is-open')) layer.hidden = true;
      updateBodyLock();
    }, 250);
  }

  function showLayer(layer) {
    if (!layer) return;
    [TREE_ID, ATELIER_ID].forEach(function (id) {
      if (id !== layer.id) closeLayer(id);
    });
    layer.hidden = false;
    layer.setAttribute('aria-hidden', 'false');
    window.requestAnimationFrame(function () {
      layer.classList.add('is-open');
      updateBodyLock();
      var focus = layer.querySelector('[data-autofocus],button');
      if (focus) focus.focus({ preventScroll: true });
    });
  }

  function fallbackClick(keys) {
    for (var i = 0; i < keys.length; i += 1) {
      var target = document.querySelector(keys[i]);
      if (target && typeof target.click === 'function') {
        target.click();
        return true;
      }
    }
    return false;
  }

  function routeWorkspace(key) {
    var routes = {
      home: { group: 'home', tab: 'home' },
      today: { group: 'today', tab: 'today' },
      people: { group: 'people', tab: 'teamtree' },
      progress: { group: 'progress', tab: 'journey' },
      profit: { group: 'profit', tab: 'sale' },
      admin: { group: 'admin', tab: 'admin' }
    };
    var route = routes[key];
    if (!route) return false;
    if (key === 'admin' && !canOpenAdmin()) {
      announce(document.getElementById(VILLAGE_ID), '관리자 권한이 있는 계정에서만 열 수 있어요.');
      return false;
    }
    closeLayer(TREE_ID);
    closeLayer(ATELIER_ID);
    var village = document.getElementById(VILLAGE_ID);
    if (village) {
      village.classList.remove('is-open');
      village.setAttribute('aria-hidden', 'true');
      village.hidden = true;
    }
    try {
      if (typeof goTab === 'function') {
        goTab(route.tab);
        if (key !== 'home' && typeof selectGroup === 'function') selectGroup(route.group);
        return true;
      }
      if (key !== 'home' && typeof selectGroup === 'function') {
        selectGroup(route.group);
        return true;
      }
    } catch (ignore) {}
    return fallbackClick([
      '[data-group="' + route.group + '"]',
      '[data-tab="' + route.tab + '"]',
      '#m-' + route.tab
    ]);
  }

  function makeNav(key, label) {
    var el = button('pv-nav-button', label, label + ' 열기');
    el.dataset.worldTarget = key;
    if (key === 'home') el.setAttribute('aria-current', 'page');
    if (key === 'admin') {
      el.dataset.admin = 'true';
      el.hidden = !canOpenAdmin();
    }
    el.addEventListener('click', function () { routeWorkspace(key); });
    return el;
  }

  function makeHotspot(key, label, icon, target, adminOnly) {
    var el = button('pv-hotspot ' + key, '', label + ' 열기');
    el.innerHTML = '<span class="pv-hotspot-icon" aria-hidden="true">' + (icon || '') + '</span><span>' + label + '</span>';
    el.dataset.worldTarget = target;
    if (adminOnly) {
      el.dataset.admin = 'true';
      el.hidden = !canOpenAdmin();
    }
    el.addEventListener('click', function () {
      if (target === 'tree') window.openPresenceTreeWorld();
      else routeWorkspace(target);
    });
    return el;
  }

  function updateVillageProfile() {
    var world = document.getElementById(VILLAGE_ID);
    if (!world) return;
    var copy = profileCopy();
    var label = world.querySelector('.pv-profile-copy b');
    if (label) label.textContent = copy.label;
    world.querySelectorAll('[data-admin="true"]').forEach(function (item) {
      item.hidden = !canOpenAdmin();
    });
  }

  function createVillage(home) {
    var existing = document.getElementById(VILLAGE_ID);
    if (existing) return existing;
    var world = document.createElement('section');
    world.id = VILLAGE_ID;
    world.className = 'presence-approved-world presence-village-world';
    world.dataset.version = VERSION;
    world.setAttribute('role', 'region');
    world.setAttribute('aria-label', '프레젠스 동물농장 홈');
    world.setAttribute('aria-hidden', 'true');
    world.style.backgroundImage = 'url("' + ASSETS.village + '")';
    world.hidden = true;

    var skip = document.createElement('a');
    skip.className = 'pv-skip';
    skip.href = '#presenceVillageNavigation';
    skip.textContent = '월드 메뉴로 이동';
    world.appendChild(skip);

    var nav = document.createElement('nav');
    nav.id = 'presenceVillageNavigation';
    nav.className = 'pv-world-nav';
    nav.setAttribute('aria-label', '프레젠스 워크스페이스');
    [['home', 'Home'], ['today', 'Today'], ['people', 'People'], ['progress', 'Progress'], ['profit', 'Profit'], ['admin', 'Admin']].forEach(function (entry) {
      nav.appendChild(makeNav(entry[0], entry[1]));
    });
    world.appendChild(nav);

    var profile = button('pv-profile', '', '나의 아바타 아틀리에 열기');
    profile.innerHTML = '<span class="pv-profile-copy"><small>FARM KEEPER</small><b></b></span>';
    profile.addEventListener('click', function () { window.openApprovedAtelier(); });
    world.appendChild(profile);

    var scene = document.createElement('div');
    scene.className = 'pv-scene-hotspots';
    scene.appendChild(makeHotspot('people', '사람 사랑방', '', 'people', false));
    scene.appendChild(makeHotspot('today', '오늘 광장', '', 'today', false));
    scene.appendChild(makeHotspot('growth', '성장 온실', '', 'tree', false));
    scene.appendChild(makeHotspot('profit', '수익 장터', '', 'profit', false));
    scene.appendChild(makeHotspot('admin', '관리자 집무실', '', 'admin', true));
    world.appendChild(scene);

    var mobile = document.createElement('div');
    mobile.className = 'pv-mobile-sheet';
    mobile.setAttribute('aria-label', '농장 공간 바로가기');
    mobile.appendChild(makeHotspot('people', '사람 사랑방', '', 'people', false));
    mobile.appendChild(makeHotspot('today', '오늘 광장', '', 'today', false));
    mobile.appendChild(makeHotspot('growth', '성장 온실', '', 'tree', false));
    mobile.appendChild(makeHotspot('profit', '수익 장터', '', 'profit', false));
    mobile.appendChild(makeHotspot('admin', '관리자 집무실', '', 'admin', true));
    var atelier = makeHotspot('atelier', '나의 아틀리에', '', 'atelier', false);
    atelier.addEventListener('click', function (event) {
      event.stopImmediatePropagation();
      window.openApprovedAtelier();
    }, true);
    mobile.appendChild(atelier);
    world.appendChild(mobile);

    var live = document.createElement('div');
    live.className = 'pv-live';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.hidden = true;
    world.appendChild(live);

    home.prepend(world);
    updateVillageProfile();
    return world;
  }

  function createTreeWorld() {
    var existing = document.getElementById(TREE_ID);
    if (existing) return existing;
    var layer = document.createElement('section');
    layer.id = TREE_ID;
    layer.className = 'presence-approved-world presence-tree-world';
    layer.dataset.version = VERSION;
    layer.hidden = true;
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', '성장 온실');
    layer.setAttribute('aria-hidden', 'true');

    var close = button('pv-close', '×', '성장 온실 닫기');
    close.dataset.autofocus = 'true';
    close.addEventListener('click', function () {
      closeLayer(TREE_ID);
      syncVillageVisibility();
    });
    layer.appendChild(close);

    var water = button('pv-action pv-water', '오늘 물 주기', '프레젠스 나무에 오늘 물 주기');
    water.addEventListener('click', function () {
      var before = water.textContent;
      water.disabled = true;
      water.textContent = '물을 주고 있어요…';
      try {
        if (typeof waterTree === 'function') waterTree();
        else if (!fallbackClick(['#waterBtn'])) announce(layer, '기존 물주기 기능을 찾지 못했어요.');
        announce(layer, '프레젠스 나무에 오늘의 물주기를 전달했어요.');
      } catch (error) {
        announce(layer, '물주기를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
      window.setTimeout(function () {
        water.disabled = false;
        water.textContent = before;
      }, 1100);
    });
    layer.appendChild(water);

    var back = button('pv-action pv-tree-back', '← 동물농장으로', '동물농장 홈으로 돌아가기');
    back.addEventListener('click', function () {
      closeLayer(TREE_ID);
      syncVillageVisibility();
    });
    layer.appendChild(back);

    var live = document.createElement('div');
    live.className = 'pv-live';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.hidden = true;
    layer.appendChild(live);
    document.body.appendChild(layer);
    return layer;
  }

  function createAtelierWorld() {
    var existing = document.getElementById(ATELIER_ID);
    if (existing) return existing;
    var layer = document.createElement('section');
    layer.id = ATELIER_ID;
    layer.className = 'presence-approved-world presence-atelier-world';
    layer.dataset.version = VERSION;
    layer.hidden = true;
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', '나의 프레젠스 아틀리에');
    layer.setAttribute('aria-hidden', 'true');

    var title = document.createElement('h2');
    title.className = 'pv-atelier-title';
    title.textContent = '프레젠스 동물농장 — 나의 아틀리에';
    layer.appendChild(title);
    var sub = document.createElement('p');
    sub.className = 'pv-atelier-sub';
    sub.textContent = '마음에 드는 스타일을 골라 나만의 병아리를 완성해 보세요.';
    layer.appendChild(sub);

    var close = button('pv-close', '×', '아틀리에 닫기');
    close.dataset.autofocus = 'true';
    close.addEventListener('click', function () {
      closeLayer(ATELIER_ID);
      syncVillageVisibility();
    });
    layer.appendChild(close);

    var enter = button('pv-action pv-enter-atelier', '아틀리에 들어가기', '아바타 스튜디오 편집 화면 열기');
    enter.addEventListener('click', function () {
      closeLayer(ATELIER_ID);
      routeWorkspace('progress');
      try {
        if (typeof goTab === 'function') goTab('petshop');
        else fallbackClick(['[data-tab="petshop"]', '#animalPetShopBtn']);
      } catch (ignore) {}
    });
    layer.appendChild(enter);
    document.body.appendChild(layer);
    return layer;
  }

  function homeIsActive() {
    var home = document.getElementById('m-home');
    if (!home || !home.classList.contains('active')) return false;
    var app = document.getElementById('app');
    return !app || !app.classList.contains('hidden');
  }

  function syncVillageVisibility() {
    var village = document.getElementById(VILLAGE_ID);
    if (!village) return;
    var otherOpen = document.querySelector('#' + TREE_ID + '.is-open,#' + ATELIER_ID + '.is-open');
    if (homeIsActive() && !otherOpen) {
      village.hidden = false;
      village.setAttribute('aria-hidden', 'false');
      window.requestAnimationFrame(function () {
        village.classList.add('is-open');
        updateBodyLock();
      });
    } else {
      village.classList.remove('is-open');
      village.setAttribute('aria-hidden', 'true');
      village.hidden = true;
      updateBodyLock();
    }
    updateVillageProfile();
  }

  function observe(home) {
    if (homeObserver && observedHome === home) return;
    if (homeObserver) homeObserver.disconnect();
    observedHome = home;
    homeObserver = new MutationObserver(syncVillageVisibility);
    homeObserver.observe(home, { attributes: true, attributeFilter: ['class'] });
    var app = document.getElementById('app');
    if (app) homeObserver.observe(app, { attributes: true, attributeFilter: ['class'] });

    if (profileObserver) profileObserver.disconnect();
    profileObserver = new MutationObserver(updateVillageProfile);
    ['mePillNm', 'mePillRole'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) profileObserver.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  function boot() {
    ensureStyle();
    var home = document.getElementById('m-home');
    if (!home) return false;
    createVillage(home);
    createTreeWorld();
    createAtelierWorld();
    observe(home);
    syncVillageVisibility();
    return true;
  }

  window.openPresenceVillageWorld = function () {
    if (!boot()) return false;
    try {
      if (typeof goTab === 'function') goTab('home');
    } catch (ignore) {}
    syncVillageVisibility();
    return true;
  };

  window.closePresenceVillageWorld = function () {
    var village = document.getElementById(VILLAGE_ID);
    if (!village) return;
    village.classList.remove('is-open');
    village.hidden = true;
    village.setAttribute('aria-hidden', 'true');
    updateBodyLock();
  };

  window.openPresenceTreeWorld = function () {
    if (!boot()) return false;
    var village = document.getElementById(VILLAGE_ID);
    if (village) {
      village.classList.remove('is-open');
      village.hidden = true;
      village.setAttribute('aria-hidden', 'true');
    }
    showLayer(createTreeWorld());
    return true;
  };

  window.closePresenceTreeWorld = function () {
    closeLayer(TREE_ID);
    syncVillageVisibility();
  };

  window.openApprovedAtelier = function () {
    if (!boot()) return false;
    var village = document.getElementById(VILLAGE_ID);
    if (village) {
      village.classList.remove('is-open');
      village.hidden = true;
      village.setAttribute('aria-hidden', 'true');
    }
    closeLayer(ATELIER_ID);
    try {
      if (typeof goTab === 'function') goTab('petshop');
      else fallbackClick(['[data-tab="petshop"]', '#animalPetShopBtn']);
    } catch (ignore) {}
    document.dispatchEvent(new CustomEvent('presence:approved-atelier-open', { detail: { version: VERSION } }));
    return true;
  };

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (document.getElementById(ATELIER_ID) && document.getElementById(ATELIER_ID).classList.contains('is-open')) {
      closeLayer(ATELIER_ID);
      syncVillageVisibility();
    } else if (document.getElementById(TREE_ID) && document.getElementById(TREE_ID).classList.contains('is-open')) {
      closeLayer(TREE_ID);
      syncVillageVisibility();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  var retries = 0;
  var retryTimer = window.setInterval(function () {
    retries += 1;
    if (boot() || retries > 40) window.clearInterval(retryTimer);
  }, 250);
}());
