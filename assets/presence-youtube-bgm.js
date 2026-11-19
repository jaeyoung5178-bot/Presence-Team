/* Seasonal visuals and licensed, audio-only background music. */
(function () {
  'use strict';
  var KEY = 'presence_local_season_effects.';
  var enabled = false;
  var button = null;
  var originalSet = null;
  var installed = false;
  var seasonHint = '';
  var preferenceUid = '';
  var musicButton = null, winterCanvas = null, winterFrame = 0, winterStarted = 0, winterFlight = null;
 var MUSIC_KEY='presence_local_christmas_music.',musicUid='',musicPreference=null,musicState='off',audio=null,musicGeneration=0;
 var audioSource=window.PresenceBgmSource||{src:'assets/audio/deck-the-halls-a-kevin-macleod.mp3'};
 function musicStatus(state,text){musicState=state;if(musicButton){musicButton.textContent=state==='playing'?'음악 켜짐':state==='blocked'?'음악 재생 대기':state==='loading'?'음악 준비 중':'음악';musicButton.setAttribute('aria-pressed',String(state==='playing'));musicButton.title=text||'배경 음악 켜기·끄기';var status=document.getElementById('presenceMusicStatus');if(status)status.textContent=text||'';}}
 function saveMusic(value){musicPreference=value;try{if(musicUid)localStorage.setItem(MUSIC_KEY+musicUid,value);}catch(ignore){}}
 function stopCarol(explicit){musicGeneration++;if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio.remove();audio=null;}if(explicit===true)saveMusic('off');musicStatus('off','');}
 function attemptMusic(){if(!audio||!active()||musicPreference==='off'||document.hidden)return;var generation=musicGeneration;var promise;try{promise=audio.play();}catch(error){musicStatus('error','음악을 재생하지 못했어요. 음악 버튼으로 다시 시도해 주세요.');return;}if(promise&&promise.catch)promise.catch(function(error){if(generation!==musicGeneration||!audio)return;if(error.name==='NotAllowedError')musicStatus('blocked','자동 재생이 차단됐어요. 화면을 한 번 터치하면 음악이 시작돼요.');else if(error.name!=='AbortError')musicStatus('error','음악을 불러오지 못했어요. 음악 버튼으로 다시 시도해 주세요.');});}
 function playCarol(){if(!active()||season()!=='winter')return;saveMusic('on');if(!audioSource||!audioSource.src){musicStatus('error','배경 음악 음원을 준비하고 있어요.');return;}if(!audio){silence();var current=++musicGeneration;audio=document.createElement('audio');audio.id='presenceCarolAudio';audio.loop=true;audio.volume=.65;audio.preload='auto';audio.src=audioSource.src;audio.addEventListener('playing',function(){if(current===musicGeneration)musicStatus('playing','배경 음악 재생 중');});audio.addEventListener('pause',function(){if(current===musicGeneration&&musicState==='playing')musicStatus('paused','배경 음악 일시 정지');});audio.addEventListener('error',function(){if(current===musicGeneration)musicStatus('error','음악을 불러오지 못했어요. 음악 버튼으로 다시 시도해 주세요.');});document.body.appendChild(audio);musicStatus('loading','배경 음악을 준비하고 있어요.');}if(musicState==='error')audio.load();attemptMusic();}
 function syncMusic(){var uid=active()?String(actor().uid||''):'';if(uid!==musicUid){stopCarol();musicUid=uid;musicPreference=null;try{if(uid)musicPreference=localStorage.getItem(MUSIC_KEY+uid);}catch(ignore){}}if(!uid||season()!=='winter'){if(audio)stopCarol();return;}if(musicPreference!=='off'&&!audio&&!document.hidden)playCarol();}
 function winterEffects(on) {
   if (!on) { if(winterFrame)cancelAnimationFrame(winterFrame);winterFrame=0;if(winterCanvas)winterCanvas.remove();winterCanvas=null;if(winterFlight)winterFlight.remove();winterFlight=null;return; }
   if(winterCanvas)return;
   winterCanvas=document.createElement('canvas');winterCanvas.id='presenceWinterCanvas';winterCanvas.setAttribute('aria-hidden','true');document.body.appendChild(winterCanvas);
   var safeRects=[],safeAt=0;
   var ctx=winterCanvas.getContext('2d');if(!ctx){winterCanvas.remove();winterCanvas=null;return;}winterStarted=performance.now();
   function character(x,y,size,reindeer){
     ctx.save();ctx.translate(x,y);ctx.scale(size/24,size/24);ctx.globalAlpha=.82;
     function oval(cx,cy,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fill();}
     if(reindeer){
       ctx.strokeStyle='#85603e';ctx.lineWidth=1.5;ctx.lineCap='round';for(var side of[-1,1]){ctx.beginPath();ctx.moveTo(side*5,-5);ctx.lineTo(side*7,-10);ctx.lineTo(side*10,-12);ctx.moveTo(side*7,-10);ctx.lineTo(side*6,-13);ctx.stroke();}
       oval(-8,-3,4,2.5,'#b98a5e');oval(8,-3,4,2.5,'#b98a5e');oval(0,0,7,7,'#bd8e62');oval(0,3,4.7,3.5,'#e5c49c');oval(-2.8,-1,1,1.3,'#312e2b');oval(2.8,-1,1,1.3,'#312e2b');oval(0,2,1.8,1.5,'#bd4542');oval(0,9,4.2,2,'#c24c43');
     }else{
       oval(0,7,7,4.5,'#b9403d');oval(0,1,7.7,7.5,'#fff9e9');oval(0,-1,5.6,5,'#edc7a6');oval(-4,1.5,1.5,1,'#df9d92');oval(4,1.5,1.5,1,'#df9d92');oval(-2,-1,0.8,1,'#302c29');oval(2,-1,0.8,1,'#302c29');oval(0,4,4.7,3.5,'#fffaf0');
       ctx.fillStyle='#bd4542';ctx.beginPath();ctx.moveTo(-7,-5);ctx.quadraticCurveTo(-4,-15,5,-10);ctx.lineTo(8,-5);ctx.closePath();ctx.fill();oval(0,-5,7.5,1.6,'#fffaf0');oval(6,-10,2.2,2.2,'#fffaf0');
     }ctx.restore();
   }
   function draw(now){
     if(!winterCanvas)return;var w=innerWidth,h=innerHeight,d=Math.min(devicePixelRatio||1,1.5);
     if(winterCanvas.width!==Math.round(w*d)||winterCanvas.height!==Math.round(h*d)){winterCanvas.width=Math.round(w*d);winterCanvas.height=Math.round(h*d);}
     ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);var t=(now-winterStarted)/1000;
     if(now-safeAt>500){safeAt=now;safeRects=Array.from(document.querySelectorAll('header,nav,iframe,input,textarea,select,button,a,main h1,main h2,main h3,main p,main label,main strong,main b,main .pw-garden-mobile-meta,main .pw-garden-totals,main dt,main dd,main td,dialog,.modal.on')).filter(function(e){return e.getClientRects().length;}).map(function(e){return e.getBoundingClientRect();});}
     for(var i=0;i<42;i++){var near=i%3!==0,x=((i*97+Math.sin(t*(near?.5:.28)+i)*14)%w+w)%w,y=(i*67+t*(near?34+i%4*5:10+i%3*2))%h;if(safeRects.some(function(r){return x>r.left-4&&x<r.right+4&&y>r.top-4&&y<r.bottom+4;}))continue;ctx.globalAlpha=near?.76:.38;ctx.fillStyle='#ffffff';ctx.strokeStyle='#dce9ef';ctx.lineWidth=.2;ctx.shadowColor='#d2e1e9';ctx.shadowBlur=near?2.2:.8;ctx.beginPath();ctx.arc(x,y,near?2.2+i%3*.6:1.4+i%3*.3,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.shadowBlur=0;
     // Small separate canvas characters drift among snow depths; no bitmap or flight band.
     if(winterFlight){winterFlight.remove();winterFlight=null;}
     var count=w<980?4:6,visible=0;
     for(var n=0;n<count;n++){
       var size=(w<980?18:24)+(n%3)*2,cx=w*(n+.55)/count+Math.sin(t*.18+n*1.7)*9,cy=((h*(n*.271+.16)+t*(3+n%3))%(Math.max(1,h-170)))+80+Math.sin(t*.55+n)*3;
       for(var shift of[0,24,-24,48,-48,72,-72,96,-96]){var yy=cy+shift,radius=size*.58;if(yy<84||yy>h-150)continue;
         if(safeRects.some(function(r){return cx-radius<r.right+2&&cx+radius>r.left-2&&yy-radius<r.bottom+2&&yy+radius>r.top-2;}))continue;
         character(cx,yy,size,n%2===1);visible++;break;
       }
     }winterCanvas.dataset.characterCount=String(count);winterCanvas.dataset.visibleCharacters=String(visible);
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
    button.dataset.audioState = musicState;
    button.querySelector('[data-effect-label]').textContent = label;
    button.querySelector('[data-effect-icon]').textContent = season() === 'winter' ? '❄' : '✧';
    button.classList.toggle('is-on', enabled);
  }
  function apply() {
    silence();
    placeCanvas();
    var show=active()&&enabled&&!document.hidden; winterEffects(show&&season()==='winter'); if(originalSet)originalSet(show&&season()!=='winter'?mode():null);
   if(musicButton){musicButton.hidden=!active()||season()!=='winter';var credit=document.getElementById('presenceMusicCredit');if(credit)credit.hidden=musicButton.hidden;var dock=document.getElementById('presenceUtilityDock');if(dock&&musicButton.parentNode!==dock)dock.appendChild(musicButton);}
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
    musicButton=document.createElement('button');musicButton.id='presenceMusicOpen';musicButton.type='button';musicButton.textContent='음악';musicButton.setAttribute('aria-pressed','false');musicButton.onclick=function(){if(musicState==='playing')stopCarol(true);else playCarol();};document.body.appendChild(musicButton);var status=document.createElement('span');status.id='presenceMusicStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');document.body.appendChild(status);
    var credit=document.createElement('details');credit.id='presenceMusicCredit';credit.innerHTML='<summary>음악 정보</summary><p>Deck the Halls A · Kevin MacLeod (<a href="https://incompetech.com/music/royalty-free/index.html?Search=Search&amp;isrc=USUAN1100263" target="_blank" rel="noopener noreferrer">incompetech.com · 원곡</a>)<br><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> · 저용량 MP3 · 원음 레벨 유지·시작/끝 페이드 · 반복 재생</p>';(document.querySelector('#app main')||document.body).appendChild(credit);
    document.body.classList.add('presence-effects-ready', 'presence-music-ready');
    sync();
    window.addEventListener('presence:seasonchange', function (event) {
      if (event.detail && /^(auto|winter|spring|summer|autumn)$/.test(event.detail.season || '')) seasonHint = event.detail.season;
      if (season() !== 'winter') stopCarol();
      sync();
    });
    document.addEventListener('keydown',function(event){if(event.isTrusted&&!event.target.closest('#presenceMusicOpen'))attemptMusic();});
    document.addEventListener('pointerdown',function(event){if(event.isTrusted&&!event.target.closest('#presenceMusicOpen'))attemptMusic();},{passive:true});
    document.addEventListener('visibilitychange',function(){if(document.hidden&&audio)audio.pause();else attemptMusic();apply();});
    var motion=window.matchMedia('(prefers-reduced-motion: reduce)');if(motion.addEventListener)motion.addEventListener('change',function(){preferenceUid='';sync();});
  }
  window.PresenceChristmasEffects = Object.freeze({toggle: toggle, setEnabled: setEnabled, sync: sync, get enabled() { return enabled; }, get mode() { return mode(); }, get audioState() { return musicState; }});
  // Self-hosted licensed audio only: no remote video player or hidden iframe.
  window.PresenceBgm = Object.freeze({play:playCarol,pause:function(){stopCarol(true);},stop:suspend,toggle:function(){if(musicState==='playing')stopCarol(true);else playCarol();},togglePanel:playCarol,setTrack:sync,setSource:function(source){stopCarol();audioSource=source&&typeof source.src==='string'?source:null;syncMusic();},get playing(){return musicState==='playing';},get state(){return musicState;},get currentTime(){return audio?.currentTime||0;}});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
