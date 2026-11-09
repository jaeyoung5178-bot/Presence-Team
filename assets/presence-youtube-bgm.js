(function(){
  'use strict';
  var video='w2rSZ90PoZE',label='Presence 음악',frame=null,root=null,opened=false,playing=false,starting=false,muted=false,failure='',loadTimer=null;
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
    mountMood();
    root.hidden=!opened;
    var b=document.getElementById('presenceBgmQuick');
    b.setAttribute('aria-expanded',String(opened));
    root.querySelector('[data-title]').textContent=label;
    root.querySelector('[data-play]').textContent=starting?'연결 취소':playing?'일시정지':'재생';
    root.querySelector('[data-mute]').textContent=muted?'소리 켜기':'음소거';
    root.querySelector('a').href='https://youtu.be/'+video;
    root.querySelector('p').textContent=failure||(starting?'YouTube에 연결하고 있어요.':playing?'재생 중 · 소리를 켜거나 끌 수 있어요.':'재생되지 않으면 YouTube에서 열어 주세요.');
  }
  function destroy(){
    clearTimeout(loadTimer);
    if(frame)frame.remove();
    frame=null;
    playing=false;
    starting=false;
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
        frame.contentWindow.postMessage(JSON.stringify({
          event:'listening',id:'presenceBgmPlayer'
        }
        ),'https://www.youtube-nocookie.com');
        command('setVolume',[22]);
        command(muted?'mute':'unMute');
        command('addEventListener',['onStateChange']);
        command('addEventListener',['onError']);
        command('addEventListener',['onAutoplayBlocked']);
        command('playVideo');
      }
      ;
      frame.onerror=fail;
      root.querySelector('[data-video]').appendChild(frame);
    }
    else command('playVideo');
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
    b.textContent='♫';
    b.setAttribute('aria-label','음악 플레이어 열기·닫기');
    b.setAttribute('aria-controls','presenceMusicPanel');
    b.onclick=function(){
      if(opened)close();
      else{
        opened=true;
        state();
      }
    }
    ;
    document.body.appendChild(b);
    root=document.createElement('section');
    root.id='presenceMusicPanel';
    root.setAttribute('aria-label','음악 플레이어');
    root.innerHTML='<header><strong data-title></strong><button type="button" data-close aria-label="음악 플레이어 닫기">×</button></header><div data-video><span>재생 버튼을 눌러 음악을 시작하세요.</span></div><div class="presence-music-actions"><button type="button" data-play>재생</button><button type="button" data-mute>음소거</button><a target="_blank" rel="noopener noreferrer">YouTube ↗</a></div><p role="status">재생되지 않으면 YouTube에서 열어 주세요.</p>';
    document.body.appendChild(root);
    root.querySelector('[data-close]').onclick=close;
    root.querySelector('[data-play]').onclick=function(){
      if(starting)destroy();
      else if(playing)pause();
      else play();
    }
    ;
    root.querySelector('[data-mute]').onclick=function(){
      muted=!muted;
      try{
        localStorage.setItem('presence_music_muted',String(muted));
      }
      catch(e){
      }
      command(muted?'mute':'unMute');
      state();
    }
    ;
    try{
      muted=localStorage.getItem('presence_music_muted')==='true';
    }
    catch(e){
    }
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
