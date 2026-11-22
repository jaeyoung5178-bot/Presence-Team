import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const role of ['LR','IC','admin']){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('**/*',route=>route.abort());
  await page.setContent('<meta charset="utf-8"><div id="root"></div>');
  for(const file of ['model','bridge','']){const name='assets/presence-recap-lab'+(file?'-'+file:'')+'.js';if(process.env.PRESENCE_QA_ORIGIN){const r=await fetch(process.env.PRESENCE_QA_ORIGIN+'/'+name+'?verify=future-recovery');assert(r.ok);await page.addScriptTag({content:await r.text()});}else await page.addScriptTag({path:root+name});}
  await page.evaluate(role=>{
   const actor={uid:role==='admin'?'admin':'member',name:'Synthetic',status:'active',role},member=role==='admin'?{uid:'member',name:'Synthetic member',status:'active',role:'LR'}:actor;
   window.savedRecords={};window.calls=[];window.pendingAssignment=true;
   const api={actor:()=>actor,members:()=>[member],month:'2026-11',today:()=> '2026-11-22',admin:()=>role==='admin',canWrite:()=>true,eligible:()=>true,
    assignment:async(_uid,pay)=>{if(pay==='2026-11-27'&&pendingAssignment)throw Object.assign(Error('No unique weekly assignment'),{code:'recap/assignment-missing'});return{teamKey:'presence',assignmentId:'approved',configHash:'reviewed'};},
    get:async path=>structuredClone(savedRecords[path]??null),
    tx:async(path,fn)=>{const next=fn(structuredClone(savedRecords[path]??null));if(next===undefined)return{committed:false};savedRecords[path]=structuredClone(next);calls.push(path);return{committed:true};},
    summary:()=>({}),verifyWrite:async()=>{},invalidate:()=>{}};
   PresenceRecapLab.mount(document.getElementById('root'),PresenceRecapLabBridge.create(api));
  },role);
  await page.locator('[data-lab-week="2026-11-27"]').waitFor();
  const future=page.locator('[data-lab-week="2026-11-27"]');assert(await future.isEnabled());assert((await future.textContent()).includes('배정 확인 필요'));
  await future.click();assert.equal(await future.getAttribute('aria-pressed'),'true');
  for(const [field,value]of [['netPaymentCents','12.50'],['rejectSWCount','0'],['rejectCLCount','0']])await page.locator('[data-lab-field='+field+']').fill(value);
  await page.locator('[data-lab-form=week] button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('[data-lab-message]').textContent.includes('No unique weekly assignment'));
  assert.equal(await page.evaluate(()=>calls.length),0);assert.equal(await page.locator('[data-lab-field=netPaymentCents]').inputValue(),'12.50');
  await page.evaluate(()=>pendingAssignment=false);await page.locator('[data-lab-form=week] button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('[data-lab-message]').textContent.includes('저장했습니다'));
  assert.equal(await page.evaluate(()=>savedRecords['recapStudioTeams/presence/weekly/2026-11-27/member'].netPayment),12.5);
  assert.equal(await page.evaluate(()=>calls.length),1);assert((await future.textContent()).includes('예정 · 사전 입력 가능'));await page.close();
 }
 console.log('PASS browser LR/IC/admin future week selection/input; missing assignment save denied with draft retained; confirmed assignment save and confirmation; memory only');
}finally{await browser.close();}
