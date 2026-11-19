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
 var MUSIC_KEY='presence_local_christmas_music.',musicUid='',musicPreference=null,player=null,musicState='off',playerGeneration=0,apiPromise=null;
 function musicStatus(state,text){musicState=state;if(panel){panel.dataset.musicState=state;panel.querySelector('[data-music-status]').textContent=text;}if(musicButton){musicButton.textContent=state==='playing'?'음악 켜짐':state==='blocked'?'음악 재생 대기':'음악';musicButton.setAttribute('aria-pressed',String(state==='playing'));}}
 function saveMusic(value){musicPreference=value;try{if(musicUid)localStorage.setItem(MUSIC_KEY+musicUid,value);}catch(ignore){}}
 function stopCarol(explicit) { clearTimeout(musicWait);musicWait=0;playerGeneration++;if(player){try{player.pauseVideo();player.destroy();}catch(ignore){}player=null;}if(explicit===true)saveMusic('off');if(panel){panel.remove();panel=null;}musicStatus('off','');var old=document.getElementById('presenceCarolAudio');if(old){old.pause();old.remove();} }
 function youtubeAPI(){if(window.YT&&YT.Player)return Promise.resolve();if(apiPromise)return apiPromise;apiPromise=new Promise(function(resolve,reject){var previous=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=function(){if(typeof previous==='function')previous();resolve();};var s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.onerror=function(){apiPromise=null;reject(new Error('YouTube load'));};document.head.appendChild(s);});return apiPromise;}
 function attemptMusic(){if(!player||!panel||!active()||musicPreference==='off')return;try{player.playVideo();}catch(ignore){}}
 function playCarol() {
   if (!active() || season() !== 'winter') return;
   if(panel){saveMusic('on');attemptMusic();return;}
   silence();saveMusic('on');var generation=++playerGeneration;
   panel = document.createElement('section'); panel.id = 'presenceMusicPanel';panel.setAttribute('role','region'); panel.setAttribute('aria-labelledby','presenceMusicTitle');
   panel.innerHTML = '<h2 id="presenceMusicTitle">크리스마스 음악</h2><p data-music-status role="status" aria-live="polite">공식 플레이어를 준비하고 있어요.</p><iframe id="presenceBgmPlayer" title="그 시절 케빈 가족들이 틀어 놓는 뉴욕 캐롤 플레이리스트 | PLAYLIST" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><a href="https://www.youtube.com/watch?v='+VIDEO+'" target="_blank" rel="noopener noreferrer">YouTube에서 원본 보기</a><button type="button" data-music-close>음악 끄고 닫기</button>';
   panel.querySelector('iframe').src = 'https://www.youtube.com/embed/'+VIDEO+'?enablejsapi=1&autoplay=1&controls=1&playsinline=1&rel=0&origin='+encodeURIComponent(location.origin);
   var opened=panel;function fallback(){if(panel===opened)opened.querySelector('[data-music-status]').textContent='재생 화면이 보이지 않으면 아래 YouTube에서 원본 보기를 눌러 주세요.';}
   panel.querySelector('iframe').addEventListener('error',fallback);musicWait=setTimeout(fallback,8000);
   panel.querySelector('[data-music-close]').onclick = function(){stopCarol(true);musicButton?.focus({preventScroll:true});};

   var host=document.querySelector('#app main')||document.body;host.prepend(panel);musicStatus('loading','공식 플레이어를 준비하고 있어요.');
   youtubeAPI().then(function(){if(generation!==playerGeneration||panel!==opened)return;player=new YT.Player('presenceBgmPlayer',{events:{onReady:function(){if(generation!==playerGeneration)return;clearTimeout(musicWait);attemptMusic();},onStateChange:function(e){if(generation!==playerGeneration)return;if(e.data===1)musicStatus('playing','크리스마스 음악 재생 중');else if(e.data===2)musicStatus('paused','음악이 일시 정지되었어요.');else if(e.data===3)musicStatus('buffering','음악을 불러오고 있어요.');},onAutoplayBlocked:function(){if(generation===playerGeneration)musicStatus('blocked','자동 재생이 차단됐어요. 화면을 한 번 터치하면 음악이 시작돼요.');},onError:function(){if(generation===playerGeneration)musicStatus('error','YouTube 재생을 연결하지 못했어요. 원본 보기로 확인해 주세요.');}}});}).catch(fallback);
 }
 function syncMusic(){var uid=active()?String(actor().uid||''):'';if(uid!==musicUid){stopCarol();musicUid=uid;musicPreference=null;try{if(uid)musicPreference=localStorage.getItem(MUSIC_KEY+uid);}catch(ignore){}}if(!uid||season()!=='winter'){if(panel)stopCarol();return;}if(musicPreference!=='off'&&!panel&&!document.hidden)playCarol();}
 function winterEffects(on) {
   if (!on) { if(winterFrame)cancelAnimationFrame(winterFrame);winterFrame=0;if(winterCanvas)winterCanvas.remove();winterCanvas=null;if(winterFlight)winterFlight.remove();winterFlight=null;return; }
   if(winterCanvas)return;
   winterCanvas=document.createElement('canvas');winterCanvas.id='presenceWinterCanvas';winterCanvas.setAttribute('aria-hidden','true');document.body.appendChild(winterCanvas);
   var safeRects=[],blockingRects=[],safeAt=0,flightCycle=-1,flightY=0;
   var ctx=winterCanvas.getContext('2d');if(!ctx){winterCanvas.remove();winterCanvas=null;return;}winterStarted=performance.now();
   function draw(now){
     if(!winterCanvas)return;var w=innerWidth,h=innerHeight,d=Math.min(devicePixelRatio||1,1.5);
     if(winterCanvas.width!==Math.round(w*d)||winterCanvas.height!==Math.round(h*d)){winterCanvas.width=Math.round(w*d);winterCanvas.height=Math.round(h*d);}
     ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);var t=(now-winterStarted)/1000;
     if(now-safeAt>500){safeAt=now;safeRects=Array.from(document.querySelectorAll('header,nav,input,textarea,select,button,a,main h1,main h2,main h3,main p,main label,main strong,main dt,main dd,main td,dialog,.modal.on')).filter(function(e){return e.getClientRects().length;}).map(function(e){return e.getBoundingClientRect();});blockingRects=Array.from(document.querySelectorAll('header.top,#botbar,button,input,textarea,select,iframe,dialog[open],.modal.on')).filter(function(e){return e.getClientRects().length;}).map(function(e){return e.getBoundingClientRect();});}
     for(var i=0;i<42;i++){var near=i%3!==0,x=((i*97+Math.sin(t*(near?.5:.28)+i)*14)%w+w)%w,y=(i*67+t*(near?34+i%4*5:10+i%3*2))%h;if(safeRects.some(function(r){return x>r.left-4&&x<r.right+4&&y>r.top-4&&y<r.bottom+4;}))continue;ctx.globalAlpha=near?.76:.38;ctx.fillStyle='#ffffff';ctx.strokeStyle='#dce9ef';ctx.lineWidth=.2;ctx.shadowColor='#d2e1e9';ctx.shadowBlur=near?2.2:.8;ctx.beginPath();ctx.arc(x,y,near?2.2+i%3*.6:1.4+i%3*.3,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.shadowBlur=0;
     // Viewport flight is independent of garden rendering and collapse state.
     if(!winterFlight||!winterFlight.isConnected){winterFlight=document.createElement('div');winterFlight.id='presenceWinterFlight';winterFlight.setAttribute('aria-hidden','true');var img=document.createElement('img');img.alt='';img.src='assets/christmas/santa-sleigh-640.webp';img.srcset='assets/christmas/santa-sleigh-320.webp 320w, assets/christmas/santa-sleigh-640.webp 640w';img.sizes='(min-width:980px) 290px, 200px';img.decoding='async';winterFlight.appendChild(img);document.body.appendChild(winterFlight);}
     var sprite=winterFlight.firstElementChild,phase=(t+2.5)%23,sw=w<980?200:290,sh=sw*819/1920;
     var header=document.querySelector('header.top'),edge=header?Math.max(0,header.getBoundingClientRect().bottom):72;
     var cycle=Math.floor((t+2.5)/23);if(cycle!==flightCycle){flightCycle=cycle;if(w<768){flightY=Math.max(edge+8,Math.min(h*.285,h-sh-150));}else{var candidates=[edge+6,h*.26,h*.42,h*.56,h*.68].filter(function(y){return y>=edge+4&&y+sh<h-150;});var best=Infinity;candidates.forEach(function(y){var score=blockingRects.reduce(function(sum,r){return sum+Math.max(0,Math.min(y+sh,r.bottom)-Math.max(y,r.top))*Math.max(0,Math.min(w,r.right)-Math.max(0,r.left));},0);if(score<best){best=score;flightY=y;}});}}
     var fx=-sw+(w+sw)*(Math.min(phase,12)/12),fy=flightY+Math.sin(t*.5)*3;
     winterFlight.style.transform='translate3d('+fx+'px,'+fy+'px,0)';
     var flightBox={left:fx,right:fx+sw,top:fy,bottom:fy+sh};
     var collision=safeRects.some(function(r){return flightBox.left<r.right&&flightBox.right>r.left&&flightBox.top<r.bottom&&flightBox.bottom>r.top;});
     var blocked=blockingRects.some(function(r){return flightBox.left<r.right&&flightBox.right>r.left&&flightBox.top<r.bottom&&flightBox.bottom>r.top;});winterFlight.style.opacity=phase>12||blocked?'0':collision?'.8':'.9';
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
  function sync() { readPreference(); installRenderer(); apply();syncMusic(); }
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
    document.addEventListener('keydown',function(event){if(event.key==='Escape'&&panel)stopCarol(true);else if(event.isTrusted&&!event.target.closest('[data-music-close]'))attemptMusic();});
    document.addEventListener('pointerdown',function(event){if(event.isTrusted&&!event.target.closest('[data-music-close]'))attemptMusic();},{passive:true});
    document.addEventListener('visibilitychange',function(){if(document.hidden&&player){try{player.pauseVideo();}catch(ignore){}}apply();});
    var motion=window.matchMedia('(prefers-reduced-motion: reduce)');if(motion.addEventListener)motion.addEventListener('change',function(){preferenceUid='';sync();});
  }
  window.PresenceChristmasEffects = Object.freeze({toggle: toggle, setEnabled: setEnabled, sync: sync, get enabled() { return enabled; }, get mode() { return mode(); }, get audioState() { return panel ? 'player' : 'off'; }});
  // Official visible player only; browser autoplay policy decides when audio can start.
  window.PresenceBgm = Object.freeze({play: playCarol, pause: function () { stopCarol(true); }, stop: suspend, toggle: function(){if(panel)stopCarol(true);else playCarol();}, togglePanel: playCarol, setTrack: sync, get playing() { return musicState==='playing'; }, get state(){return musicState;},get currentTime(){try{return player?.getCurrentTime()||0;}catch(ignore){return 0;}}, get videoId() { return VIDEO; }});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
