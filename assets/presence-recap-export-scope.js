/* Authenticated recap material snapshots. No legacy cache or bundled member data. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PresenceRecapExportScope=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const LEADERS={umqn54ujf:'fuse',umqna7jpj:'youngwave'},TEAMS=['presence','fuse','youngwave'];
 const clone=v=>JSON.parse(JSON.stringify(v??null));
 function stable(v){return JSON.stringify(sort(v));}
 function sort(v){return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;}
 function fail(message){throw Object.assign(Error(message),{code:'recap/export-scope'});}
 function identity(actor){if(!actor||actor.status!=='active')fail('로그인 상태를 확인해 주세요.');if(actor.uid==='admin')return {owner:true,uid:'admin',teamKey:'',label:'Presence 전체'};const teamKey=LEADERS[actor.uid];if(!teamKey||!['TL','AOP','OP','O','OWNER'].includes(actor.role))fail('리캡 자료를 열 수 있는 팀리더 권한이 없습니다.');return {owner:false,uid:actor.uid,teamKey,label:teamKey==='fuse'?'FUSE 우리 팀':'YOUNG WAVE 우리 팀'};}
 function activeIntervals(entry,pay){if(!entry)return [];const intervals=entry.intervals?Object.values(entry.intervals):[entry];return intervals.filter(x=>x&&(x.activeFrom||x.from||'0000-01-01')<=pay&&pay<=(x.activeTo||x.to||'9999-12-31'));}
 function periodMembers(control,pays,eligible){const byUid={};for(const teamKey of Object.keys(control.rosters)){for(const[uid,entry]of Object.entries(control.rosters[teamKey]||{})){const projected=control.owner?null:control.members[uid];if(!control.owner&&(!projected||projected.status!=='active'))continue;const eligiblePays=pays.filter(pay=>activeIntervals(entry,pay).length===1&&(!eligible||eligible({...entry,uid},pay)));if(!eligiblePays.length)continue;const existing=byUid[uid]||(byUid[uid]={uid,name:projected?.name||entry.name||uid,role:projected?.role||entry.role||'IC',status:'active',intervals:[],teamPays:{}});existing.intervals.push(...(entry.intervals?Object.values(entry.intervals):[entry]));for(const pay of eligiblePays){if(existing.teamPays[pay]&&existing.teamPays[pay]!==teamKey)fail('같은 주차에 중복된 팀 배정이 있습니다.');existing.teamPays[pay]=teamKey;}}}return Object.values(byUid);}
 function create(api){
  async function capture(request){
   request=clone(request||{});const meta=request.meta,uid=String(request.uid||'');if(!meta||!Array.isArray(meta.pays)||!meta.pays.length||meta.from!==request.from||meta.to!==request.to)fail('리캡 기간을 확인해 주세요.');const actor=api.actor(),id=identity(actor),generation=api.generation?.(),selection=stable(api.selection?.()),role=actor.role;
   function sync(){const current=api.actor();if(!current||current.uid!==id.uid||current.status!=='active'||current.role!==role||api.generation?.()!==generation||stable(api.selection?.())!==selection||!api.localAllowed?.(current))fail('계정·권한 또는 선택한 리캡 기간이 변경되었습니다.');}
   async function get(path){sync();const value=await api.get(path);sync();return clone(value);}
   if(!api.localAllowed?.(actor))fail('현재 리캡 자료 권한을 확인해 주세요.');
   async function control(){
    sync();const profile=await get('users/'+id.uid);if(!profile||profile.status!=='active'||profile.uid&&profile.uid!==id.uid||profile.role!==role)fail('현재 계정의 재직·직급 권한을 확인해 주세요.');
    let access=null,grant=null,members={},rosters={};
    if(id.owner){const values=await Promise.all(TEAMS.map(team=>get('recapStudioTeams/'+team+'/roster')));sync();TEAMS.forEach((team,i)=>rosters[team]=values[i]||{});}
    else{const values=await Promise.all([get('recapStudioAccess/viewers/'+id.uid),get('tlWorkspaceGrants/'+id.uid),get('tlWorkspaceMembers/'+id.teamKey),get('recapStudioTeams/'+id.teamKey+'/roster')]);sync();[access,grant,members]=values;rosters[id.teamKey]=values[3]||{};if(!access||access.active===false||access.revokedAt||access.scope!=='team'||access.teamKey!==id.teamKey||!grant||grant.active!==true||grant.teamKey!==id.teamKey||grant.capabilities?.recap!==true)fail('관리자가 허용한 우리 팀 리캡 권한을 확인해 주세요.');members=members||{};if(!members[id.uid]||members[id.uid].status!=='active')fail('현재 팀 트리의 팀리더 배정을 확인해 주세요.');}
    const result={...id,profile:{uid:id.uid,status:profile.status,role:profile.role},access,grant,members,rosters};const people=periodMembers(result,meta.pays,api.eligible);if(uid&&!people.some(p=>p.uid===uid))fail('선택한 팀원은 해당 기간의 우리 팀 자료에 없습니다.');return {...result,people};
   }
   const baseline=await control(),fingerprint=stable(baseline);sync();
   async function assertFresh(){sync();const latest=await control();if(stable(latest)!==fingerprint)fail('팀 권한이나 승인된 명단이 변경되었습니다. 다시 열어 주세요.');sync();return true;}
   async function readData(){
    await assertFresh();sync();const keys=id.owner?TEAMS:[id.teamKey],teams={};
    for(const team of keys){const value=await get('recapStudioTeams/'+team);await assertFresh();if(!value||stable(value.roster||{})!==stable(baseline.rosters[team]||{}))fail('팀 명단과 자료의 기준이 달라 다시 확인해야 합니다.');teams[team]=value;}
    const sales=await get(id.owner?'sales':'tlWorkspaceSales/'+id.teamKey);await assertFresh();
    const users=id.owner?await get('users'):null;if(id.owner)await assertFresh();
    const data=aggregate({meta,people:baseline.people,teams,sales:sales||{},users,owner:id.owner,uid},api);await assertFresh();return data;
   }
   return Object.freeze({owner:id.owner,teamKey:id.teamKey,label:id.label,actorUid:id.uid,from:meta.from,to:meta.to,people:clone(baseline.people),fingerprint,sync,assertFresh,readData});
  }
  return {capture};
 }
 function aggregate(input,api){
  const {meta,teams,owner}=input,pays=meta.pays,people=input.people.filter(p=>!input.uid||p.uid===input.uid),byUid=Object.fromEntries(people.map(p=>[p.uid,p])),datesByUid={},nameIds={};
  function nameKey(value){return String(value||'').replace(/\s/g,'');}
  for(const[key,p]of Object.entries(input.users||{})){const name=nameKey(p?.name),uid=p?.uid||key;if(name&&uid)(nameIds[name]||(nameIds[name]=new Set())).add(uid);}
  for(const p of input.people){const name=nameKey(p.name);if(name)(nameIds[name]||(nameIds[name]=new Set())).add(p.uid);}
  function addSale(value,date,fallbackName,explicitUid){if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return;let uid=explicitUid||value.uid;if(!uid){const ids=nameIds[nameKey(value.name||fallbackName)];if(ids?.size>1)fail('동명이인의 세일즈를 구분할 UID가 없어 내보내기를 중단했습니다.');uid=ids?.values().next().value;}if(!byUid[uid])return;const person=byUid[uid],row={...value,uid,name:person.name,date};if(api.countsAsWork&&!api.countsAsWork(row))return;if(value.cleared||value.na||value.rally||!(value.checked===true||Number(value.count)>0))return;const count=Number(value.count);if(!Number.isFinite(count)||count<0)fail('세일즈 원본 건수를 확인해 주세요.');const prior=(datesByUid[uid]||(datesByUid[uid]={}))[date];if(prior&&prior.count!==count)fail('같은 팀원·날짜의 세일즈가 중복되어 확인이 필요합니다.');datesByUid[uid][date]={count};}
  if(owner){for(const[key,value]of Object.entries(input.sales)){if(!value||typeof value!=='object')continue;if(/^\d{4}-\d{2}-\d{2}$/.test(key)){for(const[name,row]of Object.entries(value))addSale(row,key,name);}else{const parts=key.split('|');addSale(value,value.date||parts[0],parts.slice(1).join('|'));}}}
  else for(const[uid,dates]of Object.entries(input.sales))for(const[date,value]of Object.entries(dates||{}))addSale(value,date,null,uid);
  const number=(v,negative)=>{if(v==null)return null;const n=Number(v);if(!Number.isFinite(n)||!negative&&n<0)fail('주간 리캡의 숫자 원본을 확인해 주세요.');return n;},count=v=>number(v,false)||0;
  let rows=people.map(person=>{const records=pays.map(pay=>{const team=person.teamPays[pay];if(!team)return null;const row=teams[team]?.weekly?.[pay]?.[person.uid]||null;if(row&&(row.uid!==person.uid||row.payDate!==pay||row.teamKey&&row.teamKey!==team))fail('주간 자료의 팀원·팀·주차가 일치하지 않습니다.');return row?clone(row):null;}),saved=records.filter(Boolean),performance=saved.filter(r=>api.payType(r)==='performance'),weekStats=pays.map(pay=>{if(!person.teamPays[pay])return {sales:0,days:0};const period=api.week(pay),dates=Object.entries(datesByUid[person.uid]||{}).filter(([date])=>period.sd<=date&&date<=period.ed);return {sales:dates.reduce((n,[,r])=>n+r.count,0),days:dates.length};}),weekly=weekStats.map(x=>x.sales),sales=weekly.reduce((n,v)=>n+v,0),fieldDays=weekStats.reduce((n,v)=>n+v.days,0),income=saved.reduce((n,r)=>n+(number(r.netPayment??(api.payType(r)==='hourly'?r.hourlyPay:null),false)||0),0),rejects=performance.reduce((n,r)=>n+count(r.rejectSWCount)+count(r.rejectCLCount),0),resubmits=performance.reduce((n,r)=>n+api.resubmits(r),0),last=performance.slice().sort((a,b)=>b.payDate.localeCompare(a.payDate))[0],bond=last?number(last.bondBalance,true):null;return {uid:person.uid,name:person.name,role:person.role,weeklyFieldDays:weekStats.map(x=>x.days),fieldDays,sales,income,rejects,resubmits,rejectRate:api.rejectRate(rejects,resubmits,sales),bond,bondKnown:bond!==null,weekly,records,savedWeeks:saved.length,hourlyWeeks:saved.length-performance.length,performanceWeeks:performance.length,payLabel:saved.length===performance.length?'성과 '+performance.length:!performance.length?'시급 '+saved.length:'혼합',bep:0};});
  rows=rows.filter(r=>input.uid||r.fieldDays||r.sales||r.savedWeeks).sort(api.sortPeople||((a,b)=>a.name.localeCompare(b.name,'ko')));
  const records=rows.flatMap(r=>r.records.filter(Boolean)),weeklySales=pays.map((_,i)=>rows.reduce((n,r)=>n+r.weekly[i],0)),weeklyRejects=pays.map((_,i)=>rows.reduce((n,r)=>{const x=r.records[i];return n+(x?Math.max(0,(api.payType(x)==='hourly'?0:count(x.rejectSWCount)+count(x.rejectCLCount))-api.resubmits(x)):0);},0)),weeklyIncome=pays.map((_,i)=>rows.reduce((n,r)=>n+(r.records[i]?number(r.records[i].netPayment??r.records[i].hourlyPay,false)||0:0),0));
  const totals=api.finalize({fieldDays:rows.reduce((n,r)=>n+r.fieldDays,0),sales:rows.reduce((n,r)=>n+r.sales,0),income:rows.reduce((n,r)=>n+r.income,0),rejects:rows.reduce((n,r)=>n+r.rejects,0),resubmits:rows.reduce((n,r)=>n+r.resubmits,0),bond:rows.reduce((n,r)=>n+(r.bond||0),0),bondKnown:rows.every(r=>r.bondKnown),hourlyWeeks:rows.reduce((n,r)=>n+r.hourlyWeeks,0),performanceWeeks:rows.reduce((n,r)=>n+r.performanceWeeks,0),weekly:weeklySales});let cumulative=0;
  return {meta,period:meta.period,pays,rows,records,totals,weeklySales,weeklyRejects,weeklyIncome,cumulativeSales:weeklySales.map(v=>cumulative+=v),source:'canonical-authorized-snapshot'};
 }
 return Object.freeze({create,aggregate,identity,stable,periodMembers});
});
