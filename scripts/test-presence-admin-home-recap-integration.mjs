import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const repo=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
let source=await readFile(repo+'/scripts/qa-recap-lab-integration.mjs','utf8');
source=source.replace('createRequire(import.meta.url)','createRequire('+JSON.stringify(import.meta.url)+')').replace("resolve(new URL('../',import.meta.url).pathname)",JSON.stringify(repo));
source=source.replace("p.on('pageerror',e=>errors.push(e.message));","p.on('pageerror',e=>{errors.push(e.message);console.log('PAGE_ERROR',e.stack);});");
source=source.replace('DB.on=()=>()=>{};',`if(user.uid==='admin'){
 state.recapStudioTeams={presence:{roster:Object.fromEntries(Object.values(state.users).map(u=>[u.uid,{...u,activeFrom:'2026-01-01',activeTo:'9999-12-31'}])),weekly:{},bep:{}},fuse:{roster:{},weekly:{},bep:{}},youngwave:{roster:{},weekly:{},bep:{}}};
 const serverTeams=JSON.parse(JSON.stringify(state.recapStudioTeams)),serverUsers=JSON.parse(JSON.stringify(state.users));
 const priorGet=DB.get;DB.get=async path=>{if(path==='users')return serverUsers;if(path.startsWith('users/'))return serverUsers[path.split('/')[1]]||null;if(path.startsWith('recapStudioTeams/'))return path.split('/').slice(1).reduce((v,k)=>v?.[k],serverTeams)||null;if(path==='sales')return {};return priorGet(path);};
}DB.on=()=>()=>{};`);
source=source.replace("await p.waitForFunction(()=>document.querySelectorAll('.prl-week').length===4,{timeout:20000});","await p.waitForFunction(()=>document.querySelectorAll('.prl-week').length===4,{timeout:20000}).catch(async e=>{console.log('INITIAL_LAB_DIAGNOSTIC',await p.evaluate(()=>({errors:document.getElementById('presenceRecapLabRoot')?.textContent,profile:me,rosters:state.recapStudioTeams})));throw e;});");
const extra=`
await p.evaluate(()=>goTab('adminhome'));
if(role==='admin'){
 const entry=p.locator('[data-pah-action="recap"]');
 await entry.waitFor({state:'visible'});
 assert.equal(await entry.locator('strong').textContent(),'리캡 자료 보기');
 assert((await entry.locator('small').textContent()).includes('PPT'));
 assert.equal(await p.locator('[data-pah-action]').count(),9);
 await p.evaluate(()=>document.fonts.ready);
 await p.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const geometry=await p.locator('[data-pah-action]').evaluateAll(es=>es.map(e=>{
   const r=e.getBoundingClientRect(),title=e.querySelector('strong');
   return {left:r.left,right:r.right,width:r.width,height:r.height,titleClipped:title.scrollWidth>title.clientWidth+1};
 }));
 assert(geometry.every(r=>r.width>=44&&r.height>=44&&r.left>=0&&r.right<=width+1&&!r.titleClipped),JSON.stringify(geometry));
 await entry.scrollIntoViewIfNeeded();
 await p.screenshot({path:out+'/'+engine+'-admin-'+width+'-recap-entry.png'});
 await entry.focus();await p.keyboard.press('Enter');
 assert.equal(await p.evaluate(()=>curTab),'recap');
 await p.evaluate(()=>goTab('adminhome'));
 await p.locator('[data-pah-action="recap"]').waitFor({state:'visible'});
 await p.evaluate(()=>{window.qaRecapGate=TABMETA.recap.g;TABMETA.recap.g=()=>false;document.querySelector('[data-pah-action="recap"]').click();});
 assert.equal(await p.evaluate(()=>curTab),'home','Recap visibility is checked again at activation');
 await p.evaluate(()=>PresenceAdminHome.render('adminHomeMount',{actor:me,state,mode:'admin'}));
 assert.equal(await p.locator('[data-pah-action="recap"]').count(),0);
 await p.evaluate(()=>{TABMETA.recap.g=window.qaRecapGate;PresenceAdminHome.render('adminHomeMount',{actor:me,state,mode:'admin'});});
 await p.evaluate(()=>{const stale=document.querySelector('[data-pah-action="recap"]');me={uid:'not-owner',name:'권한 없는 팀원',role:'IC',status:'active'};stale.click();});
 assert.equal(await p.evaluate(()=>curTab),'home','A stale owner card cannot navigate after actor switch');
 await p.evaluate(()=>PresenceAdminHome.render('adminHomeMount',{actor:me,state,mode:'admin'}));
 assert.equal(await p.locator('[data-pah-action="recap"]').count(),0);
}else{
 assert.equal(await p.locator('[data-pah-action]').count(),0);
 assert.equal(await p.locator('[data-pah-action="recap"]').count(),0);
 assert.equal(await p.evaluate(()=>curTab),'home');
}
if(role==='TL'){
 for(const order of ['grant-first','team-first']){
  await p.evaluate(({order})=>{
   goTab('home');tlhClearSubscriptions();
   me={uid:order==='grant-first'?'umqn54ujf':'umqna7jpj',name:order==='grant-first'?'고윤경':'윤채영',role:'TL',status:'active'};
   state.users={[me.uid]:me};state.managers=[];state.memberInfo={};state.dossier={};
   window.qaSubscriptionCallbacks={};
   DB.on=(path,fn)=>{qaSubscriptionCallbacks[path]=fn;return()=>{if(qaSubscriptionCallbacks[path]===fn)delete qaSubscriptionCallbacks[path];};};
   goTab('tlhome');
  },{order});
  assert.equal(await p.locator('#tlHomeRecapMaterialsEntry').count(),0,'No entry before the first grant arrives');
  await p.evaluate(({order})=>{
   const uid=me.uid,team=order==='grant-first'?'fuse':'youngwave',grant={active:true,teamKey:team,capabilities:{recap:true}};
   const receiveGrant=()=>qaSubscriptionCallbacks['tlWorkspaceGrants/'+uid](grant);
   const receiveTeam=()=>{qaSubscriptionCallbacks['recapStudioAccess/viewers/'+uid]({scope:'team',teamKey:team});qaSubscriptionCallbacks['recapStudioTeams/'+team]({roster:{},weekly:{},bep:{}});};
   if(order==='grant-first'){receiveGrant();receiveTeam();}else{receiveTeam();receiveGrant();}
  },{order});
  await p.locator('#tlHomeRecapMaterialsEntry').waitFor({state:'visible'});
  assert.equal(await p.evaluate(()=>tabVisible('recap')),true,'Initial subscriptions refresh the read gate automatically');
  const entry=p.locator('#tlHomeRecapMaterialsEntry'),r=await entry.boundingBox();assert(r.width>=44&&r.height>=44);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await entry.focus();await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>curTab),'recap');
 }
 for(const cancel of [false,true]){
  await p.evaluate(()=>{
   qaSubscriptionCallbacks['tlWorkspaceGrants/'+me.uid](null);
   PresenceTLWorkspace.reset();goTab('home');tlhClearSubscriptions();
   window.qaSubscriptionCallbacks={};
   history.replaceState(null,'','?open=recap&release=qa-recap-materials');window.__presenceEntryPass=true;enterApp();
  });
  assert.equal(await p.evaluate(()=>curTab),'tlhome','A cold deep link waits for approved team access');
  if(cancel)await p.evaluate(()=>goTab('home'));
  await p.evaluate(()=>{
   const team='youngwave';qaSubscriptionCallbacks['recapStudioAccess/viewers/'+me.uid]({scope:'team',teamKey:team});
   qaSubscriptionCallbacks['recapStudioTeams/'+team]({roster:{},weekly:{},bep:{}});
   qaSubscriptionCallbacks['tlWorkspaceGrants/'+me.uid]({active:true,teamKey:team,capabilities:{recap:true}});
  });
  assert.equal(await p.evaluate(()=>curTab),cancel?'home':'recap','Pending deep link opens once and respects another navigation');
 }
}
assert.deepEqual(errors,[]);
console.log('PASS admin-home recap card',engine,role,width);
`;
source=source.replace("console.log('PASS fullindex',engine,role,width);await p.close();",extra+"console.log('PASS fullindex',engine,role,width);await p.close();");
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
