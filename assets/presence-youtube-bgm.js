/* Compatibility filename; the user control is visual effects only. No audio or YouTube. */
(function () {
  'use strict';
  var KEY = 'presence_local_season_effects.';
  var enabled = false;
  var button = null;
  var originalSet = null;
  var installed = false;
  var seasonHint = '';
  var preferenceUid = '';
  function readPreference() {
    var uid = active() ? String(actor().uid || '') : '';
    if (uid === preferenceUid) return;
    preferenceUid = uid;
    enabled = false;
    try { if (uid) enabled = localStorage.getItem(KEY + uid) === 'on'; } catch (ignore) {}
  }

  function actor() { return typeof me !== 'undefined' ? me : null; }
  function active() { var u = actor(); return !!(u && u.status === 'active'); }
  function season() {
    if (seasonHint && seasonHint !== 'auto') return seasonHint;
    if (document.body.classList.contains('presence-christmas')) return 'winter';
    if (window.PresenceWorkspace && typeof window.PresenceWorkspace.currentSeason === 'function') {
      return window.PresenceWorkspace.currentSeason();
    }
    var month = new Date().getMonth() + 1;
    return month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
  }
  function mode() { return {winter: 'xmas', spring: 'sakura', summer: 'sun', autumn: 'leaves'}[season()] || null; }
  function silence() {
    try {
      if (typeof SND === 'undefined') return;
      SND.stop();
      if (!SND.__presenceVisualOnly) {
        SND.play = function () { SND.stop(); };
        SND.__presenceVisualOnly = true;
      }
    } catch (ignore) {}
  }
  function renderButton() {
    if (!button) return;
    document.body.classList.toggle('presence-music-authenticated', active());
    var label = (season() === 'winter' ? '크리스마스 효과 ' : '분위기 효과 ') + (enabled ? '끄기' : '켜기');
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-checked', String(enabled));
    button.title = label;
    button.querySelector('[data-effect-label]').textContent = label;
    button.querySelector('[data-effect-icon]').textContent = season() === 'winter' ? '❄' : '✧';
    button.classList.toggle('is-on', enabled);
  }
  function apply() {
    silence();
    placeCanvas();
    if (originalSet) originalSet(active() && enabled && !document.hidden ? mode() : null);
    renderButton();
  }
  function installRenderer() {
    if (installed || typeof FX === 'undefined' || !FX || typeof FX.set !== 'function') return;
    originalSet = FX.set.bind(FX);
    FX.set = function () { apply(); };
    installed = true;
  }
  function placeCanvas() {
    var canvas = document.getElementById('fxCanvas');
    if (!canvas) return;
    var stage = active() && enabled ? document.querySelector('#m-home.active #treeSecHome:not([hidden]) .tree-stage') : null;
    var host = stage && stage.getClientRects().length ? stage : document.body;
    var kind = host === document.body ? 'page' : 'garden';
    if (canvas.parentNode !== host || canvas.dataset.sceneHost !== kind) {
      canvas.dataset.sceneHost = kind;
      host.appendChild(canvas);
      if (typeof FX !== 'undefined' && typeof FX.resize === 'function') FX.resize();
    }
  }
  function sync() { readPreference(); installRenderer(); apply(); }
  function setEnabled(value) {
    if (!active()) return false;
    readPreference();
    enabled = value === true;
    try { if (preferenceUid) localStorage.setItem(KEY + preferenceUid, enabled ? 'on' : 'off'); } catch (ignore) {}
    sync();
    return enabled;
  }
  function toggle() { readPreference(); return setEnabled(!enabled); }
  function suspend() {
    silence();
    readPreference();
    placeCanvas();
    if (originalSet) originalSet(null);
    renderButton();
  }
  function boot() {
    document.getElementById('presenceMusicPanel')?.remove();
    document.getElementById('presenceBgmPlayer')?.remove();
    button = document.getElementById('presenceBgmQuick') || document.createElement('button');
    button.id = 'presenceBgmQuick';
    button.type = 'button';
    button.setAttribute('role', 'switch');
    button.removeAttribute('aria-controls');
    button.removeAttribute('aria-expanded');
    button.innerHTML = '<span data-effect-icon aria-hidden="true">❄</span><span data-effect-label></span><span class="presence-effect-dot" aria-hidden="true"></span>';
    button.onclick = toggle;
    if (!button.parentNode) document.body.appendChild(button);
    document.body.classList.add('presence-effects-ready', 'presence-music-ready');
    sync();
    window.addEventListener('presence:seasonchange', function (event) {
      if (event.detail && /^(auto|winter|spring|summer|autumn)$/.test(event.detail.season || '')) seasonHint = event.detail.season;
      sync();
    });
    document.addEventListener('visibilitychange', apply);
  }
  window.PresenceChristmasEffects = Object.freeze({toggle: toggle, setEnabled: setEnabled, sync: sync, get enabled() { return enabled; }, get mode() { return mode(); }});
  // Kept for older workspace callers. These methods never create media or play sound.
  window.PresenceBgm = Object.freeze({play: function () { setEnabled(true); }, pause: function () { setEnabled(false); }, stop: suspend, toggle: toggle, togglePanel: toggle, setTrack: sync, get playing() { return false; }, get videoId() { return null; }});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
