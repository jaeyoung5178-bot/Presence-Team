import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=new URL('../',import.meta.url);
const [html,script,css]=await Promise.all(['index.html','assets/presence-admin-home.js','assets/presence-admin-home.css'].map(p=>readFile(new URL(p,base),'utf8')));
const graphSource=html.slice(html.indexOf('function recapStudioGraphPreflight('),html.indexOf('function recapStudioValidateAssignments('));
const fixture={users:{root:{name:'대표',role:'AOP',status:'active'},member:{name:'검토대상',role:'LR',status:'active'}},memberInfo:{검토대상:{join:'2026-10-20'}},dossier:{검토대상:{upline:'대표'}},removedMembers:[],weekly:{'2026-10-23':{member:{uid:'member',name:'검토대상',role:'IC',netPayment:123456,rejectCLCount:2,rejectSWCount:1}}}};
const original=JSON.stringify(fixture);
const context=vm.createContext({RECAP_STUDIO_TEAM_ROOTS:{presence:{name:'대표'}},recapStudioNormName:v=>String(v||'').replace(/\s/g,'')});
vm.runInContext(graphSource+';globalThis.graph=recapStudioGraphPreflight;',context);
assert.equal(context.graph(fixture).people.검토대상.role,'LR','Canonical current user role survives fallback IC sources');
assert.equal(JSON.stringify(fixture),original,'Graph preflight cannot mutate historical weekly finance or role');
const browser=await chromium.launch({headless:true,channel:'chrome'});
for(const [width,height] of [[390,844],[1024,768],[1440,900]])for(const role of ['IC','TL','founder']){
 const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>body{margin:0;padding:16px;background:#0b101a;color:#e6edf8;font-family:Arial,sans-serif}button,input{font:inherit}:root{--cream:#e6edf8;--muted:#a8b9cd;--faint:#7b91b0;--line:#34425a;--surface:#172232;--ink:#0e1725}</style><style>'+css+'</style><div id="mount"></div>');
 await page.evaluate(({fixture,role})=>{window.me={uid:role==='founder'?'admin':'actor',name:'관리자',role:role==='founder'?'AOP':role,status:'active'};window.state=fixture;window.isFounder=u=>u?.uid==='admin'&&u.status==='active';window.calls={review:0,approve:[],migrate:0};window.recapStudioPreflightV3=async()=>{calls.review++;return calls.approve.length?{blocked:false,conflicts:[],unresolved:[]}:{blocked:true,conflicts:[],unresolved:[{type:'unapproved-descendant',uid:'member',name:'검토대상',teamKey:'presence',unsafe:'DO NOT RENDER'}]};};window.recapStudioApproveAssignment=async input=>{calls.approve.push(input);return input;};window.recapStudioMigrateV3=async()=>{calls.migrate++;return {blocked:false,written:0,conflicts:[],unresolved:[]};};}, {fixture,role});
 await page.addScriptTag({content:script});await page.evaluate(()=>PresenceAdminHome.render('mount',{actor:me,state}));
 if(role!=='founder'){
  assert.equal(await page.locator('[data-pah-action="recap-repair"]').count(),0);assert.equal(await page.locator('.pah-repair').count(),0);assert.equal(await page.evaluate(()=>calls.review),0);await page.close();continue;
 }
 await page.getByRole('button',{name:/리캡 배정 복구/}).click();await page.waitForSelector('[data-pah-approve]');
 assert.equal(await page.evaluate(()=>calls.review),1);assert.equal(await page.evaluate(()=>calls.migrate),0,'Review must not call migration');assert.equal(await page.evaluate(()=>calls.approve.length),0,'Review must not approve');
 assert.equal(await page.locator('[data-pah-from]').inputValue(),'2026-10-20');assert.equal(await page.locator('[data-pah-to]').inputValue(),'');
 assert.match(await page.locator('.pah-repair').innerText(),/LR/);assert.match(await page.locator('.pah-repair').innerText(),/대표/);assert.doesNotMatch(await page.locator('.pah-repair').innerText(),/DO NOT RENDER/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${width} repair overflow`);
 const small=await page.locator('.pah-repair button,.pah-repair input').evaluateAll(nodes=>nodes.filter(el=>{const r=el.getBoundingClientRect();return r.width<44||r.height<44}).length);assert.equal(small,0,`${width} repair touch targets`);
 page.on('dialog',()=>{throw Error('Repair must never use browser confirmation');});await page.getByRole('button',{name:'검토한 기간 배정 승인',exact:true}).focus();await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>calls.approve.length),0,'First click stages only');assert.equal(await page.getByRole('alertdialog').count(),1);assert.match(await page.getByRole('alertdialog').innerText(),/member/);assert.match(await page.getByRole('alertdialog').innerText(),/2026-10-20/);assert.match(await page.getByRole('alertdialog').innerText(),/LR/);
 await page.getByRole('button',{name:'취소',exact:true}).click();assert.equal(await page.getByRole('alertdialog').count(),0);assert.equal(await page.evaluate(()=>calls.approve.length),0,'Cancel never approves');
 await page.getByRole('button',{name:'검토한 기간 배정 승인',exact:true}).click();await page.locator('[data-pah-from]').fill('2026-10-21');assert.equal(await page.getByRole('alertdialog').count(),0,'Changing date invalidates staged approval');await page.locator('[data-pah-from]').fill('2026-10-20');
 await page.getByRole('button',{name:'검토한 기간 배정 승인',exact:true}).click();assert.equal(await page.getByRole('button',{name:'이 기간으로 승인',exact:true}).evaluate(el=>el===document.activeElement),true,'Final approval receives accessible focus');await page.keyboard.press('Enter');
 await page.waitForSelector('[data-pah-execute]');assert.equal(await page.evaluate(()=>calls.approve.length),1);assert.equal(await page.evaluate(()=>calls.review),2,'Approval reruns readonly preflight');assert.equal(await page.evaluate(()=>calls.migrate),0,'Approval cannot implicitly execute migration');
 assert.deepEqual(await page.evaluate(()=>calls.approve[0]),{uid:'member',teamKey:'presence',activeFrom:'2026-10-20'});assert.equal(await page.evaluate(()=>JSON.stringify(state)),original,'Review/approval mock preserves historical finance and roles');assert.deepEqual(errors,[]);
 await page.getByRole('button',{name:'검증 완료 · 복구 실행',exact:true}).click();assert.equal(await page.evaluate(()=>calls.migrate),0,'Restore first click stages only');assert.equal(await page.getByRole('button',{name:'복구 실행 확정',exact:true}).count(),1);await page.getByRole('button',{name:'취소',exact:true}).click();assert.equal(await page.evaluate(()=>calls.migrate),0);
 await page.getByRole('button',{name:'검증 완료 · 복구 실행',exact:true}).click();await page.evaluate(()=>{me={uid:'member',role:'IC',status:'active'};PresenceAdminHome.render('mount',{actor:me,state});});assert.equal(await page.getByRole('alertdialog').count(),0,'Session revocation clears staged confirmation');assert.equal(await page.evaluate(()=>calls.migrate),0);
 await page.evaluate(()=>{me={uid:'admin',name:'관리자',role:'AOP',status:'active'};});
 // A changed session cannot receive the awaited privileged report.
 await page.evaluate(()=>{PresenceAdminHome.reset('mount');PresenceAdminHome.render('mount',{actor:me,state});window.recapStudioPreflightV3=()=>new Promise(resolve=>window.finishReview=resolve);});
 await page.getByRole('button',{name:/리캡 배정 복구/}).click();await page.evaluate(()=>{me={uid:'member',role:'IC',status:'active'};PresenceAdminHome.render('mount',{actor:me,state});finishReview({blocked:true,conflicts:[],unresolved:[{type:'unapproved-descendant',uid:'secret',name:'secret',teamKey:'presence'}]});});
 await page.waitForTimeout(30);assert.equal(await page.locator('.pah-repair').count(),0);await page.close();
}
await browser.close();console.log('PASS: graph canonical role + immutable historical finance; founder-only read-only review; explicit keyboard approval and recheck; session changes; 390/1024/1440 geometry and 44px targets. No production writes.');
