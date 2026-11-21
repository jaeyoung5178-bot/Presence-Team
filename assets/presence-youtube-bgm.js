/* Lightweight seasonal visuals and user-provided, audio-only background music. */
(function () {
  'use strict';
  if(window.PresenceBgm&&window.PresenceBgm.version==='holiday-audio-v2')return;
  var KEY = 'presence_local_season_effects.';
  var enabled = false;
  var button = null;
  var originalSet = null;
  var installed = false;
  var seasonHint = '';
  var preferenceUid = '';
  var musicButton = null, winterCanvas = null, winterFrame = 0, winterStarted = 0, winterFlight = null;

  var MUSIC_KEY='presence_local_christmas_music.',VOLUME_KEY='presence_local_christmas_volume.';
  var musicUid='',musicPreference=null,musicState='off',audio=null,musicGeneration=0,musicUnlocked=false,musicVolume=1;
  var deviceVolumeOnly=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  var audioSource=window.PresenceBgmSource||{src:'assets/audio/presence-new-york-carols-v1.m4a?v=20261121-carol1'};
  function musicStatus(state,text){
    musicState=state;
    if(musicButton){
      musicButton.textContent=state==='playing'?'음악 켜짐':state==='loading'?'음악 준비 중':state==='paused'?'음악 이어듣기':'음악 켜기';
      musicButton.setAttribute('aria-pressed',String(state==='playing'));
      musicButton.title=text||'배경 음악 켜기·끄기';
      var status=document.getElementById('presenceMusicStatus');if(status)status.textContent=text||'';
    }
  }
  function saveMusic(value){musicPreference=value;try{if(musicUid)localStorage.setItem(MUSIC_KEY+musicUid,value);}catch(ignore){}}
  function setMusicVolume(value,persist){
    var next=Number(value);if(!Number.isFinite(next))return musicVolume;musicVolume=Math.max(0,Math.min(1,next));
    if(audio&&!deviceVolumeOnly)audio.volume=musicVolume;
    if(persist!==false)try{if(musicUid)localStorage.setItem(VOLUME_KEY+musicUid,String(musicVolume));}catch(ignore){}
    var input=document.getElementById('presenceMusicVolume'),output=document.getElementById('presenceMusicVolumeValue');
    if(input)input.value=String(Math.round(musicVolume*100));if(output)output.textContent=deviceVolumeOnly?'기기':Math.round(musicVolume*100)+'%';
    return musicVolume;
  }
  function stopCarol(explicit){
    musicGeneration++;
    if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio.remove();audio=null;}
    if(explicit===true)saveMusic('off');musicStatus('off','');
  }
  function attemptMusic(){
    if(!audio||!active()||musicPreference==='off'||document.hidden)return;
    var generation=musicGeneration,promise;
    try{promise=audio.play();}catch(error){musicStatus('error','음악을 재생하지 못했어요. 음악 버튼으로 다시 시도해 주세요.');return;}
    if(promise&&promise.catch)promise.catch(function(error){
      if(generation!==musicGeneration||!audio)return;
      if(error.name==='NotAllowedError')musicStatus('blocked','음악 버튼을 누르면 배경 음악이 시작돼요.');
      else if(error.name!=='AbortError')musicStatus('error','음악을 불러오지 못했어요. 음악 버튼으로 다시 시도해 주세요.');
    });
  }
  function playCarol(){
    if(!active()||season()!=='winter')return;
    if(!musicUnlocked&&!(navigator.userActivation&&navigator.userActivation.isActive)){musicStatus('blocked','화면을 한 번 터치하면 배경 음악이 시작돼요.');return;}
    musicUnlocked=true;saveMusic('on');
    if(!audioSource||!audioSource.src){musicStatus('error','배경 음악 음원을 준비하고 있어요.');return;}
    if(!audio){
      silence();var current=++musicGeneration;audio=document.createElement('audio');audio.id='presenceCarolAudio';
      audio.loop=true;if(!deviceVolumeOnly)audio.volume=musicVolume;audio.preload='none';audio.setAttribute('playsinline','');audio.src=audioSource.src;
      audio.addEventListener('playing',function(){if(current===musicGeneration)musicStatus('playing','배경 음악 재생 중');});
      audio.addEventListener('pause',function(){if(current===musicGeneration&&musicState==='playing')musicStatus('paused','배경 음악 일시 정지');});
      audio.addEventListener('volumechange',function(){if(current===musicGeneration&&audio&&!deviceVolumeOnly)setMusicVolume(audio.volume);});
      audio.addEventListener('error',function(){if(current===musicGeneration)musicStatus('error','음악을 불러오지 못했어요. 음악 버튼으로 다시 시도해 주세요.');});
      document.body.appendChild(audio);musicStatus('loading','배경 음악을 준비하고 있어요.');
    }
    if(musicState==='error')audio.load();attemptMusic();
  }
  function syncMusic(){
    var uid=active()?String(actor().uid||''):'';
    if(uid!==musicUid){
      stopCarol();musicUid=uid;musicPreference=null;musicUnlocked=false;musicVolume=1;
      try{if(uid){musicPreference=localStorage.getItem(MUSIC_KEY+uid);var saved=localStorage.getItem(VOLUME_KEY+uid);if(saved!==null&&Number.isFinite(Number(saved)))musicVolume=Math.max(0,Math.min(1,Number(saved)));}}catch(ignore){}
      setMusicVolume(musicVolume,false);
    }
    if(!uid||season()!=='winter'){if(audio)stopCarol();return;}
    if(musicPreference==='off'){if(audio)stopCarol();return;}
    if(musicUnlocked&&!audio&&!document.hidden)playCarol();
    else if(!audio)musicStatus('blocked','화면을 한 번 터치하면 배경 음악이 시작돼요.');
  }
  function trustedMusicGesture(event){
    if(!event.isTrusted||!active()||season()!=='winter'||musicPreference==='off'||event.target.closest('#presenceMusicOpen,#presenceMusicCredit,[data-mm-music]'))return;
    musicUnlocked=true;if(audio)attemptMusic();else playCarol();
  }

  var winterRectsDirty=true;
  var winterProfile={frames:0,lastFrameMs:0,rectScans:0,canvasCreations:0,particleCount:0,spriteCount:0};
  var spriteCache=null,snowStamp=null;
  function markWinterRects(){winterRectsDirty=true;}
  function winterSprites(){
    if(spriteCache)return spriteCache;spriteCache={};
    function sprite(kind){
      var c=document.createElement('canvas');c.width=96;c.height=96;var g=c.getContext('2d');g.scale(2,2);g.translate(24,24);g.lineCap='round';g.lineJoin='round';
      function oval(x,y,rx,ry,color){g.fillStyle=color;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();}
      function line(points,color,width){g.strokeStyle=color;g.lineWidth=width;g.beginPath();points.forEach(function(p,i){if(i)g.lineTo(p[0],p[1]);else g.moveTo(p[0],p[1]);});g.stroke();}
      if(kind==='gift'){
        g.fillStyle='#8f3845';g.fillRect(-9,-5,18,15);g.fillStyle='#a84c56';g.fillRect(-10,-7,20,5);g.fillStyle='#e0c27f';g.fillRect(-1.5,-7,3,17);
        oval(-4,-10,4,2.5,'#d5b16e');oval(4,-10,4,2.5,'#dfbf7d');oval(0,-8,2,2,'#edda9b');
      }else if(kind==='snowman'){
        line([[-6,2],[-12,-3]],'#846348',1.5);line([[6,2],[12,-2]],'#846348',1.5);
        oval(0,6,8,7,'#eef5ef');oval(0,-4,5.8,5.5,'#fbfcf3');g.fillStyle='#234b3d';g.fillRect(-6,-10,12,2.5);g.fillRect(-4,-16,8,7);
        g.fillStyle='#a3414b';g.fillRect(-5.5,0,11,3);g.fillRect(3,2,2.5,5);oval(-2,-5,0.6,0.7,'#314335');oval(2,-5,0.6,0.7,'#314335');
        g.fillStyle='#c68c47';g.beginPath();g.moveTo(0,-3.5);g.lineTo(5,-2.3);g.lineTo(0,-1.5);g.fill();oval(0,5,.8,.8,'#6b7869');oval(0,9,.8,.8,'#6b7869');
      }else if(kind==='reindeer'){
        line([[-7,3],[-9,13]],'#755039',2.3);line([[-1,4],[-2,13]],'#9c704b',2.2);line([[6,3],[8,12]],'#755039',2.3);
        oval(-2,1,10,6,'#a88057');oval(-3,-.2,7.5,4,'#bd9569');g.fillStyle='#a88057';g.beginPath();g.moveTo(4,1);g.lineTo(6,-10);g.lineTo(11,-7);g.lineTo(9,4);g.fill();
        oval(9,-10,5,5.2,'#b38b60');oval(13,-8,3.5,2.7,'#d2ae7e');oval(16,-8,1.3,1.2,'#a3414b');oval(10,-11,.7,.8,'#293d32');oval(4,-13,3,1.5,'#b18a60');
        line([[7,-14],[6,-19],[3,-21]],'#77583a',1.4);line([[6,-18],[9,-20]],'#77583a',1.3);line([[11,-14],[13,-18],[16,-19]],'#77583a',1.4);
        line([[-11,-1],[-15,-5]],'#e1c498',2.5);line([[5,-5],[11,-3]],'#8e3441',2.8);oval(8,-3,1.1,1.1,'#ddc078');
      }else{
        oval(-7,-1,6,8,'#466a4a');oval(1,-4,6,7,'#973a47');oval(2,-11,4.6,4.4,'#ebc8a5');oval(2,-7,4,3.5,'#fbf5e7');oval(3,-11,.65,.7,'#293d32');
        g.fillStyle='#a34049';g.beginPath();g.moveTo(-3,-14);g.lineTo(3,-22);g.lineTo(9,-14);g.fill();line([[-3,-14],[8,-14]],'#fff5e4',2.4);oval(3,-22,1.8,1.8,'#fff5e4');
        line([[1,1],[6,5],[12,5]],'#233e33',3);line([[-3,0],[-7,5]],'#973a47',3);oval(7,-2,2,1.6,'#fff5e4');
        g.fillStyle='#8d3442';g.beginPath();g.moveTo(-16,3);g.lineTo(9,3);g.quadraticCurveTo(16,2,17,-3);g.lineTo(18,1);g.quadraticCurveTo(16,10,9,10);g.lineTo(-12,10);g.fill();
        line([[-15,13],[10,13],[16,10]],'#b68b51',1.7);line([[-9,10],[-8,13]],'#b68b51',1.4);line([[8,10],[9,13]],'#b68b51',1.4);line([[-14,5],[11,5]],'#d2ad6a',1);
      }
      return c;
    }
    ['santa','reindeer','gift','snowman'].forEach(function(kind){spriteCache[kind]=sprite(kind);});
    snowStamp=document.createElement('canvas');snowStamp.width=24;snowStamp.height=24;var sg=snowStamp.getContext('2d'),gradient=sg.createRadialGradient(12,12,0,12,12,12);gradient.addColorStop(0,'rgba(255,255,255,.95)');gradient.addColorStop(.35,'rgba(255,255,255,.8)');gradient.addColorStop(1,'rgba(231,240,235,0)');sg.fillStyle=gradient;sg.fillRect(0,0,24,24);
    return spriteCache;
  }
  function winterEffects(on){
    if(!on){
      if(winterFrame)cancelAnimationFrame(winterFrame);winterFrame=0;
      if(winterCanvas)winterCanvas.remove();winterCanvas=null;
      if(winterFlight)winterFlight.remove();winterFlight=null;return;
    }
    if(winterCanvas)return;
    winterCanvas=document.createElement('canvas');winterCanvas.id='presenceWinterCanvas';winterCanvas.setAttribute('aria-hidden','true');document.body.appendChild(winterCanvas);winterProfile.canvasCreations++;
    var ctx=winterCanvas.getContext('2d');if(!ctx){winterCanvas.remove();winterCanvas=null;return;}
    var sprites=winterSprites(),safeRects=[],safeAt=0,lastDraw=0;winterStarted=performance.now();winterRectsDirty=true;
    function blocked(x,y,rx,ry){return safeRects.some(function(r){return x+rx>r.left-5&&x-rx<r.right+5&&y+ry>r.top-5&&y-ry<r.bottom+5;});}
    function draw(now){
      if(!winterCanvas)return;
      winterFrame=requestAnimationFrame(draw);if(now-lastDraw<1000/30)return;lastDraw=now;
      var started=performance.now(),w=innerWidth,h=innerHeight,d=Math.min(devicePixelRatio||1,1.5);
      if(winterCanvas.width!==Math.round(w*d)||winterCanvas.height!==Math.round(h*d)){winterCanvas.width=Math.round(w*d);winterCanvas.height=Math.round(h*d);winterRectsDirty=true;}
      ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);var t=(now-winterStarted)/1000;
      if((winterRectsDirty&&now-safeAt>160)||now-safeAt>1400){
        safeAt=now;winterRectsDirty=false;winterProfile.rectScans++;
        safeRects=Array.from(document.querySelectorAll('header,nav,iframe,input,textarea,select,button,a,dialog,.modal.on,#presenceUtilityDock,#app section,#app article,#app .card,#app .panel,#app .pw-card,#app .pw-garden-mobile-card,#app h1,#app h2,#app h3,#app h4,#app p,#app label,#app summary,#app strong,#app b,#app dt,#app dd,#app th,#app td')).map(function(e){return e.getBoundingClientRect();}).filter(function(r){return r.width>0&&r.height>0&&r.bottom>0&&r.top<h;});
      }
      var flakes=Math.min(46,Math.max(18,Math.round(w/30))),kinds=['santa','reindeer','gift','snowman'],count=w<700?4:7,visible=0;
      for(var i=0;i<flakes;i++){
        var near=i%3!==0,x=((i*97+Math.sin(t*(near?.4:.2)+i)*18)%w+w)%w,y=(i*67+t*(near?15+i%4*3:6+i%3))%h,size=near?6+i%3*1.2:4;
        if(blocked(x,y,size*.4,size*.4))continue;ctx.globalAlpha=near?.82:.42;ctx.drawImage(snowStamp,x-size/2,y-size/2,size,size);
      }
      for(var n=0;n<count;n++){
        var size=(w<700?23:28)+(n%2)*2,cx=w*(n+.55)/count+Math.sin(t*.1+n*1.7)*18,cy=((h*(n*.223+.13)+t*(2+n%3))%Math.max(1,h-150))+56;
        for(var shift of [0,30,-30,60,-60,90,-90,120,-120]){
          var yy=cy+shift;if(yy<size||yy>h-size)continue;if(blocked(cx,yy,size*.65,size*.65))continue;
          ctx.globalAlpha=n%2?.82:.92;ctx.drawImage(sprites[kinds[n%4]],cx-size*.6,yy-size*.6,size*1.2,size*1.2);visible++;break;
        }
      }
      ctx.globalAlpha=1;winterProfile.frames++;winterProfile.lastFrameMs=performance.now()-started;winterProfile.particleCount=flakes;winterProfile.spriteCount=visible;
      winterCanvas.dataset.characterCount=String(count);winterCanvas.dataset.visibleCharacters=String(visible);winterCanvas.dataset.frameMs=winterProfile.lastFrameMs.toFixed(2);
    }
    winterFrame=requestAnimationFrame(draw);
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
    var show=active()&&enabled&&!document.hidden; winterEffects(show&&season()==='winter'&&!matchMedia('(prefers-reduced-motion: reduce)').matches); if(originalSet)originalSet(show&&season()!=='winter'?mode():null);
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
    musicButton=document.createElement('button');musicButton.id='presenceMusicOpen';musicButton.type='button';musicButton.textContent='음악';musicButton.setAttribute('aria-pressed','false');musicButton.onclick=function(){if(musicState==='playing'||musicState==='loading')stopCarol(true);else{musicUnlocked=true;playCarol();}};document.body.appendChild(musicButton);var status=document.createElement('span');status.id='presenceMusicStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');document.body.appendChild(status);
    var credit=document.createElement('details');credit.id='presenceMusicCredit';credit.innerHTML='<summary>음악 정보 · 음량</summary><p>뉴욕 캐롤 플레이리스트 · 사용자 제공<br>영상 없는 배경 음악 · 반복 재생</p><div class="presence-music-volume"><label for="presenceMusicVolume">배경 음량</label><input id="presenceMusicVolume" type="range" min="0" max="100" step="1" value="100"><output id="presenceMusicVolumeValue" for="presenceMusicVolume">100%</output></div>';var utility=document.getElementById('presenceUtilityDock');if(!utility){utility=document.createElement('div');utility.id='presenceUtilityDock';utility.setAttribute('role','group');utility.setAttribute('aria-label','화면 효과와 음악');document.body.appendChild(utility);}utility.appendChild(credit);document.getElementById('presenceMusicVolume').oninput=function(event){setMusicVolume(Number(event.target.value)/100);};if(deviceVolumeOnly){document.getElementById('presenceMusicVolume').disabled=true;document.getElementById('presenceMusicVolumeValue').textContent='기기';var volumeNote=document.createElement('p');volumeNote.textContent='아이폰·아이패드는 기기 음량 버튼으로 조절해 주세요.';credit.appendChild(volumeNote);}
    document.body.classList.add('presence-effects-ready', 'presence-music-ready');
    sync();
    window.addEventListener('resize',markWinterRects,{passive:true});window.addEventListener('scroll',markWinterRects,{passive:true});
    window.addEventListener('presence:seasonchange', function (event) {
      if (event.detail && /^(auto|winter|spring|summer|autumn)$/.test(event.detail.season || '')) seasonHint = event.detail.season;
      if (season() !== 'winter') stopCarol();
      sync();
    });
    document.addEventListener('keydown',function(event){if(event.key==='Enter'||event.key===' '||event.key==='Spacebar')trustedMusicGesture(event);});
    document.addEventListener('click',trustedMusicGesture,{passive:true});
    document.addEventListener('visibilitychange',function(){if(document.hidden&&audio)audio.pause();else attemptMusic();apply();});
    var motion=window.matchMedia('(prefers-reduced-motion: reduce)');if(motion.addEventListener)motion.addEventListener('change',function(){preferenceUid='';sync();});
  }
  window.PresenceChristmasEffects = Object.freeze({toggle: toggle, setEnabled: setEnabled, sync: sync, get enabled() { return enabled; }, get mode() { return mode(); }, get renderStats(){return Object.assign({},winterProfile);}, get audioState() { return musicState; }});
  // User-provided local audio only; no video player, third-party embed or initial media request.
  window.PresenceBgm = Object.freeze({version:'holiday-audio-v2',play:playCarol,setVolume:function(value){return setMusicVolume(value);},get volume(){return musicVolume;},pause:function(){stopCarol(true);},stop:suspend,toggle:function(){if(musicState==='playing'||musicState==='loading')stopCarol(true);else playCarol();},togglePanel:playCarol,setTrack:sync,setSource:function(source){stopCarol();audioSource=source&&typeof source.src==='string'?source:null;syncMusic();},get playing(){return musicState==='playing';},get state(){return musicState;},get currentTime(){return audio?.currentTime||0;}});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
