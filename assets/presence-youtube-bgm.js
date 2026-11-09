(function(){
  'use strict';
  var video='w2rSZ90PoZE',label='Presence 음악',frame=null,root=null,opened=false,playing=false,starting=false,muted=false,failure='',loadTimer=null;
  var volume=50,actualMuted=null,actualVolume=null,audioSynced=false,handshakeTimers=[];
  function stopMood(){
    try{
      if(typeof SND!=='undefined')SND.stop();
    }
    catch(e){
    }
  }
  function ownAudio(){
    try{
      if(typeof SND==='undefined'||SND.__presenceMusicOwner)return;
      var original=SND.play;
      SND.play=function(){
        if(playing||starting)return;
        return original.apply(this,arguments);
      }
      ;
      SND.__presenceMusicOwner=true;
    }
    catch(e){
    }
  }
  function command(name,args){
    if(frame&&frame.contentWindow)frame.contentWindow.postMessage(JSON.stringify({
      event:'command',func:name,args:args||[]
    }
    ),'https://www.youtube-nocookie.com');
  }
  function saveAudioPreference(){
    try{
      localStorage.setItem('presence_music_muted',String(muted));
      localStorage.setItem('presence_music_volume',String(volume));
    }catch(ignore){}
  }
  function applyAudio(){
    command('setVolume',[volume]);
    command(muted?'mute':'unMute');
  }
  function handshake(){
    if(!frame)return;
    frame.contentWindow.postMessage(JSON.stringify({event:'listening',id:'presenceBgmPlayer'}),'https://www.youtube-nocookie.com');
    command('addEventListener',['onReady']);
    command('addEventListener',['onStateChange']);
    command('addEventListener',['onError']);
    command('addEventListener',['onAutoplayBlocked']);
  }
  function playWithSound(){
    muted=false;
    if(volume===0)volume=50;
    saveAudioPreference();
    play();
  }
  function mountMood(){
    document.body.classList.add('presence-music-ready');
    if(typeof toggleFxDock!=='function')return;
    var b=root.querySelector('[data-mood]');
    if(!b){
      b=document.createElement('button');
      b.type='button';
      b.dataset.mood='';
      b.textContent='화면 분위기';
      b.onclick=function(){
        close();
        var dock=document.getElementById('fxDock');
        if(dock)dock.classList.add('show');
        toggleFxDock(true);
      }
      ;
      root.querySelector('.presence-music-actions').appendChild(b);
    }
    var dock=document.getElementById('fxDock');
    b.hidden=!(document.body.classList.contains('can-mod')||(dock&&dock.classList.contains('show')));
  }
  function state(){
    if(!root)return;
    var activeActor=typeof me!=='undefined'&&me&&me.status==='active';
    document.body.classList.toggle('presence-music-authenticated',!!activeActor);
    mountMood();
    root.hidden=!opened;
    var b=document.getElementById('presenceBgmQuick');
    b.setAttribute('aria-expanded',String(opened));
    b.setAttribute('aria-label',starting?'캐롤 연결 취소':playing?'캐롤 끄기':'캐롤 켜기');
    b.title=starting?'캐롤 연결 취소':playing?'캐롤 끄기':'캐롤 켜기';
    b.querySelector('.presence-music-quick-label').textContent=starting?'연결 중':playing?'캐롤 끄기':'캐롤 켜기';
    root.querySelector('[data-title]').textContent=label;
    root.querySelector('[data-play]').textContent=starting?'연결 취소':playing?'일시정지':'소리 켜고 재생';
    root.querySelector('[data-mute]').textContent=(actualMuted===null?muted:actualMuted)?'소리 켜기':'음소거';
    root.querySelector('[data-mute]').setAttribute('aria-pressed',String(actualMuted===null?muted:actualMuted));
    root.querySelector('[data-volume]').textContent=volume+'%';
    root.querySelector('a').href='https://youtu.be/'+video;
    var soundStatus=actualMuted===true||actualVolume===0?'재생 중 · 음소거 상태예요. 소리를 켜주세요.':actualMuted===false&&actualVolume>0?'캐롤 재생 중 · 볼륨 '+actualVolume+'%':'재생 중 · 소리 상태 확인 중…';
    root.querySelector('p').textContent=failure||(starting?'YouTube에 연결하고 있어요.':playing?soundStatus:'소리 켜고 재생을 누르면 캐롤이 시작됩니다.');
  }
  function destroy(){
    clearTimeout(loadTimer);
    handshakeTimers.forEach(clearTimeout);
    handshakeTimers=[];
    if(frame)frame.remove();
    frame=null;
    playing=false;
    starting=false;
    actualMuted=null;
    actualVolume=null;
    audioSynced=false;
    state();
  }
  function pause(){
    clearTimeout(loadTimer);
    starting=false;
    playing=false;
    command('pauseVideo');
    state();
  }
  function close(){
    opened=false;
    destroy();
  }
  function fail(){
    destroy();
    failure='이 화면에서 음악을 재생할 수 없어요. YouTube에서 열어 주세요.';
    state();
  }
  function play(){
    if(!root)return;
    if(document.querySelector('.modal.on,dialog[open]')){
      if(typeof window.toast==='function')window.toast('열린 창을 닫고 음악 버튼을 눌러 주세요.');
      return;
    }
    ownAudio();
    opened=true;
    failure='';
    starting=true;
    actualMuted=null;
    actualVolume=null;
    audioSynced=false;
    stopMood();
    if(!frame){
      frame=document.createElement('iframe');
      frame.id='presenceBgmPlayer';
      frame.title=label+' · YouTube';
      frame.allow='autoplay; encrypted-media; picture-in-picture';
      frame.referrerPolicy='strict-origin-when-cross-origin';
      frame.src='https://www.youtube-nocookie.com/embed/'+video+'?enablejsapi=1&playsinline=1&controls=1&rel=0&autoplay=1&origin='+encodeURIComponent(location.origin);
      frame.onload=function(){
        if(!starting)return;
        handshake();
        command('playVideo');
      }
      ;
      frame.onerror=fail;
      root.querySelector('[data-video]').appendChild(frame);
    }
    else{
      applyAudio();
      command('playVideo');
    }
    handshakeTimers.forEach(clearTimeout);
    handshakeTimers=[250,800,1800].map(function(delay){return setTimeout(handshake,delay);});
    clearTimeout(loadTimer);
    loadTimer=setTimeout(function(){
      if(starting)fail();
    }
    ,12000);
    state();
  }
  function receive(e){
    if(!frame||e.source!==frame.contentWindow||!/^https:\/\/www\.youtube(?:-nocookie)?\.com$/.test(e.origin))return;
    var d=e.data;
    try{
      if(typeof d==='string')d=JSON.parse(d);
    }
    catch(ignore){
      return;
    }
    if(!d)return;
    if(d.event==='onError'||d.event==='onAutoplayBlocked'){
      fail();
      return;
    }
    if(d.event==='onReady'||d.event==='initialDelivery'||d.event==='infoDelivery'){
      if(!audioSynced){
        audioSynced=true;
        applyAudio();
      }
      if(d.info&&typeof d.info==='object'){
        if(typeof d.info.muted==='boolean')actualMuted=d.info.muted;
        if(typeof d.info.volume==='number')actualVolume=Math.max(0,Math.min(100,Math.round(d.info.volume)));
      }
      state();
    }
    var n=d.event==='onStateChange'?d.info:d.event==='infoDelivery'&&d.info?d.info.playerState:null;
    if(typeof n==='number'){
      playing=n===1;
      if(playing){
        starting=false;
        failure='';
        clearTimeout(loadTimer);
        stopMood();
      }
      else if(n===2||n===0){
        starting=false;
        clearTimeout(loadTimer);
      }
      state();
    }
  }
  function boot(){
    if(document.getElementById('presenceBgmQuick'))return;
    var b=document.createElement('button');
    b.id='presenceBgmQuick';
    b.type='button';
    b.innerHTML='<span aria-hidden="true">♫</span><span class="presence-music-quick-label">캐롤 켜기</span>';
    b.setAttribute('aria-label','캐롤 켜기');
    b.setAttribute('aria-controls','presenceMusicPanel');
    b.onclick=function(){
      if(starting||playing)close();
      else playWithSound();
    }
    ;
    document.body.appendChild(b);
    root=document.createElement('section');
    root.id='presenceMusicPanel';
    root.setAttribute('aria-label','음악 플레이어');
    root.innerHTML='<header><strong data-title></strong><button type="button" data-close aria-label="음악 플레이어 닫기">×</button></header><div data-video><span>소리 켜고 재생을 눌러 주세요.</span></div><div class="presence-music-actions"><button type="button" data-play>소리 켜고 재생</button><button type="button" data-mute>음소거</button><a target="_blank" rel="noopener noreferrer">YouTube ↗</a></div><div class="presence-music-volume" role="group" aria-label="음악 볼륨"><span>볼륨</span><button type="button" data-volume-down aria-label="음악 볼륨 낮추기">−</button><output data-volume>50%</output><button type="button" data-volume-up aria-label="음악 볼륨 높이기">+</button></div><p role="status">소리 켜고 재생을 누르면 캐롤이 시작됩니다.</p>';
    document.body.appendChild(root);
    root.querySelector('[data-close]').onclick=close;
    root.querySelector('[data-play]').onclick=function(){
      if(starting)destroy();
      else if(playing)pause();
      else playWithSound();
    }
    ;
    root.querySelector('[data-mute]').onclick=function(){
      muted=!(actualMuted===null?muted:actualMuted);
      if(!muted&&volume===0)volume=50;
      saveAudioPreference();
      actualMuted=null;
      applyAudio();
      state();
    }
    ;
    try{
      muted=localStorage.getItem('presence_music_muted')==='true';
      var savedVolume=Number(localStorage.getItem('presence_music_volume'));
      if(localStorage.getItem('presence_music_volume')!==null&&Number.isFinite(savedVolume))volume=Math.max(0,Math.min(100,savedVolume));
    }
    catch(e){
    }
    function changeVolume(delta){
      volume=Math.max(0,Math.min(100,volume+delta));
      if(delta>0)muted=false;
      if(volume===0)muted=true;
      actualMuted=null;
      actualVolume=null;
      saveAudioPreference();
      applyAudio();
      state();
    }
    root.querySelector('[data-volume-down]').onclick=function(){changeVolume(-10);};
    root.querySelector('[data-volume-up]').onclick=function(){changeVolume(10);};
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&opened){
        close();
        b.focus();
      }
    }
    );
    document.addEventListener('visibilitychange',function(){
      if(document.hidden)pause();
    }
    );
    window.addEventListener('message',receive);
    state();
  }
  window.PresenceBgm=Object.freeze({
    play:play,pause:pause,stop:close,toggle:function(){
      playing?pause():play();
    }
    ,togglePanel:function(){
      if(opened)close();
      else{
        opened=true;
        state();
      }
    }
    ,setTrack:function(id,title){
      if(!/^[\w-]{11}$/.test(id))throw Error('올바른 YouTube ID가 아닙니다.');
      if(video!==id)destroy();
      video=id;
      label=title||'Presence 음악';
      state();
    }
    ,get videoId(){
      return video;
    }
    ,get playing(){
      return playing;
    }
    ,get audioStatus(){
      return Object.freeze({muted:actualMuted,volume:actualVolume,wantedMuted:muted,wantedVolume:volume});
    }
  }
  );
  function start(){
    boot();
    // A real modal owns both focus and media visibility while it is open.
    new MutationObserver(function(records){
      if(!opened)return;
      if(records.some(function(record){
        return record.target.matches('.modal.on,dialog[open]');
      }))close();
    }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','open']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();
}
)();
