import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
// Private snapshot is supplied at test time; no account/profile data is committed.
const actual=JSON.parse(await readFile(process.env.PRESENCE_QA_OWNER_SOURCE||'/tmp/promotion-owner-access-1794718516245/source.json','utf8'));
assert.ok(typeof actual.campaign.targetUid==='string'&&actual.campaign.targetUid.length>0);
assert.equal(actual.user.status,'active');assert.equal(actual.user.role,'TL');
const require=createRequire(import.meta.url);
const {chromium}=require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=process.env.PRESENCE_QA_OUT||'/tmp/presence-promotion-final';
const base=process.env.BASE_URL||new URL('../index.html',import.meta.url).href;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
let count=0;
try {
for(const width of (process.env.PRESENCE_QA_WIDTHS||'390,1024,1440').split(',').map(Number)) for(const role of (process.env.PRESENCE_QA_ROLES||'assignedTL,otherTL,IC,admin').split(',')) {
 const page=await browser.newPage({viewport:{width,height:width===390?844:width===1024?768:width===1280?720:900}});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.protocol==='file:'||u.protocol==='data:'||u.protocol==='blob:')return route.continue();if(process.env.BASE_URL&&u.origin===new URL(base).origin&&(u.pathname==='/'||/\.(?:html|css|js|svg|webp|png|jpg|woff2?)(?:$)/i.test(u.pathname)))return route.continue();return route.abort();});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.PresencePromotionCampaignCloud?.saveDay&&window.PresenceWorkspace);
 await page.evaluate(({role,actual})=>{
  window.qaNow=Date.parse('2026-11-15T03:00:00Z');Date.now=()=>qaNow;
  __firebaseReady=true;__booting=false;window.__previewRole=null;window.__adminOff=role!=='admin';
  const leaderUid=actual.campaign.targetUid;
  me={uid:role==='admin'?'admin':role==='assignedTL'?leaderUid:role,name:'화면 예시',role:role==='admin'?'AOP':role==='IC'?'IC':'TL',status:'active'};
  state.users={[me.uid]:me};state.dossier={};state.sales={};state.pr=201;state.waters={};PresenceWorkspace.dispose();
  const cloud=PresencePromotionCampaignCloud;
  window.qaConfig={version:1,revision:1,targetUid:'fixtureLead',displayName:'화면 예시',goalRoleLabel:'AOP',teamKey:'youngwave',week1Start:'2026-11-09',weeklyTarget:3200000,weekCount:2,displayFrom:'2026-11-11',currency:'KRW',bondDeductionBps:0,multiplierBps:10000,thresholdBasis:'net',calcBasis:'dailyFundraising',calculationMode:'bondDeduction',enabled:true,updatedAt:qaNow,updatedBy:'admin',ledger:{}};
  qaConfig={...structuredClone(actual.campaign),updatedAt:qaNow};
  qaConfig.targetUid=leaderUid;
  state.users[leaderUid]={uid:leaderUid,name:actual.user.name,status:actual.user.status,role:actual.user.role};if(role==='assignedTL')me={...state.users[leaderUid]};
  window.qaPrivatePaths=[];window.qaCallbacks={};window.qaWrites=0;
  window.qaAllowWrites=false;DB.get=async path=>path==='users/'+leaderUid?{name:actual.user.name,status:'active',role:'TL'}:path==='users/admin'?{status:'active'}:path.startsWith('recapStudioTeams/')?{uid:leaderUid}:path==='promotionGoalCampaigns/private/admin/youngwave-aop-20261111'?structuredClone(qaConfig):null;DB.set=async()=>{throw Error('No set');};DB.update=async(path,patch)=>{if(!qaAllowWrites)throw Error('Fixture offline: no actual writes');if(path!=='promotionGoalCampaigns')throw Error('Unexpected fixture write');const cfg=patch['private/admin/youngwave-aop-20261111'],pub=patch['public/youngwave-aop-20261111'];if(!cfg||!pub)throw Error('Atomic private/public required');qaWrites++;qaConfig=structuredClone(cfg);for(const[p,callbacks]of Object.entries(qaCallbacks))if(p==='promotionGoalCampaigns/private/admin/youngwave-aop-20261111')callbacks.forEach(cb=>cb(structuredClone(cfg)));else if(p==='promotionGoalCampaigns/public/youngwave-aop-20261111')callbacks.forEach(cb=>cb(structuredClone(pub)));};
  DB.on=(path,cb,err)=>{(qaCallbacks[path]??=[]).push(cb);if(path.startsWith('promotionGoalCampaigns/private'))qaPrivatePaths.push(path);queueMicrotask(()=>{if(path==='promotionGoalCampaigns/private/admin')cb({'youngwave-aop-20261111':qaConfig});else if(path==='promotionGoalCampaigns/private/admin/youngwave-aop-20261111'){if(role==='assignedTL')cb(qaConfig);else err?.(Error('permission denied'));}else if(path.startsWith('promotionGoalCampaigns/public/'))cb(cloud.project(qaConfig));else if(path==='workspaceSettings')cb({season:'winter'});else if(path==='pr')cb(201);else if(path==='waters')cb({});else if(path==='workspaceGarden')cb({fixture:{count:48}});});return()=>{};};
  PresencePromotionCampaignController.dispose();document.body.classList.add('app-on','presence-workspace-v2');document.getElementById('app').classList.remove('hidden');document.getElementById('app').style.setProperty('display','block','important');['authGate','presenceGameLoader','presenceEntryLobby','ffAskModal'].forEach(id=>document.getElementById(id)?.style.setProperty('display','none','important'));PresenceSeason.sync();goTab('home');PresenceWorkspace.render();PresencePromotionCampaignController.sync();
 },{role,actual});
 await page.waitForTimeout(120);
 if(role==='assignedTL'||role==='admin') {
  await page.waitForSelector('.ppc-record-entry');
  if(process.env.PRESENCE_QA_STAGE){await page.evaluate(empty=>{qaConfig.displayName='윤채영';if(!empty)qaConfig.ledger.d0.amount=3200000;for(const[path,callbacks]of Object.entries(qaCallbacks))if(path.startsWith('promotionGoalCampaigns/public/'))callbacks.forEach(cb=>cb(PresencePromotionCampaignCloud.project(qaConfig)));},!!process.env.PRESENCE_QA_STAGE_EMPTY);await page.locator('.ppc-boss-card').evaluate(el=>scrollTo(0,scrollY+el.getBoundingClientRect().top-90));await page.screenshot({path:`${out}/card-${width}.png`});await page.locator('.ppc-record-entry').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await page.screenshot({path:`${out}/entry-${width}.png`});await page.locator('.ppc-record-entry').click();await page.waitForSelector('.ppc-daily-primary');if(process.env.PRESENCE_QA_STAGE_PRESETS){await page.locator('[data-ppc-add="110000"]').click();await page.locator('[data-ppc-add="110000"]').click();await page.locator('.ppc-presets').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));}else await page.locator('.ppc-daily-primary').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/editor-${width}.png`});console.log('STAGED',width,role);await page.close();continue;}
  await page.locator('.ppc-record-entry').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  const entryGeometry=await page.locator('.ppc-record-entry').evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),floats=[...document.querySelectorAll('.presence-season-floating button[data-season-expand],#presenceBgmQuick')].filter(n=>n.getBoundingClientRect().width).map(n=>n.getBoundingClientRect());return{height:r.height,hit:hit===e||e.contains(hit),clear:floats.every(f=>r.right<=f.left||r.left>=f.right||r.bottom<=f.top||r.top>=f.bottom),x:r.x,y:r.y,width:r.width};});assert.ok(entryGeometry.height>=44&&entryGeometry.hit&&entryGeometry.clear,JSON.stringify(entryGeometry));if(width===1280)console.log('PASS 1280x720 CTA rect/float nonoverlap',entryGeometry);
  if(role==='assignedTL') {
   await page.evaluate(()=>{goTab('tlhome');renderTLHome();PresencePromotionCampaignController.sync();});
   assert.equal(await page.locator('#promotionCampaignLeadEntry').count(),1);
   await page.evaluate(()=>renderTLHome());
   await page.waitForFunction(()=>document.getElementById('promotionCampaignLeadEntry'));
   const box=await page.locator('#promotionCampaignLeadEntry').boundingBox();assert.ok(box.height>=44);
   await page.locator('#promotionCampaignLeadEntry').click();
  } else await page.locator('.ppc-record-entry').click();
  await page.waitForSelector('[data-ppc-gross]');
  assert.equal(await page.locator('.ppc-fields input,.ppc-fields select,.ppc-day-picker select,.ppc-day-input input').evaluateAll(nodes=>nodes.every(n=>parseFloat(getComputedStyle(n).fontSize)>=16)),true);
  assert.equal(await page.locator('[data-ppc-config]').count(),role==='admin'?6:0);
  assert.equal(await page.locator('[data-ppc-enabled]').count(),role==='admin'?1:0);
  assert.equal(await page.locator('[data-ppc-preview]').count(),role==='admin'?1:0);
  if(role==='admin') {await page.locator('.ppc-settings summary').click();const rate=page.locator('[data-ppc-config="bondDeductionBps"]');await rate.fill('0');assert.equal(await rate.evaluate(e=>e.checkValidity()),true);await rate.fill('100');assert.equal(await rate.evaluate(e=>e.checkValidity()),true);await rate.fill('0');await page.locator('.ppc-settings summary').click();}
  await page.locator('[data-ppc-date]').selectOption('2026-11-16');assert.equal(await page.locator('[data-ppc-gross]').isDisabled(),true);assert.equal(await page.locator('[data-ppc-save-day]').isDisabled(),true);
  assert.equal(await page.locator('[data-ppc-add]').evaluateAll(nodes=>nodes.length===6&&nodes.every(n=>n.disabled)),true);
  await page.locator('[data-ppc-date]').selectOption('2026-11-11');assert.equal(await page.locator('[data-ppc-gross]').isDisabled(),false);
  assert.equal(await page.locator('[data-ppc-add]').evaluateAll(nodes=>nodes.length===6&&nodes.every(n=>n.getBoundingClientRect().height>=44&&n.getBoundingClientRect().width>=44&&parseFloat(getComputedStyle(n).fontSize)>=16)),true);
  await page.locator('[data-ppc-gross]').fill('');await page.locator('[data-ppc-add="110000"]').click();await page.locator('[data-ppc-add="110000"]').click();assert.equal(await page.locator('[data-ppc-gross]').inputValue(),'220000');assert.deepEqual(await page.locator('.ppc-day-preview dd').allTextContents(),['220,000원','220,000원']);assert.ok((await page.locator('.ppc-net-preview').innerText()).includes((Object.entries(actual.campaign.ledger).filter(([k])=>Number(k.slice(1))<7&&k!=='d2').reduce((sum,[,r])=>sum+(r.amount||0),0)+220000).toLocaleString('ko-KR')+'원'));assert.equal(await page.evaluate(()=>qaWrites),0);
  await page.locator('[data-ppc-gross]').fill('1000');await page.locator('[data-ppc-add="140000"]').click();assert.equal(await page.locator('[data-ppc-gross]').inputValue(),'141000');await page.locator('[data-ppc-date]').selectOption('2026-11-09');assert.equal(await page.locator('[data-ppc-gross]').inputValue(),'360000');await page.locator('[data-ppc-date]').selectOption('2026-11-11');assert.equal(await page.locator('[data-ppc-gross]').inputValue(),'141000');
  await page.locator('[data-ppc-gross]').fill('0');await page.evaluate(()=>PresencePromotionCampaign.sync());assert.equal(await page.locator('[data-ppc-gross]').inputValue(),'0');
  await page.locator('.ppc-back-home').click();await page.waitForFunction(()=>curTab==='home'&&document.activeElement?.classList.contains('ppc-record-entry'));await page.locator('.ppc-record-entry').press('Enter');await page.waitForSelector('[data-ppc-gross]');assert.equal(await page.locator('[data-ppc-gross]').inputValue(),'0');
  if(width===390&&role==='assignedTL') {
   await page.evaluate(()=>{qaConfig={...qaConfig,revision:qaConfig.revision+1};for(const cb of qaCallbacks['promotionGoalCampaigns/private/admin/youngwave-aop-20261111']||[])cb(qaConfig);});
   await page.locator('[data-ppc-save-day]').click();await page.waitForFunction(()=>document.querySelector('.ppc-day-status').textContent.includes('다른 창'));assert.equal(await page.locator('[data-ppc-gross]').inputValue(),'0');assert.equal(await page.evaluate(()=>qaWrites),0);
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>{const d=document.createElement('div');d.innerHTML=PresencePromotionCampaign.homeHTML({...qaConfig,weeks:{w1:{net:1,confirmedDays:1,status:'partial'},w2:{net:null}}},{preview:true});document.body.append(d);const v=getComputedStyle(d.querySelector('.ppc-track>span')).transitionDuration;d.remove();return v;}),'0s');
  await page.locator('[data-ppc-day]').evaluate(row=>row.scrollIntoView({block:'center',behavior:'instant'}));
  await page.waitForTimeout(300);
  const geometry=await page.evaluate(()=>{
   const floats=[...document.querySelectorAll('.presence-season-floating button[data-season-expand],#presenceBgmQuick')].filter(e=>e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=='hidden').map(e=>e.getBoundingClientRect());
   return [...document.querySelectorAll('[data-ppc-gross],[data-ppc-save-day]')].map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{control:e.hasAttribute('data-ppc-gross')?'amount':'save',inside:r.top>=76&&r.bottom<=innerHeight-76,hit:hit===e||e.contains(hit),clear:floats.every(f=>r.right<=f.left||r.left>=f.right||r.bottom<=f.top||r.top>=f.bottom)};});
  });
  assert.equal(geometry.every(g=>g.inside&&g.hit&&g.clear),true,JSON.stringify(geometry));
  console.log('PASS scrolled controls/float hit-test',width,role,geometry);
  await page.screenshot({path:`${out}/${role}-${width}.png`});
  if(role==='assignedTL'&&width===390){
   await page.evaluate(()=>{PresencePromotionCampaignController.dispose();qaAllowWrites=true;PresencePromotionCampaignController.sync();});await page.waitForTimeout(100);await page.evaluate(()=>PresencePromotionCampaignController.openAdmin());await page.waitForSelector('[data-ppc-gross]');await page.locator('[data-ppc-date]').selectOption('2026-11-15');await page.locator('[data-ppc-gross]').fill('54000');await page.locator('[data-ppc-save-day]').click();await page.waitForFunction(()=>qaWrites===1);assert.equal(await page.evaluate(()=>qaConfig.ledger.d6.amount),54000);await page.locator('.ppc-back-home').click();await page.waitForSelector('.ppc-boss-card');const expected=await page.evaluate(()=>PresencePromotionCampaignCloud.project(qaConfig).weeks.w1.net.toLocaleString('ko-KR')+'원');assert.equal(await page.locator('.ppc-total').first().innerText(),expected);assert.equal(await page.evaluate(()=>__adminOff),true);await page.evaluate(()=>qaWrites=0);console.log('PASS actual UID TL default adminOff success atomic save and garden public update');
   await page.evaluate(()=>{me.status='inactive';PresencePromotionCampaignController.sync()});assert.equal(await page.locator('[data-promotion-campaign-admin]').count(),0);assert.equal(await page.locator('#promotionCampaignLeadEntry').count(),0);}
 } else {
  assert.equal(await page.locator('.ppc-record-entry').count(),0);await page.evaluate(()=>PresencePromotionCampaignController.openAdmin());assert.equal(await page.locator('[data-promotion-campaign-admin]').count(),0);assert.equal(await page.locator('#promotionCampaignLeadEntry').count(),0);if(role==='IC')assert.equal(await page.evaluate(()=>qaPrivatePaths.length),0);
 }
 assert.equal(await page.evaluate(()=>qaWrites),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 if(width===390&&role==='admin') await page.evaluate(()=>{
  const cloud=PresencePromotionCampaignCloud,c=structuredClone(qaConfig);Object.values(c.ledger).forEach(row=>delete row.amount);c.ledger.d0.amount=8000000;c.ledger.d7.amount=1000000;const p=cloud.project(c);
  if(p.weeks.w1.net!==8000000||p.weeks.w2.net!==1000000||!p.weeks.w1.achieved||p.weeks.w2.achieved)throw Error('Independent full-productivity/no-carry calculation');
  if(PresencePromotionCampaign.homeHTML({...p,enabled:true},{today:'2026-11-10'})!=='')throw Error('Pre-display leak');
  if(!PresencePromotionCampaign.homeHTML({...p,enabled:true},{today:'2026-11-11'}))throw Error('Display start missing');
 });
 if(width===390&&role==='admin') {
  await page.evaluate(()=>{PresencePromotionCampaignController.dispose();const h=document.createElement('div');h.id='qaOffline';document.body.append(h);PresencePromotionCampaign.mountAdmin(h,{actorUid:'offlineFixture',isAdmin:()=>false,canWriteDays:()=>true,config:()=>qaConfig,ledger:()=>({}),onSaveDay:async()=>{throw Error('offline · 입력을 유지했어요');}});});
  await page.locator('#qaOffline [data-ppc-date]').selectOption('2026-11-11');await page.locator('#qaOffline [data-ppc-gross]').fill('55');await page.locator('#qaOffline [data-ppc-save-day]').evaluate(button=>button.click());await page.waitForFunction(()=>document.querySelector('#qaOffline .ppc-day-status').textContent.includes('offline'));assert.equal(await page.locator('#qaOffline [data-ppc-gross]').inputValue(),'55');
 }
 count++;console.log('PASS',width,role);await page.close();
}
console.log('PASS targeted roles',count,'real DB writes 0');
} finally {await browser.close();}
