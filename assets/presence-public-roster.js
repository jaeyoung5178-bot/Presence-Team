/* Publish the hub's display-only roster from the workbook's live subscriptions. */
(function(root){
  'use strict';
  const clean=v=>String(v||'').trim();
  const list=v=>Array.isArray(v)?v:Object.values(v||{});
  function build(users,config,removed){
    config=config||{};
    const departed=new Set(list(config.departedMembers).concat(list(removed)).map(clean));
    const first=new Set(list(config.hubFirstNames).map(clean)),order=list(config.hubNameOrder).map(clean),seen=new Set();
    const rows=Object.entries(users||{}).map(([uid,u])=>({...u,uid})).filter(u=>{
      const name=clean(u.name);
      return name&&u.status==='active'&&!u.test&&!/테스트|테스터|testbot|tester|^test\d*$/i.test(name+' '+clean(u.id))&&!departed.has(name);
    }).sort((a,b)=>{
      const ai=order.indexOf(clean(a.name)),bi=order.indexOf(clean(b.name));
      return (ai<0?9999:ai)-(bi<0?9999:bi)||(Number(a.createdAt)||0)-(Number(b.createdAt)||0)||clean(a.name).localeCompare(clean(b.name),'ko');
    });
    const members={};
    for(const u of rows){const name=clean(u.name);if(seen.has(name))continue;seen.add(name);
      const group=/^(AOP|OP|O)$/.test(u.role||'')?'AOP':first.has(name)?'FIRST':/^(LR|TL)$/.test(u.role||'')?'SECOND':'IC';
      members[u.uid]={name,group,order:Object.keys(members).length};
    }
    return members;
  }
  if(typeof module==='object'&&module.exports){module.exports={build};return;}
  if(root.PresencePublicRoster)return;
  const state={users:null,config:null,removed:null},ready=new Set();
  let started=false,timer=0,busy=false,queued=false,last='';
  function canPublish(){return typeof me!=='undefined'&&me&&me.uid==='admin'&&me.status==='active';}
  async function publish(){
    if(busy){queued=true;return;}
    if(ready.size!==3||!canPublish())return;
    const members=build(state.users,state.config,state.removed),signature=JSON.stringify(members);
    if(signature===last)return;
    busy=true;
    try{await root.__PRESENCE_SECURE_DB.set('hubPublicRoster',{version:1,members,updatedAt:Date.now()});last=signature;root.dispatchEvent(new CustomEvent('presence:hub-roster-synced'));}
    catch(e){clearTimeout(timer);timer=setTimeout(publish,5000);}
    finally{busy=false;if(queued){queued=false;schedule();}}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(publish,120);}
  function start(){if(started||!root.__PRESENCE_SECURE_DB)return;started=true;
    [['users','users'],['privateConfig','config'],['removedMembers','removed']].forEach(([path,key])=>{
      root.__PRESENCE_SECURE_DB.on(path,v=>{state[key]=v||{};ready.add(key);schedule();});
    });
  }
  root.PresencePublicRoster={build,sync:schedule};
  root.addEventListener('presence:firebase-ready',start);
  root.addEventListener('online',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){start();schedule();}});
  start();
})(typeof window==='undefined'?globalThis:window);
