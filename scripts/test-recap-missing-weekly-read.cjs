'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
if(!process.env.RULES_FILE)throw Error('RULES_FILE must point to a private reviewed full rules JSON; never commit that file');
if(!process.env.TEST_TL_UID)throw Error('TEST_TL_UID must match the reviewed rules canonical TL mapping (emulator only)');
const testTl=process.env.TEST_TL_UID;
const file=process.env.RULES_FILE,host='http://127.0.0.1:19019',ns='recap-missing-self-regression',rulesDoc=JSON.parse(fs.readFileSync(file)),rules=rulesDoc.rules||rulesDoc,proof=[];
function token(uid){return Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,user_id:uid,iat:1,exp:9999999999,aud:ns,iss:'https://securetoken.google.com/'+ns})).toString('base64url')+'.';}
async function req(method,path,value,actor='lrAuth'){const response=await fetch(host+'/'+path+'.json?ns='+ns+(actor==='seed'?'':'&auth='+token(actor)),{method,headers:{'Content-Type':'application/json',...(actor==='seed'?{Authorization:'Bearer owner'}:{})},...(value===undefined?{}:{body:JSON.stringify(value)})});return{status:response.status,text:await response.text()};}
async function check(label,method,path,value,allow,actor){const r=await req(method,path,value,actor);assert.equal(r.status===200,allow,label+' HTTP '+r.status);if(allow&&method==='GET'&&label.includes('missing'))assert.equal(r.text,'null');proof.push({label,status:r.status,allowed:allow});}
(async()=>{assert(host==='http://127.0.0.1:19019');let r=await req('PUT','.settings/rules',{rules},'seed');assert.equal(r.status,200,r.text.slice(0,300));
 const pay='2026-11-20',oldPay='2026-11-13',assignment=(uid,teamKey='presence')=>({uid,teamKey,assignmentId:'a',configHash:'h',activeFrom:'2026-01-01'}),doc=(uid,p=pay,teamKey='presence')=>({uid,payDate:p,weekEnding:'2026-11-15',netPayment:0,rejectCLCount:0,rejectSWCount:0,updatedAt:Date.now(),teamKey,assignmentId:'a',assignmentConfigHash:'h'});
 const seed={users:{lr:{status:'active',role:'LR'},ic:{status:'active',role:'IC'},inactive:{status:'retired',role:'LR'},admin:{status:'active',role:'OP'},[testTl]:{status:'active',role:'TL'},teamIC:{status:'active',role:'IC'}},authSessions:{lrAuth:{userUid:'lr'},icAuth:{userUid:'ic'},inactiveAuth:{userUid:'inactive'},adminAuth:{userUid:'admin'},tlAuth:{userUid:testTl}},recapStudioPublicStatus:{teamHistoryV3:{status:'complete',version:'2026-10-03.team-history-v3',configHash:'h'}},recapStudioAccess:{viewers:{[testTl]:{scope:'team',teamKey:'fuse'}}},tlWorkspaceGrants:{[testTl]:{active:true,teamKey:'fuse',capabilities:{recap:true}}},tlWorkspaceMembers:{fuse:{teamIC:{status:'active',role:'IC'}}},recapStudioAssignments:{byPay:{[pay]:{lr:assignment('lr'),ic:assignment('ic'),inactive:assignment('inactive'),teamIC:assignment('teamIC','fuse')},[oldPay]:{lr:assignment('lr')}}},recapStudioTeams:{presence:{weekly:{[oldPay]:{lr:doc('lr',oldPay)}}}}};r=await req('PUT','',seed,'seed');assert.equal(r.status,200);
 const expectMissing=process.env.EXPECT_MISSING!=='deny';
 await check('LR self missing weekly','GET','recapStudioTeams/presence/weekly/'+pay+'/lr',undefined,expectMissing);
 await check('IC self missing weekly','GET','recapStudioTeams/presence/weekly/'+pay+'/ic',undefined,expectMissing,'icAuth');
 await check('self existing valid','GET','recapStudioTeams/presence/weekly/'+oldPay+'/lr',undefined,true);
 await req('PUT','recapStudioTeams/presence/weekly/'+oldPay+'/lr',{...doc('lr',oldPay),assignmentConfigHash:'wrong'},'seed');
 await check('self mismatched existing metadata denied','GET','recapStudioTeams/presence/weekly/'+oldPay+'/lr',undefined,false);
 await check('other uid missing denied','GET','recapStudioTeams/presence/weekly/'+pay+'/ic',undefined,false);
 await check('wrong team missing denied','GET','recapStudioTeams/fuse/weekly/'+pay+'/lr',undefined,false);
 await check('inactive self missing denied','GET','recapStudioTeams/presence/weekly/'+pay+'/inactive',undefined,false,'inactiveAuth');
 await check('unmapped auth denied','GET','recapStudioTeams/presence/weekly/'+pay+'/lr',undefined,false,'forged');
 await check('self parent weekly denied','GET','recapStudioTeams/presence/weekly/'+pay,undefined,false);
 await check('self missing assignment denied','GET','recapStudioTeams/presence/weekly/2026-11-27/lr',undefined,false);
 await check('admin missing member preserved','GET','recapStudioTeams/presence/weekly/'+pay+'/lr',undefined,true,'adminAuth');
 await check('TL own scope missing member preserved','GET','recapStudioTeams/fuse/weekly/'+pay+'/teamIC',undefined,true,'tlAuth');
 await check('TL other team missing denied','GET','recapStudioTeams/presence/weekly/'+pay+'/ic',undefined,false,'tlAuth');
 await check('self write valid preserved','PUT','recapStudioTeams/presence/weekly/'+pay+'/lr',doc('lr'),true);
 await check('self write wrong metadata denied','PATCH','recapStudioTeams/presence/weekly/'+pay+'/lr',{assignmentConfigHash:'bad'},false);
 await check('TL own IC write preserved','PUT','recapStudioTeams/fuse/weekly/'+pay+'/teamIC',doc('teamIC',pay,'fuse'),true,'tlAuth');
 const out=process.env.PROOF_FILE||'/tmp/recap-missing-weekly-read-proof.json';fs.writeFileSync(out,JSON.stringify({file,rulesSHA:crypto.createHash('sha256').update(JSON.stringify(rules)).digest('hex'),namespace:ns,emulatorOnly:true,actualCloudWrites:0,cases:proof},null,2));console.log('PASS',proof.length,'emulator-only missing weekly self read cases; actual cloud writes0; proof',out);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
