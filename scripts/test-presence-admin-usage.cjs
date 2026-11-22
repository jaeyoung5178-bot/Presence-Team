const assert=require('node:assert/strict');
const U=require('../assets/presence-admin-usage.js');
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
const copy=v=>JSON.parse(JSON.stringify(v));
function fakeDB(now){const records={},writes=[];return {records,writes,async update(path,patch){writes.push({path,patch:copy(patch)});let row=records[path]||(records[path]={});for(const [key,value]of Object.entries(patch)){const keys=key.split('/'),last=keys.pop();let target=row;for(const k of keys)target=target[k]||(target[k]={});target[last]=value&&value['.sv']==='timestamp'?now():value&&value['.sv']?.increment!=null?(target[last]||0)+value['.sv'].increment:value;}}};}
async function main(){
 let t=Date.parse('2026-11-22T12:00:00+09:00'),actor={uid:'member-one',status:'active'},store=storage(),db=fakeDB(()=>t),timers=[];
 const env=()=>({actor:copy(actor),getActor:()=>actor,db,storage:store,now:()=>t,setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout:()=>{}});
 const a=U.createTracker(env()),b=U.createTracker(env());
 assert.equal(a.trackFeature('home'),true);assert.equal(a.trackFeature('home'),false);assert.equal(b.trackFeature('home'),false);
 assert.equal(b.trackFeature('recaplab'),true);await Promise.all([a.flush(),b.flush()]);
 assert.equal(Object.keys(db.records).length,1,'tabs share one active session');
 let record=Object.values(db.records)[0];assert.equal(record.pageViews,2);assert.deepEqual(record.features,{home:1,recaplab:1});
 assert(db.writes.every(w=>w.path.startsWith('presenceUsageDays/'+U.dayKey(t)+'/member-one/')));
 assert(db.writes.every(w=>w.patch.dayIndex===U.dayIndex(t)));
 t+=31000;assert.equal(a.trackFeature('home'),true);await a.flush();assert.equal(record.pageViews,3);assert.equal(record.features.home,2);
 const sameSession=Object.keys(db.records)[0];t+=31*60000;a.activity();await a.flush();assert.equal(Object.keys(db.records).length,2,'30min inactivity starts new session');
 actor={uid:'other',status:'active'};t+=61000;assert.equal(a.trackFeature('sale'),false);await a.flush();assert.equal(db.writes.length,4,'switch cannot emit former actor writes');
 a.stop();b.stop();assert.equal(a.isActive(),false);
 actor={uid:'member-one',status:'inactive'};const inactive=U.createTracker(env());assert.equal(inactive.trackFeature('home'),false);
 actor={uid:'member-one',status:'active',test:true};assert.equal(U.createTracker(env()).trackFeature('home'),false);
 actor={uid:'member-one',status:'active'};
 const forbidden=U.createTracker(env());for(const key of ['password','https://example.test','unknown','sale/amount','__proto__'])assert.equal(forbidden.trackFeature(key),false);await forbidden.flush();forbidden.stop();
 const failing=U.createTracker({...env(),storage:storage(),db:{update:async()=>{throw Error('permission denied');}}});assert.equal(failing.trackFeature('home'),true);await failing.flush();failing.stop();
 // Delayed first acknowledgement and a queued second feature remain independent atomic increments.
 let release,delayedWrites=[],delayedStore=storage();
 const delayed=U.createTracker({...env(),storage:delayedStore,db:{update:async(path,patch)=>{delayedWrites.push(copy(patch));if(delayedWrites.length===1)await new Promise(r=>release=r);}}});
 delayed.trackFeature('home');const first=delayed.flush();delayed.trackFeature('today');release();await first;t+=61000;await delayed.flush();
 assert(!('startedAt' in delayedWrites[0]));assert(!('startedAt' in delayedWrites[1]));assert.equal(delayedWrites[0].pageViews['.sv'].increment,1);assert.equal(delayedWrites[1].pageViews['.sv'].increment,1);delayed.stop();
 assert.deepEqual(U.datesFor(7,Date.parse('2026-12-01T00:05:00+09:00')),['2026-11-25','2026-11-26','2026-11-27','2026-11-28','2026-11-29','2026-11-30','2026-12-01']);
 const day='2026-11-22',start=Date.parse(day+'T12:00:00+09:00');const data={[day]:{a:{s:{v:1,dayIndex:U.dayIndex(start),lastSeen:start+1000,pageViews:2,features:{home:1,recaplab:1,unknown:200}}},retired:{s:{v:1,dayIndex:U.dayIndex(start),lastSeen:start+1000,pageViews:500,features:{home:500}}}}};
 const view=U.aggregate(data,[day],{a:{uid:'a',name:'합성',status:'active'},retired:{uid:'retired',name:'퇴사 합성',status:'retired'},empty:{uid:'empty',name:'빈 기록',status:'active'}});
 assert.equal(view.sessions,1);assert.equal(view.pages,2);assert.equal(view.daily[0].sessions,1);assert.equal(view.daily[0].pages,2);assert.equal(view.rows.length,2);assert.equal(view.rows[1].sessions,0);assert(!('unknown' in view.features));
 const canonical=U.aggregate({[day]:{one:{deviceA:{v:1,dayIndex:U.dayIndex(start),lastSeen:start,pageViews:2},deviceB:{v:1,dayIndex:U.dayIndex(start),lastSeen:start,pageViews:3}},two:{deviceC:{v:1,dayIndex:U.dayIndex(start),lastSeen:start,pageViews:7}}}},[day],{one:{name:'동명이인',status:'active'},two:{uid:'wrong-profile-uid',name:'동명이인',status:'active'}});
 assert.equal(canonical.rows.length,2);assert.equal(canonical.rows.find(r=>r.uid==='one').sessions,2);assert.equal(canonical.rows.find(r=>r.uid==='one').pages,5);assert.equal(canonical.rows.find(r=>r.uid==='two').pages,7);
 assert(!('startedAt' in db.records[sameSession]));
 console.log('PASS active-self/switch/logout/bot/whitelist/30s-debounce/30min-session/shared-tab-atomic-increments/failed-write-nonblocking/delayed-init/KST-period/active-cohort/no-record');
}
main().catch(e=>{console.error(e);process.exitCode=1});
