'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const model=require('../assets/presence-recap-lab-model.js');
const g={PresenceRecapLabModel:model};
vm.runInNewContext(fs.readFileSync(__dirname+'/../assets/presence-recap-lab-bridge.js','utf8'),{window:g,Date,Math,Map,Object,Error});

function fixture({admin=false,role='LR',ineligible='',unassigned='',assignmentErrorCode='recap/assignment-missing'}={}){
 const actor={uid:admin?'admin':'member',name:'Synthetic',status:'active',role:admin?'OWNER':role};
 const member=admin?{uid:'member',name:'Synthetic member',status:'active',role}:actor;
 const store={},reads=[],assignments=[],writes=[];
 const api={actor:()=>actor,members:()=>[member],month:'2026-11',today:()=> '2026-11-22',admin:()=>admin,
  canWrite:()=>true,eligible:(_u,pay)=>pay!==ineligible,
  assignment:async(uid,pay)=>{assignments.push(pay);if(pay===unassigned)throw Object.assign(Error('No unique weekly assignment'),{code:assignmentErrorCode});return{teamKey:'presence',assignmentId:'approved',configHash:'reviewed'};},
  get:async path=>{reads.push(path);return structuredClone(store[path]??null);},
  tx:async(path,fn)=>{const next=fn(structuredClone(store[path]??null));if(next===undefined)return{committed:false};writes.push(path);store[path]=structuredClone(next);return{committed:true};},
  summary:(_u,w)=>({allNA:w.payDate==='2026-11-13'||w.payDate==='2026-10-02'}),verifyWrite:async()=>{},invalidate:()=>{}};
 return{bridge:g.PresenceRecapLabBridge.create(api),store,reads,assignments,writes,member,confirmAssignment:()=>{unassigned='';}};
}

(async()=>{
 for(const options of [{role:'LR'},{role:'IC'},{admin:true,role:'LR'}]){
  const f=fixture(options);let view=await f.bridge.loadMonth('2026-11');
  assert.deepEqual(Array.from(view.weeks,w=>w.payDate),['2026-11-06','2026-11-13','2026-11-20','2026-11-27']);
  const week=view.weeks[1];
  assert.equal(week.activityFrom,'2026-11-02');assert.equal(week.activityTo,'2026-11-08');
  assert.equal(week.eligible,true,'NA attendance must remain selectable, not outside period');
  assert.equal(week.editable,true);assert.equal(week.status,'na');assert.equal(week.statusLabel,'NA · 휴무');
  for(const i of [0,2]){assert.equal(view.weeks[i].eligible,true);assert.equal(view.weeks[i].editable,true);}
  assert.equal(view.weeks[3].status,'future');assert.equal(view.weeks[3].eligible,true);assert.equal(view.weeks[3].editable,true);assert.equal(view.weeks[3].statusLabel,'예정 · 사전 입력 가능');
  assert(f.assignments.includes('2026-11-27'));assert(f.reads.some(p=>p.includes('2026-11-27')));
  await f.bridge.onSaveWeek('2026-11-13',{netPaymentCents:0,rejectSWCount:0,rejectCLCount:0});
  const saved=f.store['recapStudioTeams/presence/weekly/2026-11-13/'+f.member.uid];
  assert.equal(saved.netPayment,0);assert.equal(saved.activityFrom,'2026-11-02');assert.equal(saved.activityTo,'2026-11-08');
  await f.bridge.onSaveWeek('2026-11-27',{netPaymentCents:1250,rejectSWCount:0,rejectCLCount:0});assert.equal(f.store['recapStudioTeams/presence/weekly/2026-11-27/'+f.member.uid].netPayment,12.5);
  view=await f.bridge.loadMonth('2026-12');assert(view.weeks.every(w=>w.eligible&&w.editable&&w.status==='future'));await f.bridge.onSaveWeek('2026-12-04',{netPaymentCents:0,rejectSWCount:0,rejectCLCount:0});
  view=await f.bridge.loadMonth('2026-10');
  assert.equal(view.weeks[0].activityFrom,'2026-09-21');assert.equal(view.weeks[0].activityTo,'2026-09-27');
  assert.equal(view.weeks[0].eligible,true);assert.equal(view.weeks[0].editable,true);assert.equal(view.weeks[0].statusLabel,'NA · 휴무');
 }
 const outside=fixture({ineligible:'2026-11-13'}),outsideView=await outside.bridge.loadMonth('2026-11');
 assert.equal(outsideView.weeks[1].eligible,false);assert.equal(outsideView.weeks[1].editable,false);assert.equal(outsideView.weeks[1].status,'ineligible');
 assert(!outside.assignments.includes('2026-11-13'));
 await assert.rejects(()=>outside.bridge.onSaveWeek('2026-11-13',{netPaymentCents:0,rejectSWCount:0,rejectCLCount:0}),/권한/);
 const unassigned=fixture({unassigned:'2026-11-13'});
 await assert.rejects(()=>unassigned.bridge.loadMonth('2026-11'),/No unique weekly assignment/);assert.equal(unassigned.writes.length,0);
 for(const options of [{role:'LR'},{role:'IC'},{admin:true,role:'LR'}]){
  const pending=fixture({...options,unassigned:'2026-11-27'}),view=await pending.bridge.loadMonth('2026-11'),week=view.weeks[3];
  assert.equal(view.status,'ready');assert(view.weeks.slice(0,3).every(w=>w.editable));
  assert.equal(week.eligible,true);assert.equal(week.editable,true);assert.equal(week.awaitingAssignment,true);assert.equal(week.statusLabel,'배정 확인 필요');
  assert(!pending.reads.some(p=>p.includes('/weekly/2026-11-27/')),'no guessed weekly path before assignment exists');
  await pending.bridge.onSaveWeek('2026-11-06',{netPaymentCents:0,rejectSWCount:0,rejectCLCount:0});
  const written=pending.writes.length;
  await assert.rejects(()=>pending.bridge.onSaveWeek('2026-11-27',{netPaymentCents:1250,rejectSWCount:0,rejectCLCount:0}),{code:'recap/assignment-missing'});
  assert.equal(pending.writes.length,written,'unassigned future save must not write');
  pending.confirmAssignment();await pending.bridge.onSaveWeek('2026-11-27',{netPaymentCents:1250,rejectSWCount:0,rejectCLCount:0});
  assert.equal(pending.store['recapStudioTeams/presence/weekly/2026-11-27/'+pending.member.uid].netPayment,12.5);
 }
 const denied=fixture({unassigned:'2026-11-27',assignmentErrorCode:'PERMISSION_DENIED'});
 await assert.rejects(()=>denied.bridge.loadMonth('2026-11'),{code:'PERMISSION_DENIED'});assert.equal(denied.writes.length,0);
 const ambiguous=fixture({unassigned:'2026-11-27',assignmentErrorCode:'recap/assignment-ambiguous'});
 await assert.rejects(()=>ambiguous.bridge.loadMonth('2026-11'),{code:'recap/assignment-ambiguous'});
 console.log('PASS assigned NA week selectable/editable/zero save; LR/IC/admin; November neighbors/month boundary; assigned future week/month save; ineligible/unassigned remain blocked');
 console.log('PASS future missing index isolated; due weeks usable; canonical recheck before save; no guessed path; permission/ambiguity/past missing not hidden');
})().catch(error=>{console.error(error);process.exitCode=1;});
