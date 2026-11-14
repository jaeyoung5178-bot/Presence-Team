// Synthetic fixtures only. No network, credentials, production reads or writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=process.env.PROMOTION_CLOUD_SOURCE||path.join(__dirname,'../assets/presence-promotion-campaign-cloud.js');
const now=Date.parse('2026-11-14T03:00:00Z');class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
let current=null,writes=0,revoke=false;
const context=vm.createContext({window:{__firebaseReady:true},LIVE:true,Date:Clock,me:{uid:'admin',status:'active'},DB:{get:async p=>{if(revoke)context.me={uid:'admin',status:'inactive'};return p==='users/admin'?{status:'active'}:p==='users/target'?{name:'Synthetic TL',role:'TL',status:'active'}:p.startsWith('recapStudioTeams/')?{uid:'target'}:current;},update:async(ns,updates)=>{assert.equal(ns,'promotionGoalCampaigns');assert(Object.keys(updates).every(p=>p==='private/admin/fixture'||p==='public/fixture'));writes++;current=updates['private/admin/fixture'];}}});
vm.runInContext(fs.readFileSync(source,'utf8'),context);const C=context.window.PresencePromotionCampaignCloud;
const seed={campaignId:'fixture',targetUid:'target',teamKey:'youngwave',week1Start:'2026-11-09',weeklyTarget:3200000,weekCount:2,displayFrom:'2026-11-11',bondDeductionBps:0,enabled:true,ledger:{}};
const plain=v=>JSON.parse(JSON.stringify(v));
(async()=>{
 const saved=await C.saveConfig({...seed,ledger:{d0:{amount:828600}}},null),projection=C.project(saved);
 assert.equal(projection.weeks.w1.gross,828600);assert.equal(projection.weeks.w1.net,828600);assert.equal(projection.multiplierBps,10000);assert.equal((828600/3200000*100).toFixed(1),'25.9');assert.equal(3200000-projection.weeks.w1.net,2371400);
 const actualFixture=plain(saved);[100000,240000,150000,250000,88600].forEach((amount,i)=>actualFixture.ledger['d'+i].amount=amount);const actualProjected=C.project(actualFixture);assert.equal(actualProjected.weeks.w1.gross,828600);assert.equal(actualProjected.weeks.w1.net,828600);assert.equal(actualProjected.weeks.w1.confirmedDays,5);assert.equal(actualProjected.weeks.w2.confirmedDays,0);
 assert.equal(projection.weeks.w2.status,'missing');assert.equal(projection.weeks.w2.confirmedDays,0);assert.equal('net'in projection.weeks.w2,false);assert.equal('gross'in projection.weeks.w2,false);
 const zero=plain(saved);zero.ledger.d7.amount=0;const z=C.project(zero);assert.equal(z.weeks.w2.net,0);assert.equal(z.weeks.w2.confirmedDays,1);assert.equal(z.weeks.w2.status,'partial');
 const excess=plain(saved);excess.ledger.d0.amount=3420000;const e=C.project(excess);assert.equal(e.weeks.w1.net,3420000);assert.equal(e.weeks.w1.achieved,true);assert.equal(e.weeks.w2.achieved,false);assert.equal(e.overallComplete,false);assert.equal('net'in e.weeks.w2,false);
 assert.throws(()=>C.project({...saved,weeklyTarget:0}));assert.throws(()=>C.project({...saved,currency:'USD'}));assert.throws(()=>C.project({...saved,bondDeductionBps:10001}));
 const bad=plain(saved);bad.ledger.d0.amount=1000000001;assert.throws(()=>C.project(bad));
 await assert.rejects(()=>C.saveConfig({...saved,campaignId:'fixture',revision:0},saved),/버전/);
 for(const amount of[0,1]){const future=plain(saved);future.ledger.d7.amount=amount;await assert.rejects(()=>C.saveConfig({...future,campaignId:'fixture'},saved),/미래/);}
 context.addEventListener=()=>{};context.clearTimeout=()=>{};vm.runInContext(fs.readFileSync(path.join(path.dirname(source),'presence-promotion-campaign.js'),'utf8'),context);
 const html=(amount,goal=3200000,rate=0)=>context.window.PresencePromotionCampaign.homeHTML({bondDeductionBps:rate,weeklyTarget:goal,week1Start:'2026-11-09',weeks:{w1:{gross:amount,net:amount,startDate:'2026-11-09',endDate:'2026-11-15',confirmedDays:1},w2:{startDate:'2026-11-16',endDate:'2026-11-22',confirmedDays:0}}},{preview:true});
 const defenses=value=>[...value.matchAll(/class="ppc-reject-defense"[^]*?<strong>([^<]*)<\/strong>/g)].map(m=>m[1]);
 for(const [amount,expected]of [[0,'0건'],[828600,'0건'],[3200000,'0건'],[3309999,'0건'],[3310000,'1건'],[3420000,'2건']])assert.deepEqual(defenses(html(amount)),[expected,'—']);
 assert.match(html(828600),/2,481,400원/);assert.match(html(828600),/시작 전 · 미입력/);assert.match(html(828600),/실제 리젝 기록이 아닌|실제 리젝 기록 아님/);
 assert.deepEqual(defenses(html(4000000,0)),['—','—']);assert.equal(defenses(html(4000000,3200000,4500)).length,0);assert.match(html(828600),/25\.9%/);assert.match(html(828600),/2,371,400원/);assert.equal(3200000+110000-828600,2481400);assert.match(html(6400000),/aria-valuenow="100\.0"/);
 const beforeWrites=writes;context.me={uid:'other',status:'active',role:'TL'};await assert.rejects(()=>C.saveDay({...saved,campaignId:'fixture'},saved));context.me={uid:'target',status:'active',role:'TL'};await assert.rejects(()=>C.saveConfig({...saved,campaignId:'fixture'},saved));context.me={uid:'admin',status:'active'};revoke=true;await assert.rejects(()=>C.saveConfig({...saved,campaignId:'fixture'},saved));assert.equal(writes,beforeWrites);
 console.log('PASS full raw KRW/no conversion/828600/25.9%/missing vs zero/no carry/uncapped total/invalid goal+currency+rate+day cap/CAS/future zero+positive/other TL/config denial/revoke; synthetic writes='+writes);
})().catch(e=>{console.error(e);process.exitCode=1;});
