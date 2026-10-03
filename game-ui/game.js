/* ============================================================
   프레젠스 동물농장 — 게임 UI 레이어 (마을 월드맵 홈)
   기존 앱 위에 전체화면 게임 월드를 마운트. 기존 함수는 호출만.
   ============================================================ */
(function () {
  'use strict';

  var ART = 'game-ui/';
  var IMG_MAP = ART + 'farmart-village-clean.webp';
  var IMG_CHICK_A = ART + 'farmart-chick-idle.webp';
  var IMG_CHICK_B = ART + 'farmart-chick-walk.webp';
  var MAP_RATIO = 1022 / 791;

  /* ---- 안전 유틸 ---- */
  function ce(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function el(id) { return document.getElementById(id); }
  function q(s, r) { return (r || document).querySelector(s); }
  function tryv(fn, d) { try { var v = fn(); return v == null ? d : v; } catch (e) { return d; } }
  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function gMe() { return tryv(function () { return me; }, null); }
  function gState() { return tryv(function () { return state; }, {}) || {}; }
  function gToday() { return tryv(function () { return TODAY; }, ''); }
  function gNk(n) { return tryv(function () { return nk(n); }, String(n || '').toLowerCase()); }
  function canTab(k) { return tryv(function () { return typeof tabVisible === 'function' ? !!tabVisible(k) : true; }, true); }
  function goTabSafe(k) { try { if (typeof goTab === 'function') goTab(k); } catch (e) { } }

  function say(m) {
    var t = el('pgToast'); if (!t) { t = ce('div'); t.id = 'pgToast'; document.body.appendChild(t); }
    t.textContent = m; t.classList.add('show'); clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ---- SVG 아이콘 (이모지 금지) ---- */
  var SVG = {
    leaf: function (c, s) { s = s || 18; return '<svg class="pg-leaf" width="' + s + '" height="' + s + '" viewBox="0 0 24 24"><path fill="' + (c || '#7a9a4e') + '" d="M12 2C7 6 4 10 4 14a8 8 0 0 0 16 0c0-4-3-8-8-12Zm0 3.6c3 2.6 5 5.5 5 8.4a5 5 0 0 1-9.7 1.7C9 14 10.4 10 12 5.6Z"/></svg>'; },
    home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/></svg>',
    people: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M16 6a3 3 0 0 1 0 6"/><path d="M17 15c2 .5 4 2 4 5"/></svg>',
    flag: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 21V4"/><path d="M5 4h11l-2 3 2 3H5"/></svg>',
    sprout: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 21v-8"/><path d="M12 13C9 13 6 11 6 7c4 0 6 2 6 6Z"/><path d="M12 13c3 0 6-2 6-6-4 0-6 2-6 6Z"/></svg>',
    chat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-4 3v-3H4Z"/></svg>',
    book: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h9a3 3 0 0 1 3 3v13a3 3 0 0 0-3-2H5Z"/><path d="M19 4h0a1 1 0 0 1 0 0v14"/></svg>'
  };

  /* ---- 이름/직급 ---- */
  function meName() { var m = gMe(); return (m && m.name) || '농장지기'; }
  function meRole() { var m = gMe(); var lbl = tryv(function () { return ROLE_LABEL; }, {}) || {}; return (m && lbl[m.role]) ? lbl[m.role] : ''; }

  /* ============================================================
     기존 기능으로의 다리: "마을 → 기능 화면" 임시 이식 모드
     (각 장소가 커스텀 게임 룸으로 완성될 때까지의 안전한 연결)
     ============================================================ */
  function openLegacy(tabKey, placeName) {
    goTabSafe(tabKey);
    document.documentElement.classList.remove('pg-on');
    document.documentElement.classList.add('pg-legacy');
    var back = el('pgBack');
    if (!back) {
      back = ce('button'); back.id = 'pgBack'; back.type = 'button';
      back.innerHTML = '<span>&larr;</span> 마을로 돌아가기';
      back.style.cssText = 'position:fixed;z-index:99999;left:16px;top:14px;padding:11px 18px;border:0;cursor:pointer;' +
        'font-family:var(--pg-disp,serif);font-weight:700;color:#f6efdb;border-radius:12px;' +
        'background:linear-gradient(180deg,#26385a,#16233c);box-shadow:0 0 0 2px #c9a86a,0 8px 20px rgba(0,0,0,.4);';
      back.addEventListener('click', closeLegacy);
      document.body.appendChild(back);
    }
    back.style.display = '';
    var tag = el('pgPlaceTag');
    if (!tag) {
      tag = ce('div'); tag.id = 'pgPlaceTag';
      tag.style.cssText = 'position:fixed;z-index:99999;left:50%;top:14px;transform:translateX(-50%);padding:10px 20px;' +
        'font-family:var(--pg-disp,serif);font-weight:700;color:#f6efdb;border-radius:12px;' +
        'background:linear-gradient(180deg,#6f4d31,#4e3418);box-shadow:0 0 0 2px #a8843f,0 6px 16px rgba(0,0,0,.35);';
      document.body.appendChild(tag);
    }
    tag.textContent = placeName || '';
    tag.style.display = '';
  }
  function closeLegacy() {
    document.documentElement.classList.remove('pg-legacy');
    document.documentElement.classList.add('pg-on');
    if (el('pgBack')) el('pgBack').style.display = 'none';
    if (el('pgPlaceTag')) el('pgPlaceTag').style.display = 'none';
  }
  window.pgCloseLegacy = closeLegacy;

  /* ============================================================
     마을 월드맵 홈
     ============================================================ */
  var BUILDINGS = [
    { x: 53.5, y: 10, ko: '오늘 광장', act: function () { scrollLegacy('todaySec', '오늘 광장'); } },
    { x: 26.9, y: 20.4, ko: '사람 사랑방', act: function () { if (canTab('teamtree')) openLegacy('teamtree', '사람 사랑방'); else scrollLegacy('praiseSec', '사람 사랑방'); } },
    { x: 77.5, y: 18.9, ko: '성장 온실', act: function () { scrollLegacy('treeSecHome', '성장 온실'); } },
    { x: 25.6, y: 50.5, ko: '수익 장터', act: function () { openLegacy('sale', '수익 장터'); } },
    { x: 71.5, y: 50.2, ko: '관리자 집무실', act: function () { if (canTab('admin')) openLegacy('admin', '관리자 집무실'); else say('관리자 전용 공간이에요'); } }
  ];

  /* 홈 내부 섹션으로 이식(성장 온실=나무 카드 등) */
  function scrollLegacy(sectionId, placeName) {
    goTabSafe('home');
    document.documentElement.classList.remove('pg-on');
    document.documentElement.classList.add('pg-legacy');
    var back = el('pgBack');
    if (back) back.style.display = ''; else openLegacy('home', placeName);
    if (el('pgBack')) el('pgBack').style.display = '';
    var tag = el('pgPlaceTag'); if (tag) { tag.textContent = placeName; tag.style.display = ''; }
    setTimeout(function () { var s = el(sectionId); if (s && s.scrollIntoView) s.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); }, 120);
  }

  function skyPhase() { var h = new Date().getHours(); if (h >= 5 && h < 8) return 'dawn'; if (h >= 8 && h < 17) return 'day'; if (h >= 17 && h < 20) return 'dusk'; return 'night'; }

  function build() {
    if (el('pgRoot')) return true;
    var root = ce('div'); root.id = 'pgRoot';

    /* 배경 블러 + 선명 지도 */
    var world = ce('div', 'pg-world'); root.appendChild(world);
    var blur = ce('div', 'pg-map-blur'); blur.style.backgroundImage = "url('" + IMG_MAP + "')"; world.appendChild(blur);
    var mapWrap = ce('div', 'pg-mapwrap'); world.appendChild(mapWrap);
    var artbox = ce('div', 'pg-artbox'); mapWrap.appendChild(artbox);
    var img = new Image(); img.className = 'pg-map'; img.alt = '프레젠스 동물농장 마을';
    img.onerror = function () { mapWrap.style.background = 'linear-gradient(180deg,#bfe0ea,#8db26a 55%,#5c7a3a)'; };
    img.src = IMG_MAP; artbox.appendChild(img);

    var phase = skyPhase();
    root.setAttribute('data-tod', phase);

    /* 건물 클릭존 (그림의 간판 위에 투명하게 — 그림 그대로 유지) */
    BUILDINGS.forEach(function (b, i) {
      var z = ce('button', 'pg-zone');
      z.type = 'button';
      z.style.left = b.x + '%'; z.style.top = b.y + '%';
      z.style.animationDelay = (0.6 + i * 0.12) + 's';
      z.setAttribute('aria-label', b.ko);
      z.innerHTML = '<span class="pg-zone-ring"></span><span class="pg-zone-tip">' + esc(b.ko) + '</span>';
      z.addEventListener('click', function () { b.act(); });
      artbox.appendChild(z);
    });

    /* 병아리 NPC 3마리 */
    [['a', IMG_CHICK_A, 5.4, 34, 22, 26], ['b', IMG_CHICK_B, 4.6, 27, 58, 34], ['c', IMG_CHICK_A, 6, 12, 30, 40]]
      .forEach(function (n) {
        var d = ce('div', 'pg-npc pg-npc-' + n[0]);
        d.style.width = n[2] + '%'; d.style.bottom = n[3] + '%'; d.style.left = n[4] + '%';
        d.style.setProperty('--dur', n[5] + 's');
        var fl = ce('span', 'pg-flip'); fl.style.setProperty('--dur', n[5] + 's');
        var im = new Image(); im.src = n[1]; im.alt = '';
        im.onerror = function () { d.style.display = 'none'; };
        fl.appendChild(im); d.appendChild(fl); artbox.appendChild(d);
      });

    /* 야간 별 */
    if (phase === 'night') {
      for (var si = 0; si < 14; si++) {
        var st = ce('span', 'pg-star');
        st.style.left = (Math.random() * 100).toFixed(1) + '%';
        st.style.top = (Math.random() * 26).toFixed(1) + '%';
        st.style.animationDelay = (Math.random() * 3).toFixed(2) + 's';
        artbox.appendChild(st);
      }
    }

    /* 좌측 게임 사이드바(마을 안내판) */
    root.appendChild(buildSidebar());

    /* 인사말 */
    var greet = ce('div', 'pg-greet');
    greet.innerHTML = '<div class="pg-greet-t">좋은 하루예요, <b>' + esc(meName()) + (meRole() ? ' ' + esc(meRole()) : '') + '님</b>! ' + SVG.leaf('#8ab24e', 20) + '</div>' +
      '<div class="pg-greet-s">프레젠스 동물농장은 오늘도 함께 자라요.</div>';
    root.appendChild(greet);

    /* FARM KEEPER 배지 */
    var kb = ce('div', 'pg-keeper');
    kb.innerHTML = '<span>FARM KEEPER</span><b>농장지기 ' + esc(meName()) + (meRole() ? ' ' + esc(meRole()) : '') + '님</b>';
    root.appendChild(kb);

    /* 우측 스프링 노트 */
    root.appendChild(buildNote());

    document.body.appendChild(root);
    document.documentElement.classList.add('pg-on');

    layout(); watchLayout();
    requestAnimationFrame(function () { root.classList.add('pg-in'); });
    return true;
  }

  function buildSidebar() {
    var bar = ce('aside', 'pg-side');
    var top = ce('div', 'pg-side-top');
    top.innerHTML =
      '<div class="pg-emblem"><img src="' + IMG_CHICK_A + '" alt="" onerror="this.style.display=\'none\'"></div>' +
      '<div class="pg-brand"><b>프레젠스</b><span>동물농장</span></div>';
    bar.appendChild(top);

    var items = [
      { ic: SVG.home, ko: '마을', key: null, act: function () { } },
      { ic: SVG.people, ko: '팀 현황', key: 'teamtree', act: function () { openLegacy('teamtree', '팀 현황'); } },
      { ic: SVG.flag, ko: '프로젝트', key: 'wins', act: function () { openLegacy('wins', '프로젝트'); } },
      { ic: SVG.sprout, ko: '성장 기록', key: 'perf', act: function () { openLegacy('perf', '성장 기록'); } },
      { ic: SVG.chat, ko: '소통 메모', key: 'gb', act: function () { scrollLegacy('gbSec', '소통 메모'); } },
      { ic: SVG.book, ko: '가이드', key: 'manual', act: function () { openLegacy('manual', '가이드'); } }
    ];
    var nav = ce('nav', 'pg-menu');
    items.forEach(function (it, i) {
      if (it.key && !canTab(it.key)) return;
      var b = ce('button', 'pg-menu-item' + (i === 0 ? ' on' : ''));
      b.type = 'button';
      b.innerHTML = '<i>' + it.ic + '</i><span>' + it.ko + '</span>';
      b.addEventListener('click', function () {
        nav.querySelectorAll('.pg-menu-item').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on'); it.act();
      });
      nav.appendChild(b);
    });
    bar.appendChild(nav);

    var foot = ce('div', 'pg-side-foot');
    foot.innerHTML = '함께 가꾸는<br>우리의 하루';
    bar.appendChild(foot);
    return bar;
  }

  function latestNotice() {
    try {
      var arr = (gState().notices) || []; if (!arr.length) return '';
      var s = arr.slice().sort(function (a, b) { return (b.t || 0) - (a.t || 0); });
      var t = (s[0] && (s[0].title || s[0].text || s[0].msg)) || '';
      t = String(t).replace(/\s+/g, ' ').trim();
      return t.length > 24 ? t.slice(0, 24) + '…' : t;
    } catch (e) { return ''; }
  }

  function buildNote() {
    var st = gState(), m = gMe(), today = gToday();
    var items = [];

    var att = tryv(function () { return st.attend[today][gNk(meName())]; }, null);
    items.push(att
      ? { n: 1, tt: '오늘 출근 체크 완료', ds: '하루의 시작을 팀에 알렸어요.', src: '오늘 광장 · 출근부', chip: ['ok', '완료'], act: function () { scrollLegacy('attendSec', '오늘 광장'); } }
      : { n: 1, tt: '오늘 출근 체크하기', ds: '하루의 시작을 팀에 알려주세요.', src: '오늘 광장 · 출근부', chip: ['wait', '대기'], act: function () { scrollLegacy('attendSec', '오늘 광장'); } });

    var watered = tryv(function () { return st.waters[m.uid].last === today; }, false);
    items.push(watered
      ? { n: 2, tt: '오늘 물주기 완료', ds: '우리 나무가 한 뼘 더 자랐어요.', src: '성장 온실 · 프레젠스 나무', chip: ['ok', '완료'], act: function () { scrollLegacy('treeSecHome', '성장 온실'); } }
      : { n: 2, tt: '나무에 물 주기', ds: '하루 한 번, 함께 키우는 나무를 돌봐요.', src: '성장 온실 · 프레젠스 나무', chip: ['wait', '대기'], act: function () { scrollLegacy('treeSecHome', '성장 온실'); } });

    var adm = tryv(function () { return typeof isFounder === 'function' && isFounder(m); }, false);
    if (adm) {
      var pend = 0;
      try { var us = st.users || {}; Object.keys(us).forEach(function (k) { var u = us[k]; if (u && (u.status === 'pending' || u.status === 'wait' || u.status === 'waiting')) pend++; }); } catch (e) { }
      items.push(pend > 0
        ? { n: 3, tt: '가입 승인 대기 ' + pend + '건', ds: '새 농장 식구의 합류를 확인해주세요.', src: '관리자 집무실 · 승인함', chip: ['go', '진행 중'], act: function () { openLegacy('admin', '관리자 집무실'); } }
        : { n: 3, tt: '가입 승인 대기 없음', ds: '지금은 처리할 승인 요청이 없어요.', src: '관리자 집무실 · 승인함', chip: ['ok', '완료'], act: function () { openLegacy('admin', '관리자 집무실'); } });
    } else {
      var nt = latestNotice();
      if (nt) items.push({ n: 3, tt: '새 소식: ' + nt, ds: '게시판에 새로운 이야기가 있어요.', src: '게시판 · 공지', chip: ['go', '새 글'], act: function () { openLegacy('notice', '게시판'); } });
    }

    var wrap = ce('div', 'pg-note-wrap');
    var note = ce('div', 'pg-note');
    var paper = ce('div', 'pg-note-paper');
    var rings = ce('div', 'pg-rings'); for (var r = 0; r < 10; r++) rings.appendChild(ce('i'));
    paper.appendChild(rings);
    paper.insertAdjacentHTML('beforeend',
      '<h3 class="pg-note-h">' + SVG.leaf('#6f9a4e', 18) + ' 오늘 먼저 볼 3가지 ' + SVG.leaf('#6f9a4e', 18) + '</h3><div class="pg-note-div"></div>');

    items.forEach(function (it) {
      var b = ce('button', 'pg-note-item'); b.type = 'button';
      b.innerHTML =
        '<span class="pg-note-num">' + it.n + '</span>' +
        '<span class="pg-note-body"><b>' + esc(it.tt) + '</b><em>' + esc(it.ds) + '</em>' +
        '<span class="pg-note-src"><span class="pg-chip src">출처 ' + esc(it.src) + '</span></span></span>' +
        '<span class="pg-chip ' + it.chip[0] + ' pg-note-st">' + it.chip[1] + '</span>';
      b.addEventListener('click', it.act);
      paper.appendChild(b);
    });
    paper.insertAdjacentHTML('beforeend',
      '<div class="pg-note-quote">' + SVG.leaf('#9a8460', 14) + ' 작은 돌봄이 모여 큰 성장을 만듭니다. ' + SVG.leaf('#9a8460', 14) + '</div>');

    note.appendChild(paper); wrap.appendChild(note);
    return wrap;
  }

  /* ---- contain된 지도 박스 크기 계산 (간판 좌표계 = 지도) ---- */
  function layout() {
    var root = el('pgRoot'); if (!root) return;
    var wrap = q('.pg-mapwrap', root), art = q('.pg-artbox', root);
    if (!wrap || !art) return;
    var W = wrap.clientWidth, H = wrap.clientHeight; if (!W || !H) return;
    var w = W, h = W / MAP_RATIO;
    if (h > H) { h = H; w = H * MAP_RATIO; }
    art.style.width = w + 'px'; art.style.height = h + 'px';
    art.style.left = ((W - w) / 2) + 'px'; art.style.top = ((H - h) / 2) + 'px';
  }
  var _ro;
  function watchLayout() {
    layout();
    try { if (window.ResizeObserver) { _ro = new ResizeObserver(layout); _ro.observe(q('.pg-mapwrap', el('pgRoot'))); } } catch (e) { }
    window.addEventListener('resize', layout, { passive: true });
  }

  /* ---- 스타일(월드 전용, game.css 보완) ---- */
  function injectCSS() {
    if (el('pg-world-css')) return;
    var s = ce('style'); s.id = 'pg-world-css';
    s.textContent = [
      ".pg-world{position:absolute;inset:0;overflow:hidden}",
      ".pg-map-blur{position:absolute;inset:-6%;background-size:cover;background-position:center;filter:blur(30px) brightness(.7) saturate(1.05);transform:scale(1.15)}",
      "#pgRoot[data-tod=night] .pg-map-blur{filter:blur(30px) brightness(.4)}",
      ".pg-mapwrap{position:absolute;left:220px;right:362px;top:0;bottom:0}",
      "@media(max-width:1279px){.pg-mapwrap{left:70px;right:0}}",
      "@media(max-width:767px){.pg-mapwrap{left:0;right:0;bottom:auto;height:60vh}}",
      ".pg-artbox{position:absolute;border-radius:14px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.5)}",
      ".pg-map{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;user-select:none;-webkit-user-drag:none;opacity:0;transition:opacity .8s ease}",
      "#pgRoot.pg-in .pg-map{opacity:1}",
      "#pgRoot[data-tod=night] .pg-map{filter:brightness(.55) saturate(.9)}",
      "#pgRoot[data-tod=dusk] .pg-map{filter:brightness(.9) saturate(1.1) sepia(.08)}",
      "#pgRoot[data-tod=dawn] .pg-map{filter:brightness(1.02) sepia(.06)}",
      /* 건물 클릭존 (그림 위 투명) */
      ".pg-zone{position:absolute;z-index:7;width:15%;height:12%;min-width:64px;min-height:52px;transform:translate(-50%,-50%);border:0;background:transparent;cursor:pointer;padding:0}",
      ".pg-zone-ring{position:absolute;inset:0;border-radius:14px;box-shadow:0 0 0 0 rgba(216,184,119,0);transition:box-shadow .3s,background .3s;animation:pgBeacon 2.6s ease-in-out infinite;animation-delay:var(--d,0ms)}",
      "@keyframes pgBeacon{0%,100%{box-shadow:0 0 0 2px rgba(216,184,119,.28),0 0 14px 2px rgba(216,184,119,.14)}50%{box-shadow:0 0 0 2px rgba(216,184,119,.6),0 0 22px 6px rgba(216,184,119,.32)}}",
      ".pg-zone:hover .pg-zone-ring,.pg-zone:focus-visible .pg-zone-ring{box-shadow:0 0 0 2px #f0d79a,0 0 26px 8px rgba(216,184,119,.5);background:rgba(216,184,119,.12);animation:none}",
      ".pg-zone-tip{position:absolute;left:50%;top:-30px;transform:translateX(-50%) scale(.8);opacity:0;white-space:nowrap;padding:5px 12px;border-radius:999px;font-family:var(--pg-disp,serif);font-weight:700;font-size:12px;color:#f6efdb;background:linear-gradient(180deg,#26385a,#16233c);box-shadow:0 0 0 2px #c9a86a,0 6px 14px rgba(0,0,0,.4);transition:opacity .2s,transform .2s;pointer-events:none}",
      ".pg-zone:hover .pg-zone-tip,.pg-zone:focus-visible .pg-zone-tip{opacity:1;transform:translateX(-50%) scale(1)}",
      ".pg-zone:active{transform:translate(-50%,-50%) scale(.96)}",
      "@media(max-width:767px){.pg-zone-tip{opacity:1;transform:translateX(-50%) scale(.9);top:-26px;font-size:11px}}",
      /* NPC */
      ".pg-npc{position:absolute;z-index:5;pointer-events:none;contain:layout style;animation:pgWalk var(--dur,30s) linear infinite}",
      ".pg-flip{display:block;animation:pgFlip var(--dur,30s) step-end infinite}",
      ".pg-npc img{display:block;width:100%;animation:pgBob 1.2s ease-in-out infinite alternate;filter:drop-shadow(0 6px 6px rgba(20,30,20,.4))}",
      ".pg-npc::after{content:'';position:absolute;left:16%;right:16%;bottom:-3px;height:8px;border-radius:50%;background:radial-gradient(ellipse,rgba(12,22,12,.32),rgba(0,0,0,0) 70%)}",
      "@keyframes pgWalk{0%{transform:translateX(0)}48%{transform:translateX(560%)}52%{transform:translateX(560%)}100%{transform:translateX(0)}}",
      "@keyframes pgFlip{0%{transform:scaleX(1)}48%{transform:scaleX(-1)}100%{transform:scaleX(-1)}}",
      "@keyframes pgBob{from{transform:translateY(0) rotate(-2deg)}to{transform:translateY(-16%) rotate(2deg)}}",
      ".pg-star{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;z-index:6;box-shadow:0 0 5px #fff;animation:pgTwinkle 3s ease-in-out infinite}",
      "@keyframes pgTwinkle{0%,100%{opacity:.2}50%{opacity:1}}",
      /* 사이드바 */
      ".pg-side{position:absolute;left:0;top:0;bottom:0;width:220px;z-index:8;display:flex;flex-direction:column;padding:20px 14px;color:#f6efdb;background:linear-gradient(180deg,#16233c,#101a2e);box-shadow:inset -1px 0 0 rgba(216,184,119,.4),8px 0 30px rgba(0,0,0,.3)}",
      ".pg-side-top{display:flex;flex-direction:column;align-items:center;gap:8px;padding-bottom:16px;border-bottom:1px solid rgba(216,184,119,.25)}",
      ".pg-emblem{width:92px;height:92px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:radial-gradient(circle at 50% 40%,#33507a,#1a2b47);box-shadow:0 0 0 2px #d8b877,0 0 0 5px rgba(22,35,60,.9),0 8px 18px rgba(0,0,0,.4)}",
      ".pg-emblem img{width:104%;height:104%;object-fit:contain;transform:translateY(6%)}",
      ".pg-brand{text-align:center;font-family:var(--pg-disp,serif)}",
      ".pg-brand b{display:block;font-size:21px;color:#e7c987;letter-spacing:.04em}",
      ".pg-brand span{display:block;font-size:12px;color:#cdbf9a;letter-spacing:.18em}",
      ".pg-menu{display:flex;flex-direction:column;gap:5px;margin-top:16px;flex:1}",
      ".pg-menu-item{display:flex;align-items:center;gap:12px;min-height:46px;padding:8px 12px;border:0;cursor:pointer;border-radius:11px;background:transparent;color:#d9e2ef;font-family:var(--pg-disp,serif);font-weight:700;font-size:15px;position:relative;transition:background .18s,color .18s}",
      ".pg-menu-item i{display:grid;place-items:center;width:26px;color:#c9a86a}",
      ".pg-menu-item:hover{background:rgba(216,184,119,.12);color:#fff}",
      ".pg-menu-item.on{background:rgba(216,184,119,.16);color:#fff}",
      ".pg-menu-item.on::before{content:'';position:absolute;left:0;top:8px;bottom:8px;width:4px;border-radius:3px;background:#d8b877}",
      ".pg-side-foot{margin-top:14px;padding-top:14px;border-top:1px solid rgba(216,184,119,.25);text-align:center;font-family:var(--pg-disp,serif);font-size:12px;color:#d8b877;line-height:1.7;letter-spacing:.04em}",
      "@media(max-width:1279px){.pg-side{width:70px;padding:16px 8px}.pg-brand,.pg-side-foot,.pg-menu-item span{display:none}.pg-emblem{width:52px;height:52px}.pg-menu-item{justify-content:center;padding:8px}}",
      "@media(max-width:767px){.pg-side{display:none}}",
      /* 인사말 */
      ".pg-greet{position:absolute;left:244px;top:22px;z-index:6;pointer-events:none}",
      ".pg-greet-t{font-family:var(--pg-disp,serif);font-weight:700;font-size:clamp(20px,2.4vw,32px);color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.65)}",
      ".pg-greet-t b{color:#f0d79a}",
      ".pg-greet-s{margin-top:5px;font-size:13.5px;color:#f0e8d4;text-shadow:0 1px 6px rgba(0,0,0,.6)}",
      "@media(max-width:1279px){.pg-greet{left:88px}}",
      "@media(max-width:767px){.pg-greet{left:16px;top:14px}.pg-greet-s{font-size:12px}}",
      /* keeper */
      ".pg-keeper{position:absolute;right:366px;top:22px;z-index:8;text-align:right;padding:10px 16px;border-radius:12px;background:rgba(20,30,50,.92);box-shadow:0 0 0 2px #c9a86a,0 8px 20px rgba(0,0,0,.4);opacity:0;transform:translateY(-8px);transition:opacity .5s,transform .5s;transition-delay:.35s}",
      "#pgRoot.pg-in .pg-keeper{opacity:1;transform:none}",
      ".pg-keeper span{display:block;font-size:10px;letter-spacing:.24em;color:#d8b877;font-weight:800}",
      ".pg-keeper b{display:block;margin-top:3px;font-size:13px;color:#f6efdb;font-family:var(--pg-disp,serif)}",
      "@media(max-width:1279px){.pg-keeper{right:16px}}",
      "@media(max-width:1023px){.pg-keeper{display:none}}",
      /* 노트 */
      ".pg-note-wrap{position:absolute;right:18px;top:64px;width:334px;z-index:8;opacity:0;transform:translateX(24px);transition:opacity .5s,transform .5s;transition-delay:.55s}",
      "#pgRoot.pg-in .pg-note-wrap{opacity:1;transform:none}",
      ".pg-note-h{margin:0 0 8px;text-align:center;font-family:var(--pg-disp,serif);font-size:18px;color:#33261a;font-weight:700;display:flex;align-items:center;justify-content:center;gap:7px}",
      ".pg-note-div{height:1px;background:repeating-linear-gradient(90deg,rgba(120,95,60,.4) 0 6px,transparent 6px 11px);margin:0 0 6px}",
      ".pg-note-item{display:grid;grid-template-columns:30px 1fr auto;gap:11px;align-items:center;width:100%;text-align:left;border:0;background:transparent;cursor:pointer;padding:9px 4px;border-radius:9px;transition:background .16s,transform .16s}",
      ".pg-note-item+.pg-note-item{border-top:1px dashed rgba(120,100,70,.3)}",
      ".pg-note-item:hover{background:rgba(111,154,78,.12);transform:translateX(2px)}",
      ".pg-note-num{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(180deg,#26385a,#1a2840);color:#fff;font-weight:800;font-size:13px;box-shadow:0 2px 5px rgba(0,0,0,.3)}",
      ".pg-note-body{min-width:0}",
      ".pg-note-body b{display:block;font-size:14.5px;font-weight:700;color:#33261a;line-height:1.3}",
      ".pg-note-body em{display:block;margin-top:2px;font-style:normal;font-size:12px;color:#7a6549;line-height:1.4}",
      ".pg-note-src{display:block;margin-top:6px}",
      ".pg-note-st{align-self:flex-start;white-space:nowrap}",
      ".pg-note-quote{margin-top:12px;padding-top:10px;border-top:1px dashed rgba(120,100,70,.35);text-align:center;font-family:var(--pg-disp,serif);font-style:italic;font-size:12px;color:#7a6549}",
      "@media(max-width:1279px){.pg-note-wrap{position:static;width:auto;margin:12px 12px 16px;opacity:1;transform:none}}",
      "@media(min-width:768px) and (max-width:1279px){#pgRoot{overflow-y:auto}.pg-mapwrap{position:relative;height:62vh}.pg-world{position:relative;min-height:100%}}",
      "@media(max-width:767px){.pg-note-wrap{position:static;width:auto;margin:10px 12px calc(16px + var(--pg-safe-b))}#pgRoot{overflow-y:auto}.pg-world{position:relative;min-height:64vh}}"
    ].join('');
    document.head.appendChild(s);
  }

  function injectFont() {
    if (el('pg-font')) return;
    var l = ce('link'); l.id = 'pg-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap';
    document.head.appendChild(l);
  }

  /* ---- goTab 몽키패치: home 복귀 시 게임 월드로 ---- */
  function wrapGoTab() {
    if (typeof window.goTab !== 'function' || window.__pgWrapped) return;
    var orig = window.goTab; window.__pgWrapped = true;
    window.goTab = function (name) {
      var r = orig.apply(this, arguments);
      try {
        if (name === 'home' && !document.documentElement.classList.contains('pg-legacy')) {
          closeLegacy(); if (el('pgRoot')) el('pgRoot').style.display = '';
        }
      } catch (e) { }
      return r;
    };
  }

  /* ---- 부팅 ---- */
  var tries = 0, iv = null;
  function ready() {
    var m = gMe();
    var appOn = tryv(function () { var a = el('app'); return a && !a.classList.contains('hidden'); }, false);
    return m && appOn;
  }
  function tick() {
    tries++;
    injectFont(); injectCSS(); wrapGoTab();
    if (ready()) {
      if (!el('pgRoot')) { build(); }
      if (el('pgRoot')) { stop(); return; }
    }
    if (tries >= 40) stop();
  }
  function stop() { if (iv) { clearInterval(iv); iv = null; } }
  function boot() { injectFont(); injectCSS(); wrapGoTab(); tick(); if (!iv) iv = setInterval(tick, 700); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
