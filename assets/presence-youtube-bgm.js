(function () {
  'use strict';

  var VERSION = '20260727-2';
  var VIDEO_ID = 'w2rSZ90PoZE';
  var STORAGE_KEY = 'presence_youtube_bgm';
  var PANEL_KEY = 'presence_youtube_bgm_panel';
  var player = null;
  var quick = null;
  var panelButton = null;
  var card = null;
  var enabled = false;
  var playing = false;
  var playerLoaded = false;
  var userStarted = false;
  var panelCollapsed = false;
  var commandTimers = [];

  try {
    panelCollapsed = localStorage.getItem(PANEL_KEY) === 'closed';
  } catch (error) {}

  function savePreference() {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    } catch (error) {}
  }

  function savePanelPreference() {
    try {
      localStorage.setItem(PANEL_KEY, panelCollapsed ? 'closed' : 'open');
    } catch (error) {}
  }

  function announce(message) {
    try {
      if (typeof window.toast === 'function') window.toast(message);
    } catch (error) {}
  }

  function stopMoodAudio() {
    try {
      if (typeof SND !== 'undefined' && SND && typeof SND.stop === 'function') SND.stop();
    } catch (error) {}
  }

  function playerUrl() {
    var origin = location.origin && location.origin !== 'null' ? location.origin : 'https://presence-team.web.app';
    return 'https://www.youtube-nocookie.com/embed/' + VIDEO_ID +
      '?enablejsapi=1&playsinline=1&loop=1&playlist=' + VIDEO_ID +
      '&rel=0&modestbranding=1&controls=1&origin=' + encodeURIComponent(origin);
  }

  function ensurePlayer() {
    if (player) return player;
    var shell = card && card.querySelector('.presence-bgm-frame-shell');
    if (!shell) return null;
    player = document.createElement('iframe');
    player.id = 'presenceBgmPlayer';
    player.title = 'Presence 배경음악 YouTube 플레이어';
    player.src = playerUrl();
    player.loading = 'eager';
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    player.allow = 'autoplay; encrypted-media; picture-in-picture';
    player.setAttribute('allowfullscreen', '');
    player.addEventListener('load', function () {
      playerLoaded = true;
      listenToPlayer();
      setVolume();
      if (enabled && userStarted) sendCommand('playVideo');
    });
    shell.appendChild(player);
    card.classList.add('has-player');
    return player;
  }

  function post(payload) {
    if (!player || !player.contentWindow) return;
    try {
      player.contentWindow.postMessage(JSON.stringify(payload), 'https://www.youtube-nocookie.com');
    } catch (error) {
      try {
        player.contentWindow.postMessage(JSON.stringify(payload), '*');
      } catch (ignored) {}
    }
  }

  function listenToPlayer() {
    post({event: 'listening', id: 'presenceBgmPlayer', channel: VERSION});
    post({event: 'command', func: 'addEventListener', args: ['onStateChange']});
  }

  function setVolume() {
    post({event: 'command', func: 'setVolume', args: [22]});
  }

  function clearCommandTimers() {
    commandTimers.forEach(window.clearTimeout);
    commandTimers = [];
  }

  function sendCommand(command) {
    ensurePlayer();
    clearCommandTimers();
    [0, 260, 850].forEach(function (delay) {
      commandTimers.push(window.setTimeout(function () {
        if (command === 'playVideo') {
          setVolume();
          stopMoodAudio();
        }
        post({event: 'command', func: command, args: []});
      }, delay));
    });
  }

  function renderState() {
    var label = playing ? '음악 일시정지' : '음악 시작';
    if (quick) {
      quick.classList.toggle('is-playing', playing);
      quick.setAttribute('aria-label', playing ? '배경음악 일시정지' : '배경음악 재생');
      quick.title = playing ? 'BGM 일시정지' : 'BGM 재생';
      quick.querySelector('.presence-bgm-note').textContent = playing ? '♫' : '♪';
    }
    if (panelButton) {
      panelButton.classList.toggle('is-playing', playing);
      panelButton.setAttribute('aria-pressed', playing ? 'true' : 'false');
      panelButton.innerHTML = '<span>' + (playing ? '♫' : '♪') + '</span><span>' + label + '</span>';
    }
    if (card) {
      card.classList.toggle('is-collapsed', panelCollapsed);
      var cardToggle = card.querySelector('.presence-bgm-card-toggle');
      if (cardToggle) {
        cardToggle.setAttribute('aria-expanded', panelCollapsed ? 'false' : 'true');
        cardToggle.textContent = panelCollapsed ? '노래창 보기' : '노래창 숨기기';
      }
      var startButton = card.querySelector('.presence-bgm-start');
      if (startButton) {
        startButton.classList.toggle('is-playing', playing);
        startButton.textContent = playing ? '❚❚ 음악 일시정지' : '▶ 음악 시작';
      }
    }
    document.querySelectorAll('[data-presence-bgm-menu]').forEach(function (button) {
      var text = button.querySelector('span');
      if (text) text.textContent = playing ? 'BGM 일시정지' : 'BGM 재생';
    });
  }

  function play(fromUser) {
    enabled = true;
    userStarted = true;
    savePreference();
    ensurePlayer();
    sendCommand('playVideo');
    if (fromUser) announce('🎵 Presence BGM을 재생해요');
    renderState();
  }

  function pause(fromUser) {
    enabled = false;
    playing = false;
    savePreference();
    if (playerLoaded) sendCommand('pauseVideo');
    if (fromUser) announce('BGM을 잠시 껐어요');
    renderState();
  }

  function toggle() {
    if (playing) pause(true);
    else play(true);
  }

  function togglePanel() {
    panelCollapsed = !panelCollapsed;
    savePanelPreference();
    renderState();
  }

  function createUi() {
    if (!document.body) return;
    if (!quick) {
      quick = document.createElement('button');
      quick.id = 'presenceBgmQuick';
      quick.type = 'button';
      quick.innerHTML = '<span class="presence-bgm-note" aria-hidden="true">♪</span>';
      quick.addEventListener('click', function (event) {
        event.stopPropagation();
        toggle();
      });
      document.body.appendChild(quick);
    }

    var row = document.querySelector('#fxPanel .fxp-row');
    if (row && !document.getElementById('presenceBgmToggle')) {
      panelButton = document.createElement('button');
      panelButton.id = 'presenceBgmToggle';
      panelButton.type = 'button';
      panelButton.addEventListener('click', toggle);
      row.appendChild(panelButton);

      card = document.createElement('section');
      card.className = 'presence-bgm-card';
      card.setAttribute('aria-label', 'Presence 배경음악');
      card.innerHTML =
        '<div class="presence-bgm-card-head"><span>🎵 <b>Presence BGM</b></span>' +
        '<button class="presence-bgm-card-toggle" type="button" aria-expanded="true">노래창 숨기기</button></div>' +
        '<div class="presence-bgm-card-body">' +
        '<div class="presence-bgm-frame-shell">' +
        '<div class="presence-bgm-placeholder"><span>오늘의 작업을 위한 음악</span>' +
        '<button class="presence-bgm-start" type="button">▶ 음악 시작</button>' +
        '<small>버튼을 누른 뒤에만 재생됩니다.</small></div>' +
        '</div>' +
        '<div class="presence-bgm-meta"><span><b>Presence BGM</b><br>볼륨 22% · 반복 재생</span>' +
        '<a href="https://youtu.be/' + VIDEO_ID + '" target="_blank" rel="noopener">YouTube ↗</a></div></div>';
      card.querySelector('.presence-bgm-card-toggle').addEventListener('click', togglePanel);
      card.querySelector('.presence-bgm-start').addEventListener('click', toggle);
      row.parentNode.insertBefore(card, row.nextSibling);
    }
    renderState();
  }

  function syncMoreMenu() {
    var menu = document.getElementById('moreMenu');
    if (!menu || menu.querySelector('[data-presence-bgm-menu]')) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-presence-bgm-menu', '1');
    button.innerHTML = '🎵 <span>' + (playing ? 'BGM 일시정지' : 'BGM 재생') + '</span>';
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      menu.classList.remove('on');
      toggle();
    });
    var install = Array.prototype.find.call(menu.querySelectorAll('button'), function (node) {
      return (node.textContent || '').indexOf('앱으로 설치') >= 0;
    });
    menu.insertBefore(button, install || menu.firstChild && menu.firstChild.nextSibling);
  }

  function onMessage(event) {
    if (event.origin !== 'https://www.youtube.com' &&
        event.origin !== 'https://www.youtube-nocookie.com') return;
    var data = event.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (error) {
        return;
      }
    }
    if (!data || data.event !== 'onStateChange' && data.event !== 'infoDelivery') return;
    var state = data.info;
    if (data.event === 'infoDelivery' && state && typeof state.playerState === 'number') {
      state = state.playerState;
    }
    if (typeof state !== 'number') return;
    playing = state === 1;
    if (playing) {
      enabled = true;
      savePreference();
      stopMoodAudio();
    }
    renderState();
  }

  function wrapMoodRenderer() {
    try {
      if (typeof window.applyHomeFx !== 'function' || window.applyHomeFx.__presenceBgmWrapped) return;
      var original = window.applyHomeFx;
      window.applyHomeFx = function () {
        var result = original.apply(this, arguments);
        if (playing) window.setTimeout(stopMoodAudio, 0);
        return result;
      };
      window.applyHomeFx.__presenceBgmWrapped = true;
    } catch (error) {}
  }

  function boot() {
    createUi();
    syncMoreMenu();
    wrapMoodRenderer();
    window.addEventListener('message', onMessage);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && playing) {
        post({event: 'command', func: 'pauseVideo', args: []});
      } else if (!document.hidden && enabled && userStarted) {
        sendCommand('playVideo');
      }
    });
    window.setInterval(function () {
      createUi();
      syncMoreMenu();
      wrapMoodRenderer();
      if (playing) stopMoodAudio();
    }, 2400);
  }

  window.PresenceBgm = Object.freeze({
    videoId: VIDEO_ID,
    play: function () { play(true); },
    pause: function () { pause(true); },
    toggle: toggle,
    togglePanel: togglePanel,
    get playing() { return playing; }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
