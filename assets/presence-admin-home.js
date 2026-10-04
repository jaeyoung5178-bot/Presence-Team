(function (global) {
  'use strict';

  var session = { root: null, actor: null, snapshot: null, actorUid: '', mode: 'admin', onModeChange: null, onNavigate: null };
  var historyBound = false;

  function resolveRoot(target) {
    if (!target) return null;
    if (typeof target === 'string') return document.getElementById(target);
    return target && typeof target === 'object' ? target : null;
  }

  function liveActor(options) {
    if (options && Object.prototype.hasOwnProperty.call(options, 'actor')) return options.actor;
    try { return typeof me !== 'undefined' ? me : null; } catch (error) { return null; }
  }

  function liveState(options) {
    if (options && options.state) return options.state;
    try { return typeof state !== 'undefined' && state ? state : (session.snapshot || {}); } catch (error) { return session.snapshot || {}; }
  }

  function currentActor() {
    try { if (typeof me !== 'undefined') return me; } catch (error) {}
    return session.actor;
  }

  function isAuthorized(actor) {
    if (!actor || actor.status !== 'active') return false;
    try {
      if (typeof isFounder === 'function') return !!isFounder(actor);
    } catch (error) {}
    if (global.__previewRole || global.__adminOff) return false;
    return actor.uid === 'admin' || actor.isFounder === true || actor.isAdmin === true || actor.role === 'ADMIN' || actor.role === 'FOUNDER';
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeList(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function values(value) {
    return value && typeof value === 'object' ? Object.keys(value).map(function (key) { return value[key]; }) : [];
  }

  function isTestUser(user) {
    try { if (typeof isTestBot === 'function') return !!isTestBot(user); } catch (error) {}
    return !!(user && user.test === true);
  }

  function approvalRows(snapshot) {
    try {
      if (typeof pendingApprovalUsers === 'function') return safeList(pendingApprovalUsers());
    } catch (error) {}
    return values(snapshot.users).filter(function (user) { return user && user.status === 'pending'; });
  }

  function surveyRows(snapshot) {
    try {
      if (typeof promotionRecords === 'function') {
        return safeList(promotionRecords()).filter(function (record) { return record && record.status === 'pending'; });
      }
    } catch (error) {}
    var rows = [];
    values(snapshot.promotionSurveys).forEach(function (entry) {
      if (!entry || typeof entry !== 'object') return;
      if (entry.status) rows.push(entry);
      else values(entry).forEach(function (record) { if (record) rows.push(record); });
    });
    return rows.filter(function (record) { return record && record.status === 'pending'; });
  }

  function activeRows(snapshot) {
    return values(snapshot.users).filter(function (user) {
      return user && user.status === 'active' && !isTestUser(user);
    });
  }

  function departedCount(snapshot) {
    var names = Object.create(null);
    safeList(snapshot.removedMembers).forEach(function (name) {
      var key = String(name || '').replace(/\s/g, '');
      if (key) names[key] = true;
    });
    Object.keys(snapshot.memberInfo || {}).forEach(function (memberName) {
      var entry = snapshot.memberInfo[memberName];
      if (!entry || !entry.left) return;
      var name = entry.name || entry.memberName || memberName;
      var key = String(name).replace(/\s/g, '');
      if (key) names[key] = true;
    });
    return Object.keys(names).length;
  }

  function badge(count, label) {
    return count > 0
      ? '<span class="pah-badge" aria-label="' + esc(label) + ' ' + count + '건">' + count + '</span>'
      : '<span class="pah-ready" aria-label="' + esc(label) + ' 없음">READY</span>';
  }

  function actionCard(action, code, title, description, meta) {
    return '<button type="button" class="pah-action" data-pah-action="' + action + '">' +
      '<span class="pah-action-top"><span class="pah-action-code" aria-hidden="true">' + code + '</span>' + meta + '</span>' +
      '<span class="pah-action-copy"><strong>' + title + '</strong><small>' + description + '</small></span>' +
      '<span class="pah-action-go" aria-hidden="true">→</span>' +
      '</button>';
  }

  function modeSwitch(mode) {
    return '<div class="pah-mode-switch" role="group" aria-label="Home 화면 전환">' +
      '<button type="button" data-pah-mode="admin" aria-pressed="' + (mode === 'admin' ? 'true' : 'false') + '" class="' + (mode === 'admin' ? 'is-active' : '') + '">Admin Home</button>' +
      '<button type="button" data-pah-mode="general" aria-pressed="' + (mode === 'general' ? 'true' : 'false') + '" class="' + (mode === 'general' ? 'is-active' : '') + '">일반 Home</button>' +
    '</div>';
  }

  function go(name) {
    try {
      if (typeof goTab === 'function') { goTab(name); return true; }
    } catch (error) {}
    if (typeof global.goTab === 'function') { global.goTab(name); return true; }
    return false;
  }

  function historyState(extra) {
    var base = {};
    try {
      if (global.history && global.history.state && typeof global.history.state === 'object') {
        Object.keys(global.history.state).forEach(function (key) { base[key] = global.history.state[key]; });
      }
    } catch (error) {}
    Object.keys(extra || {}).forEach(function (key) { base[key] = extra[key]; });
    return base;
  }

  function markHomeHistory(mode) {
    try {
      if (!global.history || typeof global.history.replaceState !== 'function') return;
      global.history.replaceState(historyState({ presenceAdminHome: mode === 'admin' ? 'home' : 'general', presenceAdminHomeVersion: 1 }), document.title, global.location && global.location.href);
    } catch (error) {}
  }

  function pushDestinationHistory(name) {
    markHomeHistory('admin');
    try {
      if (global.history && typeof global.history.pushState === 'function') {
        global.history.pushState(historyState({ presenceAdminHome: 'destination', presenceAdminHomeDestination: name, presenceAdminHomeVersion: 1 }), document.title, global.location && global.location.href);
      }
    } catch (error) {}
  }

  function navigate(name) {
    pushDestinationHistory(name);
    if (typeof session.onNavigate === 'function') {
      try { session.onNavigate({ from: 'adminhome', to: name }); } catch (error) {}
    }
    return go(name);
  }

  function scrollTarget(selector, focus) {
    var target = null;
    try { target = document.querySelector(selector); } catch (error) {}
    if (!target) return false;
    try {
      var collapsed = typeof target.closest === 'function' ? target.closest('.adm-card.adm-collapsed') : null;
      if (collapsed && collapsed.classList) collapsed.classList.remove('adm-collapsed');
    } catch (error) {}
    var reduce = false;
    try { reduce = !!global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (error) {}
    try { target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center', inline: 'nearest' }); }
    catch (error) { try { target.scrollIntoView(); } catch (ignored) {} }
    if (focus && typeof target.focus === 'function') {
      try { target.focus({ preventScroll: true }); } catch (error) { try { target.focus(); } catch (ignored) {} }
    }
    return true;
  }

  function afterAdmin(selector, focus) {
    navigate('admin');
    var found = scrollTarget(selector, focus);
    if (!found || focus) global.setTimeout(function () { scrollTarget(selector, focus); }, 140);
  }

  function runAction(action) {
    var actor = currentActor();
    if (!isAuthorized(actor) || !session.actor || actor.uid !== session.actor.uid) return;
    if (action === 'recap-repair') {
      if (typeof global.recapStudioMigrateV3 !== 'function') {
        if (typeof global.toast === 'function') global.toast('리캡 복구 도구를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
        return;
      }
      if (typeof global.toast === 'function') global.toast('리캡 기간 배정을 검증하고 복구하고 있어요…');
      global.recapStudioMigrateV3().then(function (report) {
        var conflicts = (report && report.conflicts || []).length;
        var unresolved = (report && report.unresolved || []).length;
        if (report && report.blocked) {
          if (typeof global.toast === 'function') global.toast('복구 전 검수가 필요한 항목이 ' + (conflicts + unresolved) + '건 있습니다.');
          return;
        }
        if (typeof global.toast === 'function') global.toast('✅ 리캡 기간 배정 복구 완료 · ' + Number(report && report.written || 0) + '건 반영');
      }).catch(function (error) {
        console.error('[Admin Home recap repair]', error);
        if (typeof global.toast === 'function') global.toast('리캡 복구에 실패했습니다. 연결 상태를 확인해 주세요.');
      });
      return;
    }
    if (action === 'survey') { navigate('survey'); return; }
    if (action === 'new-member') { afterAdmin('#newMemberIn', true); return; }
    if (action === 'permissions') { afterAdmin('.mem-rows', false); return; }
    if (action === 'departed') { afterAdmin('#departedBody', false); return; }
    if (action === 'approvals') {
      try {
        if (typeof openPendingApprovals === 'function') { openPendingApprovals(); return; }
      } catch (error) {}
      if (typeof global.openPendingApprovals === 'function') { global.openPendingApprovals(); return; }
      afterAdmin('#pendList', false);
    }
  }

  function syncAdminActive(root, active) {
    if (!root || typeof root.closest !== 'function') return;
    var panel = null;
    try { panel = root.closest('#m-home'); } catch (error) {}
    if (!panel || !panel.classList || typeof panel.classList.toggle !== 'function') return;
    panel.classList.toggle('pah-admin-active', active === true);
  }

  function emitMode(root) {
    if (!root) return;
    syncAdminActive(root, session.mode === 'admin');
    root.setAttribute('data-pah-mode', session.mode);
    if (typeof session.onModeChange === 'function') {
      try { session.onModeChange(session.mode); } catch (error) {}
    }
    try {
      if (typeof global.CustomEvent === 'function' && typeof root.dispatchEvent === 'function') {
        root.dispatchEvent(new global.CustomEvent('presence:admin-home-mode', { bubbles: true, detail: { mode: session.mode } }));
      }
    } catch (error) {}
    markHomeHistory(session.mode);
  }

  function handlePopState(event) {
    var marker = event && event.state && event.state.presenceAdminHome;
    if (marker !== 'home') return false;
    var actor = currentActor();
    if (!session.root || !isAuthorized(actor) || !session.actor || actor.uid !== session.actor.uid) return false;
    session.mode = 'admin';
    go('home');
    render(session.root, { actor: actor, state: liveState({}), mode: 'admin', onModeChange: session.onModeChange, onNavigate: session.onNavigate });
    return true;
  }

  function bindHistory() {
    if (historyBound || typeof global.addEventListener !== 'function') return;
    historyBound = true;
    global.addEventListener('popstate', handlePopState);
  }

  function bind(root) {
    root.querySelectorAll('[data-pah-action]').forEach(function (button) {
      button.addEventListener('click', function () { runAction(button.dataset.pahAction); });
    });
    root.querySelectorAll('[data-pah-mode]').forEach(function (button) {
      button.addEventListener('click', function () { setMode(button.dataset.pahMode); });
    });
  }

  function clear(root) {
    if (!root) return;
    syncAdminActive(root, false);
    root.innerHTML = '';
    root.hidden = true;
    root.removeAttribute('data-pah-ready');
    root.removeAttribute('data-pah-mode');
  }

  function render(target, options) {
    var root = resolveRoot(target);
    var actor = liveActor(options || {});
    var snapshot = liveState(options || {});
    if (!root) return false;
    var nextUid = actor && actor.uid ? String(actor.uid) : '';
    var changedActor = nextUid !== session.actorUid;
    session.root = root;
    session.actor = actor;
    session.snapshot = snapshot;
    session.actorUid = nextUid;
    session.onModeChange = options && typeof options.onModeChange === 'function' ? options.onModeChange : session.onModeChange;
    session.onNavigate = options && typeof options.onNavigate === 'function' ? options.onNavigate : session.onNavigate;
    if (!isAuthorized(actor)) { clear(root); return false; }
    if (changedActor) session.mode = 'admin';
    if (options && (options.mode === 'admin' || options.mode === 'general')) session.mode = options.mode;

    root.hidden = false;
    root.setAttribute('data-pah-ready', 'true');
    if (session.mode === 'general') {
      root.innerHTML = '<section class="pah-general-shell" aria-label="Home 화면 모드">' +
        '<div><span>HOME VIEW</span><strong>일반 Home을 보고 있습니다</strong><small>관리 업무로 돌아갈 때 Admin Home을 선택하세요.</small></div>' +
        modeSwitch('general') +
      '</section>';
      bind(root);
      emitMode(root);
      return true;
    }

    var approvals = approvalRows(snapshot);
    var surveys = surveyRows(snapshot);
    var active = activeRows(snapshot);
    var departed = departedCount(snapshot);
    var attention = approvals.length + surveys.length;
    var name = esc(actor.name || '관리자');
    var summary = attention
      ? '지금 확인할 운영 항목이 <b>' + attention + '건</b> 있습니다. 필요한 화면으로 바로 이동하세요.'
      : '현재 긴급한 승인 항목은 없습니다. 팀 운영 화면으로 바로 이동할 수 있어요.';

    root.innerHTML = '<section class="pah-shell" aria-labelledby="pahTitle">' +
      '<div class="pah-mode-row"><span>HOME VIEW</span>' + modeSwitch('admin') + '</div>' +
      '<div class="pah-hero">' +
        '<div class="pah-heading">' +
          '<span class="pah-kicker">ADMIN HOME · OPERATIONS</span>' +
          '<h2 id="pahTitle">' + name + '님, 오늘의 운영 흐름입니다</h2>' +
          '<p>' + summary + '</p>' +
        '</div>' +
        '<dl class="pah-summary" aria-label="관리 운영 현황">' +
          '<div><dt>ACTIVE TEAM</dt><dd>' + active.length + '<small>명</small></dd></div>' +
          '<div class="' + (approvals.length ? 'is-alert' : '') + '"><dt>JOIN APPROVAL</dt><dd>' + approvals.length + '<small>건</small></dd></div>' +
          '<div class="' + (surveys.length ? 'is-alert' : '') + '"><dt>SURVEY QUEUE</dt><dd>' + surveys.length + '<small>건</small></dd></div>' +
        '</dl>' +
      '</div>' +
      '<div class="pah-section-head"><div><span>QUICK OPERATIONS</span><h3>자주 쓰는 관리 업무</h3></div><p>한 번의 클릭으로 기존 관리 화면을 엽니다.</p></div>' +
      '<div class="pah-actions" aria-label="관리자 빠른 실행">' +
        actionCard('recap-repair', 'RX', '리캡 배정 복구', '8·9·10월 팀 배정과 저장 경로를 검증하고 복구합니다.', '<span class="pah-status">REPAIR</span>') +
        actionCard('survey', 'SV', '설문 보기', '팀원 설문과 승진 응답을 확인합니다.', badge(surveys.length, '대기 설문')) +
        actionCard('new-member', '+', '신입 등록', '새 팀원을 등록하는 입력창으로 이동합니다.', '<span class="pah-status">CREATE</span>') +
        actionCard('permissions', 'AC', '권한 관리', '직급·매니저·섹터 권한을 관리합니다.', '<span class="pah-status">ACCESS</span>') +
        actionCard('departed', 'DP', '퇴사자 관리', '퇴사 기록과 재입사 대상을 관리합니다.', departed ? '<span class="pah-badge" aria-label="퇴사자 ' + departed + '명">' + departed + '</span>' : '<span class="pah-ready">CLEAR</span>') +
        actionCard('approvals', 'OK', '가입 승인', '가입 신청자를 검토하고 승인합니다.', badge(approvals.length, '가입 승인 대기')) +
      '</div>' +
    '</section>';
    bind(root);
    emitMode(root);
    return true;
  }

  function setMode(mode) {
    var next = mode === 'general' ? 'general' : 'admin';
    var actor = currentActor();
    if (!session.root || !isAuthorized(actor) || !session.actor || actor.uid !== session.actor.uid) return false;
    session.mode = next;
    render(session.root, { actor: actor, state: liveState({}), mode: next, onModeChange: session.onModeChange, onNavigate: session.onNavigate });
    return true;
  }

  function toggle() {
    return setMode(session.mode === 'admin' ? 'general' : 'admin');
  }

  function getMode() { return session.mode; }

  function reset(target) {
    var root = resolveRoot(target) || session.root;
    clear(root);
    session = { root: null, actor: null, snapshot: null, actorUid: '', mode: 'admin', onModeChange: null, onNavigate: null };
  }

  function invalidate() {
    if (!session.root) return false;
    return render(session.root, { actor: currentActor(), state: liveState({}), mode: session.mode, onModeChange: session.onModeChange, onNavigate: session.onNavigate });
  }

  function guardRoute(requested, actor, target) {
    var name = String(requested || '').toLowerCase();
    if (name !== 'adminhome' && name !== 'admin-home') return requested;
    var root = resolveRoot(target) || session.root;
    if (!isAuthorized(actor)) {
      reset(root);
      return 'home';
    }
    if (root) render(root, { actor: actor, state: liveState({}), mode: 'admin', onModeChange: session.onModeChange, onNavigate: session.onNavigate });
    return 'home';
  }

  bindHistory();
  global.PresenceAdminHome = Object.freeze({ render: render, reset: reset, invalidate: invalidate, setMode: setMode, toggle: toggle, getMode: getMode, guardRoute: guardRoute, handlePopState: handlePopState });
})(typeof window !== 'undefined' ? window : this);
