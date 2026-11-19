/* Seasonal background visuals and a gesture-opened, visible official YouTube player. */
(function () {
  'use strict';
  var KEY = 'presence_local_season_effects.';
  var enabled = false;
  var button = null;
  var originalSet = null;
  var installed = false;
  var seasonHint = '';
  var preferenceUid = '';
  var VIDEO = 'rxULak5ND40', panel = null, musicButton = null, winterCanvas = null, winterFrame = 0, winterStarted = 0, winterFlight = null, musicWait = 0;
 function stopCarol() { clearTimeout(musicWait);musicWait=0;if (panel) { panel.remove(); panel = null;if(musicButton&&musicButton.isConnected&&!document.hidden)musicButton.focus({preventScroll:true}); } var old=document.getElementById('presenceCarolAudio');if(old){old.pause();old.remove();} }
 function playCarol() {
   if (!active() || season() !== 'winter') return;
   silence(); stopCarol();
   panel = document.createElement('section'); panel.id = 'presenceMusicPanel';panel.setAttribute('role','region'); panel.setAttribute('aria-labelledby','presenceMusicTitle');
   panel.innerHTML = '<h2 id="presenceMusicTitle">크리스마스 음악</h2><p data-music-status role="status" aria-live="polite">공식 YouTube 플레이어에서 재생해 주세요.</p><iframe id="presenceBgmPlayer" title="그 시절 케빈 가족들이 틀어 놓는 뉴욕 캐롤 플레이리스트 | PLAYLIST" allow="encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><a href="https://www.youtube.com/watch?v='+VIDEO+'" target="_blank" rel="noopener noreferrer">YouTube에서 원본 보기</a><button type="button" data-music-close>닫기</button>';
   panel.querySelector('iframe').src = 'https://www.youtube.com/embed/'+VIDEO+'?controls=1&playsinline=1&rel=0';
   var opened=panel;function fallback(){if(panel===opened)opened.querySelector('[data-music-status]').textContent='재생 화면이 보이지 않으면 아래 YouTube에서 원본 보기를 눌러 주세요.';}
   panel.querySelector('iframe').addEventListener('error',fallback);musicWait=setTimeout(fallback,8000);
   panel.querySelector('[data-music-close]').onclick = stopCarol;

   var host=document.querySelector('#app main')||document.body;host.prepend(panel);panel.scrollIntoView({block:'start',behavior:'instant'});panel.querySelector('[data-music-close]').focus({preventScroll:true});
 }
 function winterEffects(on) {
   if (!on) { if(winterFrame)cancelAnimationFrame(winterFrame);winterFrame=0;if(winterCanvas)winterCanvas.remove();winterCanvas=null;if(winterFlight)winterFlight.remove();winterFlight=null;return; }
   if(winterCanvas)return;
   winterCanvas=document.createElement('canvas');winterCanvas.id='presenceWinterCanvas';winterCanvas.setAttribute('aria-hidden','true');document.body.appendChild(winterCanvas);
   var safeRects=[],safeAt=0;
   var ctx=winterCanvas.getContext('2d');if(!ctx){winterCanvas.remove();winterCanvas=null;return;}winterStarted=performance.now();
   function draw(now){
     if(!winterCanvas)return;var w=innerWidth,h=innerHeight,d=Math.min(devicePixelRatio||1,1.5);
     if(winterCanvas.width!==Math.round(w*d)||winterCanvas.height!==Math.round(h*d)){winterCanvas.width=Math.round(w*d);winterCanvas.height=Math.round(h*d);}
     ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);var t=(now-winterStarted)/1000;
     if(now-safeAt>500){safeAt=now;safeRects=Array.from(document.querySelectorAll('header,nav,input,textarea,select,button,a,main h1,main h2,main h3,main p,main label,main strong,main dt,main dd,main td,dialog,.modal.on')).filter(function(e){return e.getClientRects().length;}).map(function(e){return e.getBoundingClientRect();});}
     for(var i=0;i<28;i++){var near=i%2===1,x=((i*97+Math.sin(t*(near?.5:.28)+i)*14)%w+w)%w,y=(i*67+t*(near?28+i%4*3:12+i%3*2))%h;if(safeRects.some(function(r){return x>r.left-4&&x<r.right+4&&y>r.top-4&&y<r.bottom+4;}))continue;ctx.globalAlpha=near?.58:.38;ctx.fillStyle='#fffdf5';ctx.strokeStyle='#baa477';ctx.lineWidth=near?.55:.4;ctx.beginPath();ctx.arc(x,y,near?1.7+i%3*.2:1+i%3*.15,0,Math.PI*2);ctx.fill();ctx.stroke();}
     var host=document.querySelector('#workspaceHomeGarden #treeSecHome[data-garden-state="ready"] .tree-stage');var sky=host&&host.querySelector('.tree-v2-background');if(!sky||!sky.complete||!sky.naturalWidth)host=null;
     if(host&&host.getClientRects().length){
       if(!winterFlight||!winterFlight.isConnected){winterFlight=document.createElement('div');winterFlight.id='presenceWinterFlight';winterFlight.setAttribute('aria-hidden','true');var img=document.createElement('img');img.alt='';img.src='assets/christmas/santa-sleigh-640.webp';img.srcset='assets/christmas/santa-sleigh-320.webp 320w, assets/christmas/santa-sleigh-640.webp 640w';img.sizes='(min-width:980px) 260px, 180px';img.decoding='async';winterFlight.appendChild(img);host.appendChild(winterFlight);}
       if(winterFlight.parentNode!==host)host.appendChild(winterFlight);var sprite=winterFlight.firstElementChild,travel=Math.max(0,winterFlight.clientWidth-sprite.clientWidth-16);sprite.style.transform='translateX('+(8+(Math.sin(t*.14)+1)/2*travel)+'px) translateY('+(Math.sin(t*.7)*3)+'px)';
     }else if(winterFlight){winterFlight.remove();winterFlight=null;}
     ctx.globalAlpha=1;winterFrame=requestAnimationFrame(draw);
   }winterFrame=requestAnimationFrame(draw);
 }
 function readPreference() {
    var uid = active() ? String(actor().uid || '') : '';
    if (uid === preferenceUid) return;
    stopCarol();
    preferenceUid = uid;
    enabled = false;
    try { if (uid) { var saved=localStorage.getItem(KEY + uid); enabled=saved==='on'||(saved!=='off'&&!matchMedia('(prefers-reduced-motion: reduce)').matches); } } catch (ignore) {}
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
    button.dataset.audioState = panel ? 'player' : 'off';
    button.querySelector('[data-effect-label]').textContent = label;
    button.querySelector('[data-effect-icon]').textContent = season() === 'winter' ? '❄' : '✧';
    button.classList.toggle('is-on', enabled);
  }
  function apply() {
    silence();
    placeCanvas();
    var show=active()&&enabled&&!document.hidden; winterEffects(show&&season()==='winter'); if(originalSet)originalSet(show&&season()!=='winter'?mode():null);
   if(musicButton){musicButton.hidden=!active()||season()!=='winter';var dock=document.getElementById('presenceUtilityDock');if(dock&&musicButton.parentNode!==dock)dock.appendChild(musicButton);}
    renderButton();
    window.dispatchEvent(new CustomEvent('presence:effectchange', {detail: {enabled: enabled, mode: mode()}}));
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
    if (canvas.parentNode !== document.body || canvas.dataset.sceneHost !== 'page') {
      canvas.dataset.sceneHost = 'page'; document.body.appendChild(canvas);
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
    if (!enabled) stopCarol();
    return enabled;
  }
  function toggle() { readPreference(); return setEnabled(!enabled); }
 function suspend() {
    silence();
    stopCarol();
    readPreference();
    placeCanvas();
    winterEffects(false); if (originalSet) originalSet(null);
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
    musicButton=document.createElement('button');musicButton.id='presenceMusicOpen';musicButton.type='button';musicButton.textContent='음악';musicButton.setAttribute('aria-controls','presenceMusicPanel');musicButton.onclick=playCarol;document.body.appendChild(musicButton);
    document.body.classList.add('presence-effects-ready', 'presence-music-ready');
    sync();
    window.addEventListener('presence:seasonchange', function (event) {
      if (event.detail && /^(auto|winter|spring|summer|autumn)$/.test(event.detail.season || '')) seasonHint = event.detail.season;
      if (season() !== 'winter') stopCarol();
      sync();
    });
    document.addEventListener('keydown',function(event){if(event.key==='Escape'&&panel)stopCarol();});
    document.addEventListener('visibilitychange',function(){if(document.hidden)stopCarol();apply();});
    var motion=window.matchMedia('(prefers-reduced-motion: reduce)');if(motion.addEventListener)motion.addEventListener('change',function(){preferenceUid='';sync();});
  }
  window.PresenceChristmasEffects = Object.freeze({toggle: toggle, setEnabled: setEnabled, sync: sync, get enabled() { return enabled; }, get mode() { return mode(); }, get audioState() { return panel ? 'player' : 'off'; }});
  // Compatibility entry points; opening the visible player still requires a caller gesture.
  window.PresenceBgm = Object.freeze({play: playCarol, pause: function () { setEnabled(false); }, stop: suspend, toggle: toggle, togglePanel: toggle, setTrack: sync, get playing() { return false; }, get videoId() { return VIDEO; }});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
