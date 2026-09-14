(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PresenceWorkspaceCore = factory();
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  function dateKey(date) { return new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date || new Date()); }
  function parse(s) { return new Date(s + 'T12:00:00+09:00'); }
  function add(s,n) { const d=parse(s); d.setUTCDate(d.getUTCDate()+n); return dateKey(d); }
  function monday(s) { const d=parse(s),dow=new Date(d.getTime()+9*3600000).getUTCDay(); return add(s,dow===0?-6:1-dow); }
  function period(kind,today) {
    today=today||dateKey(); let start=today,end=today,previousStart,previousEnd;
    if(kind==='week'){start=monday(today);end=add(start,6);previousStart=add(start,-7);previousEnd=add(start,-1);}
    else if(kind==='month'){start=today.slice(0,7)+'-01';const d=parse(start);d.setUTCMonth(d.getUTCMonth()+1);end=add(dateKey(d),-1);d.setUTCMonth(d.getUTCMonth()-2);previousStart=dateKey(d);previousEnd=add(start,-1);}
    else if(kind==='year'){start=today.slice(0,4)+'-01-01';end=today.slice(0,4)+'-12-31';previousStart=(Number(today.slice(0,4))-1)+'-01-01';previousEnd=(Number(today.slice(0,4))-1)+'-12-31';}
    else{previousStart=add(today,-1);previousEnd=previousStart;}
    const elapsed=Math.round((parse(today)-parse(start))/86400000);
    return {kind,start,end,cutoff:today<end?today:end,previousStart,previousEnd,previousCutoff:[add(previousStart,elapsed),previousEnd].sort()[0]};
  }
  function validDate(value) { if(!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value||''))return false;try{return dateKey(parse(value))===value;}catch(e){return false;} }
  function reportPeriod(kind,selected,today) {
    today=today||dateKey();selected=validDate(selected)?selected:today;if(selected>today)selected=today;
    const range=period(kind,selected),current=period(kind,today),isCurrent=range.start===current.start;
    return {...range,cutoff:range.end<today?range.end:today,previousCutoff:isCurrent?current.previousCutoff:range.previousEnd,isCurrent};
  }
  function shiftPeriod(kind,selected,offset,today) {
    const range=reportPeriod(kind,selected,today),start=range.start;
    if(kind==='day'||kind==='week')return add(start,offset*(kind==='week'?7:1));
    const d=parse(start);if(kind==='month')d.setUTCMonth(d.getUTCMonth()+offset);else d.setUTCFullYear(d.getUTCFullYear()+offset);
    return dateKey(d);
  }
  function aggregate(records,names,start,end,isWork) {
    const wanted=new Set(names),by=new Map();
    Object.values(records||{}).forEach(e=>{if(!e||!wanted.has(e.name)||e.date<start||e.date>end)return;
      const key=e.name+'|'+e.date,old=by.get(key);if(!old||Number(e.t||0)>Number(old.t||0))by.set(key,e);
    });
    let sales=0,days=0;const members={};by.forEach(e=>{const valid=isWork?isWork(e):!e.na&&!e.rally&&!e.cleared&&(e.checked===true||Number(e.count)>0);if(!valid)return;days++;const value=Math.max(0,Number(e.count)||0);sales+=value;members[e.name]=members[e.name]||{sales:0,days:0};members[e.name].sales+=value;members[e.name].days++;});
    return {sales,days,avg:days?sales/days:null,members};
  }
  function pendingSubmissions(members,records,date,isRecorded,isBeforeStart) {
    const latest=new Map();Object.values(records||{}).forEach(e=>{if(!e||e.date!==date)return;const old=latest.get(e.name);if(!old||Number(e.t||0)>=Number(old.t||0))latest.set(e.name,e);});
    return (members||[]).filter(m=>m&&m.name&&!(isBeforeStart&&isBeforeStart(m.name,date))&&!isRecorded(latest.get(m.name)));
  }
  function waterCount(record) { const count=Number(record?.count);return Number.isFinite(count)?Math.max(0,Math.floor(count)):0; }
  function gardenTotal(legacyTotal,legacy,current) { return Math.max(Number(legacyTotal)||0,Object.values(legacy||{}).reduce((n,r)=>n+waterCount(r),0))+Object.values(current||{}).reduce((n,r)=>n+waterCount(r),0); }
  function waterLeaders(users,legacy,current) {
    return Object.values(users||{}).filter(u=>u&&u.uid&&u.status==='active').map(u=>{
      const old=(legacy||{})[u.uid]||{},now=(current||{})[u.uid]||{};
      const time=Math.max(Number(old.t)||0,Number(now.lastWateredAt)||0);
      return {uid:u.uid,name:u.name,count:waterCount(old)+waterCount(now),reachedAt:time>0?time:Infinity};
    }).filter(r=>r.count>0).sort((a,b)=>b.count-a.count||a.reachedAt-b.reachedAt||a.uid.localeCompare(b.uid)).slice(0,3).map((r,i)=>({...r,rank:i+1}));
  }
  function season(today) { const m=Number((today||dateKey()).slice(5,7)); return m>=3&&m<=5?'spring':m>=6&&m<=8?'summer':m>=9&&m<=11?'autumn':'winter'; }
  function canCoach(actor,target,access) { return !!(actor&&actor.status==='active'&&target&&(actor.uid==='admin'||((access||{})[target.uid]||{}).leaderUid===actor.uid)); }
  function allowedUids(actor,users,access) { return Object.values(users||{}).filter(u=>u&&u.status==='active'&&(u.uid===actor.uid||canCoach(actor,u,access))).map(u=>u.uid); }
  function safeText(value,max) { return String(value==null?'':value).trim().slice(0,max||1000); }
  return {dateKey,parse,add,monday,period,validDate,reportPeriod,shiftPeriod,aggregate,pendingSubmissions,waterCount,gardenTotal,waterLeaders,season,canCoach,allowedUids,safeText};
});
