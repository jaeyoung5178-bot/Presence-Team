import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const repo=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
let source=await readFile(repo+'/scripts/qa-recap-lab-integration.mjs','utf8');
source=source.replace('createRequire(import.meta.url)','createRequire('+JSON.stringify(import.meta.url)+')').replace("resolve(new URL('../',import.meta.url).pathname)",JSON.stringify(repo));
const extra=`
await p.evaluate(()=>{state.users.synthetic={uid:'wrongEmbeddedId',name:'합성 긴이름 팀원',role:'IC',status:'active'};DB.getUsageDays=async(from,to)=>{window.usageRangeCalls=(window.usageRangeCalls||0)+1;const day=Math.floor((Date.now()+32400000)/86400000);return {[day]:{synthetic:{synthetic_session:{v:1,dayIndex:day,lastSeen:Date.now(),pageViews:4,features:{home:2,recaplab:2}}}}};};DB.update=async()=>{};goTab('adminusage');});
if(role==='admin'){
 await p.waitForFunction(()=>document.querySelector('.pau-person'));
 assert.equal(await p.evaluate(()=>curTab),'adminusage');
 assert((await p.locator('#adminUsageRoot').textContent()).includes('합성 긴이름 팀원'));
 assert.equal(await p.evaluate(()=>usageRangeCalls),1);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const controls=await p.locator('#adminUsageRoot button').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));assert(controls.every(h=>h>=44),JSON.stringify(controls));
 await p.screenshot({path:out+'/'+engine+'-owner-'+width+'-usage.png',fullPage:true});
 await p.evaluate(()=>{window.__adminOff=true;presenceUsageDispose();});assert.equal(await p.locator('#adminUsageRoot').textContent(),'');
 await p.evaluate(()=>{window.__adminOff=false;goTab('home');});assert.equal(await p.evaluate(()=>curTab),'home');
}else{assert.notEqual(await p.evaluate(()=>curTab),'adminusage');assert.equal(await p.locator('#adminUsageRoot').textContent(),'');assert.equal(await p.evaluate(()=>window.usageRangeCalls||0),0);}
console.log('PASS usage integration',engine,role,width);
`;
source=source.replace("console.log('PASS fullindex',engine,role,width);await p.close();",extra+"console.log('PASS fullindex',engine,role,width);await p.close();");
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
