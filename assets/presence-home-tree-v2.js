(function () {
  'use strict';

  var VERSION = '20260727-5';
  var ROOT = 'assets/tree-scene/';
  var CONTRACT = Object.freeze({
    scene: Object.freeze({width: 1672, height: 941}),
    treeRoot: Object.freeze({x: 836, y: 806, xPercent: 50, yPercent: 85.653560043, tolerancePx: 2}),
    treeSprite: Object.freeze({width: 1024, height: 1536, localRootX: 512, localRootY: 1535, renderedWidthPercent: 33.5}),
    giftRoot: Object.freeze({xPercent: 50, yPercent: 90.2}),
    giftHeroSprite: Object.freeze({width: 1024, height: 1024, localBottomX: 512, localBottomY: 1023}),
    giftPileSprite: Object.freeze({width: 1536, height: 1024, localBottomX: 768, localBottomY: 1023})
  });

  var BACKGROUNDS = {
    spring: {
      day: ROOT + 'backgrounds/spring-day.png',
      night: ROOT + 'backgrounds/spring-night.png'
    },
    summer: {
      day: ROOT + 'backgrounds/summer-rain-day.png',
      night: ROOT + 'backgrounds/summer-rain-night.png'
    },
    autumn: {
      day: ROOT + 'backgrounds/autumn-day.png',
      night: ROOT + 'backgrounds/autumn-night.png'
    },
    winter: {
      day: ROOT + 'backgrounds/winter-snow-day.png',
      night: ROOT + 'backgrounds/winter-snow-night.png'
    }
  };

  var TREES = {
    stage1: ROOT + 'trees/stage-01-sprout.png',
    stage2: ROOT + 'trees/stage-02-cotyledon.png',
    stage3: ROOT + 'trees/stage-03-seedling.png',
    stage4: ROOT + 'trees/stage-04-sapling.png',
    stage5: ROOT + 'trees/stage-05-young-tree.png',
    spring: ROOT + 'trees/mature-spring-cherry.png',
    summer: ROOT + 'trees/mature-summer-green.png',
    autumn: ROOT + 'trees/mature-autumn-maple.png',
    winter: ROOT + 'trees/mature-winter-christmas.png'
  };

  var GIFTS = {
    pile: ROOT + 'gifts/gift-pile-back.png',
    closed: ROOT + 'gifts/gift-hero-closed.png',
    loose: ROOT + 'gifts/gift-hero-ribbon-loose.png',
    open: ROOT + 'gifts/gift-hero-open.png'
  };

  var original = {};
  var giftVisible = false;
  var waterTimer = 0;
  var booted = false;

  function versioned(url) {
    return url + '?v=' + VERSION;
  }

  function currentUser() {
    try {
      if (window.me) return window.me;
      return typeof me !== 'undefined' ? me : null;
    } catch (error) {
      return null;
    }
  }

  function currentState() {
    try {
      if (window.state) return window.state;
      return typeof state !== 'undefined' ? state : null;
    } catch (error) {
      return null;
    }
  }

  function seasonNow() {
    try {
      if (typeof treeSeason === 'function') return treeSeason();
    } catch (error) {}
    var month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
  }

  function lightMode() {
    try {
      if (typeof daylight === 'function') {
        var value = daylight();
        return value && value.light < 0.3 ? 'night' : 'day';
      }
    } catch (error) {}
    var hour = new Date().getHours();
    return hour >= 6 && hour < 19 ? 'day' : 'night';
  }

  function treeContext(weekOverride) {
    var context = {frac: 0, ended: false, preview: false};
    try {
      if (weekOverride != null && typeof treeFrac === 'function') {
        context.frac = treeFrac(weekOverride);
        return context;
      }

      if (typeof treePreviewStep !== 'undefined' && treePreviewStep !== null &&
          typeof TREE_PREVIEW !== 'undefined' && TREE_PREVIEW) {
        context.preview = true;
        var step = TREE_PREVIEW[treePreviewStep];
        if (step === 'end') {
          context.frac = 1;
          context.ended = true;
        } else if (typeof treeFrac === 'function') {
          context.frac = treeFrac(step);
        }
        return context;
      }

      context.ended = typeof treeEnded === 'function' && treeEnded();
      if (context.ended) {
        context.frac = 1;
        return context;
      }

      var week = typeof treeWeek === 'function' ? treeWeek() : 0;
      if (typeof isTreeGrowthDay === 'function' && isTreeGrowthDay() &&
          typeof lsGet === 'function' && typeof TODAY !== 'undefined' &&
          lsGet('tree_grown_seen') !== TODAY) {
        week = Math.max(0, week - 1);
      }
      context.frac = typeof treeFrac === 'function' ? treeFrac(week) : 0;
    } catch (error) {
      context.frac = 0;
    }
    context.frac = Math.max(0, Math.min(1, Number(context.frac) || 0));
    return context;
  }

  function treeKeyFor(context, season) {
    if (context.ended) return 'winter';
    if (!context.preview) return season;
    if (context.frac >= 0.72) return season;
    if (context.frac < 0.02) return 'stage1';
    if (context.frac < 0.09) return 'stage2';
    if (context.frac < 0.20) return 'stage3';
    if (context.frac < 0.42) return 'stage4';
    return 'stage5';
  }

  function loadInto(image, url, fallback) {
    if (!image || image.dataset.requested === url) return;
    image.dataset.requested = url;
    var loader = new Image();
    loader.decoding = 'async';
    loader.onload = function () {
      if (image.dataset.requested !== url) return;
      image.src = versioned(url);
      image.dataset.loaded = url;
      image.style.opacity = '1';
    };
    loader.onerror = function () {
      if (!fallback || image.dataset.requested !== url) return;
      image.dataset.requested = fallback;
      image.src = versioned(fallback);
      image.dataset.loaded = fallback;
      image.style.opacity = '1';
    };
    loader.src = versioned(url);
  }

  function ensureBackground(stage) {
    var image = stage.querySelector('.tree-v2-background');
    if (!image) {
      image = document.createElement('img');
      image.className = 'tree-v2-background';
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.decoding = 'async';
      stage.insertBefore(image, stage.firstChild);
    }
    return image;
  }

  function renderBackground(stage) {
    if (!stage) return;
    var season = seasonNow();
    var mode = lightMode();
    var url = BACKGROUNDS[season][mode];
    var image = ensureBackground(stage);
    loadInto(image, url, BACKGROUNDS.spring.day);
    stage.dataset.treeSeason = season;
    stage.dataset.treeTime = mode;
    stage.setAttribute(
      'aria-label',
      ({spring: '봄 벚꽃', summer: '여름 빗속', autumn: '가을 단풍', winter: '겨울 눈'}[season]) +
      ' · ' + (mode === 'night' ? '밤' : '낮') + ' Presence 나무 정원'
    );
  }

  function fallbackAvatarMarkup() {
    return '<div class="presence-game-pet pgp-avatar pgp-coop" role="img" aria-label="스칼라 조끼를 입은 병아리">' +
      '<img class="pgp-master" src="assets/pets/avatar-scholar.png" alt="" draggable="false"></div>';
  }

  function avatarMarkup(profile) {
    try {
      if (typeof window.presencePetArt === 'function') {
        return window.presencePetArt(profile || undefined, null, 'coop');
      }
    } catch (error) {}
    return fallbackAvatarMarkup();
  }

  function profileForCurrentUser() {
    try {
      if (typeof window.presenceAvatarProfile === 'function') return window.presenceAvatarProfile();
    } catch (error) {}
    var user = currentUser();
    var stateValue = currentState();
    return user && stateValue && stateValue.petProfiles ? stateValue.petProfiles[user.uid] : null;
  }

  function profileForWatering(profile) {
    if (!profile) return null;
    var copy = Object.assign({}, profile);
    copy.equipped = Object.assign({}, profile.equipped || {});
    /* The watering can owns the hand-prop slot in this scene. Keep the user's
       body/head identity, but suppress a second ball/tube/tool from covering it. */
    delete copy.equipped.prop;
    delete copy.equipped.weapon;
    if (copy.equipped.look && /^(ball|tube|watergun|wand|sword|shield)$/.test(copy.equipped.look)) {
      delete copy.equipped.look;
    }
    return copy;
  }

  function wateringCanSvg() {
    return '<svg class="tree-v2-waterer-can" viewBox="0 0 120 92" aria-hidden="true" focusable="false">' +
      '<defs>' +
      '<linearGradient id="treeV3CanBody" x1=".08" y1=".03" x2=".9" y2=".94">' +
      '<stop offset="0" stop-color="#f7daa0"/><stop offset=".42" stop-color="#b8b576"/>' +
      '<stop offset="1" stop-color="#5d7654"/></linearGradient>' +
      '<linearGradient id="treeV3CanRim" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#fff0bd"/><stop offset="1" stop-color="#758557"/></linearGradient>' +
      '<radialGradient id="treeV3CanBadge" cx=".35" cy=".3" r=".8">' +
      '<stop offset="0" stop-color="#fff6cf"/><stop offset=".35" stop-color="#e8bc67"/>' +
      '<stop offset="1" stop-color="#8f6c34"/></radialGradient>' +
      '</defs>' +
      '<path d="M31 37h52l-2 38c-.5 8-6.5 13-14.5 13h-22C36 88 31 82 31 73.5V37Z" fill="url(#treeV3CanBody)" stroke="#35452f" stroke-width="3.8"/>' +
      '<path d="M39 38c0-22 37-23 39 0" fill="none" stroke="#4a5e41" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M40 37c1-16 28-17 30-1" fill="none" stroke="#f8dfaa" stroke-width="3.2" stroke-linecap="round" opacity=".82"/>' +
      '<path d="M82 47 109 30l6 10-30 22" fill="url(#treeV3CanRim)" stroke="#35452f" stroke-width="3.8" stroke-linejoin="round"/>' +
      '<path d="m107 29 10-7 3 8-7 8" fill="#e4bc6f" stroke="#35452f" stroke-width="3"/>' +
      '<path d="M32 39h50" fill="none" stroke="#fff0bd" stroke-width="4" stroke-linecap="round" opacity=".82"/>' +
      '<path d="M37 43v28c0 8 3 11 10 12" fill="none" stroke="#fff7d9" stroke-width="2.8" stroke-linecap="round" opacity=".45"/>' +
      '<circle cx="52" cy="61" r="9" fill="url(#treeV3CanBadge)" stroke="#755b32" stroke-width="2"/>' +
      '<path d="m52 54 2 4 4 .5-3 3 1 4.5-4-2-4 2 1-4.5-3-3 4-.5Z" fill="#fff3bd"/>' +
      '</svg>';
  }

  function waterFxMarkup() {
    var dropSpecs = [
      [790, 465, 1.45, 335], [822, 438, 1.55, 360], [850, 470, 1.62, 330],
      [770, 510, 1.72, 290], [836, 500, 1.78, 300], [870, 520, 1.84, 280],
      [805, 545, 1.92, 255], [850, 560, 2.03, 240], [785, 575, 2.12, 225],
      [835, 590, 2.22, 210], [868, 610, 2.33, 190], [810, 625, 2.44, 175]
    ];
    var fallingDrops = dropSpecs.map(function (spec) {
      var x = spec[0];
      var y = spec[1];
      return '<path class="tree-v4-fall-drop" d="M ' + x + ' ' + y +
        ' C ' + (x - 8) + ' ' + (y + 12) + ' ' + (x - 7) + ' ' + (y + 22) +
        ' ' + x + ' ' + (y + 22) + ' C ' + (x + 7) + ' ' + (y + 22) + ' ' +
        (x + 8) + ' ' + (y + 12) + ' ' + x + ' ' + y +
        ' Z" style="--drop-delay:' + spec[2] + 's;--drop-fall:' + spec[3] + 'px"/>';
    }).join('');
    return '<svg class="tree-v2-water-fx" viewBox="0 0 1672 941" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<defs>' +
      '<linearGradient id="treeV4DropGlass" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#f4fdff"/><stop offset=".46" stop-color="#92e1f3"/>' +
      '<stop offset="1" stop-color="#3fa6cd"/></linearGradient>' +
      '</defs>' +
      '<ellipse class="tree-v2-wet-soil" cx="836" cy="812" rx="59" ry="12"/>' +
      '<g class="tree-v4-water-shower">' + fallingDrops + '</g>' +
      '<g class="tree-v2-water-ripples">' +
      '<ellipse cx="836" cy="809" rx="18" ry="5"/><ellipse cx="836" cy="810" rx="30" ry="8"/>' +
      '</g>' +
      '<g class="tree-v2-water-splashes">' +
      '<circle class="tree-v2-splash-a" cx="830" cy="799" r="6"/>' +
      '<circle class="tree-v2-splash-b" cx="841" cy="801" r="5"/>' +
      '<circle class="tree-v2-splash-c" cx="850" cy="803" r="4"/>' +
      '<circle class="tree-v2-splash-d" cx="822" cy="804" r="3.5"/>' +
      '</g>' +
      '<g class="tree-v2-water-complete">' +
      '<ellipse class="tree-v2-complete-shine" cx="836" cy="811" rx="45" ry="10"/>' +
      '<circle class="tree-v2-complete-glow" cx="836" cy="807" r="15"/>' +
      '<ellipse class="tree-v2-complete-ring tree-v2-complete-ring-a" cx="836" cy="810" rx="18" ry="5"/>' +
      '<ellipse class="tree-v2-complete-ring tree-v2-complete-ring-b" cx="836" cy="810" rx="27" ry="7"/>' +
      '<circle class="tree-v2-complete-drop" cx="836" cy="804" r="5.5" style="--water-dx:-35px;--water-dy:-31px;--water-delay:3.09s"/>' +
      '<circle class="tree-v2-complete-drop" cx="836" cy="804" r="4.5" style="--water-dx:-15px;--water-dy:-42px;--water-delay:3.13s"/>' +
      '<circle class="tree-v2-complete-drop" cx="836" cy="804" r="5" style="--water-dx:10px;--water-dy:-45px;--water-delay:3.1s"/>' +
      '<circle class="tree-v2-complete-drop" cx="836" cy="804" r="4.5" style="--water-dx:31px;--water-dy:-32px;--water-delay:3.16s"/>' +
      '<circle class="tree-v2-complete-drop" cx="836" cy="804" r="3.5" style="--water-dx:42px;--water-dy:-16px;--water-delay:3.21s"/>' +
      '<circle class="tree-v2-complete-drop" cx="836" cy="804" r="3.5" style="--water-dx:-43px;--water-dy:-14px;--water-delay:3.19s"/>' +
      '</g>' +
      '</svg>';
  }

  function ensureWaterFx(stage) {
    var effect = stage.querySelector('.tree-v2-water-fx');
    if (!effect) {
      stage.insertAdjacentHTML('beforeend', waterFxMarkup());
      effect = stage.querySelector('.tree-v2-water-fx');
    }
    return effect;
  }

  function ensureWaterer(stage) {
    var host = stage.querySelector('.tree-v2-waterer');
    if (!host) {
      host = document.createElement('div');
      host.className = 'tree-v2-waterer';
      host.setAttribute('role', 'img');
      host.setAttribute('aria-label', '나의 병아리가 나무에 물을 줍니다');
      host.innerHTML = '<div class="tree-v2-waterer-pet"></div>' + wateringCanSvg() +
        '<span class="tree-v2-waterer-grip" aria-hidden="true"></span>';
      stage.appendChild(host);
    }
    ensureWaterFx(stage);
    var profile = profileForWatering(profileForCurrentUser());
    var equipped = profile && profile.equipped || {};
    var signature = profile ?
      [profile.color || 'honey', profile.feather || 'classic', equipped.head || '',
        equipped.body || '', profile.outfit || ''].join('|') : 'fallback';
    var slot = host.querySelector('.tree-v2-waterer-pet');
    if (slot && host.dataset.avatarSignature !== signature && !host.classList.contains('is-watering')) {
      slot.innerHTML = avatarMarkup(profile);
      host.dataset.avatarSignature = signature;
    }
    return host;
  }

  function playWaterer() {
    var stage = document.querySelector('#treeSecHome .tree-stage');
    if (!stage || !currentUser()) return;
    var host = ensureWaterer(stage);
    window.clearTimeout(waterTimer);
    host.classList.remove('is-watering');
    stage.classList.remove('tree-v2-is-watering');
    document.body.classList.remove('tree-v2-watering-mode');
    void host.offsetWidth;
    host.classList.add('is-watering');
    stage.classList.add('tree-v2-is-watering');
    document.body.classList.add('tree-v2-watering-mode');
    ensureWaterFx(stage);
    waterTimer = window.setTimeout(function () {
      host.classList.remove('is-watering');
      stage.classList.remove('tree-v2-is-watering');
      document.body.classList.remove('tree-v2-watering-mode');
    }, 4400);
  }

  function ensureTree(stage) {
    var tree = document.getElementById('treeMain');
    if (!tree) {
      tree = document.createElement('img');
      tree.id = 'treeMain';
      tree.alt = '';
      tree.decoding = 'async';
    }
    var anchor = stage.querySelector('.tree-v2-anchor');
    if (!anchor) {
      anchor = document.createElement('div');
      anchor.className = 'tree-v2-anchor';
      anchor.setAttribute('aria-hidden', 'true');
      stage.appendChild(anchor);
    }
    if (tree.parentNode !== anchor) anchor.appendChild(tree);
    return tree;
  }

  function renderTreeSprite(stage, context, season) {
    var tree = ensureTree(stage);
    tree.style.height = '';
    tree.style.animation = '';
    var key = treeKeyFor(context, season);
    if (tree.dataset.treeV2Key === key) return;
    tree.dataset.treeV2Key = key;
    tree.style.opacity = '0';
    loadInto(tree, TREES[key], TREES.stage1);
    tree.classList.remove('tree-v2-changing');
    void tree.offsetWidth;
    tree.classList.add('tree-v2-changing');
    window.setTimeout(function () {
      tree.classList.remove('tree-v2-changing');
    }, 760);
  }

  function giftButtonEnabled() {
    try {
      if (typeof giftHuntActive !== 'function' || !giftHuntActive()) return true;
      if (typeof openedGiftToday === 'function' && openedGiftToday()) return false;
      if (typeof giftRemaining === 'function' && giftRemaining() <= 0) return false;
    } catch (error) {}
    return true;
  }

  function renderGiftLayer(show) {
    giftVisible = !!show;
    var host = document.getElementById('treeGifts');
    if (!host) return;
    host.classList.add('tree-v2-gifts');
    if (!giftVisible) {
      host.innerHTML = '';
      return;
    }

    var active = false;
    try {
      active = typeof giftHuntActive === 'function' && giftHuntActive() &&
        currentState() && currentState().giftHunt && currentState().giftHunt.started;
    } catch (error) {}
    var enabled = giftButtonEnabled();
    host.innerHTML =
      '<div class="tree-v2-gift-anchor">' +
      '<img class="tree-v2-gift-pile" src="' + versioned(GIFTS.pile) + '" alt="" aria-hidden="true" draggable="false">' +
      '<button type="button" class="tree-v2-gift-hero" aria-label="' +
      (active ? (enabled ? '오늘의 선물 열기' : '오늘은 이미 선물을 열었습니다') : '선물 미리보기') +
      '"' + (active && !enabled ? ' disabled' : '') + '>' +
      '<img src="' + versioned(GIFTS.closed) + '" alt="" aria-hidden="true" draggable="false">' +
      '</button></div>';

    var button = host.querySelector('.tree-v2-gift-hero');
    if (button && !button.disabled) {
      button.addEventListener('click', function () {
        if (active && typeof window.openGift === 'function') window.openGift();
        else if (typeof window.peekGift === 'function') window.peekGift();
      });
    }
  }

  function upgradeScene(weekOverride) {
    var stage = document.querySelector('#treeSecHome .tree-stage');
    if (!stage) return;
    stage.classList.add('tree-v2-stage');
    stage.setAttribute('role', 'group');
    renderBackground(stage);
    var season = seasonNow();
    var context = treeContext(weekOverride);
    renderTreeSprite(stage, context, season);
    ensureWaterer(stage);
    ensureWaterFx(stage);
    stage.querySelectorAll('.tree-chick').forEach(function (node) { node.remove(); });
    if (context.ended || context.frac >= 0.6 || giftVisible) renderGiftLayer(true);
  }

  function teamProfiles() {
    var values = [];
    var seen = {};
    var user = currentUser();
    var userProfile = profileForCurrentUser();
    if (user) {
      values.push(userProfile || {outfit: 'scholar'});
      seen[user.uid] = true;
    }

    var stateValue = currentState();
    var users = stateValue && stateValue.users ? Object.keys(stateValue.users).map(function (key) {
      return stateValue.users[key];
    }) : [];
    users.filter(function (candidate) {
      return candidate && candidate.uid && !seen[candidate.uid] && candidate.status !== 'inactive';
    }).slice(0, 2).forEach(function (candidate) {
      seen[candidate.uid] = true;
      values.push(stateValue.petProfiles && stateValue.petProfiles[candidate.uid] ||
        {outfit: ['cape', 'scarf'][values.length - 1] || 'scholar'});
    });

    while (values.length < 3) {
      values.push({outfit: ['cape', 'scarf', 'scholar'][values.length]});
    }
    return values.slice(0, 3);
  }

  function sparksMarkup() {
    var colors = ['#ffe16d', '#ff8f6b', '#87e8bf', '#7ec7ff', '#ff9fd2'];
    var output = '';
    for (var index = 0; index < 18; index += 1) {
      var angle = (Math.PI * 2 * index) / 18;
      var distance = 90 + (index % 4) * 22;
      output += '<i style="--spark:' + colors[index % colors.length] +
        ';--sx:' + (Math.cos(angle) * distance).toFixed(1) + 'px' +
        ';--sy:' + (Math.sin(angle) * distance).toFixed(1) + 'px' +
        ';--delay:' + ((index % 6) * 0.035).toFixed(3) + 's"></i>';
    }
    return output;
  }

  function playOpenSceneV2(win, callback) {
    var old = document.getElementById('giftOpenScene');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'giftOpenScene';
    overlay.className = 'tree-v2-open-scene';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '팀 병아리 선물 개봉');

    var party = teamProfiles().map(function (profile) {
      return '<div class="tree-v2-open-chick">' + avatarMarkup(profile) + '</div>';
    }).join('');

    overlay.innerHTML =
      '<div class="gos-fw" id="gosFw"></div>' +
      '<section class="tree-v2-open-panel">' +
      '<button type="button" class="tree-v2-open-close" aria-label="선물 개봉 장면 닫기">×</button>' +
      '<p class="tree-v2-open-kicker">PRESENCE TEAM GIFT</p>' +
      '<h2 class="tree-v2-open-label">병아리 친구들이 선물을 열러 왔어요!</h2>' +
      '<div class="tree-v2-open-party">' + party + '</div>' +
      '<div class="tree-v2-open-gift"><img src="' + versioned(GIFTS.closed) + '" alt="닫힌 선물 상자"></div>' +
      '<div class="tree-v2-open-sparks" aria-hidden="true">' + sparksMarkup() + '</div>' +
      '</section>';
    document.body.appendChild(overlay);

    var finished = false;
    var previousFocus = document.activeElement;
    var giftImage = overlay.querySelector('.tree-v2-open-gift img');
    var label = overlay.querySelector('.tree-v2-open-label');
    var close = overlay.querySelector('.tree-v2-open-close');
    var timers = [];

    function later(fn, delay) {
      timers.push(window.setTimeout(fn, delay));
    }

    function finish() {
      if (finished) return;
      finished = true;
      timers.forEach(window.clearTimeout);
      overlay.classList.remove('on');
      document.removeEventListener('keydown', onKeyDown);
      window.setTimeout(function () {
        overlay.remove();
        if (previousFocus && previousFocus.focus) previousFocus.focus();
        if (callback) callback();
      }, 280);
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') finish();
    }

    close.addEventListener('click', finish);
    document.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(function () {
      overlay.classList.add('on', 'phase-arrive');
      close.focus();
    });

    later(function () {
      overlay.classList.remove('phase-arrive');
      overlay.classList.add('phase-tug');
      giftImage.src = versioned(GIFTS.loose);
      giftImage.alt = '리본이 풀리는 선물 상자';
      label.textContent = '영차, 영차! 리본을 함께 풀어요';
    }, 1050);

    later(function () {
      overlay.classList.remove('phase-tug');
      overlay.classList.add('phase-open');
      giftImage.src = versioned(GIFTS.open);
      giftImage.alt = '활짝 열린 선물 상자';
      label.innerHTML = win ?
        '<span class="win">행운의 선물 당첨! 병아리 팀이 축하해요!</span>' :
        '<span class="miss">아깝다! 내일 병아리 친구들과 다시 도전해요</span>';
      if (win && typeof window.gosFireworks === 'function') {
        window.gosFireworks(document.getElementById('gosFw'));
      }
    }, 2150);

    later(finish, win ? 5100 : 4300);
  }

  function hookFunctions() {
    if (typeof window.renderTree === 'function' && !window.renderTree.__presenceTreeV2) {
      original.renderTree = window.renderTree;
      window.renderTree = function () {
        var result = original.renderTree.apply(this, arguments);
        upgradeScene(arguments[0]);
        return result;
      };
      window.renderTree.__presenceTreeV2 = true;
      window.renderTree.__presenceOriginal = original.renderTree;
    }

    if (typeof window.renderTreeBg === 'function' && !window.renderTreeBg.__presenceTreeV2) {
      original.renderTreeBg = window.renderTreeBg;
      window.renderTreeBg = function () {
        var result = original.renderTreeBg.apply(this, arguments);
        var stage = document.querySelector('#treeSecHome .tree-stage');
        if (stage) renderBackground(stage);
        return result;
      };
      window.renderTreeBg.__presenceTreeV2 = true;
      window.renderTreeBg.__presenceOriginal = original.renderTreeBg;
    }

    original.paintGifts = window.paintGifts;
    window.paintGifts = function (show) {
      renderGiftLayer(show);
    };
    window.paintGifts.__presenceTreeV2 = true;

    original.paintFloatGifts = window.paintFloatGifts;
    window.paintFloatGifts = function (remaining, openedToday) {
      renderGiftLayer(remaining > 0 || giftVisible);
      var button = document.querySelector('#treeGifts .tree-v2-gift-hero');
      if (button) {
        button.disabled = !!openedToday || remaining <= 0;
        button.setAttribute('aria-label', button.disabled ? '오늘은 이미 선물을 열었습니다' : '오늘의 선물 열기');
      }
      var floating = document.getElementById('treeFloat');
      if (floating) floating.innerHTML = '';
    };
    window.paintFloatGifts.__presenceTreeV2 = true;

    original.openGift = window.openGift;
    window.openGift = function () {
      if (typeof window.doOpenGift === 'function') window.doOpenGift();
    };
    window.openGift.__presenceTreeV2 = true;

    original.playOpenScene = window.playOpenScene;
    window.playOpenScene = playOpenSceneV2;
    window.playOpenScene.__presenceTreeV2 = true;

    if (typeof window.renderGiftHunt === 'function' && !window.renderGiftHunt.__presenceTreeV2) {
      original.renderGiftHunt = window.renderGiftHunt;
      window.renderGiftHunt = function () {
        var result = original.renderGiftHunt.apply(this, arguments);
        var tap = document.querySelector('#giftHunt .gh-tap');
        if (tap && tap.textContent.indexOf('날아다니는') >= 0) {
          tap.innerHTML = '나무 앞에서 반짝이는 <b>가운데 선물</b>을 눌러 열어보세요! 👆';
        }
        return result;
      };
      window.renderGiftHunt.__presenceTreeV2 = true;
      window.renderGiftHunt.__presenceOriginal = original.renderGiftHunt;
    }

    if (typeof window.waterToTree === 'function' && !window.waterToTree.__presenceTreeV2) {
      original.waterToTree = window.waterToTree;
      window.waterToTree = function (pour) {
        var stage = document.querySelector('#treeSecHome .tree-stage');
        if (!stage || !stage.classList.contains('tree-v2-stage')) {
          return original.waterToTree.apply(this, arguments);
        }
        if (pour === false) return;
        var tree = document.getElementById('treeMain');
        if (!tree) return;
        tree.style.animation = 'none';
        void tree.offsetWidth;
        tree.style.animation = 'treeDrink 1.4s ease-in-out';
        window.setTimeout(function () {
          if (tree && tree.style.animation.indexOf('treeDrink') >= 0) tree.style.animation = '';
        }, 1460);
      };
      window.waterToTree.__presenceTreeV2 = true;
      window.waterToTree.__presenceOriginal = original.waterToTree;
    }

    if (typeof window.waterTree === 'function' && !window.waterTree.__presenceTreeV2) {
      original.waterTree = window.waterTree;
      window.waterTree = function () {
        var result = original.waterTree.apply(this, arguments);
        playWaterer();
        return result;
      };
      window.waterTree.__presenceTreeV2 = true;
      window.waterTree.__presenceOriginal = original.waterTree;
    }
  }

  function preloadCritical() {
    var urls = [];
    Object.keys(BACKGROUNDS).forEach(function (season) {
      urls.push(BACKGROUNDS[season].day, BACKGROUNDS[season].night);
    });
    Object.keys(TREES).forEach(function (key) { urls.push(TREES[key]); });
    Object.keys(GIFTS).forEach(function (key) { urls.push(GIFTS[key]); });
    urls.forEach(function (url) {
      var image = new Image();
      image.decoding = 'async';
      image.src = versioned(url);
    });
  }

  function boot() {
    hookFunctions();
    upgradeScene();
    if (!booted) {
      booted = true;
      preloadCritical();
      try {
        if (typeof window.renderTree === 'function') window.renderTree();
        if (typeof window.renderGiftHunt === 'function') window.renderGiftHunt();
      } catch (error) {
        console.error('[Presence Tree v2] initial render failed', error);
      }
    }
  }

  window.PresenceTreeSceneV2 = Object.freeze({
    version: VERSION,
    contract: CONTRACT,
    render: function () { upgradeScene(); },
    previewGiftOpen: function (won) { playOpenSceneV2(!!won); },
    debugAnchors: function (enabled) {
      document.documentElement.classList.toggle('tree-v2-debug', enabled !== false);
    }
  });

  if (new URLSearchParams(window.location.search).get('treeAnchorDebug') === '1') {
    document.documentElement.classList.add('tree-v2-debug');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.setTimeout(boot, 0);
    });
  } else {
    window.setTimeout(boot, 0);
  }
  window.setInterval(function () {
    hookFunctions();
    var stage = document.querySelector('#treeSecHome .tree-stage');
    if (stage) {
      renderBackground(stage);
      ensureWaterer(stage);
    }
  }, 60000);
})();
