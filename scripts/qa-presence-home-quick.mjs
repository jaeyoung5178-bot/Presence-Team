import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.BASE_URL||new URL('../index.html',import.meta.url).href,out=process.env.PRESENCE_QA_OUT||'/tmp/presence-home-quick';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const width of [390,1024,1440])for(const role of ['IC','LR','admin']){
 const page=await browser.newPage({viewport:{width,height:width===390?844:width===1024?768:900}});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(['file:','data:','blob:'].includes(u.protocol))return route.continue();if(process.env.BASE_URL&&u.origin===new URL(base).origin&&route.request().method()==='GET'&&/\.(html|css|js|svg|webp|png|jpg|woff2?)$/.test(u.pathname))return route.continue();return route.abort();});
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.PresenceWorkspace);
 await page.evaluate(role=>{__firebaseReady=true;__booting=false;window.__previewRole=null;window.__adminOff=false;me={uid:role==='admin'?'admin':'quickfixture',name:'검증 예시',role:role==='admin'?'AOP':role,status:'active',sk:role==='LR'};state.users={[me.uid]:me};state.sales={};state.dossier={};DB.get=async()=>null;DB.set=DB.update=async()=>{throw Error('No fixture writes');};DB.on=(p,cb)=>{if(p==='workspaceSettings')queueMicrotask(()=>cb({season:'winter'}));return()=>{};};document.body.classList.add('app-on','presence-workspace-v2');document.getElementById('app').classList.remove('hidden');document.getElementById('app').style.setProperty('display','block','important');['authGate','presenceGameLoader','presenceEntryLobby','ffAskModal'].forEach(id=>document.getElementById(id)?.style.setProperty('display','none','important'));PresenceSeason.sync();window.qaNotices=[];toast=t=>qaNotices.push(t);goTab('home');PresenceWorkspace.render();},role);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(500);
 const quick=page.locator('.pw-home-task-links');assert.equal(await quick.count(),1);assert.deepEqual(await quick.locator('button').allTextContents(),['사이트 찾기↗','셋업비서↗','세일즈 등록↗','주간리캡↗']);
 assert.equal(await quick.evaluate(e=>e.previousElementSibling.classList.contains('pw-home-values')),true);
 assert.equal(await quick.locator('button').evaluateAll(es=>es.every(e=>e.offsetHeight>=44)),true);
 await quick.scrollIntoViewIfNeeded();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.body.classList.contains('presence-christmas')),true);await page.screenshot({path:`${out}/${role}-${width}.png`});
 for(const tab of ['sites','setupkit','sale','profitrecap']){
  await page.locator(`.pw-home-task-links [data-value="${tab}"]`).focus();await page.keyboard.press('Enter');
  const permitted=role!=='IC'||tab==='sale';assert.equal(await page.evaluate(()=>curTab),permitted?tab:'home',`${role} ${tab}`);
  if(!permitted)assert.ok(await page.evaluate(()=>qaNotices.length>0));
  if(tab==='setupkit'&&permitted)assert.ok(await page.locator('#m-setupkit').innerText());
  await page.evaluate(()=>goTab('home'));
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.close();console.log('PASS quick routes',width,role);
}}finally{await browser.close();}
console.log('PASS Home four quick links 9/9, role guards+setup route+keyboard, actual source/linked styles, real DB writes0');
