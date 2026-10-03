(function () {
  'use strict';

  var renderQueued = false;
  var rendering = false;
  var observedWrap = null;
  var wrapObserver = null;
  var observedHomePanel = null;
  var homePanelObserver = null;
  var observedQuickSlots = null;
  var quickSlotsObserver = null;
  var waterTimer = 0;
  var companionSignature = '';

  function appState() {
    try { return typeof state !== 'undefined' ? state : null; } catch (error) { return null; }
  }

  function currentUser() {
    try { return typeof me !== 'undefined' ? me : null; } catch (error) { return null; }
  }

  function oneOnOneState() {
    try { return typeof OO !== 'undefined' ? OO : null; } catch (error) { return null; }
  }

  function todayKey() {
    try { if (typeof TODAY !== 'undefined' && TODAY) return TODAY; } catch (error) {}
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + month + '-' + day;
  }

  function isFounderView(user) {
    try { return !!user && typeof isFounder === 'function' && isFounder(user); } catch (error) { return false; }
  }

  function isTestUser(user) {
    try { return !!user && typeof isTestBot === 'function' && isTestBot(user); } catch (error) { return false; }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character];
    });
  }

  function replaceMarkup(element, html) {
    if (element && element.innerHTML !== html) element.innerHTML = html;
  }

  function canOpenTab(tab) {
    try { return typeof tabVisible === 'function' ? tabVisible(tab) : true; } catch (error) { return false; }
  }

  function openTab(tab) {
    if (!canOpenTab(tab)) {
      try { if (typeof toast === 'function') toast('이 기능은 현재 계정에서 열 수 없어요'); } catch (error) {}
      return;
    }
    try { if (typeof goTab === 'function') goTab(tab); } catch (error) {}
  }

  function safeTreeSnapshot() {
    var week = 0;
    var fraction = 0;
    var stage = {name: '새싹'};
    try { if (typeof treeWeek === 'function') week = Number(treeWeek()) || 0; } catch (error) {}
    try { if (typeof treeFrac === 'function') fraction = Number(treeFrac(week)) || 0; } catch (error) {}
    try { if (typeof treeStage === 'function') stage = treeStage(fraction) || stage; } catch (error) {}
    var days = 0;
    try {
      if (typeof TREE_END !== 'undefined') days = Math.max(0, Math.ceil((Number(TREE_END) - Date.now()) / 86400000));
    } catch (error) {}
    var progress = Math.max(0, Math.min(100, Math.round(fraction * 100)));
    return {week: week, stage: stage.name || '새싹', progress: progress, days: days};
  }

  function readProgress() {
    var data = appState();
    return data && isFinite(Number(data.pr)) ? Number(data.pr) : 0;
  }

  function appointmentSummary(user) {
    var model = oneOnOneState();
    var result = {ownCount: 0, todayTotal: 0, nextDate: ''};
    if (!model || !model.res || !user) return result;
    var today = todayKey();
    Object.keys(model.res).sort().forEach(function (date) {
      var reservation = model.res[date];
      if (!reservation) return;
      if (date === today) result.todayTotal += 1;
      if (reservation.uid === user.uid && date >= today) {
        result.ownCount += 1;
        if (!result.nextDate) result.nextDate = date;
      }
    });
    return result;
  }

  function callbackConnected(user) {
    var data = appState();
    var profile = data && data.callbackProfiles && user && data.callbackProfiles[user.uid];
    return !!(profile && profile.status !== 'retired' && (profile.callbackDataPath || profile.url || profile.accessKey));
  }

  function pendingCount() {
    var data = appState();
    if (!data || !data.users) return 0;
    return Object.keys(data.users).reduce(function (total, uid) {
      var user = data.users[uid];
      return total + (user && user.status === 'pending' && !isTestUser(user) ? 1 : 0);
    }, 0);
  }

  function workspaceGroup(key) {
    try {
      if (typeof NAV === 'undefined' || !Array.isArray(NAV)) return null;
      return NAV.find(function (group) { return group && group.k === key; }) || null;
    } catch (error) { return null; }
  }

  function firstVisibleWorkspaceTab(key) {
    var group = workspaceGroup(key);
    if (!group || !Array.isArray(group.tabs)) return '';
    return group.tabs.find(function (tab) { return canOpenTab(tab); }) || '';
  }

  function workspaceVisible(key) {
    if (key === 'home') return true;
    if (key === 'admin' && !isFounderView(currentUser())) return false;
    return !!firstVisibleWorkspaceTab(key);
  }

  function openWorkspace(key) {
    if (!workspaceVisible(key)) return;
    if (key === 'home') {
      openTab('home');
      return;
    }
    try {
      if (typeof selectGroup === 'function') {
        selectGroup(key);
        return;
      }
    } catch (error) {}
    openTab(firstVisibleWorkspaceTab(key));
  }

  function ensureRuntimeStyle() {
    if (document.getElementById('presenceHomeAtelierRuntimeStyle')) return;
    var style = document.createElement('style');
    style.id = 'presenceHomeAtelierRuntimeStyle';
    style.textContent =
      'body.presence-atelier-home-active nav.rail,body.presence-atelier-home-active nav.botbar{display:none!important}' +
      'body.presence-atelier-home-active #app main{margin-left:0!important;padding-top:var(--ph-home-top-offset,68px)!important}' +
      'body.presence-atelier-home .phome-workspace-nav{position:relative;z-index:20;display:grid;grid-template-columns:minmax(210px,1fr) auto;align-items:center;gap:18px;margin:0 0 6px;padding:10px 12px 10px 18px;border:1px solid rgba(214,173,105,.3);border-radius:20px;background:linear-gradient(90deg,rgba(7,20,30,.96),rgba(15,30,38,.94));box-shadow:0 12px 34px rgba(0,0,0,.24),inset 0 1px rgba(255,255,255,.055)}' +
      'body.presence-atelier-home .phome-workspace-brand{display:flex;align-items:center;gap:10px;min-width:0;color:var(--ph-paper-150);font:700 clamp(15px,1.2vw,20px)/1.35 var(--ph-serif);letter-spacing:-.02em;white-space:nowrap}' +
      'body.presence-atelier-home .phome-workspace-brand>span{display:flex;flex-direction:column;min-width:0}' +
      'body.presence-atelier-home .phome-workspace-brand small{margin-top:1px;color:rgba(249,239,217,.54);font:650 10px/1.35 var(--ph-sans);letter-spacing:.025em}' +
      'body.presence-atelier-home .phome-workspace-brand i{display:grid;place-items:center;width:34px;height:34px;flex:0 0 34px;border:1px solid rgba(237,199,127,.38);border-radius:50%;color:var(--ph-brass-300);background:rgba(216,170,98,.08);font:700 17px/1 var(--ph-serif);font-style:normal}' +
      'body.presence-atelier-home .phome-workspace-list{display:flex;align-items:center;justify-content:flex-end;gap:4px;min-width:0}' +
      'body.presence-atelier-home .phome-workspace-button{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:80px;min-height:46px;padding:9px 12px;border:1px solid transparent;border-radius:13px;color:rgba(249,239,217,.68);background:transparent;font:750 14px/1.2 var(--ph-sans);cursor:pointer;transition:color .16s ease,background .16s ease,border-color .16s ease,transform .16s ease}' +
      'body.presence-atelier-home .phome-workspace-button:hover,body.presence-atelier-home .phome-workspace-button:focus-visible{color:var(--ph-paper-100);border-color:rgba(216,170,98,.34);background:rgba(216,170,98,.09);outline:0;transform:translateY(-1px)}' +
      'body.presence-atelier-home .phome-workspace-button[aria-current="page"]{color:var(--ph-paper-100);border-color:rgba(216,170,98,.42);background:linear-gradient(180deg,rgba(216,170,98,.14),rgba(216,170,98,.045));box-shadow:inset 0 -2px var(--ph-brass-400)}' +
      'body.presence-atelier-home .phome-workspace-button[data-admin="true"]{color:var(--ph-brass-300)}' +
      'body.presence-atelier-home .phome-nav-badge{display:grid;place-items:center;min-width:19px;height:19px;padding:0 5px;border-radius:999px;color:#fff7e8;background:#9b6039;font:800 10px/1 var(--ph-sans)}' +
      'body.presence-atelier-home .phome-shortcuts-copy{margin:-5px 0 14px;color:rgba(249,239,217,.62);font:600 13px/1.6 var(--ph-sans)}' +
      'body.presence-atelier-home #homeFieldJournalCard.phome-paper-journal{isolation:isolate}' +
      '@media(max-width:1100px){body.presence-atelier-home .phome-workspace-nav{display:block;padding:12px}body.presence-atelier-home .phome-workspace-brand{padding:0 4px 8px}body.presence-atelier-home .phome-workspace-list{justify-content:flex-start;overflow-x:auto;padding:2px 2px 4px;scrollbar-width:none;overscroll-behavior-inline:contain}body.presence-atelier-home .phome-workspace-list::-webkit-scrollbar{display:none}body.presence-atelier-home .phome-workspace-button{flex:0 0 auto}}' +
      '@media(max-width:767px){body.presence-atelier-home-active #app main{padding-top:var(--ph-home-top-offset,58px)!important}body.presence-atelier-home .phome-workspace-nav{margin-bottom:4px;border-radius:16px}body.presence-atelier-home .phome-workspace-brand{font-size:16px}body.presence-atelier-home .phome-workspace-brand small{font-size:9px}body.presence-atelier-home .phome-workspace-button{min-width:78px;min-height:44px;padding:9px 10px;font-size:13px}body.presence-atelier-home .phome-workspace-button .phome-workspace-icon{display:none}}' +
      '@media(prefers-reduced-motion:reduce){body.presence-atelier-home .phome-workspace-button{transition:none}}';
    (document.head || document.documentElement).appendChild(style);
  }

  function syncHomeActiveState(home) {
    home = home || document.getElementById('m-home');
    var active = !!(home && home.classList.contains('active'));
    document.body.classList.toggle('presence-atelier-home-active', active);
    if (active) {
      var header = document.querySelector('#app header.top, header.top');
      var height = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
      document.body.style.setProperty('--ph-home-top-offset', Math.max(52, height) + 'px');
    }
  }

  function observeHomePanel(home) {
    if (!home || observedHomePanel === home) return;
    if (homePanelObserver) homePanelObserver.disconnect();
    observedHomePanel = home;
    homePanelObserver = new MutationObserver(function () { syncHomeActiveState(home); });
    homePanelObserver.observe(home, {attributes: true, attributeFilter: ['class']});
    syncHomeActiveState(home);
  }

  function ensureWorkspaceNav(scene) {
    if (!scene) return null;
    var nav = document.getElementById('homeAtelierWorkspaceNav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'homeAtelierWorkspaceNav';
      nav.className = 'phome-workspace-nav';
      nav.setAttribute('aria-label', 'Presence 주요 공간');
      scene.insertBefore(nav, scene.firstChild || null);
    }
    return nav;
  }

  function renderWorkspaceNav() {
    var nav = ensureWorkspaceNav(document.getElementById('homeSceneSec'));
    if (!nav) return;
    var labels = [
      {key: 'home', icon: '⌂', label: 'Home'},
      {key: 'today', icon: '◉', label: 'Today'},
      {key: 'people', icon: '◎', label: 'People'},
      {key: 'progress', icon: '↗', label: 'Progress'},
      {key: 'profit', icon: '◆', label: 'Profit'},
      {key: 'admin', icon: '▣', label: 'Farm Office'}
    ].filter(function (item) { return workspaceVisible(item.key); });
    var buttons = labels.map(function (item) {
      var admin = item.key === 'admin';
      var badge = admin && pendingCount() ? '<span class="phome-nav-badge" aria-label="승인 대기 ' + pendingCount() + '건">' + pendingCount() + '</span>' : '';
      return '<button type="button" class="phome-workspace-button" data-atelier-workspace="' + item.key + '"' +
        (item.key === 'home' ? ' aria-current="page"' : '') + (admin ? ' data-admin="true" aria-label="관리자 전용 공간"' : '') + '>' +
        '<span class="phome-workspace-icon" aria-hidden="true">' + item.icon + '</span><span>' + item.label + '</span>' + badge + '</button>';
    }).join('');
    replaceMarkup(nav,
      '<div class="phome-workspace-brand"><i aria-hidden="true">P</i><span>프레젠스 Work Book<small>함께 가꾸는 동물농장</small></span></div>' +
      '<div class="phome-workspace-list">' + buttons + '</div>');
  }

  function ensureGlobalBrand() {
    var logo = document.querySelector('#app header.top .logo');
    if (!logo) return;
    var name = logo.querySelector('.nm');
    var tag = logo.querySelector('.tag');
    if (name && name.textContent.trim() !== '프레젠스 Work Book') name.textContent = '프레젠스 Work Book';
    if (tag && tag.textContent.trim() !== '함께 가꾸는 동물농장') tag.textContent = '함께 가꾸는 동물농장';
    var officeTitle = document.querySelector('#m-admin .sec-head h2');
    if (officeTitle && officeTitle.textContent.trim() !== 'Farm Office') officeTitle.textContent = 'Farm Office';
  }

  function removeLegacyEmojiDecoration() {
    var selectors = '#app main .mpanel h1,#app main .mpanel h2,#app main .mpanel h3,#app main .mpanel .ah b,#app main .mpanel button,#app main .mpanel .phome-tree-title';
    document.querySelectorAll(selectors).forEach(function (element) {
      var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      var textNode = walker.nextNode();
      while (textNode && !textNode.nodeValue.trim()) textNode = walker.nextNode();
      if (!textNode) return;
      textNode.nodeValue = textNode.nodeValue.replace(/^[\s\uFE0F\u200D]*(?:\p{Extended_Pictographic}[\uFE0F\u200D]*)+\s*/u, '');
    });
  }

  function migrateLegacyHomeOrder() {
    var data = appState();
    var order = data && data.homeOrder;
    if (!Array.isArray(order) || order.indexOf('treeSecHome') < 0 || order.indexOf('homeSceneSec') >= 0) return;
    var seen = {};
    var migrated = order.map(function (id) {
      return id === 'treeSecHome' ? 'homeSceneSec' : id;
    }).filter(function (id) {
      if (!id || seen[id]) return false;
      seen[id] = true;
      return true;
    });
    data.homeOrder = migrated;
    if (typeof window.__applyHomeOrder === 'function' && !document.body.classList.contains('home-editing')) {
      window.requestAnimationFrame(function () {
        try { window.__applyHomeOrder(migrated); } catch (error) {}
      });
    }
  }

  var LEGACY_HOME_OWNERS = {
    coopSec: 'profit',
    homeDashSec: 'workspace-navigation',
    quickSec: 'custom-quickslots',
    gbSec: 'today',
    todaySec: 'today',
    attendSec: 'today',
    celebSec: 'today',
    praiseSec: 'today'
  };

  function saveLegacyVisibility(element) {
    if (!element || element.dataset.atelierHomeLegacy === 'true') return;
    element.dataset.atelierHomeLegacy = 'true';
    element.dataset.atelierPreviousHidden = element.hidden ? 'true' : 'false';
    element.dataset.atelierPreviousInert = element.hasAttribute('inert') ? 'true' : 'false';
    element.dataset.atelierPreviousAriaHidden = element.hasAttribute('aria-hidden') ? element.getAttribute('aria-hidden') : '__none__';
  }

  function hideLegacyFromHome(element, owner) {
    if (!element) return;
    saveLegacyVisibility(element);
    element.dataset.atelierWorkspaceOwner = owner || 'workspace';
    element.hidden = true;
    element.setAttribute('aria-hidden', 'true');
    element.setAttribute('inert', '');
  }

  function restoreLegacyVisibility(element) {
    if (!element || element.dataset.atelierHomeLegacy !== 'true') return;
    element.hidden = element.dataset.atelierPreviousHidden === 'true';
    if (element.dataset.atelierPreviousInert === 'true') element.setAttribute('inert', '');
    else element.removeAttribute('inert');
    if (element.dataset.atelierPreviousAriaHidden === '__none__') element.removeAttribute('aria-hidden');
    else element.setAttribute('aria-hidden', element.dataset.atelierPreviousAriaHidden || 'false');
    delete element.dataset.atelierHomeLegacy;
    delete element.dataset.atelierPreviousHidden;
    delete element.dataset.atelierPreviousInert;
    delete element.dataset.atelierPreviousAriaHidden;
  }

  function relocateTodayLegacy() {
    var todayHost = document.getElementById('todayWorkspaceBody');
    var social = document.getElementById('gbSec');
    if (!todayHost || !social || social.parentNode === todayHost) return;
    restoreLegacyVisibility(social);
    social.dataset.atelierWorkspaceOwner = 'today';
    todayHost.appendChild(social);
  }

  function syncLegacyHomeOwnership(wrap) {
    if (!wrap) return;
    relocateTodayLegacy();

    var hero = wrap.querySelector(':scope > .hero');
    if (hero) hideLegacyFromHome(hero, 'home-scene');

    Object.keys(LEGACY_HOME_OWNERS).forEach(function (id) {
      var element = document.getElementById(id);
      if (!element) return;
      if (element.parentNode === wrap) hideLegacyFromHome(element, LEGACY_HOME_OWNERS[id]);
      else restoreLegacyVisibility(element);
    });
  }

  function ensureScene() {
    var home = document.getElementById('m-home');
    var wrap = home && home.querySelector(':scope > .wrap');
    var tree = document.getElementById('treeSecHome');
    if (!home || !wrap || !tree) return null;

    document.body.classList.add('presence-atelier-home');
    home.classList.add('phome-home');
    ensureRuntimeStyle();
    observeHomePanel(home);

    var scene = document.getElementById('homeSceneSec');
    if (!scene) {
      scene = document.createElement('section');
      scene.id = 'homeSceneSec';
      scene.className = 'sec phome-scene';
      scene.setAttribute('aria-labelledby', 'homeAtelierTitle');
      scene.innerHTML =
        '<header class="phome-intro">' +
          '<div class="phome-intro-copy">' +
            '<span class="phome-kicker">PRESENCE WORK BOOK · HOME</span>' +
            '<h1 id="homeAtelierTitle">프레젠스 Work Book</h1>' +
            '<p id="homeAtelierGreeting">오늘의 작은 돌봄이 팀의 단단한 성장을 만듭니다.</p>' +
          '</div>' +
        '</header>' +
        '<div class="phome-grid">' +
          '<div id="homeAtelierCard" class="atelier-tree-card"></div>' +
          '<aside id="homeFieldJournalCard" aria-live="polite" aria-label="오늘의 필드 저널"></aside>' +
        '</div>' +
        '<section class="phome-timeline" aria-labelledby="homeAtelierTimelineTitle">' +
          '<h2 id="homeAtelierTimelineTitle">우리 농장의 오늘</h2>' +
          '<div id="homeAtelierTimeline" class="phome-timeline-list"></div>' +
        '</section>' +
        '<section class="phome-shortcuts" aria-labelledby="homeAtelierShortcutTitle">' +
          '<h2 id="homeAtelierShortcutTitle">나의 바로가기</h2>' +
          '<p class="phome-shortcuts-copy">돋보기로 기능을 찾거나 ＋ 버튼으로 자주 쓰는 공간을 직접 구성하세요.</p>' +
          '<div id="homeAtelierQuickslotHost"></div>' +
        '</section>';
      var first = wrap.firstElementChild;
      if (first && first.id === 'homeQuickDock') first = first.nextElementSibling;
      wrap.insertBefore(scene, first || null);
    }

    scene.classList.add('sec', 'phome-scene');
    ensureWorkspaceNav(scene);
    migrateLegacyHomeOrder();
    syncLegacyHomeOwnership(wrap);
    var card = document.getElementById('homeAtelierCard');
    if (card && tree.parentNode !== card) card.appendChild(tree);
    var journal = document.getElementById('homeFieldJournalCard');
    if (journal) journal.classList.add('phome-paper-journal');
    var shortcuts = scene.querySelector('.phome-shortcuts');
    if (shortcuts && !shortcuts.querySelector('.phome-shortcuts-copy')) {
      var shortcutTitle = shortcuts.querySelector('h2');
      var shortcutCopy = document.createElement('p');
      shortcutCopy.className = 'phome-shortcuts-copy';
      shortcutCopy.textContent = '돋보기로 기능을 찾거나 ＋ 버튼으로 자주 쓰는 공간을 직접 구성하세요.';
      if (shortcutTitle && shortcutTitle.nextSibling) shortcuts.insertBefore(shortcutCopy, shortcutTitle.nextSibling);
      else shortcuts.appendChild(shortcutCopy);
    }
    tree.classList.add('phome-tree-section');
    observeWrap(wrap);
    bindScene(scene);
    return scene;
  }

  function renderGreeting() {
    var element = document.getElementById('homeAtelierGreeting');
    if (!element) return;
    var user = currentUser();
    var hour = new Date().getHours();
    var moment = hour < 11 ? '아침' : hour < 17 ? '오늘' : '저녁';
    var prefix = user && user.name ? escapeHtml(user.name) + '님, ' : '';
    var html = prefix + moment + '의 작은 돌봄이 팀의 단단한 성장을 만듭니다.';
    if (element.innerHTML !== html) element.innerHTML = html;
  }

  function journalRow(index, icon, title, detail, action, label) {
    return '<li class="phome-journal-item">' +
      '<span class="' + (index ? 'phome-journal-index' : 'phome-journal-icon') + '" aria-hidden="true">' + (index || icon) + '</span>' +
      '<span><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml(detail) + '</small></span>' +
      '<button type="button" data-atelier-action="' + escapeHtml(action) + '" aria-label="' + escapeHtml(label || title) + '">›</button>' +
    '</li>';
  }

  function renderJournal() {
    var host = document.getElementById('homeFieldJournalCard');
    var user = currentUser();
    if (!host) return;
    if (!user) {
      replaceMarkup(host,
        '<h2 class="phome-journal-title">오늘의 필드 저널<span class="phome-journal-subtitle">로그인하면 나에게 필요한 기록만 보여드려요.</span></h2>' +
        '<div class="phome-journal-empty">현재 사용자 정보를 안전하게 불러오는 중이에요.</div>');
      return;
    }

    var data = appState() || {};
    var water = data.waters && data.waters[user.uid];
    var watered = !!(water && water.last === todayKey());
    var appointments = appointmentSummary(user);
    var callbackReady = callbackConnected(user);
    var ownRows = '';
    ownRows += journalRow('1', '', '오늘 나무 돌봄', watered ? '오늘 물주기 완료' : '아직 물을 주지 않았어요', 'water', '오늘 나무에 물 주기');
    ownRows += journalRow('2', '', '나의 1 on 1', appointments.ownCount ? '예정 ' + appointments.ownCount + '건' : '예정된 예약 없음', 'oneonone', '나의 1 on 1 열기');
    ownRows += journalRow('3', '', '나의 콜백싯', callbackReady ? '안전하게 연결됨' : '연결 준비 중', 'cbjournal', '나의 콜백싯 열기');

    var founderHtml = '';
    if (isFounderView(user)) {
      var pending = pendingCount();
      founderHtml =
        '<section class="phome-journal-section" data-founder-only="true">' +
          '<div class="phome-journal-heading"><span>Farm Keeper 운영 요약</span><button type="button" data-atelier-action="admin">Farm Office ›</button></div>' +
          '<div class="phome-journal-metrics">' +
            '<div class="phome-journal-metric"><span>승인 대기</span><b>' + pending + '</b></div>' +
            '<div class="phome-journal-metric"><span>오늘 1 on 1</span><b>' + appointments.todayTotal + '</b></div>' +
            '<div class="phome-journal-metric"><span>나무 돌봄 누적</span><b>' + readProgress() + '</b></div>' +
          '</div>' +
        '</section>';
    }

    replaceMarkup(host,
      '<h2 class="phome-journal-title">오늘의 필드 저널<span class="phome-journal-subtitle">내 상태와 권한에 맞는 항목만 안전하게 표시합니다.</span></h2>' +
      '<section class="phome-journal-section">' +
        '<div class="phome-journal-heading"><span>나의 오늘</span><button type="button" data-atelier-action="today">Today ›</button></div>' +
        '<ol class="phome-journal-list">' + ownRows + '</ol>' +
      '</section>' + founderHtml);
  }

  function shortDate(date) {
    if (!date || date.length < 10) return '';
    return Number(date.slice(5, 7)) + '월 ' + Number(date.slice(8, 10)) + '일';
  }

  function renderTimeline() {
    var host = document.getElementById('homeAtelierTimeline');
    var user = currentUser();
    if (!host) return;
    if (!user) {
      replaceMarkup(host, '<div class="phome-timeline-item"><time>NOW</time>내 기록을 안전하게 연결하는 중이에요.</div>');
      return;
    }
    var data = appState() || {};
    var water = data.waters && data.waters[user.uid];
    var watered = !!(water && water.last === todayKey());
    var appointments = appointmentSummary(user);
    var tree = safeTreeSnapshot();
    var appointmentText = appointments.nextDate ? shortDate(appointments.nextDate) + ' 예약이 있어요.' : '예정된 1 on 1 예약이 없어요.';
    replaceMarkup(host,
      '<article class="phome-timeline-item"><time>TREE · NOW</time><b>' + escapeHtml(tree.stage) + '</b><br>현재 성장 ' + tree.progress + '% · 물주기 누적 ' + readProgress() + '회</article>' +
      '<article class="phome-timeline-item"><time>MY CARE · TODAY</time><b>' + (watered ? '오늘 돌봄 완료' : '오늘 돌봄 대기') + '</b><br>' + (watered ? '내일 다시 만나요.' : '나무에 물을 줄 수 있어요.') + '</article>' +
      '<article class="phome-timeline-item"><time>MY 1 ON 1</time><b>' + (appointments.nextDate ? '다음 예약 확인' : '예약 없음') + '</b><br>' + escapeHtml(appointmentText) + '</article>');
  }

  function syncQuickslotEmptyState() {
    var host = document.getElementById('homeAtelierQuickslotHost');
    var slots = document.getElementById('homeQuickSlots');
    if (!host) return;
    var empty = host.querySelector('.phome-quickslot-empty');
    if (!empty) {
      empty = document.createElement('button');
      empty.type = 'button';
      empty.className = 'phome-quickslot-empty';
      empty.setAttribute('aria-label', '자주 쓰는 기능 추가');
      empty.innerHTML = '<span aria-hidden="true">＋</span><b>자주 쓰는 기능 추가</b><small>필요한 공간을 바로가기로 등록하세요</small>';
      empty.addEventListener('click', function () {
        if (typeof window.openQuickslotPicker === 'function') window.openQuickslotPicker();
      });
      host.insertBefore(empty, host.firstChild);
    }
    var hasSlot = !!(slots && slots.querySelector('.hqd-slot'));
    empty.hidden = hasSlot;

    if (slots && observedQuickSlots !== slots) {
      if (quickSlotsObserver) quickSlotsObserver.disconnect();
      observedQuickSlots = slots;
      quickSlotsObserver = new MutationObserver(syncQuickslotEmptyState);
      quickSlotsObserver.observe(slots, {childList: true});
    }
  }

  function mountQuickDock() {
    var host = document.getElementById('homeAtelierQuickslotHost');
    var dock = document.getElementById('homeQuickDock');
    if (host && dock && dock.parentNode !== host) host.appendChild(dock);
    syncQuickslotEmptyState();
  }

  function avatarProfile() {
    try { return typeof window.presenceAvatarProfile === 'function' ? window.presenceAvatarProfile() : null; } catch (error) { return null; }
  }

  function avatarSignature(profile) {
    if (!profile) return 'fallback';
    var equipped = profile.equipped || {};
    return [
      profile.nickname || '', profile.color || '', profile.feather || '', profile.eye || '', profile.beak || '', profile.expression || '',
      equipped.back || '', equipped.body || '', equipped.neck || '', equipped.waist || '', equipped.head || '', equipped.wrist || '', equipped.feet || '', equipped.prop || '', equipped.weapon || ''
    ].join('|');
  }

  function companionArt(profile) {
    try {
      if (profile && typeof window.presencePetArt === 'function') {
        return window.presencePetArt(profile, null, 'coop');
      }
    } catch (error) {}
    return '<img src="assets/pets/presence-pet-base.png" alt="" draggable="false">';
  }

  function wateringCanSvg() {
    return '<svg class="atelier-can" viewBox="0 0 120 92" aria-hidden="true" focusable="false">' +
      '<defs><linearGradient id="atelierCanBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8b16d"/><stop offset="1" stop-color="#718052"/></linearGradient></defs>' +
      '<path d="M31 36h51v39c0 8-6 13-14 13H44c-8 0-13-6-13-14V36Z" fill="url(#atelierCanBody)" stroke="#3c442c" stroke-width="4"/>' +
      '<path d="M42 38c0-18 32-18 32 0" fill="none" stroke="#e4c181" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M82 48 111 30l5 10-31 22" fill="#7b8958" stroke="#3c442c" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="m108 27 10-5 2 8-7 6" fill="#d8b16d" stroke="#3c442c" stroke-width="3"/>' +
      '<circle cx="46" cy="58" r="5" fill="#f0d49c" opacity=".9"/>' +
    '</svg>';
  }

  function ensureCompanion() {
    var stage = document.querySelector('#treeSecHome .tree-stage');
    if (!stage) return null;
    var companion = document.getElementById('homeWateringCompanion');
    if (!companion) {
      companion = document.createElement('div');
      companion.id = 'homeWateringCompanion';
      companion.className = 'atelier-waterer';
      companion.setAttribute('role', 'img');
      companion.setAttribute('aria-label', '나의 병아리가 물뿌리개로 나무를 돌봅니다');
      companion.innerHTML = '<div class="atelier-pet-slot presence-pet-art" aria-hidden="true"></div>' + wateringCanSvg() + '<span class="atelier-drops" aria-hidden="true"></span>';
      stage.appendChild(companion);
    } else if (companion.parentNode !== stage) {
      stage.appendChild(companion);
    }
    var profile = avatarProfile();
    var signature = avatarSignature(profile);
    var slot = companion.querySelector('.atelier-pet-slot');
    if (slot && signature !== companionSignature && !companion.classList.contains('is-watering')) {
      companion.classList.toggle('is-fallback', !profile);
      replaceMarkup(slot, profile ? companionArt(profile) : '');
      companionSignature = signature;
    }
    return companion;
  }

  function playWateringCompanion() {
    var companion = ensureCompanion();
    if (!companion) return;
    window.clearTimeout(waterTimer);
    companion.classList.remove('is-watering');
    companion.setAttribute('aria-label', '물주기 완료. 나의 병아리가 나무에 물을 주었습니다');
    void companion.offsetWidth;
    companion.classList.add('is-watering');
    waterTimer = window.setTimeout(function () {
      companion.classList.remove('is-watering');
      companion.setAttribute('aria-label', '나의 병아리가 물뿌리개로 나무를 돌봅니다');
      scheduleRender();
    }, 1750);
  }

  function wrapperChainContainsAtelier(fn) {
    var seen = [];
    while (typeof fn === 'function' && seen.indexOf(fn) < 0) {
      if (fn.__presenceAtelierWaterWrapper) return true;
      seen.push(fn);
      fn = fn.__presenceOriginal;
    }
    return false;
  }

  function hookWaterTree() {
    var original = window.waterTree;
    if (typeof original !== 'function' || wrapperChainContainsAtelier(original)) return;
    function wrappedWaterTree() {
      var before = readProgress();
      var result = original.apply(this, arguments);
      var after = readProgress();
      if (after > before) {
        playWateringCompanion();
        window.setTimeout(scheduleRender, 0);
        window.setTimeout(scheduleRender, 650);
        window.setTimeout(scheduleRender, 1250);
      }
      return result;
    }
    wrappedWaterTree.__presenceAtelierWaterWrapper = true;
    wrappedWaterTree.__presenceOriginal = original;
    window.waterTree = wrappedWaterTree;
  }

  function bindScene(scene) {
    if (!scene || scene.dataset.atelierBound === 'true') return;
    scene.dataset.atelierBound = 'true';
    scene.addEventListener('click', function (event) {
      var workspace = event.target.closest('[data-atelier-workspace]');
      if (workspace && scene.contains(workspace)) {
        var key = workspace.getAttribute('data-atelier-workspace');
        if (key === 'admin' && !isFounderView(currentUser())) return;
        openWorkspace(key);
        window.setTimeout(function () { syncHomeActiveState(); }, 0);
        return;
      }
      var button = event.target.closest('[data-atelier-action]');
      if (!button || !scene.contains(button)) return;
      var action = button.getAttribute('data-atelier-action');
      if (action === 'water') {
        var waterButton = document.getElementById('waterBtn');
        if (waterButton) waterButton.click();
      } else if (action === 'today' || action === 'oneonone' || action === 'cbjournal' || action === 'admin') {
        openTab(action);
      }
    });
  }

  function observeWrap(wrap) {
    if (!wrap || observedWrap === wrap) return;
    if (wrapObserver) wrapObserver.disconnect();
    observedWrap = wrap;
    wrapObserver = new MutationObserver(function (mutations) {
      var relevant = mutations.some(function (mutation) {
        return Array.prototype.some.call(mutation.addedNodes, function (node) {
          return node.nodeType === 1 && (node.id === 'homeQuickDock' || node.id === 'treeSecHome' || node.id === 'homeSceneSec' || node.classList.contains('hero') || LEGACY_HOME_OWNERS[node.id]);
        }) || Array.prototype.some.call(mutation.removedNodes, function (node) {
          return node.nodeType === 1 && (node.id === 'homeQuickDock' || node.id === 'treeSecHome' || node.id === 'homeSceneSec' || node.classList.contains('hero') || LEGACY_HOME_OWNERS[node.id]);
        });
      });
      if (relevant) scheduleRender();
    });
    wrapObserver.observe(wrap, {childList: true});
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    window.requestAnimationFrame(function () {
      renderQueued = false;
      renderPresenceAtelierHome();
    });
  }

  function renderPresenceAtelierHome() {
    if (rendering) return;
    rendering = true;
    try {
      ensureGlobalBrand();
      removeLegacyEmojiDecoration();
      if (!ensureScene()) return;
      renderWorkspaceNav();
      renderGreeting();
      renderJournal();
      renderTimeline();
      mountQuickDock();
      ensureCompanion();
      hookWaterTree();
      removeLegacyEmojiDecoration();
    } finally {
      rendering = false;
    }
  }

  window.renderPresenceAtelierHome = renderPresenceAtelierHome;
  window.addEventListener('presence:watered', scheduleRender);

  function boot() {
    renderPresenceAtelierHome();
    [280, 760, 1500, 2800, 4800].forEach(function (delay) { window.setTimeout(renderPresenceAtelierHome, delay); });
    window.setInterval(renderPresenceAtelierHome, 6500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
  else boot();
})();
