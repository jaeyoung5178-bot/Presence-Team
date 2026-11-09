/* One Christmas intro owner. Network readiness and the explicit skip button always remain authoritative. */
(function () {
  'use strict';
  var DURATION = 4500;
  var ART = 'assets/season/2026/christmas-gift-atelier-v2.webp';
  var PARTY = 'assets/season/2026/christmas-party-atelier-v2.webp';
  var root = null, shell = null, legacy = null, message = null, messageHome = null;
  var installed = false, sequenceStart = 0, running = false, ready = false, skipped = false;
  var finishTimer = null, knownStandard = false;
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var originalShow = null, originalHide = null;

  function christmas() { return document.body.classList.contains('presence-christmas'); }
  function elapsed() { return sequenceStart ? performance.now() - sequenceStart : 0; }

  function finish() {
    clearTimeout(finishTimer);
    running = false;
    if (root) root.classList.remove('show', 'complete', 'pci-reveal');
  }
  function skip() {
    skipped = true;
    clearTimeout(finishTimer);
    if (root) root.classList.add('pci-quiet');
    if (ready) finish();
  }

  function mount() {
    root = document.getElementById('presenceGameLoader');
    if (!root) return;
    legacy = root.querySelector('.pgl-cinema');
    if (legacy) legacy.classList.add('pci-legacy');
    message = document.getElementById('presenceGameLoaderMsg');
    if (message && !messageHome && !message.closest('.pci-shell')) messageHome = message.parentNode;
    shell = root.querySelector('.pci-shell');
    if (!shell) {
      shell = document.createElement('div');
      shell.className = 'pci-shell';
      shell.innerHTML = '<section class="pci-world" aria-hidden="true"><div class="pci-scene">' +
        '<div class="pci-light"></div><img class="pci-atelier" alt="" width="1536" height="1024">' +
        '<div class="pci-portal"><img class="pci-party" alt="" width="1536" height="1024">' +
        '<div class="pci-door pci-door-left"><i></i></div><div class="pci-door pci-door-right"><i></i></div></div>' +
        '<div class="pci-glasslight"></div><div class="pci-snow"><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
        '</div></section><section class="pci-console"><div class="pci-wordmark" aria-hidden="true">' +
        '<span class="pci-copy-first">Ready for winter?</span><span class="pci-copy-last">Let’s go, Presence!</span>' +
        '</div><div class="pci-loadbox"><div class="pci-message-slot"></div><div class="pci-connection" aria-hidden="true"><i></i></div></div>' +
        '<button class="pci-skip" type="button">건너뛰기</button></section>';
      var scene = shell.querySelector('.pci-scene');
      var art = shell.querySelector('.pci-atelier');
      art.decoding = 'async'; art.src = ART;
      art.onerror = function () { scene.classList.add('pci-art-unavailable'); };
      var party = shell.querySelector('.pci-party');
      party.decoding = 'async'; party.src = PARTY;
      party.onerror = function () { scene.classList.add('pci-party-unavailable'); };
      shell.querySelector('.pci-skip').onclick = skip;
      root.appendChild(shell);
    }
    if (christmas()) {
      if (message) shell.querySelector('.pci-message-slot').appendChild(message);
      root.classList.remove('pci-standard');
      root.classList.add('pci-owned');
    } else if (knownStandard) {
      if (message && messageHome) messageHome.appendChild(message);
      root.classList.remove('pci-owned', 'pci-reveal');
      root.classList.add('pci-standard');
    }
  }

  function startSequence() {
    mount();
    if (!root || !christmas()) return;
    clearInterval(window.__pglTimer);
    var percent = document.getElementById('pglPercent');
    if (percent) percent.textContent = '';
    if (running) return;
    running = true; ready = false; skipped = false;
    sequenceStart = performance.now();
    root.classList.remove('complete', 'pci-quiet', 'pci-reveal');
    void root.offsetWidth;
    root.classList.add('show', 'pci-reveal');
    clearTimeout(finishTimer);
    finishTimer = setTimeout(function () {
      if (root) root.classList.add('pci-quiet');
      if (ready) finish();
    }, DURATION);
  }

  function requestHide() {
    if (!root || !christmas()) { ready = true; finish(); return; }
    clearInterval(window.__pglTimer);
    ready = true;
    // User-requested readable sequence, never longer than 4.5 seconds after it began.
    if (!running || skipped || motion.matches || elapsed() >= DURATION) finish();
  }

  function install() {
    if (installed) return;
    installed = true;
    try { knownStandard = localStorage.getItem('presence_christmas_visual_hint') === 'off'; } catch (ignore) {}
    mount();
    originalShow = window.showPresenceLoader;
    originalHide = window.hidePresenceLoader;
    if (typeof originalShow === 'function') {
      window.showPresenceLoader = function () {
        var result = originalShow.apply(this, arguments);
        if (christmas()) startSequence();
        else mount();
        return result;
      };
    }
    if (typeof originalHide === 'function') window.hidePresenceLoader = requestHide;
    if (root?.classList.contains('show') && christmas()) startSequence();
    window.addEventListener('presence:seasonchange', function (event) {
      if (event.detail && typeof event.detail.christmas === 'boolean') knownStandard = !event.detail.christmas;
      mount();
      if (christmas() && root?.classList.contains('show')) startSequence();
      else if (!christmas() && ready) finish();
    });
    motion.addEventListener('change', function () { if (motion.matches && ready) finish(); });
  }

  window.PresenceChristmasIntro = Object.freeze({
    mount: mount,
    replay: function () { running = false; startSequence(); },
    skip: skip,
    get state() { return {running: running, ready: ready, skipped: skipped, elapsed: elapsed(), duration: DURATION}; }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
