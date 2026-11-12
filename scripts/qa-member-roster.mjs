import {createRequire} from 'node:module';import assert from 'node:assert/strict';import fs from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
fs.mkdirSync('/tmp/member-roster',{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
for(const width of [390,1024,1440]){
 const page=await browser.newPage({viewport:{width,height:width===390?844:width===1024?768:900}});
 await page.route(/firebaseio|firebasedatabase|identitytoolkit|securetoken|gstatic.com\/firebasejs/,r=>r.abort());await page.goto(process.env.BASE_URL||'http://127.0.0.1:4198/',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(()=>{
  window.__adminOff=false;window.__previewRole=null;me={uid:FOUNDER.uid,id:FOUNDER.id,name:FOUNDER.name,role:'AOP',status:'active'};
  ALLOWED_MEMBERS=['기존명단'];DEPARTED_MEMBERS=[];state.users={[me.uid]:me,old:{uid:'old',name:'신규승인예시',role:'IC',status:'retired'},new:{uid:'new',name:'신규승인예시',role:'LR',status:'pending'}};
  state.extraMembers=['계정없음예시'];state.removedMembers=[];state.memberInfo={};state.dossier={};
  const before=memberRosterNames().includes('신규승인예시');state.users.new.status='active';document.body.classList.add('app-on','presence-workspace-v2','presence-christmas');
  const app=document.getElementById('app');app.hidden=false;app.classList.remove('hidden');app.style.display='block';document.getElementById('authGate').classList.add('hidden');document.getElementById('presenceGameLoader').classList.remove('show');document.getElementById('presenceEntryLobby')?.remove();
  document.querySelectorAll('.mpanel').forEach(e=>e.classList.remove('active'));curTab='admin';document.getElementById('m-admin').classList.add('active');renderMemberAdmin();
  const card=document.getElementById('memberAdminBody').closest('.adm-card');if(card.classList.contains('adm-collapsed'))toggleAdmCard(card.querySelector('.ah'));
  return {before,names:memberRosterNames(),allowed:isAllowedName('신규승인예시'),selected:userByName('신규승인예시').uid};
 });
 assert.equal(result.before,false);assert(result.names.includes('신규승인예시'));assert.equal(result.allowed,false);assert.equal(result.selected,'new');
 const roster=page.locator('#memberAdminBody');await roster.waitFor({state:'visible'});assert.equal(await roster.getByRole('button',{name:'신규승인예시 프로필 및 팀원 관리 열기'}).count(),1);await roster.screenshot({path:`/tmp/member-roster/admin-${width}.png`});
 await page.evaluate(()=>{curTab='teamtree';document.getElementById('m-admin').classList.remove('active');document.getElementById('m-teamtree').classList.add('active');renderOrgEditor();});
 const tree=page.locator('#orgEditorBody');assert((await tree.textContent()).includes('신규승인예시'));assert((await tree.textContent()).includes('팀 연결 미지정'));assert(!(await tree.evaluate(e=>e.scrollWidth>e.clientWidth+2)));await tree.screenshot({path:`/tmp/member-roster/tree-${width}.png`});
 const gates=await page.evaluate(()=>{me={uid:'fixtureTL',name:'예시TL',role:'TL',status:'active'};const tl=TABMETA.teamtree.g();me={uid:'fixtureIC',name:'예시IC',role:'IC',status:'active'};return {tl,ic:TABMETA.teamtree.g()};});assert.equal(gates.tl,true);assert.equal(gates.ic,false);await page.close();console.log('PASS',width,'admin roster+tree, TL allowed/IC denied');
}
await browser.close();console.log('PASS actual fullindex3sizes canonical roster/profileUID/unassignedroot/signup policy; DB0');
