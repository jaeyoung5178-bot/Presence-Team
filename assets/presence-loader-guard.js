(function () {
  'use strict';

  var RECOVERY_MS = 9000;
  var recoveryTimer = 0;
  var originalShow = null;
  var originalHide = null;
  var recovering = false;

  function loader() {
    return document.getElementById('presenceGameLoader');
  }

  function loaderIsVisible() {
    var element = loader();
    return !!(element && element.classList.contains('show'));
  }

  function clearRecovery() {
    window.clearTimeout(recoveryTimer);
    recoveryTimer = 0;
  }

  function showLoginFallback() {
    var auth = document.getElementById('authGate');
    var app = document.getElementById('app');
    if (auth) auth.classList.remove('hidden');
    if (app && !document.body.classList.contains('app-on')) app.classList.add('hidden');
    try {
      if (typeof window.renderAuth === 'function') window.renderAuth();
      else if (typeof renderAuth === 'function') renderAuth();
    } catch (error) {}
  }

  function finishLoader() {
    try {
      if (originalHide) originalHide();
      else {
        var element = loader();
        if (element) element.classList.remove('show', 'complete');
      }
    } catch (error) {
      var element = loader();
      if (element) element.classList.remove('show', 'complete');
    }
  }

  function recover() {
    if (recovering || !loaderIsVisible()) return;
    recovering = true;
    clearRecovery();

    var message = document.getElementById('presenceGameLoaderMsg');
    if (message) message.textContent = '연결이 지연되어 안전하게 복구하는 중…';

    try {
      if (typeof me !== 'undefined' && me) {
        window.__presenceEntryPass = true;
        if (typeof window.enterApp === 'function') window.enterApp();
        else if (typeof enterApp === 'function') enterApp();
      } else {
        showLoginFallback();
      }
    } catch (error) {
      showLoginFallback();
    }

    window.setTimeout(function () {
      if (loaderIsVisible()) finishLoader();
      recovering = false;
    }, 500);
  }

  function armRecovery() {
    clearRecovery();
    recoveryTimer = window.setTimeout(recover, RECOVERY_MS);
  }

  function install() {
    if (window.__presenceLoaderGuardInstalled) return;
    if (typeof window.showPresenceLoader !== 'function' ||
        typeof window.hidePresenceLoader !== 'function') {
      window.setTimeout(install, 60);
      return;
    }

    window.__presenceLoaderGuardInstalled = true;
    originalShow = window.showPresenceLoader;
    originalHide = window.hidePresenceLoader;

    window.showPresenceLoader = function () {
      var result = originalShow.apply(this, arguments);
      armRecovery();
      return result;
    };

    window.hidePresenceLoader = function () {
      clearRecovery();
      return originalHide.apply(this, arguments);
    };

    if (loaderIsVisible()) armRecovery();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, {once: true});
  } else {
    install();
  }
})();
