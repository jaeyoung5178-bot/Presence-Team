(function (global) {
  'use strict';

  // Operational counts only: never inspect form values, free text, URLs or device identifiers.
  var FEATURES = Object.freeze({
    home:'홈',tlhome:'TL 홈',teamweeklyrecap:'우리팀 주간리캡',today:'오늘 실행',
    sale:'세일즈',recaplab:'리캡센터',recruitdaily:'리쿠르팅',comp:'컴페티션',perf:'이번달 목표',
    notice:'공지',kakao:'카톡방',net:'네트워킹',act:'액티비티',wins:'Wins',hall:'명예의 전당',
    manual:'매뉴얼',obj:'Objection',training:'트레이닝 가이드',cod:'COD',callback:'콜백싯 작성법',
    topics:'토픽자료',petshop:'아바타',recap:'리캡 자료',calling:'리쿠르팅 관리',
    leaderhit:'리더힛 계산기',cbjournal:'콜백싯',meeting:'미팅룸',field:'필드도구',
    sites:'사이트 관리',daily:'일일 결과',events:'기념일 관리',survey:'설문 관리',
    eventsurvey:'참여조사',gsheet:'개발 연동',salesmgr:'팀 세일즈관리',contacts:'팀원 연락처',
    teamtree:'팀트리',setupkit:'셋업 비서',rejectnote:'리젝노트',admin:'관리',
    peoplehub:'People',corevalues:'코어밸류',journey:'성장 여정',oneonone:'1:1',
    adminusage:'팀 이용 현황',hubic:'외부 IC 매니저 열기',hubsetup:'외부 셋업 도구 열기'
  });
  var IDLE = 30 * 60 * 1000, DEBOUNCE = 30000, HEARTBEAT = 60000, CAP = 2000;
  var tracker = null, mounted = new Map();
  var timestamp = function () { return {'.sv':'timestamp'}; };
  var increment = function (n) { return {'.sv':{increment:n}}; };
  function dayOf(t) {
    return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
  }
  function dayIndex(t) { return Math.floor((t+32400000)/86400000); }
  function dayKey(t) { return String(dayIndex(t)); }
  function datesFor(days,now) {
    var d=dayOf(now),end=Date.parse(d+'T00:00:00+09:00'),out=[];
    for(var i=days-1;i>=0;i--)out.push(dayOf(end-i*86400000));
    return out;
  }
  function validUid(uid) { return typeof uid==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(uid); }
  function key() {
    try { return global.crypto.randomUUID().replace(/-/g,''); }
    catch (_) { return 's'+Date.now().toString(36)+Math.random().toString(36).slice(2,14); }
  }
  function createTracker(env) {
    env=env||{};
    var actor=env.actor,uid=actor&&actor.uid,clock=env.now||Date.now,store=env.storage;
    var timer=null,busy=false,stopped=false,lastWrite=0,current='',memory=null,pending=new Map();
    function active() {
      var a;
      try { a=typeof env.getActor==='function'?env.getActor():null; }
      catch (_) { return false; }
      return !stopped&&validUid(uid)&&a&&a.uid===uid&&a.status==='active'&&
        !(a.test||a.obs)&&(!env.canTrack||env.canTrack(a)===true);
    }
    function loadLocal() {
      try { var raw=store&&store.getItem('presence_usage_v1_'+uid);return raw?JSON.parse(raw):memory; }
      catch (_) { return memory; }
    }
    function saveLocal(s) {
      memory=s;
      try { if(store)store.setItem('presence_usage_v1_'+uid,JSON.stringify(s)); } catch (_) {}
    }
    function session(now) {
      var s=loadLocal(),day=dayKey(now);
      if(!s||s.v!==1||!/^[A-Za-z0-9_-]{8,64}$/.test(s.sid||'')||s.day!==day||
        !Number.isFinite(s.lastActivity)||now-s.lastActivity>=IDLE||now<s.lastActivity-10000) {
        s={v:1,sid:key(),day:day,lastActivity:now,featureAt:{}};
      }
      s.featureAt=s.featureAt&&typeof s.featureAt==='object'?s.featureAt:{};
      s.lastActivity=now;saveLocal(s);return s;
    }
    function enqueue(s,feature) {
      var path='presenceUsageDays/'+s.day+'/'+uid+'/'+s.sid;
      var row=pending.get(path)||{path:path,sid:s.sid,day:s.day,pages:0,features:{}};
      if(feature&&row.pages<CAP){row.pages++;row.features[feature]=Math.min(CAP,(row.features[feature]||0)+1);}
      pending.set(path,row);
    }
    function schedule() {
      if(timer||busy||!active()||!pending.size)return;
      var wait=Math.max(0,HEARTBEAT-(clock()-lastWrite));
      timer=(env.setTimeout||global.setTimeout)(function(){timer=null;flush();},wait);
    }
    async function flush() {
      if(!active()||busy||!pending.size||!env.db||typeof env.db.update!=='function')return;
      busy=true;lastWrite=clock();
      var batch=Array.from(pending.values());pending.clear();
      try {
        for(var row of batch) {
          if(!active())break;
          // Do not write a previous day's queued counts under a fresh server timestamp.
          if(row.day!==dayKey(clock()))continue;
          var patch={v:1,dayIndex:Number(row.day),lastSeen:timestamp(),pageViews:increment(row.pages)};
          Object.keys(row.features).forEach(function(f){if(Object.hasOwn(FEATURES,f))patch['features/'+f]=increment(row.features[f]);});
          // Firebase queues this atomic update when offline; do not add a timeout/retry that could double-count it.
          await env.db.update(row.path,patch);
          if(!active())break;
        }
      } catch (_) {
        // Analytics is optional. A denied or unavailable write must never block navigation or forms.
      } finally { busy=false;if(active())schedule(); }
    }
    function trackFeature(feature) {
      if(!active()||!Object.hasOwn(FEATURES,feature))return false;
      if(env.isVisible&&env.isVisible()===false)return false;
      var now=clock(),s=session(now),last=Number(s.featureAt[feature])||0;current=feature;
      if(last&&now-last<DEBOUNCE)return false;
      s.featureAt[feature]=now;saveLocal(s);enqueue(s,feature);schedule();return true;
    }
    function activity() {
      if(!active()||(env.isVisible&&env.isVisible()===false))return;
      var now=clock(),old=loadLocal();
      if(old&&now-old.lastActivity<1000)return;
      var s=session(now);
      if(!old||s.sid!==old.sid){if(current)trackFeature(current);else{enqueue(s);schedule();}}
      else if(now-lastWrite>=HEARTBEAT){enqueue(s);schedule();}
    }
    function stop() {
      stopped=true;pending.clear();
      if(timer)(env.clearTimeout||global.clearTimeout)(timer);timer=null;
    }
    return Object.freeze({trackFeature:trackFeature,activity:activity,flush:flush,stop:stop,isActive:active});
  }
  function start(env) {
    env=env||{};
    if(tracker&&tracker.uid===env.actor?.uid&&tracker.api.isActive())return tracker.api;
    stop();
    var storage=null;try{storage=global.localStorage;}catch(_){}
    var api=createTracker(Object.assign({storage:storage,isVisible:function(){return !global.document?.hidden;}},env));
    if(!api.isActive())return null;
    var handler=function(e){if(e.isTrusted)api.activity();},visibility=function(){if(global.document.hidden)api.flush();};
    global.document?.addEventListener('pointerdown',handler,{capture:true,passive:true});
    global.document?.addEventListener('keydown',handler,{capture:true,passive:true});
    global.document?.addEventListener('visibilitychange',visibility);
    tracker={uid:env.actor.uid,api:api,handler:handler,visibility:visibility};return api;
  }
  function stop() {
    if(tracker){tracker.api.stop();global.document?.removeEventListener('pointerdown',tracker.handler,true);
      global.document?.removeEventListener('keydown',tracker.handler,true);global.document?.removeEventListener('visibilitychange',tracker.visibility);tracker=null;}
    Array.from(mounted.keys()).forEach(unmount);
  }
  function trackFeature(feature) { return tracker?tracker.api.trackFeature(feature):false; }
  function esc(v) { return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function number(n) { return Number(n||0).toLocaleString('ko-KR'); }
  function authorized(env) {
    try { var a=env.getActor?.();return !!a&&a.uid==='admin'&&a.status==='active'&&a.uid===env.actor?.uid&&env.isAdmin?.(a)===true; }
    catch (_) { return false; }
  }
  function safeCount(v) { return Number.isSafeInteger(v)&&v>=0&&v<=CAP?v:0; }
  function usersOf(env) { try { return typeof env.getUsers==='function'?env.getUsers():(env.users||{}); } catch (_) { return {}; } }
  function aggregate(data,days,users) {
    var people=Object.entries(users||{}).filter(function(entry){return validUid(entry[0])&&entry[1]&&entry[1].status==='active'&&!entry[1].test&&!entry[1].obs;}).map(function(entry){return Object.assign({},entry[1],{uid:entry[0]});}),uids=new Set(people.map(function(u){return u.uid;}));
    var allowed=new Set(days),byUid={},daily=days.map(function(d){return {date:d,sessions:0,pages:0};}),byDay={};
    daily.forEach(function(d){byDay[d.date]=d;});
    Object.keys(data||{}).filter(function(d){return allowed.has(d);}).forEach(function(day){
      Object.keys(data[day]||{}).forEach(function(uid){if(!validUid(uid)||!uids.has(uid))return;
        Object.values(data[day][uid]||{}).forEach(function(s){
          if(!s||s.v!==1||s.dayIndex!==dayIndex(Date.parse(day+'T00:00:00+09:00'))||!Number.isFinite(s.lastSeen)||dayOf(s.lastSeen)!==day)return;
          var row=byUid[uid]||(byUid[uid]={uid:uid,sessions:0,pages:0,lastSeen:0,features:{}}),pages=safeCount(s.pageViews);
          row.sessions++;row.pages+=pages;row.lastSeen=Math.max(row.lastSeen,s.lastSeen);byDay[day].sessions++;byDay[day].pages+=pages;
          Object.keys(s.features||{}).forEach(function(f){if(Object.hasOwn(FEATURES,f))row.features[f]=(row.features[f]||0)+safeCount(s.features[f]);});
        });
      });
    });
    var seen=new Set();people.forEach(function(u){seen.add(u.uid);var r=byUid[u.uid]||(byUid[u.uid]={uid:u.uid,sessions:0,pages:0,lastSeen:0,features:{}});r.name=u.name||'이름 확인 필요';r.role=u.role||'';});
    var rows=Object.values(byUid).filter(function(r){return seen.has(r.uid);});
    rows.sort(function(a,b){return b.sessions-a.sessions||b.pages-a.pages||String(a.name).localeCompare(String(b.name),'ko');});
    var features={},sessions=0,pages=0;rows.forEach(function(r){sessions+=r.sessions;pages+=r.pages;Object.keys(r.features).forEach(function(f){features[f]=(features[f]||0)+r.features[f];});});
    return {rows:rows,daily:daily,features:features,sessions:sessions,pages:pages,active:rows.filter(function(r){return r.sessions>0;}).length};
  }
  function bars(features) {
    var rows=Object.entries(features||{}).filter(function(x){return x[1]>0&&Object.hasOwn(FEATURES,x[0]);}).sort(function(a,b){return b[1]-a[1]||a[0].localeCompare(b[0]);}),max=rows[0]?.[1]||1;
    function list(items){return '<ul class="pau-features">'+items.map(function(x){return '<li><div><span>'+esc(FEATURES[x[0]])+'</span><strong>'+number(x[1])+'회</strong></div><span class="pau-bar" aria-hidden="true"><i style="width:'+Math.round(x[1]/max*100)+'%"></i></span></li>';}).join('')+'</ul>';}
    return rows.length?list(rows.slice(0,6))+(rows.length>6?'<details class="pau-more"><summary>다른 기능 '+number(rows.length-6)+'개 보기</summary>'+list(rows.slice(6))+'</details>':''):'<p class="pau-empty">이 기간에 기록된 기능 진입이 없습니다.</p>';
  }
  function chart(daily) {
    var step=daily.length>14?7:1,groups=[];
    for(var i=0;i<daily.length;i+=step){var part=daily.slice(i,i+step);groups.push({label:part[0].date.slice(5).replace('-','/')+(part.length>1?'–'+part.at(-1).date.slice(5).replace('-','/') : ''),value:part.reduce(function(n,d){return n+d.sessions;},0)});}
    var max=Math.max(1,...groups.map(function(g){return g.value;}));
    var labelEvery=groups.length>7?Math.ceil(groups.length/5):1;
    return '<ol class="pau-chart" aria-label="'+(step===1?'일별':'기간별')+' 접속 회차">'+groups.map(function(g,index){return '<li aria-label="'+esc(g.label)+' · '+number(g.value)+'회"><strong>'+number(g.value)+'</strong><span class="pau-chart-track" aria-hidden="true"><i style="height:'+Math.max(2,g.value/max*100)+'%"></i></span><span aria-hidden="true">'+(index%labelEvery===0?esc(g.label.split('–')[0]):'')+'</span></li>';}).join('')+'</ol>';
  }
  function lastSeen(t) { return t?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t)):'기록 없음'; }
  function render(s) {
    if(!authorized(s.env)){unmount(s.host);return;}
    var dates=datesFor(s.days,Date.now()),view=s.view||aggregate({},dates,usersOf(s.env)),rows=view.rows;
    s.host.classList.add('presence-admin-usage');
    s.host.innerHTML='<header class="pau-head"><div><span class="pau-kicker">ADMIN · 이용 현황</span><h2>팀 이용 현황</h2><p>기록이 시작된 이후의 주앱 이용만 표시합니다.</p></div><button type="button" data-pau-reload '+(s.loading?'disabled':'')+'>새로고침</button></header>'+
      '<div class="pau-filters" aria-label="조회 기간">'+[7,30,90].map(function(n){return '<button type="button" data-pau-days="'+n+'" aria-pressed="'+(s.days===n)+'">최근 '+n+'일</button>';}).join('')+'<span>'+esc(dates[0].replace(/-/g,'.'))+' – '+esc(dates.at(-1).replace(/-/g,'.'))+'</span></div>'+
      '<p class="pau-status" role="status">'+esc(s.loading?'이용 기록을 불러오는 중입니다.':s.error?'이용 기록을 불러오지 못했습니다. 새로고침해 주세요.':s.partial?'일부 날짜의 기록을 불러오지 못했습니다. 새로고침해 주세요.':'한국시간 기준 · 접속 회차는 30분 비활동 후 다시 시작합니다.')+'</p>'+
      '<div class="pau-metrics"><article><span>이용한 팀원</span><strong>'+number(view.active)+'<small>명</small></strong></article><article><span>접속 회차</span><strong>'+number(view.sessions)+'<small>회</small></strong></article><article><span>기능 진입</span><strong>'+number(view.pages)+'<small>회</small></strong></article></div>'+
      '<div class="pau-overview"><section class="pau-card"><h3>접속 흐름</h3>'+chart(view.daily)+'</section><section class="pau-card"><h3>자주 연 기능</h3>'+bars(view.features)+'</section></div>'+
      '<section class="pau-card pau-members"><div class="pau-section-head"><h3>팀원별 이용</h3><span>이름을 눌러 기능별 기록 확인</span></div>'+
      (rows.length?rows.map(function(r){return '<details class="pau-person"><summary><span class="pau-person-name"><strong>'+esc(r.name)+'</strong><small>'+esc(r.role)+'</small></span><span class="pau-person-count"><small>접속</small><strong>'+number(r.sessions)+'회</strong></span><span class="pau-person-count"><small>기능 진입</small><strong>'+number(r.pages)+'회</strong></span><span class="pau-person-last"><small>최근 접속</small><span>'+esc(lastSeen(r.lastSeen))+'</span></span><span class="pau-caret" aria-hidden="true">⌄</span></summary><div class="pau-person-detail">'+bars(r.features)+'</div></details>';}).join(''):'<p class="pau-empty">표시할 팀원 정보가 없습니다.</p>')+'</section>'+
      '<p class="pau-footnote">입력한 금액·메모·개인 콘텐츠는 수집하지 않습니다. 외부 도구는 열기만 집계하며 도구 안의 활동은 포함하지 않습니다. 기록이 없다는 것은 미사용을 확정하는 뜻이 아닙니다.</p>';
    s.host.onclick=function(e){var b=e.target.closest('button');if(!b||!s.host.contains(b))return;if(b.dataset.pauDays){s.days=Number(b.dataset.pauDays);s.view=null;load(s);}else if(b.hasAttribute('data-pau-reload'))load(s);};
  }
  async function load(s) {
    if(!authorized(s.env))return unmount(s.host);
    var ticket=++s.epoch,days=datesFor(s.days,Date.now()),data={},failed=0,index=0;
    s.loading=true;s.error=false;s.partial=false;render(s);
    function current(){return authorized(s.env)&&s.epoch===ticket&&mounted.has(s.host);}
    async function worker(){while(index<days.length){if(!current())return;var day=days[index++];try{var value=await s.env.db.get('presenceUsageDays/'+dayKey(Date.parse(day+'T00:00:00+09:00')));if(!current())return;if(value&&typeof value==='object')data[day]=value;}catch(_){if(!current())return;failed++;}}}
    if(typeof s.env.db.getUsageDays==='function'){
      try{
        var values=await s.env.db.getUsageDays(dayKey(Date.parse(days[0]+'T00:00:00+09:00')),dayKey(Date.parse(days.at(-1)+'T00:00:00+09:00')));
        if(!current())return;
        days.forEach(function(day){var value=values?.[dayKey(Date.parse(day+'T00:00:00+09:00'))];if(value&&typeof value==='object')data[day]=value;});
      }catch(_){if(!current())return;failed=days.length;}
    }else await Promise.all(Array.from({length:Math.min(4,days.length)},worker));
    if(!authorized(s.env)||s.epoch!==ticket||!mounted.has(s.host))return;
    s.loading=false;s.error=failed===days.length;s.partial=failed>0&&!s.error;
    s.view=aggregate(data,days,usersOf(s.env));render(s);
  }
  function mount(host,env) {
    if(typeof host==='string')host=global.document?.getElementById(host);
    if(!host)return;
    unmount(host);
    if(!authorized(env||{})){host.replaceChildren();return;}
    var s={host:host,env:env,days:7,epoch:0,loading:false,view:null};mounted.set(host,s);load(s);
    return function(){unmount(host);};
  }
  function unmount(host) {var s=mounted.get(host);if(s){s.epoch++;s.view=null;s.env=null;mounted.delete(host);}if(host){host.onclick=null;host.replaceChildren();host.classList.remove('presence-admin-usage');}}
  var api=Object.freeze({start:start,stop:stop,trackFeature:trackFeature,mount:mount,unmount:unmount,features:FEATURES,
    createTracker:createTracker,aggregate:aggregate,datesFor:datesFor,dayOf:dayOf,dayIndex:dayIndex,dayKey:dayKey});
  global.PresenceAdminUsage=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
