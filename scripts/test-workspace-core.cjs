const test=require('node:test');
const assert=require('node:assert/strict');
const c=require('../assets/presence-workspace-core.js');
test('Korean midnight and Monday boundaries',()=>{
 assert.equal(c.dateKey(new Date('2026-09-13T15:00:00Z')),'2026-09-14');
 assert.equal(c.monday('2026-01-01'),'2025-12-29');
 assert.equal(c.monday('2026-09-20'),'2026-09-14');
 assert.equal(c.add('2024-02-28',1),'2024-02-29');
});
test('prior periods use equal elapsed days and cap shorter months',()=>{
 const jan=c.period('month','2026-01-14');assert.equal(jan.previousStart,'2025-12-01');assert.equal(jan.previousCutoff,'2025-12-14');
 const march=c.period('month','2024-03-31');assert.equal(march.previousCutoff,'2024-02-29');
 const year=c.period('year','2024-12-31');assert.equal(year.previousCutoff,'2023-12-31');
});
test('AVG counts recorded zero, excludes missing/NA/rally, applies latest clearing',()=>{
 const input=[{name:'A',date:'2026-09-14',count:3,checked:true,t:1},{name:'A',date:'2026-09-14',count:0,cleared:true,t:2},{name:'A',date:'2026-09-15',count:0,checked:true},{name:'A',date:'2026-09-16',count:4,checked:true},{name:'A',date:'2026-09-17',count:0},{name:'A',date:'2026-09-18',count:4,na:true},{name:'B',date:'2026-09-16',count:9,checked:true},{name:'A',date:'2026-09-19',count:3,rally:true}];
 const r=c.aggregate(input,['A'],'2026-09-14','2026-09-20');assert.equal(r.sales,4);assert.equal(r.days,2);assert.equal(r.avg,2);
 assert.equal(c.aggregate({},['A'],'2026-09-14','2026-09-20').avg,null);
});
test('coaching follows assigned UIDs, never similar names or roles alone',()=>{
 const member={uid:'m',status:'active'},leader={uid:'l',role:'TL',status:'active'},access={m:{leaderUid:'l'}};
 assert.equal(c.canCoach(leader,member,access),true);assert.equal(c.canCoach({...leader,uid:'stranger'},member,access),false);assert.equal(c.canCoach({...leader,status:'inactive'},member,access),false);assert.equal(c.canCoach({uid:'admin',status:'active'},member,access),true);
});
test('four seasons follow Korean calendar months',()=>{
 assert.equal(c.season('2026-03-01'),'spring');assert.equal(c.season('2026-06-01'),'summer');assert.equal(c.season('2026-09-01'),'autumn');assert.equal(c.season('2026-12-01'),'winter');assert.equal(c.season('2027-01-01'),'winter');
});
test('garden merges history once, ranks top three and resolves ties by arrival',()=>{
 const users=['a','b','c','d','zero'].map(uid=>({uid,name:uid,status:'active'})).concat({uid:'left',status:'inactive'});
 const legacy={a:{count:8,t:100},b:{count:9,t:200},c:{count:2,t:50},d:{count:1,t:40},left:{count:100,t:1}};
 const current={a:{count:1,lastWateredAt:300},c:{count:5,lastWateredAt:400}};
 assert.deepEqual(c.waterLeaders(users,legacy,current).map(r=>[r.uid,r.count,r.rank]),[['b',9,1],['a',9,2],['c',7,3]]);
 assert.equal(c.gardenTotal(120,legacy,current),126);
 assert.equal(c.gardenTotal(0,{a:{count:5}},{a:{count:2}}),7);
 assert.equal(c.waterCount({count:-1}),0);assert.equal(c.waterCount({count:'invalid'}),0);
 assert.deepEqual(c.waterLeaders(users,{},{}),[]);
});
test('submission check includes missing/cleared entries, accepts saved zero and NA, and uses selected date',()=>{
 const members=['missing','zero','na','cleared','unconfirmed','future'].map(name=>({name}));
 const records=[{name:'zero',date:'2026-09-14',count:0,checked:true},{name:'na',date:'2026-09-14',na:true},{name:'cleared',date:'2026-09-14',count:3,t:1},{name:'cleared',date:'2026-09-14',cleared:true,t:2},{name:'unconfirmed',date:'2026-09-14',count:0},{name:'missing',date:'2026-09-13',count:2}];
 const recorded=e=>!!(e&&!e.cleared&&(e.na||e.rally||e.checked||e.count>0));
 assert.deepEqual(c.pendingSubmissions(members,records,'2026-09-14',recorded,n=>n==='future').map(m=>m.name),['missing','cleared','unconfirmed']);
});
