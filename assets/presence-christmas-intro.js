(function () {
  'use strict';

  var ART = 'assets/season/2026/christmas-gift-atelier-v2.webp';
  var PARTY = 'assets/season/2026/christmas-party-atelier-v2.webp';
  var root = null;
  var installed = false;
  var videoSource = '';
  var video = null;
  var skipped = false;
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function christmas() {
    return document.body.classList.contains('presence-christmas');
  }

  function mount() {
    root = document.getElementById('presenceGameLoader');
    if (!root) return;
    var world = root.querySelector('.pgl-world');
    var console = root.querySelector('.pgl-console');
    if (!world || !console) return;

    if (!world.querySelector('.pci-scene')) {
      var scene = document.createElement('div');
      scene.className = 'pci-scene';
      scene.setAttribute('aria-hidden', 'true');
      scene.innerHTML = '<div class="pci-light"></div>' +
        '<img class="pci-atelier" alt="" width="1536" height="1024">' +
        '<div class="pci-portal"><img class="pci-party" alt="" width="1536" height="1024">' +
        '<div class="pci-door pci-door-left"><i></i></div><div class="pci-door pci-door-right"><i></i></div></div>' +
        '<div class="pci-glasslight"></div>' +
        '<div class="pci-snow"><i></i><i></i><i></i><i></i><i></i><i></i></div>';
      var art = scene.querySelector('img');
      art.src = ART;
      art.decoding = 'async';
      art.onload = function () { scene.classList.add('pci-art-ready'); };
      art.onerror = function () { scene.classList.add('pci-art-unavailable'); };
      var party = scene.querySelector('.pci-party');
      party.src = PARTY;
      party.decoding = 'async';
      party.onerror = function () { scene.classList.add('pci-party-unavailable'); };
      world.appendChild(scene);
    }

    if (!console.querySelector('.pci-wordmark')) {
      var wordmark = document.createElement('div');
      wordmark.className = 'pci-wordmark';
      wordmark.setAttribute('aria-hidden', 'true');
      wordmark.innerHTML = '<span class="pci-copy-first">Ready for winter?</span>' +
        '<span class="pci-copy-last">Let’s go, Presence!</span>';
      console.prepend(wordmark);
    }
  }

  function showScene() {
    mount();
    if (!root || !christmas()) return;
    // Network readiness owns the duration. The decoration never delays entry.
    clearInterval(window.__pglTimer);
    var fill = document.getElementById('pglFill');
    var percent = document.getElementById('pglPercent');
    if (fill) fill.removeAttribute('style');
    if (percent) percent.textContent = '';
    root.classList.remove('pci-reveal');
    void root.offsetWidth;
    root.classList.add('pci-reveal');
    skipped = false;
    playVideo();
  }

  function stopVideo() {
    if (video) video.pause();
  }

  function playVideo() {
    if (!videoSource || !root || !christmas() || motion.matches || skipped) return;
    var scene = root.querySelector('.pci-scene');
    if (!scene) return;
    if (!video) {
      video = document.createElement('video');
      video.className = 'pci-film';
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.poster = ART;
      video.setAttribute('aria-hidden', 'true');
      video.src = videoSource;
      video.addEventListener('playing', function () { root.classList.add('pci-film-ready'); });
      video.addEventListener('error', function () { root.classList.remove('pci-film-ready'); });
      video.addEventListener('timeupdate', function () {
        root.classList.toggle('pci-film-late', video.currentTime >= 1.2);
      });
      scene.appendChild(video);
      var skip = document.createElement('button');
      skip.className = 'pci-skip';
      skip.type = 'button';
      skip.textContent = '애니메이션 건너뛰기';
      skip.onclick = function () {
        skipped = true;
        stopVideo();
        root.classList.remove('pci-film-ready', 'pci-reveal');
      };
      root.querySelector('.pgl-console').appendChild(skip);
    }
    video.currentTime = 0;
    root.classList.remove('pci-film-late');
    var playing = video.play();
    if (playing && typeof playing.catch === 'function') {
      playing.catch(function () { root.classList.remove('pci-film-ready'); });
    }
  }

  function install() {
    if (installed) return;
    installed = true;
    mount();
    if (typeof window.showPresenceLoader === 'function') {
      var originalShow = window.showPresenceLoader;
      window.showPresenceLoader = function () {
        var result = originalShow.apply(this, arguments);
        showScene();
        return result;
      };
    }
    if (typeof window.hidePresenceLoader === 'function') {
      var originalHide = window.hidePresenceLoader;
      window.hidePresenceLoader = function () {
        var result = originalHide.apply(this, arguments);
        if (root && christmas()) {
          stopVideo();
          root.classList.remove('show', 'complete', 'pci-reveal');
        }
        return result;
      };
    }
    if (root && root.classList.contains('show')) showScene();
    window.addEventListener('presence:seasonchange', function () {
      if (!christmas()) stopVideo();
      if (root && root.classList.contains('show')) showScene();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopVideo();
    });
    motion.addEventListener('change', function () {
      if (motion.matches) {
        stopVideo();
        if (root) root.classList.remove('pci-film-ready');
      }
    });
  }

  window.PresenceChristmasIntro = Object.freeze({
    mount: mount,
    replay: showScene,
    setVideo: function (source) {
      if (!/^assets\/season\/2026\/[a-z0-9-]+\.mp4$/.test(source)) throw Error('검수된 시즌 영상 경로를 사용해 주세요.');
      stopVideo();
      if (video) video.remove();
      video = null;
      root?.querySelector('.pci-skip')?.remove();
      videoSource = source;
      if (root && root.classList.contains('show')) playVideo();
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
