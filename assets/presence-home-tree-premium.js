/* Presence Home — premium orchard tree visual layer.
 * This module never writes growth/watering data. It lets the workbook's
 * renderTree()/waterTree() finish first, then upgrades only the presentation.
 */
(function () {
  'use strict';

  var VERSION = '1.0.0';
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
        preview: preview
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
        preview: /미리보기/.test(label)
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

  function sproutMarkup() {
    return '' +
      '<defs>' + premiumDefs() + '</defs>' +
      '<ellipse cx="100" cy="241" rx="31" ry="7" fill="#08130d" opacity=".32"/>' +
      '<path d="M55 239 C70 235 80 236 99 239 C118 235 132 235 148 239" fill="none" stroke="#846339" stroke-width="3" stroke-linecap="round" opacity=".62"/>' +
      '<path d="M99 239 C98 226 100 213 101 197" fill="none" stroke="url(#phtBark)" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M100 215 C88 208 78 199 76 187 C91 188 100 199 100 215 Z" fill="url(#phtLeaf)"/>' +
      '<path d="M101 207 C113 199 124 190 128 178 C112 179 102 191 101 207 Z" fill="url(#phtLeaf)" opacity=".9"/>' +
      '<path d="M100 235 C89 238 80 241 73 246 M101 235 C112 238 122 242 130 246" fill="none" stroke="#6f4c29" stroke-width="2.5" stroke-linecap="round" opacity=".78"/>';
  }

  function premiumDefs() {
    return '' +
      '<linearGradient id="phtBark" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#9a7447"/><stop offset=".48" stop-color="#5b3c22"/><stop offset="1" stop-color="#2f2116"/>' +
      '</linearGradient>' +
      '<radialGradient id="phtLeaf" cx="35%" cy="25%" r="78%">' +
        '<stop offset="0" stop-color="#a9c765"/><stop offset=".46" stop-color="#587f35"/><stop offset="1" stop-color="#203d28"/>' +
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

  function treeMarkup(info) {
    if (info.fraction < .015) return sproutMarkup();

    var growth = info.growth;
    var scale = (.46 + growth * .54).toFixed(3);
    var leafCount = Math.min(CANOPY.length, 8 + Math.round(growth * 10));
    var fruitCount = info.ended ? FRUIT.length :
      (info.fraction > .52 ? Math.min(FRUIT.length, 1 + Math.floor((info.fraction - .52) / .075)) : 0);
    var content = '<defs>' + premiumDefs() + '</defs>';

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

    if (info.ended) {
      content += '<path d="M45 113 C72 126 126 122 154 107 M61 75 C82 87 119 86 139 73" fill="none" stroke="#d9b86a" stroke-width="1.35" opacity=".72"/>';
      var lights = [[57,116],[79,121],[103,121],[127,117],[145,109],[76,80]];
      for (var l = 0; l < lights.length; l += 1) {
        content += '<circle cx="' + lights[l][0] + '" cy="' + lights[l][1] + '" r="2.5" fill="#fff1a3" filter="url(#phtGlow)"/>';
      }
      content += '<path d="M100 34 l4 8 9 .8 -6.7 6 2.1 8.7 -8.4 -4.7 -8.4 4.7 2.1 -8.7 -6.7 -6 9 -.8 Z" fill="#edc86c" filter="url(#phtGlow)"/>';
    }

    content += '</g>';
    return content;
  }

  function enhanceTree(weekOverride) {
    var svg = document.getElementById('treeSvg');
    if (!svg) return;
    var info = resolveGrowth(weekOverride);
    svg.innerHTML = treeMarkup(info);
    svg.dataset.premiumTree = VERSION;
    svg.dataset.growth = String(Math.round(info.fraction * 100));
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
