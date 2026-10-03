/* Presence Home — premium orchard tree visual layer.
 * This module never writes growth/watering data. It lets the workbook's
 * renderTree()/waterTree() finish first, then upgrades only the presentation.
 */
(function () {
  'use strict';

  var VERSION = '1.2.0';
  var installed = false;
  var renderWrapped = false;
  var waterWrapped = false;
  var waterTimer = 0;

  var CANOPY = [
    [-52, 3, 34, 31, -15], [49, 5, 36, 32, 13], [-30, -33, 37, 34, -9],
    [27, -36, 38, 35, 8], [0, -57, 35, 32, 0], [-4, 18, 43, 35, 2],
    [-62, -26, 28, 27, -24], [63, -24, 29, 27, 20], [-43, 31, 30, 25, -5],
    [42, 32, 31, 26, 7], [-17, -72, 27, 24, -12], [20, -72, 28, 24, 11],
    [-73, 5, 23, 22, -20], [74, 7, 24, 22, 18], [-47, -53, 25, 23, -18],
    [49, -54, 26, 24, 17], [-19, 42, 28, 22, -8], [20, 43, 29, 22, 8]
  ];

  var FRUIT = [
    [-47, -19, .92], [48, -15, .88], [-24, 18, .82], [27, 20, .86],
    [2, -52, .78], [-62, 12, .72], [62, 14, .74]
  ];

  var SEASON_PALETTE = {
    spring: ['#dff2ad', '#83b950', '#315f35', '#f5d9dd'],
    summer: ['#c7db78', '#5f8f3d', '#1f422b', '#fff1a3'],
    autumn: ['#f4cc69', '#bc682e', '#60301f', '#ffd88a'],
    winter: ['#aebf98', '#536e58', '#233c36', '#eef7f8']
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function safeGlobal(name, fallback) {
    try {
      if (name === 'previewStep') return typeof treePreviewStep !== 'undefined' ? treePreviewStep : fallback;
      if (name === 'preview') return typeof TREE_PREVIEW !== 'undefined' ? TREE_PREVIEW : fallback;
      if (name === 'weeks') return typeof TREE_WEEKS !== 'undefined' ? TREE_WEEKS : fallback;
      if (name === 'today') return typeof TODAY !== 'undefined' ? TODAY : fallback;
    } catch (error) {}
    return fallback;
  }

  function resolveSeason(preview, previewStep) {
    if (preview) {
      if (previewStep <= 0) return 'spring';
      if (previewStep === 1) return 'summer';
      if (previewStep === 2) return 'autumn';
      return 'winter';
    }
    try {
      if (typeof treeSeason === 'function') return treeSeason();
    } catch (error) {}
    var month = new Date().getMonth() + 1;
    return month >= 3 && month <= 5 ? 'spring' :
      month >= 6 && month <= 8 ? 'summer' :
        month >= 9 && month <= 11 ? 'autumn' : 'winter';
  }

  function resolveGrowth(weekOverride) {
    try {
      var previewStep = safeGlobal('previewStep', null);
      var previewValues = safeGlobal('preview', []);
      var totalWeeks = safeGlobal('weeks', 1);
      var preview = weekOverride == null && previewStep !== null;
      var previewWeek = null;
      var endedPreview = false;

      if (preview) {
        previewWeek = previewValues[previewStep];
        if (previewWeek === 'end') {
          previewWeek = totalWeeks;
          endedPreview = true;
        }
      }

      var pending = !preview && weekOverride == null &&
        typeof isTreeGrowthDay === 'function' && isTreeGrowthDay() &&
        typeof lsGet === 'function' && lsGet('tree_grown_seen') !== safeGlobal('today', '');
      var endedNow = typeof treeEnded === 'function' ? treeEnded() : false;
      var week = weekOverride != null ? weekOverride :
        (preview ? previewWeek :
          (endedNow ? totalWeeks :
            (pending && typeof treeWeek === 'function' ? treeWeek() - 1 : treeWeek())));
      var fraction = typeof treeFrac === 'function' ? treeFrac(week) : clamp(week / totalWeeks, 0, 1);
      var growth = typeof treeG === 'function' ? treeG(week) : (0.26 + 0.66 * Math.pow(fraction, 0.6));

      return {
        fraction: clamp(fraction, 0, 1),
        growth: clamp(growth, 0.2, 1),
        ended: Boolean(endedPreview || (endedNow && weekOverride == null && !preview)),
        preview: preview,
        season: resolveSeason(preview, previewStep)
      };
    } catch (error) {
      var label = (document.getElementById('stageTag') || {}).textContent || '';
      var stageFraction = /완성/.test(label) ? 1 : /우거진/.test(label) ? .8 :
        /큰나무/.test(label) ? .62 : /자라는/.test(label) ? .38 :
          /어린/.test(label) ? .18 : /묘목/.test(label) ? .08 : .02;
      return {
        fraction: stageFraction,
        growth: clamp(.26 + .66 * Math.pow(stageFraction, .6), .2, 1),
        ended: /완성/.test(label),
        preview: /미리보기/.test(label),
        season: resolveSeason(false, null)
      };
    }
  }

  function organicBlob(x, y, rx, ry, rotation, tone) {
    var left = x - rx;
    var right = x + rx;
    var top = y - ry;
    var bottom = y + ry;
    var d = 'M ' + left + ' ' + y +
      ' C ' + (left + rx * .06) + ' ' + (top + ry * .2) + ', ' + (x - rx * .42) + ' ' + top + ', ' + x + ' ' + top +
      ' C ' + (x + rx * .55) + ' ' + (top - ry * .02) + ', ' + (right - rx * .02) + ' ' + (top + ry * .28) + ', ' + right + ' ' + y +
      ' C ' + (right - rx * .02) + ' ' + (bottom - ry * .2) + ', ' + (x + rx * .4) + ' ' + bottom + ', ' + x + ' ' + bottom +
      ' C ' + (x - rx * .52) + ' ' + (bottom + ry * .02) + ', ' + (left + rx * .03) + ' ' + (bottom - ry * .26) + ', ' + left + ' ' + y + ' Z';
    return '<path d="' + d + '" transform="rotate(' + rotation + ' ' + x + ' ' + y + ')" fill="url(#phtLeaf)" opacity="' + tone + '"/>';
  }

  function sproutMarkup(info) {
    return '' +
      '<defs>' + premiumDefs(info.season) + '</defs>' +
      '<ellipse cx="100" cy="241" rx="31" ry="7" fill="#08130d" opacity=".32"/>' +
      '<path d="M55 239 C70 235 80 236 99 239 C118 235 132 235 148 239" fill="none" stroke="#846339" stroke-width="3" stroke-linecap="round" opacity=".62"/>' +
      '<path d="M99 239 C98 226 100 213 101 197" fill="none" stroke="url(#phtBark)" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M100 215 C88 208 78 199 76 187 C91 188 100 199 100 215 Z" fill="url(#phtLeaf)"/>' +
      '<path d="M101 207 C113 199 124 190 128 178 C112 179 102 191 101 207 Z" fill="url(#phtLeaf)" opacity=".9"/>' +
      '<path d="M100 235 C89 238 80 241 73 246 M101 235 C112 238 122 242 130 246" fill="none" stroke="#6f4c29" stroke-width="2.5" stroke-linecap="round" opacity=".78"/>';
  }

  function premiumDefs(season) {
    var palette = SEASON_PALETTE[season] || SEASON_PALETTE.summer;
    return '' +
      '<linearGradient id="phtBark" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#9a7447"/><stop offset=".48" stop-color="#5b3c22"/><stop offset="1" stop-color="#2f2116"/>' +
      '</linearGradient>' +
      '<radialGradient id="phtLeaf" cx="35%" cy="25%" r="78%">' +
        '<stop offset="0" stop-color="' + palette[0] + '"/><stop offset=".46" stop-color="' + palette[1] + '"/><stop offset="1" stop-color="' + palette[2] + '"/>' +
      '</radialGradient>' +
      '<radialGradient id="phtFruit" cx="34%" cy="26%" r="72%">' +
        '<stop offset="0" stop-color="#fff8bd"/><stop offset=".34" stop-color="#efc969"/><stop offset="1" stop-color="#9e6b20"/>' +
      '</radialGradient>' +
      '<filter id="phtGlow" x="-90%" y="-90%" width="280%" height="280%">' +
        '<feGaussianBlur stdDeviation="3.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter>' +
      '<path id="phtLeafShape" d="M0 0 C4 -7 13 -8 18 -2 C12 5 5 7 0 0 Z"/>' +
      '<g id="phtFruitShape"><circle cx="0" cy="0" r="5.1" fill="url(#phtFruit)"/><circle cx="-1.4" cy="-1.5" r="1.25" fill="#fff" opacity=".82"/><path d="M0 -5 C2 -9 6 -9 8 -7 C5 -4 2 -4 0 -5 Z" fill="#6f8b3d"/></g>';
  }

  function seasonalDecor(info) {
    var season = info.season || 'summer';
    var out = '';
    var lights = [[48,112],[70,120],[94,122],[118,120],[143,111],[70,79],[99,72],[130,78]];
    var buds = [[48,107],[64,78],[82,48],[105,41],[130,60],[148,92],[91,105],[122,106]];

    if (season === 'spring') {
      for (var b = 0; b < buds.length; b += 1) {
        out += '<circle class="pht-spring-bud" cx="' + buds[b][0] + '" cy="' + buds[b][1] + '" r="' + (b % 3 === 0 ? '3.6' : '2.8') + '" fill="' + (b % 2 ? '#fff4e6' : '#f3cbd4') + '" opacity=".94"/>';
      }
      out += '<path d="M45 91 C62 77 76 66 91 55 M112 54 C129 65 141 77 153 95" fill="none" stroke="#d8ef9f" stroke-width="2" stroke-linecap="round" opacity=".65"/>';
      return out;
    }

    out += '<path d="M43 111 C68 124 126 124 157 108 M59 75 C82 88 119 88 141 74" fill="none" stroke="#c6a668" stroke-width="1.35" opacity=".64"/>';
    for (var l = 0; l < lights.length; l += 1) {
      out += '<circle class="pht-light pht-light-' + (l % 3) + '" cx="' + lights[l][0] + '" cy="' + lights[l][1] + '" r="2.6" fill="' + (season === 'winter' ? '#f7fbff' : '#fff1a3') + '" filter="url(#phtGlow)"/>';
    }

    if (season === 'autumn') {
      var falling = [[31,121,-30,.72],[167,104,24,.8],[44,55,-17,.66],[158,55,31,.7],[29,82,-42,.58]];
      for (var a = 0; a < falling.length; a += 1) {
        out += '<use class="pht-autumn-leaf" href="#phtLeafShape" transform="translate(' + falling[a][0] + ' ' + falling[a][1] + ') rotate(' + falling[a][2] + ') scale(' + falling[a][3] + ')" fill="' + (a % 2 ? '#d88737' : '#efb94e') + '"/>';
      }
    }

    if (season === 'winter') {
      out += '<path class="pht-snow" d="M56 63 Q71 48 88 57 Q82 64 65 68 Z" fill="#f5fbfb" opacity=".93"/>';
      out += '<path class="pht-snow" d="M82 39 Q102 24 124 40 Q112 47 91 46 Z" fill="#ffffff" opacity=".95"/>';
      out += '<path class="pht-snow" d="M116 57 Q137 47 151 64 Q139 69 122 66 Z" fill="#eaf4f4" opacity=".92"/>';
      out += '<path class="pht-snow" d="M38 95 Q53 83 68 94 Q59 100 43 101 Z" fill="#f4f9f9" opacity=".9"/>';
      out += '<path class="pht-snow" d="M133 93 Q148 82 162 96 Q151 101 137 100 Z" fill="#eef7f7" opacity=".9"/>';
      out += '<path class="pht-snow" d="M87 132 Q101 125 116 134 Q105 140 91 138 Z" fill="#f8fcfc" opacity=".88"/>';
    }

    return out;
  }

  function treeMarkup(info) {
    if (info.fraction < .015) return sproutMarkup(info);

    var growth = info.growth;
    var scale = (.46 + growth * .54).toFixed(3);
    var leafCount = Math.min(CANOPY.length, 8 + Math.round(growth * 10));
    var fruitCount = info.ended ? FRUIT.length :
      (info.fraction > .52 ? Math.min(FRUIT.length, 1 + Math.floor((info.fraction - .52) / .075)) : 0);
    var content = '<defs>' + premiumDefs(info.season) + '</defs>';

    content += '<ellipse cx="100" cy="244" rx="73" ry="12" fill="#09130e" opacity=".36"/>';
    content += '<g transform="translate(100 236) scale(' + scale + ') translate(-100 -236)">';
    content += '<path d="M99 229 C79 230 62 239 45 247 M99 230 C119 231 138 240 157 247 M96 228 C81 221 70 218 56 220 M104 228 C119 220 132 217 146 221" fill="none" stroke="#684727" stroke-width="6" stroke-linecap="round" opacity=".9"/>';
    content += '<path d="M82 235 C83 211 79 185 85 154 C88 137 93 119 99 101 C106 122 111 138 114 156 C120 187 116 213 120 235 Z" fill="url(#phtBark)"/>';
    content += '<path d="M95 226 C94 193 95 153 101 116" fill="none" stroke="#c29a62" stroke-width="3.2" stroke-linecap="round" opacity=".42"/>';
    content += '<path d="M96 174 C75 161 63 148 52 130 M104 176 C126 159 139 143 149 124 M96 148 C78 133 71 116 68 101 M103 145 C119 128 127 111 131 94 M99 126 C88 109 86 93 87 77 M102 123 C112 105 114 89 112 73" fill="none" stroke="#5a3c22" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>';

    for (var i = 0; i < leafCount; i += 1) {
      var leaf = CANOPY[i];
      content += organicBlob(100 + leaf[0], 101 + leaf[1], leaf[2], leaf[3], leaf[4], (.82 + (i % 4) * .05).toFixed(2));
    }

    var detailLeaves = [
      [47, 111, -32, .86], [146, 107, 24, .92], [61, 73, -18, .8],
      [134, 66, 20, .9], [84, 45, -7, .82], [116, 43, 9, .9]
    ];
    var detailCount = Math.min(detailLeaves.length, 2 + Math.round(growth * 4));
    for (var d = 0; d < detailCount; d += 1) {
      var detail = detailLeaves[d];
      content += '<use href="#phtLeafShape" transform="translate(' + detail[0] + ' ' + detail[1] + ') rotate(' + detail[2] + ') scale(' + detail[3] + ')" fill="#b9ce74" opacity=".84"/>';
    }

    for (var f = 0; f < fruitCount; f += 1) {
      var fruit = FRUIT[f];
      content += '<use href="#phtFruitShape" transform="translate(' + (100 + fruit[0]) + ' ' + (100 + fruit[1]) + ') scale(' + fruit[2] + ')" filter="url(#phtGlow)"/>';
    }

    content += seasonalDecor(info);

    if (info.ended) {
      content += '<path d="M100 34 l4 8 9 .8 -6.7 6 2.1 8.7 -8.4 -4.7 -8.4 4.7 2.1 -8.7 -6.7 -6 9 -.8 Z" fill="#edc86c" filter="url(#phtGlow)"/>';
    }

    content += '</g>';
    return content;
  }

  function ensurePhotorealSeason(visual, season) {
    if (!visual || visual.dataset.seasonLayer === season) return;
    var layer = visual.querySelector('.pht-seasonal-layer');
    if (!layer) {
      layer = document.createElement('span');
      layer.className = 'pht-seasonal-layer';
      layer.setAttribute('aria-hidden', 'true');
      visual.appendChild(layer);
    }

    var positions = [[27,30],[42,19],[59,25],[72,38],[34,51],[53,47],[67,59],[44,68],[61,74]];
    var markup = '';
    if (season === 'spring') {
      for (var s = 0; s < positions.length; s += 1) {
        markup += '<i class="pht-photo-bud" style="--x:' + positions[s][0] + '%;--y:' + positions[s][1] + '%;--delay:' + (s * .16).toFixed(2) + 's"></i>';
      }
    } else {
      for (var l = 0; l < positions.length; l += 1) {
        markup += '<i class="pht-photo-light pht-photo-light-' + (l % 3) + '" style="--x:' + positions[l][0] + '%;--y:' + positions[l][1] + '%;--delay:' + (l * .13).toFixed(2) + 's"></i>';
      }
    }
    if (season === 'autumn') {
      var leaves = [[20,25,-24],[78,28,27],[28,58,-38],[75,61,34],[51,12,-8],[84,48,41]];
      for (var a = 0; a < leaves.length; a += 1) {
        markup += '<i class="pht-photo-autumn-leaf" style="--x:' + leaves[a][0] + '%;--y:' + leaves[a][1] + '%;--r:' + leaves[a][2] + 'deg;--delay:' + (a * .31).toFixed(2) + 's"></i>';
      }
    }
    if (season === 'winter') {
      var snow = [[26,26,24,8,-12],[52,14,31,9,3],[71,31,24,8,14],[32,51,21,7,-7],[64,55,25,8,9],[49,72,22,7,0]];
      for (var w = 0; w < snow.length; w += 1) {
        markup += '<i class="pht-photo-snow" style="--x:' + snow[w][0] + '%;--y:' + snow[w][1] + '%;--w:' + snow[w][2] + '%;--h:' + snow[w][3] + '%;--r:' + snow[w][4] + 'deg"></i>';
      }
    }
    layer.className = 'pht-seasonal-layer is-' + season;
    layer.innerHTML = markup;
    visual.dataset.seasonLayer = season;
  }

  function enhanceTree(weekOverride) {
    var svg = document.getElementById('treeSvg');
    if (!svg) return;
    var info = resolveGrowth(weekOverride);
    var stage = svg.closest ? svg.closest('.tree-stage') : document.querySelector('#m-home .tree-stage');
    if (stage) {
      var visual = stage.querySelector('.presence-tree-photoreal');
      if (!visual) {
        visual = document.createElement('div');
        visual.className = 'presence-tree-photoreal';
        visual.setAttribute('aria-hidden', 'true');
        stage.appendChild(visual);
      }
      stage.dataset.treeSeason = info.season;
      stage.dataset.treeGrowth = String(Math.round(info.fraction * 100));
      stage.style.setProperty('--ph-tree-growth', String(clamp(.86 + info.growth * .14, .9, 1)));
      ensurePhotorealSeason(visual, info.season);
    }
    svg.innerHTML = treeMarkup(info);
    svg.dataset.premiumTree = VERSION;
    svg.dataset.growth = String(Math.round(info.fraction * 100));
    svg.dataset.season = info.season;
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', info.ended ? '완성된 프레젠스 나무' : '성장 중인 프레젠스 나무 ' + Math.round(info.fraction * 100) + '%');
  }

  function ensureWaterer() {
    var stage = document.querySelector('#m-home .tree-stage');
    if (!stage) return null;
    /* The Atelier home owns the personalized companion. Never create a
       second placeholder chick, which would overlap the user's avatar. */
    return document.getElementById('homeWateringCompanion') || stage.querySelector('.atelier-waterer');
  }

  function animateWaterer() {
    var waterer = ensureWaterer();
    if (!waterer) return;
    window.clearTimeout(waterTimer);
    waterer.classList.remove('is-watering');
    void waterer.offsetWidth;
    waterer.classList.add('is-watering');
    waterTimer = window.setTimeout(function () {
      waterer.classList.remove('is-watering');
    }, 2650);
  }

  function readProgress() {
    try {
      if (typeof state !== 'undefined' && state && typeof state.pr === 'number') return state.pr;
    } catch (error) {}
    var el = document.getElementById('prCount');
    return el ? Number(el.textContent) || 0 : 0;
  }

  function dispatchWatered(before, after) {
    var detail = { before: before, after: after, at: Date.now() };
    try {
      window.dispatchEvent(new CustomEvent('presence:watered', { detail: detail }));
    } catch (error) {
      var event = document.createEvent('CustomEvent');
      event.initCustomEvent('presence:watered', false, false, detail);
      window.dispatchEvent(event);
    }
  }

  function injectStyles() {
    if (document.getElementById('presenceHomeTreePremiumStyles')) return;
    var style = document.createElement('style');
    style.id = 'presenceHomeTreePremiumStyles';
    style.textContent = '' +
      '#treeSvg[data-premium-tree]{overflow:visible;filter:drop-shadow(0 14px 16px rgba(5,13,9,.32));}' +
      ':where(.atelier-waterer){position:absolute;z-index:5;left:clamp(4px,2vw,26px);bottom:clamp(6px,1.6vw,18px);width:clamp(92px,10vw,146px);aspect-ratio:1;pointer-events:none;transform-origin:50% 100%;filter:drop-shadow(0 10px 10px rgba(5,12,8,.28));}' +
      ':where(.atelier-waterer-chick){display:block;width:100%;height:100%;object-fit:contain;user-select:none;}' +
      ':where(.atelier-waterer-can){position:absolute;width:52%;right:-17%;bottom:2%;transform:rotate(-8deg);transform-origin:78% 70%;filter:drop-shadow(0 4px 5px rgba(0,0,0,.3));}' +
      ':where(.atelier-water-stream){position:absolute;left:107%;bottom:5%;width:44%;height:35%;opacity:0;transform:rotate(9deg);}' +
      ':where(.atelier-water-stream) i{position:absolute;top:0;width:6px;height:11px;border-radius:60% 40% 65% 35%;background:linear-gradient(180deg,#effcff,#6dcce2 72%,#2e91bc);box-shadow:0 0 7px rgba(120,221,246,.5);animation:atelierDrop .66s linear infinite;}' +
      ':where(.atelier-water-stream) i:nth-child(1){left:2%;animation-delay:0s}:where(.atelier-water-stream) i:nth-child(2){left:22%;animation-delay:.12s}:where(.atelier-water-stream) i:nth-child(3){left:43%;animation-delay:.24s}:where(.atelier-water-stream) i:nth-child(4){left:64%;animation-delay:.36s}:where(.atelier-water-stream) i:nth-child(5){left:83%;animation-delay:.48s}' +
      ':where(.atelier-waterer.is-watering){animation:atelierWatererStep 2.6s cubic-bezier(.2,.72,.22,1);}' +
      ':where(.atelier-waterer.is-watering) :where(.atelier-waterer-can){animation:atelierCanPour 2.6s cubic-bezier(.32,.74,.24,1);}' +
      ':where(.atelier-waterer.is-watering) :where(.atelier-water-stream){animation:atelierStreamShow 2.6s linear both;}' +
      '@keyframes atelierWatererStep{0%,100%{transform:translateX(0) rotate(0)}20%{transform:translateX(8%) rotate(1deg)}72%{transform:translateX(10%) rotate(-1deg)}}' +
      '@keyframes atelierCanPour{0%,18%,88%,100%{transform:rotate(-8deg)}34%,72%{transform:rotate(-36deg) translate(-2%,5%)}}' +
      '@keyframes atelierStreamShow{0%,29%,78%,100%{opacity:0}34%,72%{opacity:1}}' +
      '@keyframes atelierDrop{0%{transform:translate(0,0) scale(.72);opacity:0}18%{opacity:1}100%{transform:translate(-19px,38px) scale(1);opacity:0}}' +
      '@media(max-width:1024px){:where(.atelier-waterer){width:clamp(80px,13vw,116px);left:3px;bottom:8px}}' +
      '@media(max-width:600px){:where(.atelier-waterer){width:72px;left:0;bottom:6px}:where(.atelier-waterer-can){right:-14%;width:49%}}' +
      '@media(prefers-reduced-motion:reduce){:where(.atelier-waterer,.atelier-waterer-can,.atelier-water-stream,.atelier-water-stream i){animation:none!important}:where(.atelier-waterer.is-watering) :where(.atelier-water-stream){opacity:1}}';
    document.head.appendChild(style);
  }

  function wrapRenderTree() {
    if (renderWrapped || typeof window.renderTree !== 'function') return false;
    var original = window.renderTree;
    if (original.__presencePremiumTreeWrapper) {
      renderWrapped = true;
      return true;
    }
    function wrappedRenderTree(weekOverride) {
      var result = original.apply(this, arguments);
      try { enhanceTree(weekOverride); } catch (error) {
        if (window.console && console.warn) console.warn('[Presence tree premium] visual enhancement skipped', error);
      }
      return result;
    }
    wrappedRenderTree.__presencePremiumTreeWrapper = true;
    wrappedRenderTree.__presenceOriginal = original;
    window.renderTree = wrappedRenderTree;
    renderWrapped = true;
    return true;
  }

  function wrapWaterTree() {
    if (waterWrapped || typeof window.waterTree !== 'function') return false;
    var original = window.waterTree;
    if (original.__presencePremiumWaterWrapper) {
      waterWrapped = true;
      return true;
    }
    function wrappedWaterTree() {
      var before = readProgress();
      var result = original.apply(this, arguments);
      var after = readProgress();
      if (after > before) dispatchWatered(before, after);
      return result;
    }
    wrappedWaterTree.__presencePremiumWaterWrapper = true;
    wrappedWaterTree.__presenceOriginal = original;
    window.waterTree = wrappedWaterTree;
    waterWrapped = true;
    return true;
  }

  function install() {
    if (installed) return true;
    if (!wrapRenderTree()) return false;
    wrapWaterTree();
    injectStyles();
    window.addEventListener('presence:watered', animateWaterer);
    installed = true;
    try { enhanceTree(); } catch (error) {}
    window.PresenceHomeTreePremium = {
      version: VERSION,
      refresh: enhanceTree,
      animateWatering: function () { dispatchWatered(readProgress(), readProgress() + 1); }
    };
    return true;
  }

  var attempts = 0;
  function boot() {
    if (install()) return;
    attempts += 1;
    if (attempts < 100) window.setTimeout(boot, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}());
