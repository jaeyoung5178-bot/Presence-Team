(function(root){
  'use strict';
  let active=null;
  const roles=['TL'];
  const seen=new Set();
  function context(actor,now){
    if(!actor||actor.status!=='active'||!roles.includes(actor.role)||typeof actor.uid!=='string'||!actor.uid)return null;
    const at=new Date(Number(now===undefined?Date.now():now)+32400000);if(!Number.isFinite(at.getTime())||at.getUTCDay()!==0)return null;
    at.setUTCDate(at.getUTCDate()-6);return {uid:actor.uid,key:'presence_team_weekly_notice_v1:'+encodeURIComponent(actor.uid)+':'+at.toISOString().slice(0,10)};
  }
  function dispose(){if(active)active.close(false);}
  function maybeShow(options){
    options=options||{};const c=context(options.actor,options.now);
    if(active){if(!c||active.uid!==c.uid||active.key!==c.key)dispose();else return false;}
    if(!c||root.__previewRole||seen.has(c.key))return false;
    try{if(localStorage.getItem(c.key)==='seen')return false;}catch(e){}
    const previous=document.activeElement,oldOverflow=document.body.style.overflow;
    const dialog=document.createElement('dialog');dialog.id='presenceTeamWeeklyNotice';dialog.setAttribute('aria-labelledby','ptwnTitle');dialog.setAttribute('aria-describedby','ptwnCopy');
    dialog.style.cssText='box-sizing:border-box;width:min(420px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;border:1px solid #dce3dc;border-radius:20px;padding:24px;background:#fffdf8;color:#213a2d;box-shadow:0 16px 60px #0003;font:16px/1.6 system-ui,-apple-system,sans-serif;';
    dialog.innerHTML='<h2 id="ptwnTitle" style="font-size:22px;line-height:1.35;margin:0 0 12px">이번 주 리캡 확인</h2><p id="ptwnCopy" style="margin:0 0 20px">오늘까지 팀원들의 이번 주간 리캡현황을 업데이트해 주세요</p><div style="display:flex;flex-wrap:wrap;gap:8px"><button type="button" data-ptwn-close style="min-height:44px;min-width:44px;padding:10px 16px;border:1px solid #bbc8bd;border-radius:12px;background:#fff;color:#213a2d;font:inherit;cursor:pointer">닫기</button><button type="button" data-ptwn-update style="min-height:44px;min-width:44px;padding:10px 16px;border:0;border-radius:12px;background:#214e39;color:#fff;font:inherit;cursor:pointer">지난주 리캡 보기</button></div>';
    document.body.appendChild(dialog);
    let closed=false;
    function close(mark){if(closed)return;closed=true;if(mark){seen.add(c.key);try{localStorage.setItem(c.key,'seen');}catch(e){}}dialog.remove();document.body.style.overflow=oldOverflow;active=null;if(previous&&previous.isConnected)previous.focus({preventScroll:true});}
    dialog.addEventListener('cancel',e=>{e.preventDefault();close(true);});
    dialog.querySelector('[data-ptwn-close]').onclick=()=>close(true);
    dialog.querySelector('[data-ptwn-update]').onclick=()=>{close(true);if(typeof options.openUpdate==='function')options.openUpdate();};
    active={uid:c.uid,key:c.key,close};
    try{dialog.showModal();document.body.style.overflow='hidden';dialog.querySelector('[data-ptwn-update]').focus({preventScroll:true});}catch(e){close(false);return false;}
    return true;
  }
  root.PresenceTeamWeeklyNotice=Object.freeze({maybeShow,dispose});
})(window);
