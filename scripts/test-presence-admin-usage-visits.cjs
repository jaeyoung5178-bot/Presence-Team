const assert=require('node:assert/strict');
const U=require('../assets/presence-admin-usage.js');
const days=U.datesFor(7,Date.parse('2026-12-01T00:05:00+09:00'));
const users={one:{name:'동명이인',role:'TL',status:'active'},two:{uid:'wrong-profile-id',name:'동명이인',role:'LR',status:'active'},empty:{name:'기록 없는 팀원',status:'active'},retired:{name:'퇴사자',status:'retired'},bot:{name:'봇',status:'active',test:true}};
const session=(day,n=1)=>({v:1,dayIndex:U.dayIndex(Date.parse(day+'T12:00:00+09:00')),lastSeen:Date.parse(day+'T12:00:00+09:00'),pageViews:n,features:{home:n}});
const data={};
data[days[0]]={one:{a:session(days[0]),b:session(days[0])},two:{c:session(days[0])},retired:{d:session(days[0])},bot:{e:session(days[0])}};
data[days[3]]={one:{f:session(days[3])},two:{g:session(days[3]),h:session(days[3])}};
data[days[6]]={one:{i:session(days[6]),badDay:{...session(days[6]),dayIndex:1},badTime:{...session(days[6]),lastSeen:Date.parse(days[6]+'T16:00:00Z')},badVersion:{...session(days[6]),v:2}},foreign:{j:session(days[6])}};
const v=U.aggregate(data,days,users),one=v.rows.find(r=>r.uid==='one'),two=v.rows.find(r=>r.uid==='two'),empty=v.rows.find(r=>r.uid==='empty');
assert.equal(v.sessions,7);assert.equal(v.active,2);assert.equal(v.rows.length,3);
assert.deepEqual(one.daily.map(d=>d.sessions),[2,0,0,1,0,0,1]);assert.equal(one.visitDays,3);assert.equal(one.sessions,4);
assert.deepEqual(two.daily.map(d=>d.sessions),[1,0,0,2,0,0,0]);assert.equal(two.visitDays,2);assert.equal(two.sessions,3);
assert.equal(empty.visitDays,0);assert(empty.daily.every(d=>d.sessions===0));
for(const r of v.rows){assert.deepEqual(r.daily.map(d=>d.date),days);assert.equal(r.daily.reduce((n,d)=>n+d.sessions,0),r.sessions);assert.equal(r.daily.filter(d=>d.sessions>0).length,r.visitDays);}
for(let i=0;i<days.length;i++)assert.equal(v.rows.reduce((n,r)=>n+r.daily[i].sessions,0),v.daily[i].sessions);
assert.deepEqual(v.rows.map(r=>r.uid),['one','two','empty']);
for(const n of [7,30,90]){const ds=U.datesFor(n,Date.parse('2027-01-01T00:01:00+09:00'));const z=U.aggregate({},ds,users);assert(z.rows.every(r=>r.daily.length===n&&r.sessions===0&&r.visitDays===0));assert.equal(ds.at(-1),'2027-01-01');}
const single=U.aggregate({[days[0]]:{one:{s:session(days[0])}}},[days[0]],users);assert.deepEqual(single.rows.find(r=>r.uid==='one').daily,[{date:days[0],sessions:1}]);
console.log('PASS canonical UID per-day visits, zero-fill, KST month/year boundaries, cohort validity, total/series consistency, visit days and single-day record');
