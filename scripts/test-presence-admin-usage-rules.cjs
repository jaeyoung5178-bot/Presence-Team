'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const host='http://127.0.0.1:19019',ns='presence-usage-regression',node=JSON.parse(fs.readFileSync(path.join(__dirname,'presence-admin-usage.node.json'))),full=process.env.RULES_FILE?JSON.parse(fs.readFileSync(process.env.RULES_FILE)):null,rules=full?(full.rules||full):{'.read':false,'.write':false};rules.presenceUsageDays=node;
const day=Math.floor((Date.now()+32400000)/86400000),sid='synthetic_session_01',base='presenceUsageDays/'+day+'/member/'+sid,proof=[];
function token(uid){return Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,user_id:uid,iat:1,exp:9999999999,aud:ns,iss:'https://securetoken.google.com/'+ns})).toString('base64url')+'.';}
async function req(method,p,value,actor='memberAuth'){const r=await fetch(host+'/'+p+'.json?ns='+ns+(actor==='seed'?'':'&auth='+token(actor)),{method,headers:{'Content-Type':'application/json',...(actor==='seed'?{Authorization:'Bearer owner'}:{})},...(value===undefined?{}:{body:JSON.stringify(value)})});return{status:r.status,text:await r.text()};}
async function check(label,method,p,value,allow,actor){const r=await req(method,p,value,actor);assert.equal(r.status===200,allow,label+' HTTP'+r.status+' '+r.text.slice(0,100));proof.push({label,allowed:allow});}
(async()=>{let r=await req('PUT','.settings/rules',{rules},'seed');assert.equal(r.status,200,r.text);r=await req('PUT','',{users:{admin:{status:'active'},member:{status:'active'},other:{status:'active'},otherAdmin:{status:'active',role:'OP'},inactive:{status:'retired'}},authSessions:{adminAuth:{userUid:'admin'},memberAuth:{userUid:'member'},deviceA:{userUid:'member'},deviceB:{userUid:'member'},otherAuth:{userUid:'other'},otherAdminAuth:{userUid:'otherAdmin'},inactiveAuth:{userUid:'inactive'}}},'seed');assert.equal(r.status,200);
const doc={v:1,dayIndex:day,lastSeen:{'.sv':'timestamp'},pageViews:1,features:{home:1}};
await check('active self create','PUT',base,doc,true);
await check('owner root read','GET','presenceUsageDays',undefined,true,'adminAuth');
await check('member root read denied','GET','presenceUsageDays',undefined,false);
await check('member own leaf read denied','GET',base,undefined,false);
await check('other admin read denied','GET','presenceUsageDays',undefined,false,'otherAdminAuth');
await check('other UID write denied','PUT',base+'/../../other/another_sid',doc,false);
await check('inactive write denied','PUT','presenceUsageDays/'+day+'/inactive/'+sid,doc,false,'inactiveAuth');
await check('unmapped write denied','PUT',base,doc,false,'unmapped');
await check('whole delete denied','DELETE',base,undefined,false);
await check('feature delete denied','DELETE',base+'/features/home',undefined,false);
await check('features delete denied','DELETE',base+'/features',undefined,false);
await check('counter reset denied','PATCH',base,{pageViews:0},false);
await check('feature reset denied','PATCH',base,{features:{home:0}},false);
await check('unknown feature denied','PATCH',base,{'features/privateText':1},false);
await check('scalar features denied','PUT','presenceUsageDays/'+day+'/member/scalar_features_session',{...doc,features:'arbitrary raw text'},false);
await check('unknown payload denied','PATCH',base,{email:'not collected'},false);
await check('stale day denied','PUT','presenceUsageDays/'+(day-1)+'/member/'+sid,{...doc,dayIndex:day-1},false);
await check('mismatched day key denied','PUT','presenceUsageDays/'+(day-1)+'/member/'+sid,doc,false);
await check('forged recent timestamp denied','PATCH',base,{lastSeen:Date.now()+600000},false);
await check('fraction count denied','PATCH',base,{pageViews:1.5},false);
await check('cap denied','PATCH',base,{pageViews:2001},false);
const patch={v:1,dayIndex:day,lastSeen:{'.sv':'timestamp'},pageViews:{'.sv':{increment:1}},'features/home':{'.sv':{increment:1}}};
await check('atomic increment allowed','PATCH',base,patch,true);await Promise.all([req('PATCH',base,patch),req('PATCH',base,patch)]).then(rs=>rs.forEach(r=>assert.equal(r.status,200)));
await check('device A canonical UID increment','PATCH',base,patch,true,'deviceA');await check('device B canonical UID increment','PATCH',base,patch,true,'deviceB');await check('raw auth UID path denied','PUT','presenceUsageDays/'+day+'/deviceA/'+sid,doc,false,'deviceA');
r=await req('GET',base,undefined,'adminAuth');assert.equal(JSON.parse(r.text).pageViews,6);assert.equal(JSON.parse(r.text).features.home,6);
console.log('PASS',proof.length,'usage ACL cases; parallel increments4 + canonical devices2; emulator-only/cloudwrites0');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
