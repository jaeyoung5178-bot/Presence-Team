// Pure VM regressions for the actual index birthday helpers/renderEvents.
// No browser, network, database reads/writes, or production source edits.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const base=path.join(__dirname,'..'),html=fs.readFileSync(path.join(base,'index.html'),'utf8'),cloud=fs.readFileSync(path.join(base,'assets/presence-birthday-cloud.js'),'utf8');
const names=['bdayMD','birthdayKstDateKey','todayMD','tomorrowMD','birthdaysOn','upcomingBdays'];
const helpers=names.map(name=>{const line=html.split('\n').find(l=>l.startsWith('function '+name+'('));assert(line,'Actual index helper missing '+name);return line;}).join('\n');
const renderStart=html.indexOf('function renderEvents(){'),renderEnd=html.indexOf('\nfunction ',renderStart+1);assert(renderStart>=0&&renderEnd>renderStart);const render=html.slice(renderStart,renderEnd);
let checks=0;
for(const useHelper of [true,false]){
 let stamp=0;class ClockDate extends Date{constructor(...args){super(...(args.length?args:[stamp]));}static now(){return stamp;}}
 const birthday=(name,birth6,status='active')=>({name,status,surveys:{fixture:{answers:{birth6}}}}),nodes={weekBdays:{innerHTML:''}};
 const context=vm.createContext({window:{},Date:ClockDate,Intl,TODAY:'2026-11-09',state:{users:{park:birthday('박인선','2000-11-10'),newYear:birthday('새해 팀원','2000-01-01'),leap:birthday('윤일 팀원','2000-02-29'),inactive:birthday('비활성','2000-11-10','inactive')},events:[]},document:{getElementById:id=>nodes[id]||null},esc:x=>String(x),console});
 if(useHelper)vm.runInContext(cloud,context);vm.runInContext(helpers+'\n'+render,context);
 function at(iso,today,tomorrow,name,distance){stamp=Date.parse(iso);assert.equal(context.birthdayKstDateKey(),today);assert.equal(context.todayMD(),today.slice(5));assert.equal(context.tomorrowMD(),tomorrow.slice(5));const found=Array.from(context.upcomingBdays(3)).find(r=>r.name===name);assert(found,iso+' upcoming target');assert.equal(found.in,distance);context.renderEvents();assert(!nodes.weekBdays.innerHTML.includes('비활성'));if(distance===0){assert.match(nodes.weekBdays.innerHTML,/<span class="ev-d soon">오늘<\/span>/);assert(!nodes.weekBdays.innerHTML.includes('D-2'));}checks++;}
 at('2026-11-09T14:59:59.999Z','2026-11-09','2026-11-10','박인선',1);
 at('2026-11-09T15:00:00.000Z','2026-11-10','2026-11-11','박인선',0);
 at('2026-11-09T15:18:55.000Z','2026-11-10','2026-11-11','박인선',0);
 at('2026-12-31T14:59:59.999Z','2026-12-31','2027-01-01','새해 팀원',1);
 at('2026-12-31T15:00:00.000Z','2027-01-01','2027-01-02','새해 팀원',0);
 at('2028-02-28T14:59:59.999Z','2028-02-28','2028-02-29','윤일 팀원',1);
 at('2028-02-28T15:00:00.000Z','2028-02-29','2028-03-01','윤일 팀원',0);
 assert.equal(context.TODAY,'2026-11-09','Frozen global TODAY unchanged');console.log('PASS '+(useHelper?'actual cloud helper':'Intl fallback')+' KST midnight/current/year/leap/today labels');
}
console.log('PASS '+checks+' actual-index KST cases; frozen TODAY ignored for birthdays; no DB/network calls.');
