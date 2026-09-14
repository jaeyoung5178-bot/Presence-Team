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
