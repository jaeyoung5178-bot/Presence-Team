(function () {
  'use strict';

  var renderQueued = false;
  var rendering = false;
  var observedWrap = null;
  var wrapObserver = null;
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

  function ensureScene() {
    var home = document.getElementById('m-home');
    var wrap = home && home.querySelector(':scope > .wrap');
    var tree = document.getElementById('treeSecHome');
    if (!home || !wrap || !tree) return null;

    document.body.classList.add('presence-atelier-home');
    home.classList.add('phome-home');

    var scene = document.getElementById('homeSceneSec');
    if (!scene) {
      scene = document.createElement('section');
      scene.id = 'homeSceneSec';
      scene.className = 'sec phome-scene';
      scene.setAttribute('aria-labelledby', 'homeAtelierTitle');
      scene.innerHTML =
        '<header class="phome-intro">' +
          '<div class="phome-intro-copy">' +
            '<span class="phome-kicker">PRESENCE ANIMAL FARM · HOME</span>' +
            '<h1 id="homeAtelierTitle">프레젠스 동물농장</h1>' +
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
          '<div id="homeAtelierQuickslotHost"></div>' +
        '</section>';
      var first = wrap.firstElementChild;
      if (first && first.id === 'homeQuickDock') first = first.nextElementSibling;
      wrap.insertBefore(scene, first || null);
    }

    scene.classList.add('sec', 'phome-scene');
    migrateLegacyHomeOrder();
    var card = document.getElementById('homeAtelierCard');
    if (card && tree.parentNode !== card) card.appendChild(tree);
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
          '<div class="phome-journal-heading"><span>관리자 운영 요약</span><button type="button" data-atelier-action="admin">Admin ›</button></div>' +
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

  function mountQuickDock() {
    var host = document.getElementById('homeAtelierQuickslotHost');
    var dock = document.getElementById('homeQuickDock');
    if (host && dock && dock.parentNode !== host) host.appendChild(dock);
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
          return node.nodeType === 1 && (node.id === 'homeQuickDock' || node.id === 'treeSecHome' || node.id === 'homeSceneSec');
        }) || Array.prototype.some.call(mutation.removedNodes, function (node) {
          return node.nodeType === 1 && (node.id === 'homeQuickDock' || node.id === 'treeSecHome' || node.id === 'homeSceneSec');
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
      if (!ensureScene()) return;
      renderGreeting();
      renderJournal();
      renderTimeline();
      mountQuickDock();
      ensureCompanion();
      hookWaterTree();
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
