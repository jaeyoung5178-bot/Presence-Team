(function(){
  'use strict';
  var settings=null,uid='',off=null,busy=false,settingsError=false,previousSeason='auto';
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
  function rememberVisualMode(){
    // Appearance only: authentication and access never depend on this hint.
    if(!settings)return;
    try{localStorage.setItem('presence_christmas_visual_hint',enabled()?'winter':'off');}catch(ignore){}
  }
  function apply(){
    var on=enabled(),known=!!settings;
    document.querySelectorAll('[data-season-choice]').forEach(function(b){b.disabled=busy||!known||settingsError;b.setAttribute('aria-pressed',String(known&&settings.season===b.dataset.seasonChoice));});
    document.body.classList.toggle('presence-christmas',on);
    document.querySelectorAll('[data-christmas-toggle]').forEach(function(b){
      b.disabled=busy||!known||settingsError;
      b.setAttribute('aria-busy',String(!known&&!settingsError));
      b.setAttribute('role',known?'switch':'button');
      if(known)b.setAttribute('aria-checked',String(on));
      else b.removeAttribute('aria-checked');
      b.textContent=settingsError?(known?'연결 확인 필요 · '+(on?'ON':'OFF'):'설정 확인 실패'):!known?'설정 확인 중…':on?'크리스마스 모드 · ON':'크리스마스 모드 · OFF';
    }
    );
    document.querySelectorAll('[data-season-status]').forEach(function(p){
      p.textContent=settingsError?(known?'마지막으로 확인된 설정입니다. 연결 후 새로고침해 주세요.':'설정을 읽지 못했습니다. 연결 후 새로고침해 주세요.'):!known?'저장된 계절 설정을 확인하고 있어요.':busy?'계절 설정을 저장하고 있어요.':({spring:'벚꽃',summer:'햇빛',autumn:'낙엽',winter:'크리스마스'}[settings.season]||'자동 계절')+' 분위기 적용 중 · 모든 팀원에게 적용됩니다.';
    }
    );
    window.dispatchEvent(new CustomEvent('presence:seasonchange',{
      detail:{
        christmas:on,season:settings&&settings.season||'auto'
      }
    }
    ));
  }
  async function toggle(){
    if(enabled())try{previousSeason=localStorage.getItem('presence_pre_christmas_season')||previousSeason;}catch(ignore){}
    return selectSeason(enabled()?previousSeason:'winter');
  }
  async function selectSeason(season){
    if(!/^(auto|spring|summer|autumn|winter)$/.test(season))throw Error('올바른 계절을 선택해 주세요.');
    if(!admin())throw Error('관리자만 분위기를 변경할 수 있습니다.');
    if(busy)return;
    if(!settings)throw Error('정원 설정을 불러오는 중입니다.');
    if(settingsError)throw Error('계절 설정을 다시 확인한 뒤 변경해 주세요.');
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
        season:season,updatedAt:Date.now(),updatedBy:'admin'
      }
      ;
      await DB.set('workspaceSettings',next);
      if(!admin())throw Error('관리자 계정이 변경되었습니다.');
      settings=next;
      rememberVisualMode();
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
    section.innerHTML='<button type="button" data-season-expand aria-expanded="false">분위기 설정</button><div data-season-choices hidden>'+[['spring','벚꽃'],['summer','햇빛'],['autumn','낙엽'],['winter','크리스마스']].map(function(s){return '<button type="button" data-season-choice="'+s[0]+'" aria-pressed="false">'+s[1]+'</button>';}).join('')+'</div><p role="status" data-season-status></p>';
    var expand=section.querySelector('[data-season-expand]'),choices=section.querySelector('[data-season-choices]');
    expand.onclick=function(){var open=expand.getAttribute('aria-expanded')!=='true';expand.setAttribute('aria-expanded',String(open));choices.hidden=!open;};
    section.onkeydown=function(e){if(e.key==='Escape'){choices.hidden=true;expand.setAttribute('aria-expanded','false');expand.focus();}};
    section.querySelectorAll('[data-season-choice]').forEach(function(button){button.onclick=async function(){
      var msg=section.querySelector('p');
      try{
        await selectSeason(button.dataset.seasonChoice);
        msg.textContent='분위기 설정을 저장했습니다.';
      }
      catch(e){
        msg.textContent=e.message;
      }
    };});
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
      settingsError=false;
      try{document.body.classList.toggle('presence-christmas',localStorage.getItem('presence_christmas_visual_hint')==='winter');}catch(ignore){document.body.classList.remove('presence-christmas');}
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
      settingsError=false;
      var session=uid;
      off=DB.on('workspaceSettings',function(v){
        if(actor()&&actor().uid===session){
          settings=v||{
            season:'auto'
          }
          ;
          settingsError=false;
          rememberVisualMode();
          apply();
        }
      }
      ,function(){
        if(actor()&&actor().uid===session){settingsError=true;apply();}
      }
      );
    }
    if(!admin())document.querySelectorAll('[data-presence-season-control]').forEach(function(n){
      n.remove();
    }
    );
  }
  window.PresenceSeason=Object.freeze({
    isChristmas:enabled,toggle:toggle,selectSeason:selectSeason,mountAdmin:mountAdmin,sync:sync
  }
  );
  setInterval(sync,1000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync);
  else sync();
}
)();
