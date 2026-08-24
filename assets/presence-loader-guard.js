(function () {
  'use strict';

  var RECOVERY_MS = 6000;
  var recoveryTimer = 0;
  var originalShow = null;
  var originalHide = null;
  var recovering = false;
  var avatarTimer = 0;

  function loader() {
    return document.getElementById('presenceGameLoader');
  }

  function loaderIsVisible() {
    var element = loader();
    return !!(element && element.classList.contains('show'));
  }

  function currentUser() {
    if (window.me) return window.me;
    try {
      return typeof me !== 'undefined' ? me : null;
    } catch (error) {
      return null;
    }
  }

  function currentState() {
    if (window.state) return window.state;
    try {
      return typeof state !== 'undefined' ? state : null;
    } catch (error) {
      return null;
    }
  }

  function readLocalProfile(user) {
    if (!user) return null;
    try {
      return JSON.parse(localStorage.getItem('presence_pet_' + user.uid) || 'null');
    } catch (error) {
      return null;
    }
  }

  function rememberedProfile() {
    var best = null;
    var bestTime = -1;
    try {
      for (var index = 0; index < localStorage.length; index += 1) {
        var key = localStorage.key(index);
        if (!key || key.indexOf('presence_pet_') !== 0) continue;
        var value = JSON.parse(localStorage.getItem(key) || 'null');
        if (!value) continue;
        var time = Number(value.updatedAt || value.adoptedAt || 0);
        if (time >= bestTime) {
          best = value;
          bestTime = time;
        }
      }
    } catch (error) {}
    return best;
  }

  function rememberedSource() {
    try {
      var src = localStorage.getItem('presence_last_avatar_src') || '';
      if (/^assets\/pets\/avatar-(scholar|cape|courier|raincoat|floral|sailor|strawhat|backpack|scarf)\.png$/.test(src)) {
        return src;
      }
    } catch (error) {}
    return '';
  }

  function loaderProfile(user) {
    if (!user) return rememberedProfile();
    try {
      if (typeof window.presenceAvatarProfile === 'function') {
        return window.presenceAvatarProfile();
      }
    } catch (error) {}
    var stateValue = currentState();
    var remote = user && stateValue && stateValue.petProfiles && stateValue.petProfiles[user.uid] || null;
    var local = readLocalProfile(user);
    return Number(local && local.updatedAt || 0) > Number(remote && remote.updatedAt || 0) ? local : remote;
  }

  function avatarSource(profile) {
    if (!profile) return '';
    try {
      if (typeof window.presencePetArt === 'function') {
        var probe = document.createElement('div');
        probe.innerHTML = window.presencePetArt(profile, null, 'loader');
        var rendered = probe.querySelector('img');
        if (rendered) return rendered.getAttribute('src') || '';
      }
    } catch (error) {}
    var outfit = String(profile.outfit || '').toLowerCase();
    if (/^[a-z0-9-]+$/.test(outfit)) return 'assets/pets/avatar-' + outfit + '.png';
    return '';
  }

  function syncLoaderAvatar() {
    var hero = document.getElementById('pglHeroPet');
    var user = currentUser();
    if (!hero) return false;
    var profile = loaderProfile(user);
    var src = avatarSource(profile) || rememberedSource();
    if (!src) return false;
    var owner = user && user.uid || 'remembered';
    var signature = [owner, profile && profile.outfit || '', profile && profile.updatedAt || 0, src].join('|');
    if (hero.dataset.avatarSignature === signature && hero.getAttribute('src') === src) return true;
    var image = new Image();
    image.decoding = 'async';
    image.onload = function () {
      if (!hero.isConnected) return;
      hero.src = src;
      hero.dataset.avatarSignature = signature;
      hero.dataset.avatarOwner = owner;
      hero.alt = '';
      try{localStorage.setItem('presence_last_avatar_src',src);}catch(error){}
    };
    image.src = src;
    return true;
  }

  function stopAvatarSync() {
    window.clearInterval(avatarTimer);
    avatarTimer = 0;
  }

  function startAvatarSync() {
    stopAvatarSync();
    syncLoaderAvatar();
    avatarTimer = window.setInterval(function () {
      if (!loaderIsVisible()) {
        stopAvatarSync();
        return;
      }
      syncLoaderAvatar();
    }, 160);
  }

  function clearRecovery() {
    window.clearTimeout(recoveryTimer);
    recoveryTimer = 0;
  }

  function showLoginFallback() {
    var auth = document.getElementById('authGate');
    var app = document.getElementById('app');
    if (auth) { auth.classList.remove('hidden'); auth.setAttribute('aria-hidden', 'false'); }
    if (app && !document.body.classList.contains('app-on')) app.classList.add('hidden');
    try {
      if (typeof setLoginBusy === 'function') setLoginBusy(false);
      if (typeof window.renderAuth === 'function') window.renderAuth();
      else if (typeof renderAuth === 'function') renderAuth();
    } catch (error) {}
  }

  function finishLoader() {
    stopAvatarSync();
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
      startAvatarSync();
      return result;
    };

    window.hidePresenceLoader = function () {
      clearRecovery();
      stopAvatarSync();
      return originalHide.apply(this, arguments);
    };

    window.syncPresenceLoaderAvatar = syncLoaderAvatar;
    if (loaderIsVisible()) {
      armRecovery();
      startAvatarSync();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, {once: true});
  } else {
    install();
  }
})();
