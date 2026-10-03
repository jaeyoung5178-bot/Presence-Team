/* ============================================================================
 * farm-ui.js — 프레젠스 동물농장 · 씬(장면) 시스템
 * 단일 IIFE / 외부 의존성 없음 / 기존 앱 코드 비침습(몽키패치 + DOM 후처리)
 * 스타일은 <style id="farm-scene-css"> 로만 주입, 클래스 접두어 fs-
 * ==========================================================================*/
(function () {
  'use strict';
  if (window.__FARM_UI_SCENE__) return;
  window.__FARM_UI_SCENE__ = true;

  /* ---------------------------------------------------------------- assets */
  var ASSETS = 'assets/';
  var IMG_DAY = ASSETS + 'farm-village-day.webp';
  var IMG_NIGHT = ASSETS + 'concept-village-night.webp';
  var IMG_ATELIER = ASSETS + 'concept-atelier.webp';
  var ART_W = 1600, ART_H = 1322, ART_R = ART_W / ART_H;

  /* ----------------------------------------------------------------- utils */
  function el(id) { return document.getElementById(id); }
  function q(sel, root) { try { return (root || document).querySelector(sel); } catch (e) { return null; } }
  function qa(sel, root) { try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); } catch (e) { return []; } }
  function mk(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function say(m) { try { if (typeof window.toast === 'function') window.toast(m); } catch (e) { } }
  function tryv(fn, d) { try { var v = fn(); return v === undefined ? d : v; } catch (e) { return d; } }
  function lsGetRaw(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsSetRaw(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function reduceMotion() {
    return tryv(function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }, false);
  }

  /* 전역(let/const) 안전 접근 — 미정의/TDZ 시 undefined */
  function gState() { return tryv(function () { return state; }, null); }
  function gMe() { return tryv(function () { return me; }, null); }
  function gToday() { return tryv(function () { return TODAY; }, new Date().toISOString().slice(0, 10)); }
  function gRoleLabel() { return tryv(function () { return ROLE_LABEL; }, null); }
  function gTabmeta() { return tryv(function () { return TABMETA; }, null); }
  function gNav() { return tryv(function () { return NAV; }, null); }
  function nkey(n) {
    return tryv(function () { return nk(n); },
      String(n == null ? '' : n).trim().replace(/[.#$\/\[\]]/g, '_'));
  }
  function roleText(r) {
    var L = gRoleLabel();
    return (L && L[r]) ? L[r] : (r || '');
  }
  function myName() { var m = gMe(); return (m && m.name) ? m.name : '농장지기'; }
  function myRole() { var m = gMe(); return roleText(m && m.role); }

  function scrollToEl(node, extra) {
    if (!node) return;
    var head = q('header.top');
    var off = (head ? head.offsetHeight : 0) + (extra || 12);
    var y = node.getBoundingClientRect().top + window.pageYOffset - off;
    try { window.scrollTo({ top: y < 0 ? 0 : y, behavior: reduceMotion() ? 'auto' : 'smooth' }); }
    catch (e) { window.scrollTo(0, y < 0 ? 0 : y); }
  }
  function goHomeSection(id) {
    var node = el(id);
    if (!node) { say('해당 영역을 찾지 못했어요'); return; }
    try { if (typeof window.goTab === 'function') window.goTab('home'); } catch (e) { }
    setTimeout(function () { scrollToEl(el(id) || node); }, 60);
  }

  /* -------------------------------------------------------------- SVG 심볼 */
  var SVG = {
    leaf: function (c, s) {
      return '<svg class="fs-ic" width="' + (s || 16) + '" height="' + (s || 16) + '" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M20 4c0 9-5.5 15-13 15-1 0-2-.1-3-.4C5.6 10.8 11 4.6 20 4Z" fill="' + (c || '#4f8f3a') + '"/>' +
        '<path d="M4 20c3-6 8-10 13-12" stroke="#2f5f24" stroke-width="1.3" stroke-linecap="round"/></svg>';
    },
    chevron: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fountain: '<svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
      '<path d="M16 4c0 3-3 4-3 6.5S16 14 16 14s3-1 3-3.5S16 7 16 4Z" fill="currentColor" opacity=".85"/>' +
      '<path d="M6 20h20l-2.5 7h-15L6 20Z" fill="currentColor" opacity=".55"/>' +
      '<rect x="9" y="15" width="14" height="3.4" rx="1.6" fill="currentColor"/>' +
      '<path d="M4 28h24" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".7"/></svg>',
    house: '<svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
      '<path d="M4 15 16 5l12 10" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M7 14v13h18V14" fill="currentColor" opacity=".35"/>' +
      '<path d="M7 14v13h18V14" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
      '<rect x="13" y="19" width="6" height="8" rx="1" fill="currentColor" opacity=".85"/></svg>',
    greenhouse: '<svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
      '<path d="M16 4 4 12v15h24V12L16 4Z" fill="currentColor" opacity=".3"/>' +
      '<path d="M16 4 4 12v15h24V12L16 4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M16 5v22M4 13h24M10 9v18M22 9v18" stroke="currentColor" stroke-width="1.3" opacity=".8"/></svg>',
    market: '<svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
      '<path d="M3 12h26l-2 5H5l-2-5Z" fill="currentColor" opacity=".45"/>' +
      '<path d="M3 12 6 6h20l3 6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M3 12c2 3 5 3 6.5 0 1.6 3 4.4 3 6.5 0 2.1 3 4.9 3 6.5 0 1.5 3 4.5 3 6.5 0" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M6 17v10h20V17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    docs: '<svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
      '<rect x="7" y="4" width="15" height="20" rx="2" fill="currentColor" opacity=".3"/>' +
      '<rect x="7" y="4" width="15" height="20" rx="2" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M11 10h7M11 14h7M11 18h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      '<path d="M12 9h13a2 2 0 0 1 2 2v17H15" stroke="currentColor" stroke-width="1.6" opacity=".6" stroke-linejoin="round"/></svg>',
    seasonSpring: '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><g fill="#f6a8c8"><ellipse cx="12" cy="6" rx="3" ry="4.2"/><ellipse cx="12" cy="18" rx="3" ry="4.2"/><ellipse cx="6" cy="12" rx="4.2" ry="3"/><ellipse cx="18" cy="12" rx="4.2" ry="3"/></g><circle cx="12" cy="12" r="2.4" fill="#f2d06b"/></svg>',
    seasonSummer: '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="#f2c94c"/><g stroke="#3f9a24" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M19.4 4.6l-2.1 2.1M6.7 17.3l-2.1 2.1"/></g></svg>',
    seasonAutumn: '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 4c0 9-5.4 15-12.8 15-1 0-2-.1-3-.4C4.7 10.7 10 4.6 19 4Z" fill="#d97b3f"/><path d="M3.5 20.5C6.4 14.6 11.3 10.6 16 8.7" stroke="#a34e1e" stroke-width="1.4" stroke-linecap="round"/></svg>',
    seasonWinter: '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><g stroke="#bcd9ec" stroke-width="1.9" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="M9 4.2 12 6l3-1.8M9 19.8 12 18l3 1.8"/></g></svg>'
  };

  /* ------------------------------------------------------------------- CSS */
  var CSS = [
    /* ---- 공통 래퍼 / 씬 ---- */
    '.fs-wrap{position:relative;margin:0 0 18px;isolation:isolate}',
    '.fs-scene{position:relative;overflow:hidden;border-radius:18px;min-height:calc(100vh - 150px);',
    'background:#0d141f;box-shadow:0 18px 48px rgba(0,0,0,.45),inset 0 0 0 1px rgba(201,168,106,.22)}',
    '@media (max-width:1279px){.fs-scene{min-height:68vh}}',
    '@media (max-width:767px){.fs-scene{min-height:62vh;border-radius:14px}}',

    /* 2중 배경: 뒤=블러 cover, 앞=선명 contain */
    '.fs-bg-blur{position:absolute;inset:-4%;background-size:cover;background-position:center;filter:blur(26px) saturate(1.05);transform:scale(1.15);opacity:.85;z-index:0}',
    '.fs-stage{position:absolute;inset:0;z-index:1;overflow:hidden}',
    '.fs-art{position:absolute;left:0;top:0;width:100%;height:100%;opacity:1;transition:opacity .45s ease}',
    '.fs-art-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;user-select:none;-webkit-user-drag:none;pointer-events:none}',
    '.fs-scene[data-noart="1"] .fs-art{background:linear-gradient(180deg,#7fb6da 0%,#bfe0ea 45%,#8dbf62 46%,#4f8236 100%);border-radius:12px}',
    '.fs-scene[data-noart="1"] .fs-art-img{display:none}',

    /* 시간대 틴트 */
    '.fs-tint{position:absolute;inset:0;z-index:2;pointer-events:none;transition:background .8s ease}',
    '.fs-scene[data-tod="day"] .fs-tint{background:none}',
    '.fs-scene[data-tod="dawn"] .fs-tint{background:linear-gradient(180deg,rgba(255,183,120,.30),rgba(255,214,170,.10) 45%,rgba(90,120,160,.18))}',
    '.fs-scene[data-tod="dusk"] .fs-tint{background:linear-gradient(180deg,rgba(255,140,66,.28),rgba(148,88,120,.20) 55%,rgba(38,44,84,.30))}',
    '.fs-scene[data-tod="night"] .fs-tint{background:linear-gradient(180deg,rgba(10,18,42,.55),rgba(12,22,52,.42) 55%,rgba(6,12,30,.60))}',
    '.fs-scene[data-tod="dawn"] .fs-art-img{filter:brightness(.92) saturate(1.05) hue-rotate(-6deg)}',
    '.fs-scene[data-tod="dusk"] .fs-art-img{filter:brightness(.82) saturate(1.12) sepia(.10)}',
    '.fs-scene[data-tod="night"] .fs-art-img{filter:brightness(.55) saturate(.85)}',
    '.fs-scene[data-tod="night"] .fs-bg-blur{filter:blur(26px) brightness(.5)}',

    /* ---- 나무 팻말 버튼 ---- */
    '.fs-sign{position:absolute;transform:translate(-50%,-50%) scale(.7);opacity:0;z-index:6;',
    'min-width:96px;min-height:46px;padding:9px 16px 10px;border:0;cursor:pointer;',
    'background:linear-gradient(180deg,#24344e,#1c2a40 60%,#16223a);',
    'border-radius:9px;box-shadow:0 0 0 2px #c9a86a,0 0 0 4px rgba(28,42,64,.9),0 0 0 5.5px rgba(201,168,106,.55),0 10px 22px rgba(0,0,0,.45);',
    "font-family:Georgia,'Nanum Myeongjo','Times New Roman',serif;color:#f6efe1;font-size:clamp(12px,1.15vw,16px);letter-spacing:.06em;font-weight:600;white-space:nowrap;",
    'transition:transform .28s cubic-bezier(.34,1.56,.64,1),box-shadow .28s ease,opacity .28s ease}',
    '.fs-scene.fs-in .fs-sign{opacity:1;transform:translate(-50%,-50%) scale(1);animation:fsSignPop .5s cubic-bezier(.34,1.56,.64,1) both;animation-delay:var(--d,0ms)}',
    '@keyframes fsSignPop{0%{opacity:0;transform:translate(-50%,-50%) scale(.7)}60%{opacity:1;transform:translate(-50%,-56%) scale(1.06)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}',
    '.fs-sign:hover{transform:translate(-50%,-56%) scale(1.09);box-shadow:0 0 0 2px #e6c98d,0 0 0 4px rgba(28,42,64,.9),0 0 0 6px rgba(201,168,106,.75),0 0 26px 6px rgba(201,168,106,.45),0 16px 30px rgba(0,0,0,.5)}',
    '.fs-sign:active{transform:translate(-50%,-50%) scale(.95)}',
    '.fs-sign:focus-visible{outline:3px solid #ffe9b8;outline-offset:4px}',
    '.fs-sign .fs-nails{position:absolute;left:0;right:0;top:5px;display:flex;justify-content:space-between;padding:0 9px;pointer-events:none}',
    '.fs-sign .fs-nails i{width:5px;height:5px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#f0dfae,#9a7c3f 60%,#5d4a24);box-shadow:0 1px 1px rgba(0,0,0,.5)}',
    '.fs-sign .fs-sl{display:block;margin-top:4px}',
    '@media (max-width:767px){.fs-sign{min-width:72px;min-height:44px;padding:8px 10px 9px;font-size:11px;letter-spacing:.03em;border-radius:8px}.fs-sign .fs-nails{padding:0 6px;top:4px}}',

    /* ---- 인사 명판 ---- */
    '.fs-greet{position:absolute;left:20px;top:18px;z-index:8;max-width:min(46%,420px);',
    'background:linear-gradient(180deg,#f7f2e7,#f2ece0);border:1.5px solid #8a6a44;border-radius:12px;padding:13px 17px 14px 15px;',
    'box-shadow:0 10px 26px rgba(0,0,0,.38),inset 0 0 0 1px rgba(255,255,255,.6);opacity:0;transform:translateY(-16px)}',
    '.fs-scene.fs-in .fs-greet{animation:fsDrop .6s ease .25s both}',
    '@keyframes fsDrop{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:translateY(0)}}',
    '.fs-greet h3{margin:0;font-family:Georgia,"Nanum Myeongjo",serif;font-size:clamp(15px,1.5vw,20px);color:#3b2a17;line-height:1.35;font-weight:700;display:flex;align-items:center;gap:7px}',
    '.fs-greet p{margin:5px 0 0;font-size:clamp(11px,1vw,13px);color:#6b543a;line-height:1.45}',
    '@media (max-width:767px){.fs-greet{left:10px;top:10px;padding:9px 11px;max-width:62%;border-radius:10px}.fs-greet h3{font-size:13px;gap:5px}.fs-greet p{font-size:10.5px}}',

    /* ---- FARM KEEPER 배지 ---- */
    '.fs-keeper{position:absolute;right:20px;top:18px;z-index:8;text-align:right;',
    'background:linear-gradient(180deg,#22314a,#16223a);border-radius:11px;padding:11px 16px;',
    'box-shadow:0 0 0 1.5px #c9a86a,0 10px 24px rgba(0,0,0,.42);opacity:0;transform:translateY(-16px)}',
    '.fs-scene.fs-in .fs-keeper{animation:fsDrop .6s ease .35s both}',
    '.fs-keeper .fs-kt{display:block;font-size:10.5px;letter-spacing:.30em;color:#e2c78c;font-weight:700;text-transform:uppercase}',
    '.fs-keeper .fs-kn{display:block;margin-top:4px;font-family:Georgia,"Nanum Myeongjo",serif;font-size:clamp(11px,1.05vw,14px);color:#f4eee1}',
    '.fs-keeper .fs-rivet{position:absolute;width:5px;height:5px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#f0dfae,#9a7c3f 60%,#5d4a24)}',
    '.fs-keeper .fs-rivet.a{left:7px;top:7px}.fs-keeper .fs-rivet.b{right:7px;top:7px}',
    '.fs-keeper .fs-rivet.c{left:7px;bottom:7px}.fs-keeper .fs-rivet.d{right:7px;bottom:7px}',
    '@media (max-width:767px){.fs-keeper{right:10px;top:10px;padding:8px 11px;border-radius:9px}.fs-keeper .fs-kt{font-size:8.5px;letter-spacing:.2em}.fs-keeper .fs-kn{font-size:10px}}',

    /* ---- 수첩 패널 ---- */
    '.fs-note{position:relative;z-index:9;background-color:#f9f3e4;border-radius:12px;',
    'box-shadow:0 14px 34px rgba(0,0,0,.34),inset 0 0 0 1px rgba(150,120,80,.28);padding:16px 18px 16px 40px;margin-top:14px;',
    'background-image:linear-gradient(180deg,rgba(255,252,243,.9),rgba(246,239,223,.9)),repeating-linear-gradient(180deg,transparent 0 25px,rgba(120,100,70,.09) 25px 26px);opacity:0}',
    '.fs-wrap.fs-in .fs-note{animation:fsSlideUp .55s cubic-bezier(.22,1,.36,1) .7s both}',
    '@keyframes fsSlideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}',
    '.fs-rings{position:absolute;left:14px;top:16px;bottom:16px;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none}',
    '.fs-rings i{width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 34% 28%,#fff,#c8c2b4 55%,#7d7768);box-shadow:inset 0 -1px 2px rgba(0,0,0,.35),0 1px 2px rgba(0,0,0,.2)}',
    '.fs-note h4{margin:0 0 10px;font-family:Georgia,"Nanum Myeongjo",serif;font-size:16px;color:#3a2b19;display:flex;align-items:center;gap:7px;font-weight:700}',
    '.fs-nitem{display:flex;align-items:flex-start;gap:11px;padding:9px 6px 9px 0;border:0;background:transparent;width:100%;text-align:left;cursor:pointer;border-radius:8px;transition:background .18s ease,transform .18s ease}',
    '.fs-nitem:hover{background:rgba(92,188,46,.10);transform:translateX(2px)}',
    '.fs-nitem:focus-visible{outline:2px solid #5cbc2e;outline-offset:2px}',
    '.fs-nnum{flex:0 0 auto;width:23px;height:23px;border-radius:50%;background:linear-gradient(180deg,#6fce3e,#4c9c26);color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(50,110,25,.4)}',
    '.fs-ntxt{flex:1 1 auto;min-width:0}',
    '.fs-ntt{display:block;font-size:13.5px;font-weight:700;color:#33261a;line-height:1.35}',
    '.fs-nds{display:block;margin-top:2px;font-size:11.5px;color:#7a6549}',
    '.fs-chip{flex:0 0 auto;align-self:center;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;letter-spacing:.02em;white-space:nowrap}',
    '.fs-chip.done{background:#dff2d2;color:#2f6b17;box-shadow:inset 0 0 0 1px #a9d68f}',
    '.fs-chip.wait{background:#fdeccc;color:#8a5a12;box-shadow:inset 0 0 0 1px #e6c98d}',
    '.fs-chip.info{background:#dfe8f6;color:#2b4a7a;box-shadow:inset 0 0 0 1px #a9c1e4}',
    '.fs-quote{margin:12px 0 0;padding-top:10px;border-top:1px dashed rgba(120,100,70,.35);font-style:italic;font-size:11.5px;color:#7a6549;font-family:Georgia,"Nanum Myeongjo",serif}',
    '@media (min-width:1280px){.fs-note{position:absolute;right:20px;top:88px;bottom:auto;transform:none;width:332px;margin-top:0;max-height:calc(100% - 150px);overflow:auto}',
    '.fs-stage{right:372px}',
    '.fs-wrap.fs-in .fs-note{animation:fsSlideIn .55s cubic-bezier(.22,1,.36,1) .7s both}',
    '@keyframes fsSlideIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}}',

    /* ---- 앰비언트 ---- */
    '.fs-amb{position:absolute;inset:0;z-index:4;pointer-events:none;overflow:hidden}',
    '.fs-spark{position:absolute;width:5px;height:5px;border-radius:50%;background:radial-gradient(circle,#fff 0%,rgba(255,255,255,.7) 40%,transparent 70%);opacity:0;animation:fsSpark 3.4s ease-in-out infinite}',
    '@keyframes fsSpark{0%,100%{opacity:0;transform:scale(.5)}50%{opacity:.95;transform:scale(1.25)}}',
    '.fs-river{position:absolute;left:2%;bottom:6%;width:34%;height:12%;border-radius:50%;pointer-events:none;',
    'background:linear-gradient(100deg,transparent 10%,rgba(255,255,255,.30) 45%,transparent 78%);background-size:220% 100%;animation:fsShim 7s linear infinite;opacity:.6}',
    '@keyframes fsShim{0%{background-position:180% 0}100%{background-position:-60% 0}}',
    '.fs-fall{position:absolute;top:-8%;opacity:0;animation:fsFall linear infinite}',
    '@keyframes fsFall{0%{opacity:0;transform:translate3d(0,0,0) rotate(0deg)}8%{opacity:.9}92%{opacity:.85}100%{opacity:0;transform:translate3d(120px,115vh,0) rotate(520deg)}}',
    '.fs-star{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;box-shadow:0 0 6px 1px rgba(255,255,255,.75);opacity:0;animation:fsTwinkle 3.6s ease-in-out infinite}',
    '@keyframes fsTwinkle{0%,100%{opacity:.12;transform:scale(.7)}50%{opacity:1;transform:scale(1.2)}}',
    '.fs-scene:not([data-tod="night"]) .fs-star{display:none}',

    /* ---- 씬 내부 날씨(전역 FX 미오염) ---- */
    '.fs-wx{position:absolute;inset:0;z-index:5;pointer-events:none;overflow:hidden}',
    '.fs-drop{position:absolute;top:-12%;width:1.6px;height:16px;border-radius:1px;background:linear-gradient(180deg,rgba(190,220,255,0),rgba(190,220,255,.85));animation:fsRain linear infinite}',
    '@keyframes fsRain{0%{transform:translate3d(0,-12%,0)}100%{transform:translate3d(26px,118vh,0)}}',
    '.fs-flake{position:absolute;top:-8%;border-radius:50%;background:rgba(255,255,255,.92);box-shadow:0 0 4px rgba(255,255,255,.6);animation:fsSnow linear infinite}',
    '@keyframes fsSnow{0%{transform:translate3d(0,-8%,0)}50%{transform:translate3d(22px,55vh,0)}100%{transform:translate3d(-10px,116vh,0)}}',
    '.fs-wtoggle{position:absolute;right:14px;bottom:14px;z-index:10;display:inline-flex;align-items:center;gap:6px;',
    'padding:6px 11px;min-height:32px;border:0;border-radius:999px;cursor:pointer;font-size:11px;font-weight:700;letter-spacing:.02em;',
    'background:rgba(22,34,58,.72);color:#e2c78c;box-shadow:0 0 0 1px rgba(201,168,106,.55);backdrop-filter:blur(6px);transition:background .2s ease,color .2s ease}',
    '.fs-wtoggle .fs-dot{width:7px;height:7px;border-radius:50%;background:#5a6274;transition:background .2s ease}',
    '.fs-wtoggle[aria-pressed="true"] .fs-dot{background:#6fce3e;box-shadow:0 0 7px rgba(111,206,62,.9)}',
    '.fs-wtoggle:hover{background:rgba(28,42,64,.92);color:#f6e6bd}',

    /* ---- 스크롤 버튼 ---- */
    '.fs-scroll{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:10;display:inline-flex;align-items:center;gap:6px;',
    'padding:9px 17px;min-height:40px;border:0;border-radius:999px;cursor:pointer;font-size:12.5px;font-weight:700;',
    "font-family:Georgia,'Nanum Myeongjo',serif;background:rgba(22,34,58,.80);color:#f2e6c9;",
    'box-shadow:0 0 0 1.5px rgba(201,168,106,.6),0 8px 20px rgba(0,0,0,.4);backdrop-filter:blur(6px);animation:fsBounce 2.2s ease-in-out infinite}',
    '@keyframes fsBounce{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,7px)}}',
    '.fs-scroll:hover{background:rgba(30,46,72,.95);color:#fff}',
    '@media (max-width:767px){.fs-scroll{bottom:10px;font-size:11.5px;padding:8px 14px}.fs-wtoggle{right:10px;bottom:10px;font-size:10px}}',

    /* ---- 영역 씬 배너 ---- */
    '.fs-banner{position:relative;display:flex;align-items:center;gap:14px;height:72px;padding:0 20px;margin:0 0 14px;',
    'border-radius:14px;overflow:hidden;color:#f4eee1;box-shadow:inset 0 -2px 0 0 rgba(201,168,106,.85),0 6px 18px rgba(0,0,0,.28);',
    'animation:fsBannerIn .35s cubic-bezier(.22,1,.36,1) both}',
    '@keyframes fsBannerIn{from{opacity:0;transform:translateX(-26px)}to{opacity:1;transform:translateX(0)}}',
    '.fs-banner .fs-bsym{flex:0 0 auto;display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:11px;background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}',
    '.fs-banner .fs-btx{flex:1 1 auto;min-width:0}',
    '.fs-banner .fs-ben{display:block;font-size:10px;letter-spacing:.30em;text-transform:uppercase;font-weight:800;color:#e6cf9c}',
    '.fs-banner .fs-bko{display:block;margin-top:2px;font-family:Georgia,"Nanum Myeongjo",serif;font-size:17px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.fs-banner .fs-bcur{flex:0 0 auto;font-size:12.5px;font-weight:700;padding:6px 13px;border-radius:999px;background:rgba(0,0,0,.28);box-shadow:inset 0 0 0 1px rgba(255,255,255,.16);max-width:44%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '@media (max-width:767px){.fs-banner{height:56px;padding:0 12px;gap:10px;margin-bottom:10px;border-radius:11px}',
    '.fs-banner .fs-bsym{width:34px;height:34px;border-radius:9px}.fs-banner .fs-bsym svg{width:20px;height:20px}',
    '.fs-banner .fs-ben{font-size:8.5px;letter-spacing:.2em}.fs-banner .fs-bko{font-size:13.5px}',
    '.fs-banner .fs-bcur{font-size:10.5px;padding:4px 9px;max-width:38%}}',
    '.fs-banner.z-today{background:linear-gradient(100deg,#22314f,#3d5c8c 60%,#5f80b4)}',
    '.fs-banner.z-people{background:linear-gradient(100deg,#4a3220,#7a5535 60%,#9c6f45)}',
    '.fs-banner.z-progress{background:linear-gradient(100deg,#1a3a20,#2f6b30 60%,#428f3c)}',
    '.fs-banner.z-profit{background:linear-gradient(100deg,#54400f,#8a6a1f 60%,#b08c33)}',
    '.fs-banner.z-office{background:linear-gradient(100deg,#101a2c,#1e2f4c 60%,#2c4368)}',
    '.mpanel > .wrap > .fs-banner:first-child,.mpanel > .fs-banner:first-child{margin-top:0}',

    /* ---- 로그인 화면 ---- */
    '#authGate{position:relative}',
    '#authGate > .auth-card,#authGate > .auth-foot{position:relative;z-index:2}',
    '.fs-auth-bg{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:#070c18}',
    '.fs-auth-bg .fs-ab-img{position:absolute;inset:0;background-size:cover;background-position:center;animation:fsFadeIn 1.1s ease both}',
    '@keyframes fsFadeIn{from{opacity:0}to{opacity:1}}',
    '.fs-auth-bg .fs-ab-vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,rgba(6,10,22,.10) 0%,rgba(6,10,22,.62) 58%,rgba(4,7,16,.92) 100%)}',
    '.fs-auth-lamp{position:absolute;width:150px;height:150px;border-radius:50%;transform:translate(-50%,-50%);',
    'background:radial-gradient(circle,rgba(255,206,126,.55) 0%,rgba(255,183,96,.20) 38%,transparent 70%);animation:fsLamp 4.2s ease-in-out infinite}',
    '@keyframes fsLamp{0%,100%{opacity:.45;transform:translate(-50%,-50%) scale(.94)}50%{opacity:.95;transform:translate(-50%,-50%) scale(1.08)}}',
    '.fs-auth-title{position:relative;z-index:2;text-align:center;margin:2px 0 14px}',
    '.fs-auth-title b{display:block;font-family:Georgia,"Nanum Myeongjo",serif;font-size:clamp(19px,3.6vw,26px);color:#f6ecd6;letter-spacing:.02em;text-shadow:0 2px 12px rgba(0,0,0,.65)}',
    '.fs-auth-title span{display:block;margin-top:6px;font-size:clamp(11px,2.2vw,13px);color:#cdb98f;letter-spacing:.03em}',

    /* ---- 나무 계절 뱃지 / 아틀리에 ---- */
    '.fs-season{display:inline-flex;align-items:center;gap:5px;margin-left:8px;padding:3px 10px;border-radius:999px;',
    'font-size:11px;font-weight:700;vertical-align:middle;background:rgba(255,255,255,.09);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);color:inherit}',
    '.fs-atelier-bg{position:absolute;inset:0;z-index:0;border-radius:inherit;overflow:hidden;pointer-events:none}',
    '.fs-atelier-bg .fs-ab-img{position:absolute;inset:0;background-size:cover;background-position:center}',
    '.fs-atelier-bg .fs-ab-ov{position:absolute;inset:0;background:linear-gradient(180deg,rgba(12,10,8,.62),rgba(12,10,8,.44) 45%,rgba(8,6,4,.72))}',
    '.fs-atelier-bg .fs-ab-pad{position:absolute;left:50%;bottom:7%;width:56%;height:13%;transform:translateX(-50%);border-radius:50%;',
    'background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,.55) 0%,rgba(0,0,0,.28) 55%,transparent 78%)}',
    '.fs-atelier-host{position:relative}',
    '.fs-atelier-host > *:not(.fs-atelier-bg){position:relative;z-index:1}',
    '.fs-atelier-sub{margin:2px 0 12px;font-size:13px;color:#c9c0ae;line-height:1.5}',

    /* ---- 접근성 / 모션 축소 ---- */
    '@media (prefers-reduced-motion: reduce){',
    '.fs-scene .fs-art,.fs-scene .fs-greet,.fs-scene .fs-keeper,.fs-wrap .fs-note,.fs-scene .fs-sign,.fs-banner,.fs-auth-bg .fs-ab-img{animation:none!important;transition:none!important;opacity:1!important;transform:none!important}',
    '.fs-scene.fs-in .fs-sign{transform:translate(-50%,-50%) scale(1)!important}',
    '.fs-spark,.fs-fall,.fs-star,.fs-river,.fs-drop,.fs-flake,.fs-scroll,.fs-auth-lamp{animation:none!important}',
    '.fs-fall,.fs-drop,.fs-flake{display:none!important}',
    '.fs-scroll{transform:translateX(-50%)!important}}'
  ].join('');

  function injectCSS() {
    if (el('farm-scene-css')) return;
    var s = document.createElement('style');
    s.id = 'farm-scene-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ------------------------------------------------------------ 시간대 판정 */
  function todOf() {
    var h = new Date().getHours();
    if (h >= 5 && h < 8) return 'dawn';
    if (h >= 8 && h < 17) return 'day';
    if (h >= 17 && h < 20) return 'dusk';
    return 'night';
  }

  /* ====================================================================== */
  /* 1. 홈 로비 씬                                                           */
  /* ====================================================================== */

  var SIGNS = [
    { x: 54.6, y: 11, w: 14.5, en: 'Today', act: function () { goHomeSection('todaySec'); } },
    { x: 20.4, y: 15.5, w: 18, en: 'People', act: function () { goHomeSection('praiseSec'); } },
    { x: 84.4, y: 15.3, w: 17, en: 'Progress', act: function () { goHomeSection('treeSecHome'); } },
    { x: 26.3, y: 49, w: 18, en: 'Profit', act: function () { try { window.goTab('sale'); } catch (e) { say('이동할 수 없어요'); } } },
    {
      x: 75.5, y: 50, w: 18.5, en: 'Farm Office', act: function () {
        var ok = tryv(function () { return typeof tabVisible === 'function' && tabVisible('admin'); }, false);
        if (ok) { try { window.goTab('admin'); } catch (e) { } }
        else say('관리자 전용 공간이에요');
      }
    }
  ];

  /* --- 수첩 실데이터 --- */
  function noteItems() {
    var out = [];
    var st = gState(), m = gMe(), today = gToday();

    /* ① 오늘 출근 */
    try {
      if (st && m && m.name) {
        var day = st.attend && st.attend[today];
        var rec = day ? day[nkey(m.name)] : null;
        out.push({
          title: rec ? '오늘 출근 체크 완료' : '오늘 출근 체크하기',
          desc: rec ? '오늘도 농장에 도착했어요.' : '하루의 시작을 팀에 알려주세요.',
          chip: rec ? '완료' : '대기',
          cls: rec ? 'done' : 'wait',
          go: function () { goHomeSection('attendSec'); }
        });
      }
    } catch (e) { }

    /* ② 나무 물주기 */
    try {
      if (st && m && m.uid) {
        var w = st.waters && st.waters[m.uid];
        var did = !!(w && w.last === today);
        out.push({
          title: did ? '오늘 물주기 완료' : '나무에 물 주기',
          desc: did ? '우리 나무가 한 뼘 더 자랐어요.' : '하루 한 번, 함께 키우는 나무를 돌봐요.',
          chip: did ? '완료' : '대기',
          cls: did ? 'done' : 'wait',
          go: function () { goHomeSection('treeSecHome'); }
        });
      }
    } catch (e) { }

    /* ③ 관리자: 가입 승인 대기 / 그 외: 최신 공지 */
    try {
      var isAdm = tryv(function () { return typeof isFounder === 'function' && isFounder(gMe()); }, false);
      if (isAdm && st && st.users) {
        var pend = 0;
        Object.keys(st.users).forEach(function (k) {
          var s = st.users[k] && st.users[k].status;
          if (s === 'pending' || s === 'wait' || s === 'waiting') pend++;
        });
        out.push({
          title: pend ? ('가입 승인 대기 ' + pend + '명') : '가입 승인 대기 없음',
          desc: pend ? '새 이웃이 농장 문 앞에서 기다리고 있어요.' : '지금은 처리할 승인 요청이 없어요.',
          chip: pend ? String(pend) : '완료',
          cls: pend ? 'wait' : 'done',
          go: function () { try { window.goTab('admin'); } catch (e) { } }
        });
      } else if (st && st.notices && st.notices.length) {
        var arr = st.notices.slice().sort(function (a, b) { return (b.t || 0) - (a.t || 0); });
        var n0 = arr[0];
        if (n0 && n0.title) {
          out.push({
            title: String(n0.title).slice(0, 40),
            desc: '농장 게시판에 올라온 가장 새로운 소식이에요.',
            chip: '공지', cls: 'info',
            go: function () { try { window.goTab('notice'); } catch (e) { } }
          });
        }
      }
    } catch (e) { }

    return out;
  }

  function noteHTML() {
    var items = noteItems();
    var rows = items.map(function (it, i) {
      return '<button class="fs-nitem" type="button" data-fs-note="' + i + '">' +
        '<span class="fs-nnum">' + (i + 1) + '</span>' +
        '<span class="fs-ntxt"><span class="fs-ntt">' + esc(it.title) + '</span>' +
        '<span class="fs-nds">' + esc(it.desc) + '</span></span>' +
        '<span class="fs-chip ' + it.cls + '">' + esc(it.chip) + '</span></button>';
    }).join('');
    if (!rows) rows = '<div class="fs-nds" style="padding:6px 0">오늘의 할 일을 불러오는 중이에요.</div>';
    var rings = '';
    for (var r = 0; r < 8; r++) rings += '<i></i>';
    return '<div class="fs-rings" aria-hidden="true">' + rings + '</div>' +
      '<h4>' + SVG.leaf('#4f8f3a', 17) + '오늘 먼저 볼 3가지</h4>' +
      rows +
      '<p class="fs-quote">작은 돌봄이 모여 큰 성장을 만듭니다.</p>';
  }

  function bindNote(noteEl) {
    if (!noteEl) return;
    var items = noteItems();
    qa('[data-fs-note]', noteEl).forEach(function (b) {
      var i = parseInt(b.getAttribute('data-fs-note'), 10);
      b.addEventListener('click', function () {
        var it = items[i];
        if (it && typeof it.go === 'function') { try { it.go(); } catch (e) { } }
      });
    });
  }

  /* --- 앰비언트 요소 --- */
  function ambientHTML() {
    var h = '';
    /* 분수(52,28) 근처 반짝임 3 */
    var sp = [[52, 28], [48.5, 30.5], [55.5, 26.5]];
    sp.forEach(function (p, i) {
      h += '<span class="fs-spark" style="left:' + p[0] + '%;top:' + p[1] + '%;animation-delay:' + (i * 1.1).toFixed(1) + 's"></span>';
    });
    /* 강 shimmer */
    h += '<span class="fs-river"></span>';
    /* 낙엽 2 */
    h += '<span class="fs-fall" style="left:22%;animation-duration:26s;animation-delay:-4s">' + SVG.leaf('#78a94e', 16) + '</span>';
    h += '<span class="fs-fall" style="left:71%;animation-duration:23s;animation-delay:-13s">' + SVG.leaf('#c9a86a', 14) + '</span>';
    /* 별 12 (야간에만 표시) */
    for (var i = 0; i < 12; i++) {
      var x = (7 + (i * 7.4) % 88).toFixed(1), y = (5 + (i * 13.7) % 34).toFixed(1);
      h += '<span class="fs-star" style="left:' + x + '%;top:' + y + '%;animation-delay:' + ((i % 6) * .6).toFixed(1) + 's"></span>';
    }
    return h;
  }

  /* --- 씬 레이아웃(선명 이미지 = 팻말 좌표계) --- */
  function layoutArt(scene) {
    var stage = q('.fs-stage', scene), art = q('.fs-art', scene);
    if (!stage || !art) return;
    var W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) {
      /* 패널이 아직 숨겨져 있으면 크기가 0 — 보일 때까지 재시도 */
      if (!scene.__fsRetry) scene.__fsRetry = 0;
      if (scene.__fsRetry < 60) {
        scene.__fsRetry++;
        setTimeout(function () { layoutArt(scene); }, 350);
      }
      return;
    }
    scene.__fsRetry = 0;
    var w = W, h = W / ART_R;
    if (h > H) { h = H; w = H * ART_R; }
    art.style.width = w + 'px';
    art.style.height = h + 'px';
    art.style.left = ((W - w) / 2) + 'px';
    art.style.top = ((H - h) / 2) + 'px';
  }

  var _ro = null;
  function watchLayout(scene) {
    var relayout = function () { layoutArt(scene); };
    relayout();
    try {
      if (window.ResizeObserver) {
        if (_ro) _ro.disconnect();
        _ro = new ResizeObserver(relayout);
        _ro.observe(q('.fs-stage', scene));
      }
    } catch (e) { }
    window.addEventListener('resize', relayout);
    window.addEventListener('orientationchange', function () { setTimeout(relayout, 220); });
    setTimeout(relayout, 60); setTimeout(relayout, 400); setTimeout(relayout, 1200);
  }

  /* --- 씬 생성 --- */
  function buildHomeScene() {
    var home = el('m-home');
    if (!home) return false;
    if (el('farmSceneWrap')) { refreshScene(); return true; }

    var host = q('.wrap', home) || home;
    var tod = todOf();

    var wrap = mk('div', 'fs-wrap');
    wrap.id = 'farmSceneWrap';

    var signHTML = SIGNS.map(function (s, i) {
      return '<button class="fs-sign" type="button" data-fs-sign="' + i + '" ' +
        'style="left:' + s.x + '%;top:' + s.y + '%;' + (s.w ? 'width:' + s.w + '%;' : '') + '--d:' + (450 + i * 80) + 'ms" ' +
        'aria-label="' + esc(s.en) + '">' +
        '<span class="fs-nails" aria-hidden="true"><i></i><i></i></span>' +
        '<span class="fs-sl">' + esc(s.en) + '</span></button>';
    }).join('');

    var wxAuto = lsGetRaw('farm_weather_auto', '1') !== '0';

    wrap.innerHTML =
      '<section class="fs-scene" id="farmScene" data-tod="' + tod + '" aria-label="프레젠스 동물농장 마을">' +
      '<div class="fs-bg-blur" id="farmSceneBlur" aria-hidden="true"></div>' +
      '<div class="fs-stage">' +
      '<div class="fs-art">' +
      '<img class="fs-art-img" id="farmSceneImg" alt="프레젠스 동물농장 마을 전경" src="' + IMG_DAY + '">' +
      '<div class="fs-amb" aria-hidden="true">' + ambientHTML() + '</div>' +
      signHTML +
      '</div></div>' +
      '<div class="fs-tint" aria-hidden="true"></div>' +
      '<div class="fs-wx" id="farmSceneWx" aria-hidden="true"></div>' +
      '<div class="fs-greet" id="farmGreet"><h3>' + SVG.leaf('#4f8f3a', 17) + '<span class="fs-greet-t"></span></h3>' +
      '<p>프레젠스 동물농장은 오늘도 함께 자라요.</p></div>' +
      '<div class="fs-keeper" id="farmKeeper">' +
      '<i class="fs-rivet a"></i><i class="fs-rivet b"></i><i class="fs-rivet c"></i><i class="fs-rivet d"></i>' +
      '<span class="fs-kt">Farm Keeper</span><span class="fs-kn"></span></div>' +
      '<button class="fs-wtoggle" type="button" id="farmWxToggle" aria-pressed="' + (wxAuto ? 'true' : 'false') + '">' +
      '<span class="fs-dot" aria-hidden="true"></span>자동날씨</button>' +
      '<button class="fs-scroll" type="button" id="farmScrollBtn">농장 소식 ' + SVG.chevron + '</button>' +
      '</section>' +
      '<aside class="fs-note" id="farmNote"></aside>';

    if (host.firstChild) host.insertBefore(wrap, host.firstChild);
    else host.appendChild(wrap);

    var scene = q('.fs-scene', wrap);

    /* 배경 이미지 + 폴백 */
    var img = el('farmSceneImg');
    var blur = el('farmSceneBlur');
    if (blur) blur.style.backgroundImage = 'url("' + IMG_DAY + '")';
    if (img) {
      img.addEventListener('error', function () {
        scene.setAttribute('data-noart', '1');
        if (blur) blur.style.backgroundImage = 'none';
      }, { once: true });
    }

    /* 팻말 바인딩 */
    qa('[data-fs-sign]', wrap).forEach(function (b) {
      var i = parseInt(b.getAttribute('data-fs-sign'), 10);
      b.addEventListener('click', function (ev) {
        ev.preventDefault();
        var s = SIGNS[i];
        if (s && typeof s.act === 'function') { try { s.act(); } catch (e) { } }
      });
    });

    /* 스크롤 버튼 */
    var sb = el('farmScrollBtn');
    if (sb) sb.addEventListener('click', function () {
      var next = wrap.nextElementSibling;
      if (next) scrollToEl(next);
      else window.scrollBy({ top: window.innerHeight * .8, behavior: reduceMotion() ? 'auto' : 'smooth' });
    });

    /* 날씨 토글 */
    var wt = el('farmWxToggle');
    if (wt) wt.addEventListener('click', function () {
      var on = wt.getAttribute('aria-pressed') !== 'true';
      wt.setAttribute('aria-pressed', on ? 'true' : 'false');
      lsSetRaw('farm_weather_auto', on ? '1' : '0');
      if (on) fetchWeather(true); else clearWeather();
      say(on ? '자동 날씨를 켰어요' : '자동 날씨를 껐어요');
    });

    watchLayout(scene);
    refreshScene();

    requestAnimationFrame(function () {
      scene.classList.add('fs-in');
      wrap.classList.add('fs-in');
    });

    startTodTimer();
    if (wxAuto) fetchWeather(false);
    return true;
  }

  /* 이름/직급/수첩/시간대 갱신 */
  function refreshScene() {
    var scene = el('farmScene');
    if (!scene) return;
    scene.setAttribute('data-tod', todOf());

    var name = myName(), role = myRole();
    var gt = q('.fs-greet-t', scene);
    if (gt) gt.textContent = '좋은 하루예요, ' + name + (role ? ' ' + role : '') + '님!';
    var kn = q('.fs-keeper .fs-kn', scene);
    if (kn) kn.textContent = '농장지기 ' + name + (role ? ' ' + role : '') + '님';

    var note = el('farmNote');
    if (note) { note.innerHTML = noteHTML(); bindNote(note); }
  }

  var _todTimer = null;
  function startTodTimer() {
    if (_todTimer) return;
    _todTimer = setInterval(function () {
      var s = el('farmScene');
      if (s) s.setAttribute('data-tod', todOf());
    }, 5 * 60 * 1000);
  }

  /* --- 날씨 (Open-Meteo, 씬 내부 전용) --- */
  var WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=37.49&longitude=126.72&current_weather=true';
  function clearWeather() { var w = el('farmSceneWx'); if (w) w.innerHTML = ''; }
  function paintWeather(kind) {
    var w = el('farmSceneWx');
    if (!w) return;
    w.innerHTML = '';
    if (reduceMotion() || !kind) return;
    var h = '', i;
    if (kind === 'rain') {
      for (i = 0; i < 46; i++) {
        h += '<span class="fs-drop" style="left:' + ((i * 7.3) % 100).toFixed(1) + '%;height:' + (12 + (i % 5) * 4) + 'px;' +
          'animation-duration:' + (0.62 + (i % 6) * .09).toFixed(2) + 's;animation-delay:-' + ((i % 9) * .12).toFixed(2) + 's;opacity:' + (.35 + (i % 4) * .15).toFixed(2) + '"></span>';
      }
    } else if (kind === 'snow') {
      for (i = 0; i < 34; i++) {
        var sz = 3 + (i % 4);
        h += '<span class="fs-flake" style="left:' + ((i * 9.1) % 100).toFixed(1) + '%;width:' + sz + 'px;height:' + sz + 'px;' +
          'animation-duration:' + (8 + (i % 7)) + 's;animation-delay:-' + ((i % 10) * .9).toFixed(1) + 's;opacity:' + (.5 + (i % 5) * .1).toFixed(2) + '"></span>';
      }
    }
    w.innerHTML = h;
  }
  var _wxDone = false;
  function fetchWeather(force) {
    if (_wxDone && !force) return;
    if (lsGetRaw('farm_weather_auto', '1') === '0') { clearWeather(); return; }
    if (typeof fetch !== 'function') return;
    _wxDone = true;
    try {
      fetch(WX_URL, { cache: 'no-store' })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (j) {
          var c = j && j.current_weather && j.current_weather.weathercode;
          if (c == null) return;
          c = Number(c);
          var kind = null;
          if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95) kind = 'rain';
          if ((c >= 71 && c <= 77) || c === 85 || c === 86) kind = 'snow';
          paintWeather(kind);
        })
        .catch(function () { });
    } catch (e) { }
  }

  /* ====================================================================== */
  /* 2. 영역 씬 배너                                                         */
  /* ====================================================================== */

  var ZONES = {
    today: { en: 'Today', ko: '오늘 광장', sym: SVG.fountain },
    people: { en: 'People', ko: '사람 사랑방', sym: SVG.house },
    progress: { en: 'Progress', ko: '성장 온실', sym: SVG.greenhouse },
    profit: { en: 'Profit', ko: '수익 장터', sym: SVG.market },
    office: { en: 'Farm Office', ko: '관리자 집무실', sym: SVG.docs }
  };

  /* 탭 → 존 (스펙 우선, 미매핑은 NAV 그룹으로 폴백) */
  var TAB_ZONE = {
    today: 'today', notice: 'today', kakao: 'today', gb: 'today', celeb: 'today', board: 'today', attend: 'today',
    hall: 'people', teamtree: 'people', oneonone: 'people', calling: 'people', meeting: 'people',
    net: 'people', act: 'people', leaderwish: 'people', setupkit: 'people',
    manual: 'people', training: 'people', topics: 'people',
    journey: 'progress', leaderhit: 'progress', cod: 'progress', comp: 'progress', wins: 'progress',
    recap: 'progress', survey: 'progress', petshop: 'progress',
    sale: 'profit', callback: 'profit', cbjournal: 'profit', rejectnote: 'profit', obj: 'profit',
    field: 'profit', sites: 'profit', perf: 'profit', daily: 'profit',
    admin: 'office', events: 'office', eventsurvey: 'office', gsheet: 'office', salesmgr: 'office'
  };
  var GROUP_ZONE = { today: 'today', people: 'people', progress: 'progress', profit: 'profit', my: 'progress', admin: 'office' };

  function zoneOf(tab) {
    if (TAB_ZONE[tab]) return TAB_ZONE[tab];
    var nav = gNav();
    if (nav) {
      for (var i = 0; i < nav.length; i++) {
        if (nav[i] && nav[i].tabs && nav[i].tabs.indexOf(tab) >= 0) return GROUP_ZONE[nav[i].k] || 'today';
      }
    }
    return 'today';
  }
  function tabLabel(tab) {
    var TM = gTabmeta();
    return (TM && TM[tab] && TM[tab].l) ? TM[tab].l : tab;
  }

  function injectBanner(tab) {
    if (!tab || tab === 'home') return;
    var panel = el('m-' + tab);
    if (!panel) return;
    var host = q('.wrap', panel) || panel;
    var old = q(':scope > .fs-banner', host) || q('.fs-banner', host);
    if (old && old.getAttribute('data-fs-tab') === tab) return;   /* 중복 방지 */
    if (old && old.parentNode === host) host.removeChild(old);

    var z = ZONES[zoneOf(tab)] || ZONES.today;
    var b = mk('div', 'fs-banner z-' + zoneOf(tab));
    b.setAttribute('data-fs-tab', tab);
    b.innerHTML =
      '<span class="fs-bsym" aria-hidden="true">' + z.sym + '</span>' +
      '<span class="fs-btx"><span class="fs-ben">' + esc(z.en) + '</span>' +
      '<span class="fs-bko">' + esc(z.ko) + '</span></span>' +
      '<span class="fs-bcur">' + esc(tabLabel(tab)) + '</span>';

    /* 기존 첫 요소 위 삽입 + 레이아웃 밀림 방지 */
    var first = host.firstElementChild;
    if (first) {
      try {
        var cs = window.getComputedStyle(first);
        if (parseFloat(cs.marginTop) > 0) first.style.marginTop = '0px';
      } catch (e) { }
      host.insertBefore(b, first);
    } else host.appendChild(b);
  }

  /* ====================================================================== */
  /* 3. 로그인 화면                                                          */
  /* ====================================================================== */
  function decorateAuth() {
    var gate = el('authGate');
    if (!gate) return;

    if (!q('.fs-auth-bg', gate)) {
      var bg = mk('div', 'fs-auth-bg');
      bg.setAttribute('aria-hidden', 'true');
      var stars = '';
      for (var i = 0; i < 15; i++) {
        var x = (5 + (i * 6.7) % 90).toFixed(1), y = (4 + (i * 11.3) % 42).toFixed(1);
        stars += '<span class="fs-star" style="left:' + x + '%;top:' + y + '%;animation-delay:' + ((i % 7) * .5).toFixed(1) + 's;display:block"></span>';
      }
      var lamps = [[18, 62], [50, 71], [82, 58]].map(function (p, k) {
        return '<span class="fs-auth-lamp" style="left:' + p[0] + '%;top:' + p[1] + '%;animation-delay:' + (k * 1.3) + 's"></span>';
      }).join('');
      bg.innerHTML = '<div class="fs-ab-img" style="background-image:url(&quot;' + IMG_NIGHT + '&quot;)"></div>' +
        '<div class="fs-ab-vig"></div>' + lamps + stars;
      if (gate.firstChild) gate.insertBefore(bg, gate.firstChild); else gate.appendChild(bg);

      /* 이미지 로드 실패 폴백 */
      var probe = new Image();
      probe.onerror = function () {
        var im = q('.fs-ab-img', bg);
        if (im) im.style.backgroundImage = 'linear-gradient(180deg,#0b1430,#132244 45%,#07101f)';
      };
      probe.src = IMG_NIGHT;
    }

    var card = q('.auth-card', gate);
    if (card && !q('.fs-auth-title', card)) {
      var t = mk('div', 'fs-auth-title',
        '<b>프레젠스 동물농장</b><span>함께 가꾸고, 함께 성장하는 우리의 농장</span>');
      var box = q('.auth-box', card) || q('#authView', card);
      if (box) card.insertBefore(t, box); else card.appendChild(t);
    }
  }

  /* ====================================================================== */
  /* 4. 나무 계절                                                            */
  /* ====================================================================== */
  var AUTUMN = ['#d97b3f', '#c9542e', '#e0a13c'];

  function seasonNow() {
    var m = new Date().getMonth() + 1;
    if (m >= 3 && m <= 5) return 'spring';
    if (m >= 6 && m <= 8) return 'summer';
    if (m >= 9 && m <= 11) return 'autumn';
    return 'winter';
  }
  function isGreenish(hex) {
    var h = String(hex || '').trim();
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h);
    if (!m) return false;
    var v = m[1];
    if (v.length === 3) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
    var r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16);
    return g > r + 8 && g > b + 8 && g > 40;
  }

  var _seasonLock = false;
  function applySeason() {
    if (_seasonLock) return;
    var svg = el('treeSvg');
    if (!svg) return;
    _seasonLock = true;
    try {
      var s = seasonNow(), idx = 0;

      /* 기존 눈 레이어 제거 */
      qa('.fs-snowlayer', svg).forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });

      var nodes = qa('[fill]', svg);
      var leaves = [];
      nodes.forEach(function (n) {
        var src = n.getAttribute('data-farm-src');
        if (src == null) { src = n.getAttribute('fill') || ''; n.setAttribute('data-farm-src', src); }
        if (!isGreenish(src)) { n.setAttribute('fill', src); return; }
        leaves.push(n);
        if (s === 'summer') n.setAttribute('fill', '#2f7d1a');
        else if (s === 'autumn') { n.setAttribute('fill', AUTUMN[idx % AUTUMN.length]); idx++; }
        else if (s === 'spring') { n.setAttribute('fill', (idx % 3 === 0) ? '#f6a8c8' : src); idx++; }
        else n.setAttribute('fill', src); /* winter: 원색 복원 */
      });

      if (s === 'winter' && leaves.length) {
        var ns = 'http://www.w3.org/2000/svg';
        var g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'fs-snowlayer');
        g.setAttribute('pointer-events', 'none');
        leaves.forEach(function (n, i) {
          if (i % 2) return;
          var cx = parseFloat(n.getAttribute('cx')), cy = parseFloat(n.getAttribute('cy'));
          var rx = parseFloat(n.getAttribute('rx')) || parseFloat(n.getAttribute('r'));
          if (!isFinite(cx) || !isFinite(cy) || !isFinite(rx)) return;
          var e = document.createElementNS(ns, 'ellipse');
          e.setAttribute('cx', cx);
          e.setAttribute('cy', cy - rx * 0.45);
          e.setAttribute('rx', Math.max(1.4, rx * 0.68));
          e.setAttribute('ry', Math.max(0.9, rx * 0.30));
          e.setAttribute('fill', '#ffffff');
          e.setAttribute('opacity', '0.9');
          g.appendChild(e);
        });
        if (g.childNodes.length) svg.appendChild(g);
      }

      paintSeasonBadge(s);
    } catch (e) { }
    setTimeout(function () { _seasonLock = false; }, 0);
  }

  function paintSeasonBadge(s) {
    var sec = el('treeSecHome');
    if (!sec) return;
    var h2 = q('.sec-head h2', sec) || q('h2', sec);
    if (!h2) return;
    var map = {
      spring: ['봄', SVG.seasonSpring], summer: ['여름', SVG.seasonSummer],
      autumn: ['가을', SVG.seasonAutumn], winter: ['겨울', SVG.seasonWinter]
    };
    var m = map[s] || map.summer;
    var b = q('.fs-season', h2);
    if (!b) { b = mk('span', 'fs-season'); h2.appendChild(b); }
    if (b.getAttribute('data-s') === s) return;
    b.setAttribute('data-s', s);
    b.innerHTML = m[1] + '<span>' + m[0] + '</span>';
  }

  var _seasonObs = null, _seasonTimer = null;
  function watchTree() {
    var svg = el('treeSvg');
    if (!svg || _seasonObs) { if (svg) applySeason(); return; }
    try {
      _seasonObs = new MutationObserver(function () {
        if (_seasonLock) return;
        clearTimeout(_seasonTimer);
        _seasonTimer = setTimeout(applySeason, 60);
      });
      _seasonObs.observe(svg, { childList: true, subtree: true });
    } catch (e) { }
    applySeason();
  }

  /* ====================================================================== */
  /* 5. 아틀리에                                                             */
  /* ====================================================================== */
  function decorateAtelier() {
    var p = el('m-petshop');
    if (!p) return;

    /* 제목 치환 */
    var head = q('h1,h2,.sec-head h2,.as-title', p);
    if (head && head.getAttribute('data-fs-atl') !== '1') {
      var kids = Array.prototype.filter.call(head.childNodes, function (n) { return n.nodeType === 3; });
      if (kids.length) kids.forEach(function (n, i) { n.nodeValue = i === 0 ? '나의 아틀리에' : ''; });
      else head.textContent = '나의 아틀리에';
      head.setAttribute('data-fs-atl', '1');
    }

    /* 부제 */
    if (!q('.fs-atelier-sub', p)) {
      var sub = mk('p', 'fs-atelier-sub', '마음에 드는 스타일로 꾸며보세요. 당신의 이야기가 깃듭니다.');
      var anchor = head || q('.wrap', p) || p;
      if (head && head.parentNode) head.parentNode.insertBefore(sub, head.nextSibling);
      else anchor.insertBefore(sub, anchor.firstChild);
    }

    /* 스테이지 배경 (아이템/미리보기 로직 미접촉 — 배경 레이어만 추가) */
    var stage = el('asStage') || q('.as-stage', p);
    if (stage && !q('.fs-atelier-bg', stage)) {
      stage.classList.add('fs-atelier-host');
      var bg = mk('div', 'fs-atelier-bg');
      bg.setAttribute('aria-hidden', 'true');
      bg.innerHTML = '<div class="fs-ab-img" style="background-image:url(&quot;' + IMG_ATELIER + '&quot;)"></div>' +
        '<div class="fs-ab-ov"></div><div class="fs-ab-pad"></div>';
      stage.insertBefore(bg, stage.firstChild);
      var probe = new Image();
      probe.onerror = function () {
        var im = q('.fs-ab-img', bg);
        if (im) im.style.backgroundImage = 'linear-gradient(180deg,#3a2a1c,#241a11 60%,#150f0a)';
      };
      probe.src = IMG_ATELIER;
    }
  }

  /* ====================================================================== */
  /* 6. 라벨 · 기타                                                          */
  /* ====================================================================== */
  var LABELS = {
    home: '농장',
    today: '오늘 광장',
    sale: '수익 장터',
    admin: '관리자 집무실',
    training: '성장 온실',
    petshop: '나의 아틀리에',
    notice: '농장 소식',
    hall: '명예의 전당'
  };
  var _labelsDone = false;
  function applyLabels() {
    if (_labelsDone) return;
    var TM = gTabmeta();
    if (!TM) return;
    Object.keys(LABELS).forEach(function (k) { if (TM[k]) TM[k].l = LABELS[k]; });
    _labelsDone = true;
    try { if (typeof window.buildRail === 'function' && gMe()) window.buildRail(); } catch (e) { }
    try { if (typeof window.buildBotbar === 'function' && gMe()) window.buildBotbar(); } catch (e) { }
  }

  function applyChrome() {
    try { document.title = '프레젠스 동물농장 워크북'; } catch (e) { }
    try { if (document.body) document.body.classList.add('farm-world'); } catch (e) { }
  }

  /* ====================================================================== */
  /* goTab 몽키패치                                                          */
  /* ====================================================================== */
  var _patched = false;
  function patchGoTab() {
    if (_patched) return true;
    if (typeof window.goTab !== 'function') return false;
    var orig = window.goTab;
    if (orig.__farmWrap) { _patched = true; return true; }

    function wrapped(name) {
      var r;
      try { r = orig.apply(this, arguments); } catch (e) { r = undefined; }
      try {
        var cur = tryv(function () { return curTab; }, name) || name;
        applyLabels();
        if (cur === 'home') {
          if (!buildHomeScene()) { /* 아직 DOM 미준비 */ }
          else refreshScene();
          watchTree();
        } else {
          injectBanner(cur);
        }
        if (cur === 'petshop') setTimeout(decorateAtelier, 40);
      } catch (e) { }
      return r;
    }
    wrapped.__farmWrap = true;
    /* 원본이 다른 래퍼(__pjwrap 등)를 갖고 있으면 플래그 승계 */
    try { if (orig.__pjwrap) wrapped.__pjwrap = orig.__pjwrap; } catch (e) { }
    window.goTab = wrapped;
    _patched = true;
    return true;
  }

  /* renderTree 몽키패치 — 렌더 직후 계절 재적용 */
  var _treePatched = false;
  function patchRenderTree() {
    if (_treePatched) return;
    if (typeof window.renderTree !== 'function') return;
    var orig = window.renderTree;
    if (orig.__farmWrap) { _treePatched = true; return; }
    function wrapped() {
      var r;
      try { r = orig.apply(this, arguments); } catch (e) { }
      setTimeout(applySeason, 30);
      return r;
    }
    wrapped.__farmWrap = true;
    window.renderTree = wrapped;
    _treePatched = true;
  }

  /* ====================================================================== */
  /* 부트스트랩                                                              */
  /* ====================================================================== */
  var _tries = 0, _pollId = null;
  function tick() {
    _tries++;
    injectCSS();
    applyChrome();
    decorateAuth();
    patchGoTab();
    patchRenderTree();
    applyLabels();

    var app = el('app');
    var loggedIn = !!(app && !app.classList.contains('hidden')) && !!gMe();

    if (loggedIn) {
      var homePanel = el('m-home');
      if (homePanel) {
        buildHomeScene();
        watchTree();
      }
      var cur = tryv(function () { return curTab; }, null);
      if (cur && cur !== 'home') injectBanner(cur);
      if (cur === 'petshop') decorateAtelier();
      if (el('farmSceneWrap')) { stopPoll(); return; }
    }
    if (_tries >= 20) stopPoll();
  }
  function stopPoll() { if (_pollId) { clearInterval(_pollId); _pollId = null; } }

  function boot() {
    injectCSS();
    applyChrome();
    decorateAuth();
    patchGoTab();
    patchRenderTree();
    tick();
    if (!_pollId) _pollId = setInterval(tick, 800);
    /* 로그인 지연 대비: 클릭/포커스 시 1회 재시도 */
    document.addEventListener('click', function once() {
      setTimeout(function () { patchGoTab(); patchRenderTree(); }, 0);
    }, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* 디버그/재적용용 최소 훅 (기존 전역 미침범) */
  window.__farmScene = {
    rebuild: function () {
      var w = el('farmSceneWrap');
      if (w && w.parentNode) w.parentNode.removeChild(w);
      buildHomeScene();
    },
    refresh: refreshScene,
    season: applySeason
  };
})();

/* ======================================================================== */
/* 6. 파머트 모듈 — 원화 에셋 연동 (계절 나무 원화 · 아틀리에 3면 · NPC 병아리) */
/*    독립 IIFE: 기존 코드 무접촉, DOM 후처리만. 이미지 실패 시 자동 폴백.      */
/* ======================================================================== */
(function () {
  'use strict';
  var ART = {
    spring: 'assets/farmart-tree-spring.webp',
    summer: 'assets/farmart-tree-base.webp',
    autumn: 'assets/farmart-tree-autumn.webp',
    winter: 'assets/farmart-tree-winter.webp',
    avF: 'assets/farmart-av-front.webp',
    avS: 'assets/farmart-av-side.webp',
    avB: 'assets/farmart-av-back.webp',
    npc: 'assets/pets/presence-pet-base.png'
  };
  function seasonKey() {
    var m = new Date().getMonth() + 1;
    if (m >= 3 && m <= 5) return 'spring';
    if (m >= 6 && m <= 8) return 'summer';
    if (m >= 9 && m <= 11) return 'autumn';
    return 'winter';
  }
  function css() {
    if (document.getElementById('farm-art-css')) return;
    var s = document.createElement('style'); s.id = 'farm-art-css';
    s.textContent = [
      '.fa-treewrap{position:relative;border-radius:16px;overflow:hidden;box-shadow:0 10px 26px rgba(0,0,0,.35),inset 0 0 0 1px rgba(201,168,106,.35)}',
      '.fa-tree{display:block;width:100%;max-height:430px;object-fit:cover;object-position:center 30%}',
      '.fa-tree-tag{position:absolute;right:10px;top:10px;background:rgba(18,26,40,.82);color:#f0e6cf;',
      'font:700 11px/1 Georgia,"Nanum Myeongjo",serif;padding:6px 11px;border-radius:999px;letter-spacing:.06em;',
      'box-shadow:inset 0 0 0 1px rgba(201,168,106,.5)}',
      '.fa-3v{display:flex;gap:10px;margin-top:12px}',
      '.fa-3v figure{flex:1 1 0;margin:0;border-radius:12px;overflow:hidden;',
      'box-shadow:0 6px 16px rgba(0,0,0,.35),inset 0 0 0 1px rgba(201,168,106,.4)}',
      '.fa-3v img{display:block;width:100%;height:96px;object-fit:cover}',
      '@media(max-width:767px){.fa-3v img{height:78px}}',
      '.fa-npc{position:absolute;z-index:5;pointer-events:none;will-change:transform;contain:layout style}',
      '.fa-npc .fa-flip{display:block;will-change:transform}',
      '.fa-npc img{display:block;width:100%}',
      '.fa-npc::after{content:"";position:absolute;left:14%;right:14%;bottom:-3px;height:9px;border-radius:50%;',
      'background:radial-gradient(ellipse,rgba(15,25,15,.30),rgba(0,0,0,0) 70%)}',
      '.fa-npc-a{width:6.5%;bottom:7%;left:6%;animation:faWalkA 46s linear infinite}',
      '.fa-npc-a .fa-flip{animation:faFlipA 46s step-end infinite}',
      '.fa-npc-a img{animation:faBob 1.1s ease-in-out infinite alternate}',
      '.fa-npc-b{width:5.6%;bottom:14%;left:20%;animation:faWalkB 58s linear infinite}',
      '.fa-npc-b .fa-flip{animation:faFlipB 58s step-end infinite}',
      '.fa-npc-b img{animation:faBob 1.3s ease-in-out infinite alternate}',
      '@keyframes faBob{from{transform:translateY(0) rotate(-2deg)}to{transform:translateY(-3.5%) rotate(2deg)}}',
      '@keyframes faWalkA{0%{transform:translateX(0)}48%{transform:translateX(880%)}52%{transform:translateX(880%)}100%{transform:translateX(0)}}',
      '@keyframes faFlipA{0%{transform:scaleX(1)}48%{transform:scaleX(-1)}100%{transform:scaleX(-1)}}',
      '@keyframes faWalkB{0%{transform:translateX(0)}46%{transform:translateX(820%)}54%{transform:translateX(820%)}100%{transform:translateX(0)}}',
      '@keyframes faFlipB{0%{transform:scaleX(-1)}46%{transform:scaleX(1)}100%{transform:scaleX(1)}}',
      '@media(prefers-reduced-motion:reduce){.fa-npc,.fa-npc img{animation:none!important}}'
    ].join('');
    document.head.appendChild(s);
  }
  /* A. 계절 나무 원화 */
  function treeArt() {
    var svg = document.getElementById('treeSvg');
    if (!svg || !svg.parentElement) return;
    var host = svg.parentElement;
    if (host.querySelector('.fa-treewrap')) { return; }
    var key = seasonKey();
    var wrap = document.createElement('div'); wrap.className = 'fa-treewrap';
    var img = new Image(); img.className = 'fa-tree'; img.alt = '프레젠스 나무 — ' + key;
    var tag = document.createElement('span'); tag.className = 'fa-tree-tag';
    tag.textContent = { spring: '봄 · 벚꽃', summer: '여름 · 초록', autumn: '가을 · 단풍', winter: '겨울 · 눈과 불빛' }[key];
    img.onload = function () { svg.style.display = 'none'; };
    img.onerror = function () { try { wrap.remove(); svg.style.display = ''; } catch (e) { } };
    img.src = ART[key];
    wrap.appendChild(img); wrap.appendChild(tag);
    host.insertBefore(wrap, svg);
  }
  /* B. 아틀리에 3면 */
  function atelier3v() {
    var p = document.getElementById('m-petshop');
    if (!p || p.querySelector('.fa-3v')) return;
    var stage = document.getElementById('asStage') || p.querySelector('.as-stage');
    if (!stage || !stage.parentElement) return;
    var row = document.createElement('div'); row.className = 'fa-3v';
    [['앞면', ART.avF], ['옆면', ART.avS], ['뒷면', ART.avB]].forEach(function (pair) {
      var f = document.createElement('figure');
      var im = new Image(); im.alt = pair[0]; im.src = pair[1];
      im.onerror = function () { try { f.remove(); } catch (e) { } };
      f.appendChild(im); row.appendChild(f);
    });
    stage.parentElement.insertBefore(row, stage.nextSibling);
  }
  /* C. NPC 병아리 산책 */
  function npcs() {
    var artbox = document.querySelector('#farmSceneWrap .fs-art');
    if (!artbox || artbox.querySelector('.fa-npc')) return;
    ['fa-npc-a', 'fa-npc-b'].forEach(function (cls) {
      var d = document.createElement('div'); d.className = 'fa-npc ' + cls;
      var fl = document.createElement('span'); fl.className = 'fa-flip';
      var im = new Image(); im.alt = ''; im.src = ART.npc;
      im.onerror = function () { try { d.remove(); } catch (e) { } };
      fl.appendChild(im); d.appendChild(fl); artbox.appendChild(d);
    });
  }
  function tick() { try { css(); treeArt(); atelier3v(); npcs(); } catch (e) { } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { tick(); setInterval(tick, 1600); });
  else { tick(); setInterval(tick, 1600); }
})();
