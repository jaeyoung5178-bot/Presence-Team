(function(){
  'use strict';
  var settings=null,uid='',off=null,busy=false,previousSeason='auto';
  function actor(){
    return typeof me!=='undefined'?me:null;
  }
  function admin(){
    var u=actor();
    return !!(u&&u.uid==='admin'&&u.status==='active'&&typeof isFounder==='function'&&isFounder(u)&&!window.__previewRole&&!window.__adminOff);
  }
  function enabled(){
    return !!(settings&&settings.season==='winter');
  }
  function apply(){
    var on=enabled();
    document.body.classList.toggle('presence-christmas',on);
    if(window.PresenceBgm)window.PresenceBgm.setTrack(on?'pOIGQ2Zu7a4':'w2rSZ90PoZE',on?'Presence · Christmas Carol':'Presence 음악');
    document.querySelectorAll('[data-christmas-toggle]').forEach(function(b){
      b.disabled=busy;
      b.setAttribute('aria-checked',String(on));
      b.textContent=on?'크리스마스 모드 · ON':'크리스마스 모드 · OFF';
    }
    );
    document.querySelectorAll('[data-season-status]').forEach(function(p){
      p.textContent=busy?'계절 설정을 저장하고 있어요.':on?'겨울 테마 적용 중 · 음악은 직접 켜주세요.':'기본 계절이 적용되어 있어요.';
    }
    );
    window.dispatchEvent(new CustomEvent('presence:seasonchange',{
      detail:{
        christmas:on
      }
    }
    ));
  }
  async function toggle(){
    if(!admin())throw Error('관리자만 크리스마스 모드를 변경할 수 있습니다.');
    if(busy)return;
    if(!settings)throw Error('정원 설정을 불러오는 중입니다.');
    if(typeof LIVE==='undefined'||!LIVE||!window.__firebaseReady)throw Error('온라인 연결을 확인해 주세요.');
    if(!enabled())previousSeason=settings.season||'auto';
    try{
      if(!enabled())localStorage.setItem('presence_pre_christmas_season',previousSeason);
      else previousSeason=localStorage.getItem('presence_pre_christmas_season')||previousSeason;
    }
    catch(ignore){
    }
    if(!/^(auto|spring|summer|autumn)$/.test(previousSeason))previousSeason='auto';
    busy=true;
    apply();
    try{
      var next={
        season:enabled()?previousSeason:'winter',updatedAt:Date.now(),updatedBy:'admin'
      }
      ;
      await DB.set('workspaceSettings',next);
      if(!admin())throw Error('관리자 계정이 변경되었습니다.');
      settings=next;
      apply();
    }
    finally{
      busy=false;
      apply();
    }
  }
  function mountAdmin(container){
    if(!container||!admin()||container.querySelector('[data-presence-season-control]'))return;
    var section=document.createElement('section');
    section.dataset.presenceSeasonControl='';
    section.className='presence-season-control';
    section.innerHTML='<div><strong>겨울의 Presence</strong></div><button type="button" role="switch" data-christmas-toggle></button><p role="status" data-season-status>모든 팀원의 정원에 적용됩니다.</p>';
    section.querySelector('button').onclick=async function(){
      var msg=section.querySelector('p');
      try{
        await toggle();
        msg.textContent=enabled()?'크리스마스 모드를 저장했습니다.':'기본 계절로 돌아왔습니다.';
      }
      catch(e){
        msg.textContent=e.message;
      }
    }
    ;
    var hero=container.querySelector('.pah-hero');
    if(hero)hero.insertAdjacentElement('afterend',section);
    else container.prepend(section);
    apply();
  }
  function sync(){
    var u=actor();
    if(!u||u.status!=='active'){
      if(off)off();
      off=null;
      uid='';
      settings=null;
      document.body.classList.remove('presence-christmas');
      document.querySelectorAll('[data-presence-season-control]').forEach(function(n){
        n.remove();
      }
      );
      if(window.PresenceBgm)window.PresenceBgm.stop();
      return;
    }
    if(typeof DB==='undefined'||typeof LIVE==='undefined'||!LIVE||!window.__firebaseReady)return;
    if(uid!==u.uid){
      if(off)off();
      uid=u.uid;
      settings=null;
      var session=uid;
      off=DB.on('workspaceSettings',function(v){
        if(actor()&&actor().uid===session){
          settings=v||{
            season:'auto'
          }
          ;
          apply();
        }
      }
      ,function(){
        settings=null;
        apply();
      }
      );
    }
    if(!admin())document.querySelectorAll('[data-presence-season-control]').forEach(function(n){
      n.remove();
    }
    );
  }
  window.PresenceSeason=Object.freeze({
    isChristmas:enabled,toggle:toggle,mountAdmin:mountAdmin,sync:sync
  }
  );
  setInterval(sync,1000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync);
  else sync();
}
)();
