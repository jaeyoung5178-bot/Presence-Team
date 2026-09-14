import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.PRESENCE_QA_URL||'http://127.0.0.1:4173';
const output=process.env.PRESENCE_QA_OUTPUT||'/tmp/presence-workspace-qa';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const failures=[],matrix=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 page.on('pageerror',e=>failures.push({error:e.message,stack:e.stack}));
 // Test only isolated fixture data, including when checking deployed HTML. No Firebase traffic.
 await page.route(/(firebaseio\.com|firebasedatabase\.app|identitytoolkit|securetoken|gstatic\.com\/firebasejs|googleapis\.com\/(?!css))/,r=>r.abort());
 await page.goto(base+'/?qa=workspace-'+Date.now(),{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.PresenceWorkspace);
 await page.waitForTimeout(900);
 async function fixture(uid){
  await page.evaluate(uid=>{
   window.PresenceWorkspace.dispose();
   state.users={admin:{uid:'admin',name:'운영관리자',id:'aop',role:'AOP',status:'active'},leader:{uid:'leader',name:'김리더',id:'qa-leader',role:'TL',status:'active'},member:{uid:'member',name:'이하루',id:'qa-member',role:'IC',status:'active'},other:{uid:'other',name:'박동료',id:'qa-other',role:'LR',status:'active'}};
   state.dossier={'이하루':{teamName:'Presence',upline:'김리더'},'박동료':{teamName:'Presence',upline:'김리더'}};
   state.extraMembers=[];state.removedMembers=[];state.memberInfo={};state.sales={};state.waters={};state.weeklyProfitRecaps={};state.salesGoals={};
   const c=PresenceWorkspace.core,t=c.dateKey(),w=c.monday(t);
   for(let i=0;i<14;i++){const d=c.add(w,i-7);if(d>t)continue;for(const u of Object.values(state.users))state.sales[d+'|'+u.name]={date:d,name:u.name,count:i%5,checked:true};}
   window.__qaStore={workspaceAccess:{member:{leaderUid:'leader',teamName:'Presence'},other:{leaderUid:'leader',teamName:'Presence'}},workspaceWeeks:{member:{[w]:{entry:{target:20,action:'하루에 한 번 피드백 받기',pledge:'이번 주에는 배운 내용을 바로 실천하겠습니다.',help:'첫 미팅을 함께 준비하고 싶어요.',updatedAt:Date.now(),authorUid:'member'}}}},workspaceProfiles:{leader:{intro:'함께 배우는 김리더입니다.',strength:'현장 피드백',learning:'코칭'},member:{intro:'매일 조금씩 배우고 있어요.',strength:'고객과 대화',learning:'현장 기본기'}},workspaceChannels:{team:{hello:{authorUid:'leader',authorName:'김리더',text:'이번 주도 함께 시작해요. 도움이 필요한 점을 편하게 남겨주세요.',createdAt:Date.now()}}}};
   window.__qaWatch=new Map();window.__qaWrites=[];window.__qaFail=false;
   const get=p=>p.split('/').reduce((v,k)=>v?.[k],window.__qaStore);
   DB.on=(p,cb)=>{window.__qaWatch.set(p,cb);queueMicrotask(()=>{if(window.__qaWatch.get(p)===cb)cb(get(p)||null);});return()=>window.__qaWatch.delete(p);};
   DB.set=async(p,v)=>{if(window.__qaFail)throw new Error('연결이 끊겼습니다. 다시 시도해 주세요.');window.__qaWrites.push({path:p,value:v});const parts=p.split('/'),last=parts.pop();let dst=window.__qaStore;for(const k of parts)dst=dst[k]||(dst[k]={});if(v===null)delete dst[last];else dst[last]=structuredClone(v);for(const [path,cb]of window.__qaWatch)if(p===path||p.startsWith(path+'/'))cb(get(path));};
   DB.get=async p=>get(p);DB.update=async()=>{};DB.tx=async()=>({committed:false});DB.push=async()=>{};
   window.__firebaseReady=true;window.__booting=false;window.__previewRole='';window.__adminOff=false;
   me=state.users[uid];document.getElementById('authGate')?.classList.add('hidden');document.getElementById('app').classList.remove('hidden');document.body.classList.add('app-on');
   document.querySelectorAll('#presenceGameLoader,#presenceEntryLobby,#presenceLoader').forEach(el=>el.remove());
   document.querySelectorAll('.modal.on').forEach(el=>el.classList.remove('on'));buildRail();goTab('home');
  },uid);
  await page.waitForTimeout(180);
 }
 const views=[{width:390,height:844},{width:1024,height:768},{width:1440,height:900}];
 for(const role of (process.env.QA_QUICK?['member']:['member','leader','admin']))for(const view of views){
  await page.setViewportSize(view);await fixture(role);
  for(const tab of (process.env.QA_QUICK?['home']:['home','today','peoplehub','learnhub','profithub',...(role==='member'?[]:['supporthub'])])){
   await page.evaluate(tab=>goTab(tab),tab);await page.waitForTimeout(160);
   const geom=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,tab:curTab,nav:[...document.querySelectorAll('#rail .gtab')].map(x=>x.textContent.trim()),broken:[...document.querySelectorAll('.mpanel.active img')].filter(x=>!x.complete||!x.naturalWidth).map(x=>x.getAttribute('src')),root:[...document.querySelectorAll('.mpanel.active .pw-page')].map(e=>({w:e.clientWidth,h:e.clientHeight,text:e.textContent.slice(0,100)}))}));
   const touch=await page.evaluate(()=>[...document.querySelectorAll('.mpanel.active button,.mpanel.active input,.mpanel.active select,.mpanel.active textarea,#app header button,#botbar button')].filter(e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e),x=r.x+r.width/2,y=r.y+r.height/2;return cs.visibility!=='hidden'&&cs.opacity!=='0'&&x>=0&&x<innerWidth&&y>=0&&y<innerHeight&&e.contains(document.elementFromPoint(x,y));}).flatMap(e=>{const r=(e.closest('label')&&e.type==='checkbox'?e.closest('label'):e).getBoundingClientRect();return r.width<43.5||r.height<43.5?[{tag:e.tagName,id:e.id,cls:e.className,text:(e.textContent||'').slice(0,35),w:r.width,h:r.height}]:[];}));
   if(touch.length)failures.push({role,view,tab,error:'undersized touch targets',touch});
   matrix.push({role,view,tab,...geom});if(geom.scroll>view.width+1)failures.push({role,view,tab,error:'horizontal overflow',geometry:geom});if(geom.tab!==tab)failures.push({role,tab,error:'route rejected'});if(geom.broken.length)failures.push({role,tab,error:'broken images',images:geom.broken});
   await page.screenshot({path:output+'/'+role+'-'+view.width+'-'+tab+'.png',fullPage:false});
  }
 }
 if(!process.env.QA_QUICK){
  await page.setViewportSize({width:390,height:844});await fixture('member');
  await page.locator('[data-form=pledge] textarea').first().fill('이번 주에는 먼저 질문하고 배운 것을 실천합니다.');
  await page.locator('[data-form=pledge] button[type=submit]').click();
  await page.waitForFunction(()=>__qaWrites.some(w=>w.path.includes('/entry')));
  assert.match(await page.locator('[data-form=pledge] textarea').first().inputValue(),/먼저 질문/);
  await page.evaluate(()=>{PresenceWorkspace.dispose();PresenceWorkspace.render();});await page.waitForTimeout(150);
  assert.match(await page.locator('[data-form=pledge] textarea').first().inputValue(),/먼저 질문/);
  await page.evaluate(()=>window.__qaFail=true);
  await page.locator('[data-form=pledge] textarea').first().fill('실패해도 지워지지 않는 초안');
  await page.locator('[data-form=pledge] button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('[data-form=pledge] [data-save-status]').textContent.includes('끊겼'));
  assert.equal(await page.locator('[data-form=pledge] textarea').first().inputValue(),'실패해도 지워지지 않는 초안');
  await page.screenshot({path:output+'/member-390-save-error.png'});await page.evaluate(()=>window.__qaFail=false);
  await page.evaluate(()=>goTab('peoplehub'));
  await page.locator('[data-action=profile]').click();await page.locator('#pwProfileIntro').fill('긴 소개 '.repeat(35));
  await page.screenshot({path:output+'/member-390-profile-dialog.png'});
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');await page.keyboard.press('Escape');
  assert.equal(await page.locator('#pwDialog').evaluate(e=>e.open),false);
  await page.locator('#pwMessageText').fill('작성 중인 질문');await page.evaluate(()=>PresenceWorkspace.render());
  assert.equal(await page.locator('#pwMessageText').inputValue(),'작성 중인 질문');
  await page.locator('[data-action=channel][data-value=cod]').click();assert.equal(await page.locator('#pwMessageText').inputValue(),'');
  await page.locator('[data-action=channel][data-value=team]').click();assert.equal(await page.locator('#pwMessageText').inputValue(),'작성 중인 질문');
  await page.locator('[data-form=message] button[type=submit]').click();await page.waitForFunction(()=>__qaWrites.some(w=>w.path.startsWith('workspaceChannels/')));
  assert.equal(await page.locator('#pwMessageText').inputValue(),'');
  await page.locator('[data-action=dm][data-value=leader]').first().click();await page.locator('#pwDmText').fill('함께 준비할 시간을 잡고 싶어요.');await page.locator('[data-form=dm] button[type=submit]').click();
  await page.waitForFunction(()=>__qaWrites.some(w=>w.path.startsWith('workspaceDM/')));await page.keyboard.press('Escape');
  await page.evaluate(()=>goTab('learnhub'));await page.locator('[data-action=lesson]').first().click();await page.locator('#pwLessonStatus').selectOption('done');await page.locator('#pwLessonNote').fill('팀의 코어밸류를 동료에게 설명했습니다.');await page.locator('[data-form=lesson] button[type=submit]').click();await page.waitForFunction(()=>__qaWrites.some(w=>w.path.startsWith('workspaceLearning/')));await page.keyboard.press('Escape');
  await page.evaluate(()=>goTab('home'));await page.locator('[data-action=water]').click();await page.waitForFunction(()=>__qaWrites.some(w=>w.path.startsWith('workspaceGarden/')));
  await page.locator('[data-action=garden]').click();await page.screenshot({path:output+'/member-390-garden-dialog.png'});await page.keyboard.press('Escape');
  await page.evaluate(()=>goTab('supporthub'));assert.equal(await page.evaluate(()=>curTab),'home');assert.equal(await page.locator('#workspaceSupport').textContent(),'');
  const subscriptions=await page.evaluate(()=>[...__qaWatch.keys()]);assert.equal(subscriptions.some(p=>/^workspace(Weeks|Learning|Promotions)\/other/.test(p)),false);
  await fixture('leader');await page.evaluate(()=>goTab('supporthub'));await page.locator('#pwSupportUid').selectOption('member');await page.locator('[data-form=coach] textarea').fill('화요일에 같이 피치를 준비해요.');await page.locator('[data-form=coach] button[type=submit]').click();await page.waitForFunction(()=>__qaWrites.some(w=>w.path.includes('/coach')));
  await page.locator('#pwTeamGoalPeriod').selectOption('month');await page.locator('[data-form=teamgoal] input').first().fill('100');await page.locator('[data-form=teamgoal] input').nth(1).fill('2.5');await page.evaluate(()=>PresenceWorkspace.render());assert.equal(await page.locator('#pwTeamGoalPeriod').inputValue(),'month');await page.locator('[data-form=teamgoal] button[type=submit]').click();await page.waitForFunction(()=>__qaWrites.some(w=>w.path.startsWith('workspaceTeamGoals/leader/month_')));
  await page.locator('[data-action=promotion]').click();await page.locator('#pwPromotionRole').fill('LR');await page.locator('#pwPromotionCriteria').fill('현장 기본기를 설명하고 실천 기록을 남기기');await page.locator('[data-form=promotion] button[type=submit]').click();await page.waitForFunction(()=>__qaWrites.some(w=>w.path.startsWith('workspacePromotions/')));await page.keyboard.press('Escape');
  await page.evaluate(()=>{__qaStore.workspaceAccess={};__qaWatch.get('workspaceAccess')({});});await page.waitForTimeout(160);assert.equal(await page.locator('#workspaceSupport').textContent(),'');assert.equal(await page.evaluate(()=>PresenceWorkspace.data.weeks.member),undefined);
  await fixture('admin');await page.evaluate(()=>goTab('supporthub'));await page.locator('[data-action=access]').click();await page.locator('#pwAccessUser').selectOption('member');await page.locator('#pwAccessLeader').selectOption('leader');await page.locator('[data-form=access] button[type=submit]').click();await page.waitForFunction(()=>__qaWrites.some(w=>w.path==='workspaceAccess/member'));await page.keyboard.press('Escape');
  await page.evaluate(()=>goTab('home'));await page.locator('[data-action=preferences]').click();await page.locator('#pwSeason').selectOption('winter');await page.locator('[data-form=season] button[type=submit]').click();await page.waitForFunction(()=>__qaWrites.some(w=>w.path==='workspaceSettings'));await page.keyboard.press('Escape');assert.match(await page.locator('.pw-garden-image').getAttribute('src'),/winter/);
  await page.evaluate(()=>goTab('peoplehub'));const more=page.locator('#subRail .subrail-more');if(await more.count()){await more.click();await page.screenshot({path:output+'/admin-390-menu-open.png'});const box=await page.locator('.subrail-panel').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391&&box.y>=0&&box.y+box.height<=844,'menu remains inside viewport');}
  const controls=await page.evaluate(()=>[...document.querySelectorAll('.mpanel.active button')].filter(e=>e.getBoundingClientRect().width>0).slice(0,10).map(e=>({id:e.id,cls:e.className,text:e.textContent.slice(0,50)})));
  console.log('Controls',JSON.stringify(controls));
  await page.evaluate(()=>goTab('home'));await page.evaluate(()=>window.scrollTo(0,400));await page.evaluate(()=>goTab('profithub'));await page.goBack();await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>curTab),'home');assert.ok(await page.evaluate(()=>scrollY>=390));
 }
 await writeFile(output+'/report.json',JSON.stringify({matrix,failures},null,2));console.log(JSON.stringify({checks:matrix.length,failures,output},null,2));
}finally{await browser.close();}
if(failures.length)process.exitCode=1;
