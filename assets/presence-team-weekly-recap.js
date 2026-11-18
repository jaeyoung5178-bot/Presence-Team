(function(root){
  'use strict';
  const sessions=new WeakMap();
  function dateKey(now=Date.now()){return new Date(Number(now)+32400000).toISOString().slice(0,10);}
  function addDays(date,n){return new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);}
  function previousWeek(now=Date.now()){const today=dateKey(now),day=new Date(today+'T00:00:00Z').getUTCDay(),monday=addDays(today,-((day+6)%7));return {start:addDays(monday,-7),end:addDays(monday,-1)};}
  function allowed(actor){return !!actor&&actor.status==='active'&&['TL','AOP','OP','O'].includes(actor.role);}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function number(v){return typeof v==='number'&&Number.isFinite(v)?v:null;}
  function summarize(env,period,rate,overrides={}){
    if(!allowed(env.actor))return {denied:true,rows:[]};
    const policy=env.calcPolicy||{},unit=number(policy.unit)??110000,factor=number(policy.factor)??1,bondRate=number(policy.bondRate)??.45;
    const members=(env.members||[]).filter(m=>m&&m.name&&!m.terminated),by=new Map(members.map(m=>[m.name,{...m,sales:0,days:new Set(),recorded:new Set()}]));
    const cells=new Map();
    for(const [key,e] of Object.entries(env.sales||env.state?.sales||{}).sort(([a],[b])=>a.localeCompare(b))){
      if(!e||!by.has(e.name))continue;const person=by.get(e.name);if(e.uid&&e.uid!==person.uid)continue;
      const cell=e.name+'|'+e.date,prior=cells.get(cell),stamp=Number(e.updatedAt||e.t)||0;
      if(!prior||stamp>prior.stamp)cells.set(cell,{e,stamp,conflict:false});
      else if(stamp===prior.stamp&&((Number(e.count)||0)!==(Number(prior.e.count)||0)||!!e.na!==!!prior.e.na||!!e.rally!==!!prior.e.rally||!!e.checked!==!!prior.e.checked||!!e.cleared!==!!prior.e.cleared))prior.conflict=true;
    }
    for(const cell of cells.values()){
      if(cell.conflict){by.get(cell.e.name).conflict=true;continue;}const e=cell.e;
      const row=e&&by.get(e.name);if(!row||row.currentOnly||!e.date||e.date<period.start||e.date>period.end)continue;
      if(row.firstField&&e.date<row.firstField||row.left&&e.date>=row.left)continue;
      if(typeof env.beforeFirstField==='function'&&env.beforeFirstField(e.name,e.date))continue;
      if(typeof env.isActiveOn==='function'&&!env.isActiveOn(row,e.date))continue;
      const recorded=typeof env.isRecorded==='function'?env.isRecorded(e):!e.cleared&&(e.checked===true||Number(e.count)>0||e.na||e.rally);
      if(recorded)row.recorded.add(e.date);
      const work=typeof env.countsAsWork==='function'?env.countsAsWork(e):recorded&&!e.na&&!e.rally;
      if(!work)continue;const count=Number(e.count);if(!Number.isFinite(count)||count<0)continue;
      row.sales+=count;row.days.add(e.date);
    }
    const rows=[...by.values()].filter(r=>r.days.size>0).map(r=>({...r,days:r.days.size,recorded:r.recorded.size,status:'recorded'}));
    rows.forEach(r=>{r.rate=number(overrides[r.uid||r.name])??rate;});
    const sales=rows.reduce((s,r)=>s+r.sales,0),days=rows.reduce((s,r)=>s+r.days,0),expectedRejects=rows.reduce((s,r)=>s+r.sales*r.rate/100,0);
    const raw=rows.map(r=>r.sales*(1-r.rate/100)*unit*factor),target=Math.round(raw.reduce((s,v)=>s+v,0)),base=raw.map(Math.floor);
    let remaining=target-base.reduce((s,v)=>s+v,0);raw.map((v,i)=>({i,remainder:v-base[i]})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i).slice(0,remaining).forEach(v=>base[v.i]++);
    const cashTarget=Math.round(target*(1-bondRate)),cashRaw=base.map(v=>v*(1-bondRate)),cashBase=cashRaw.map(Math.floor);cashRaw.map((v,i)=>({i,remainder:v-cashBase[i]})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i).slice(0,cashTarget-cashBase.reduce((s,v)=>s+v,0)).forEach(v=>cashBase[v.i]++);
    rows.forEach((r,i)=>{r.expectedRejects=r.sales*r.rate/100;r.estimate=r.days?base[i]:null;r.cash=r.days?cashBase[i]:null;r.bond=r.days?base[i]-cashBase[i]:null;r.avg=r.days?r.sales/r.days:null;});
    return {rows,sales,days,participants:rows.filter(r=>r.days).length,avg:days?sales/days:null,expectedRejects:days?expectedRejects:null,estimate:days?target:null,cash:days?cashTarget:null,bond:days?target-cashTarget:null,gross:days?Math.round(sales*unit*factor):null,bondRate,rate,unit,label:policy.label||'리젝 차감 후 총액',policyNote:policy.note||'세일즈 1건당 110,000원 · 예상지급 55% / 본드 45% · 실제 입금액이 아닌 시뮬레이션'};
  }
  function render(host,env){
    if(!host)return;const prior=sessions.get(host),sessionKey=env.actor?.uid+'|'+(env.selectedTeam||env.config?.teamKey||'')+'|'+previousWeek(env.now??Date.now()).start,state=prior&&prior.actor===sessionKey?prior:{actor:sessionKey,rate:30,overrides:{}};sessions.set(host,state);
    if(!allowed(env.actor)){host.replaceChildren();return;}
    if(env.sourceStatus&&env.sourceStatus!=='ready'){host.innerHTML='<section class="ptwr"><button type="button" data-weekly-back>← TL Home</button><h1>우리팀 주간리캡</h1><p role="status">'+(env.sourceStatus==='error'?'실적을 불러오지 못했습니다. 원본 연결 상태를 확인해 주세요.':'팀 실적을 불러오는 중입니다.')+'</p></section>';host.querySelector('button').onclick=()=>env.back?.();return;}
    const retainedInputs=state===prior?[...host.querySelectorAll('input')]:[],expanded=new Set([...host.querySelectorAll('details[open]')].map(el=>el.dataset.person)),period=previousWeek(env.now??Date.now()),data=summarize(env,period,state.rate,state.overrides),money=v=>v===null?'—':Math.round(v).toLocaleString('ko-KR')+'원',fmt=v=>v===null?'—':Number(v.toFixed(2)).toLocaleString('ko-KR');
    host.innerHTML='<section class="ptwr"><header><button type="button" data-weekly-back>← TL Home</button><p>우리팀 주간리캡</p><h1>'+esc(env.teamName||env.config?.teamName||'우리 팀')+' · 지난주</h1><div class="ptwr-period">'+period.start+' ~ '+period.end+'</div></header><p class="ptwr-intro">완료된 직전 월요일~일요일 실적입니다. 이번 주가 끝날 때까지 같은 기간을 표시합니다.</p><div class="ptwr-metrics"><article><span>필드일</span><strong>'+data.days+'일</strong></article><article><span>세일즈</span><strong>'+fmt(data.sales)+'건</strong></article><article><span>AVG</span><strong>'+fmt(data.avg)+'</strong></article><article><span>'+esc(data.label)+'</span><strong>'+money(data.estimate)+'</strong></article></div><section class="ptwr-controls"><label for="ptwrRate">예상 리젝률 <strong>'+state.rate+'%</strong></label><input id="ptwrRate" type="range" min="0" max="100" step="1" value="'+state.rate+'"><p>예상 리젝 '+fmt(data.expectedRejects)+'건 · '+esc(data.policyNote)+'</p></section><div class="ptwr-table" tabindex="0" role="region" aria-label="팀원별 주간 실적, 좌우로 스크롤"><table><thead><tr><th>팀원</th><th>필드일</th><th>세일즈</th><th>AVG</th><th>예상 리젝</th><th>'+esc(data.label)+'</th></tr></thead><tbody>'+data.rows.map(r=>'<tr><th>'+esc(r.name)+'<small>'+esc(r.status==='before-first'?'첫 필드 전':r.status==='missing'?'미입력':r.status==='non-field'?'필드 기록 없음':'')+'</small></th><td>'+(r.days?r.days+'일':'—')+'</td><td>'+(r.days?fmt(r.sales)+'건':'—')+'</td><td>'+fmt(r.avg)+'</td><td>'+(r.days?fmt(r.expectedRejects)+'건':'—')+'</td><td>'+money(r.estimate)+'</td></tr>').join('')+'</tbody></table></div><p class="ptwr-note">저장된 원본을 변경하지 않습니다. 0건 제출과 미입력은 구분합니다. 예상액은 팀 합계 기준 반올림 후 원 단위로 배분합니다.</p></section>';
    host.querySelector('header p').textContent='팀트리 기준 · '+(env.teamName||env.config?.teamName||'우리 팀');
    if(env.teamOptions?.length>1){host.querySelector('header').insertAdjacentHTML('beforeend','<label class="ptwr-team">팀 선택 <select aria-label="조회할 팀">'+env.teamOptions.map(o=>'<option value="'+esc(o.key)+'" '+(o.key===env.selectedTeam?'selected':'')+' '+(o.disabled?'disabled':'')+'>'+esc(o.label)+'</option>').join('')+'</select></label>');host.querySelector('.ptwr-team select').onchange=e=>env.onSelectTeam?.(e.target.value);}
    host.querySelector('h1').textContent='우리팀 주간리캡';
    host.querySelector('.ptwr-metrics article span').textContent='합산 필드일수 · 참여 '+data.participants+'명';
    if(!data.days){host.querySelectorAll('.ptwr-metrics article strong').forEach(el=>{el.textContent='—';});host.querySelector('.ptwr-metrics article span').textContent='합산 필드일수 · 기록 입력 대기';host.querySelector('.ptwr-intro').insertAdjacentText('beforeend',' 필드 실적 입력을 기다리고 있습니다.');}
    const breakdown=(total,cash,bond,gross)=>{const original=gross===undefined?total:gross,pct=v=>original>0?v/original*100:0,reject=original===null?null:original-total;return '<div class="ptwr-split"><div class="ptwr-stack" role="img" aria-label="예상지급 '+money(cash)+' · 본드 '+money(bond)+(gross===undefined?'':' · 예상 리젝 '+money(reject))+'"><span style="width:'+pct(cash)+'%"></span><i style="width:'+pct(bond)+'%"></i><em style="width:'+pct(reject)+'%"></em></div><div class="ptwr-split-labels"><span>예상지급 '+Math.round((1-data.bondRate)*100)+'% <b>'+money(cash)+'</b></span><span>본드 '+Math.round(data.bondRate*100)+'% <b>'+money(bond)+'</b></span></div></div>';};
    host.querySelector('.ptwr-metrics').insertAdjacentHTML('afterend','<section class="ptwr-primary"><span>리젝 차감 후 총액</span><strong>'+money(data.estimate)+'</strong>'+breakdown(data.estimate,data.cash,data.bond)+'<p>세일즈 생산성 '+money(data.gross)+' − 예상 리젝 '+(data.gross===null?'—':money(data.gross-data.estimate))+'</p></section>');
    const maxSales=Math.max(1,...data.rows.map(r=>r.sales)),maxAvg=Math.max(1,...data.rows.map(r=>r.avg||0));
    host.querySelector('.ptwr-table').outerHTML='<section class="ptwr-people" aria-label="팀원별 주간 실적">'+data.rows.map((r,i)=>{
      const id='ptwr-person-'+i,key=r.uid||r.name,status=r.currentOnly?'기간별 소속 확인 필요':r.conflict?'중복 기록 충돌 · 해당 날짜 제외':r.status==='before-first'?'첫 필드 전':r.status==='missing'?'미입력':r.status==='non-field'?'필드 기록 없음':'';
      const metric=(label,value,bar)=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd>'+(bar===undefined?'':'<i class="ptwr-mini" style="--fill:'+bar+'%"></i>')+'</div>';
      return '<article class="ptwr-person"><header><h2>'+esc(r.name)+'</h2><small>'+esc(status)+'</small></header><dl>'+metric('필드일',r.days?r.days+'일':'—')+metric('세일즈',r.days?fmt(r.sales)+'건':'—',r.sales/maxSales*100)+metric('AVG',fmt(r.avg),(r.avg||0)/maxAvg*100)+metric('예상 리젝률',r.rate+'%')+metric('예상 리젝',r.days?fmt(r.expectedRejects)+'건':'—')+metric('리젝 후 총액',money(r.estimate))+metric('예상지급액',money(r.cash))+metric('본드',money(r.bond))+'</dl><details data-person="'+esc(key)+'" '+(expanded.has(key)?'open':'')+'><summary>개인 리젝률 조절 · '+r.rate+'%</summary>'+breakdown(r.estimate,r.cash,r.bond)+'<label for="'+id+'">'+esc(r.name)+' 예상 리젝률</label><input id="'+id+'" data-person-rate="'+esc(key)+'" type="range" min="0" max="100" step="1" value="'+r.rate+'"><button type="button" data-reset-rate="'+esc(key)+'">전체 '+state.rate+'% 적용</button></details></article>';
    }).join('')+'</section>';
    host.querySelector('label[for="ptwrRate"]').firstChild.textContent='전체 기본 리젝률 ';
    if(!data.rows.length)host.querySelector('.ptwr-people').innerHTML='<p class="ptwr-empty" role="status">필드기록이 있는 재직자가 없습니다.</p>';
    host.querySelectorAll('.ptwr-person h2').forEach((heading,i)=>{if(data.rows[i].teamLabel)heading.insertAdjacentHTML('beforeend','<span class="ptwr-team-label">'+esc(data.rows[i].teamLabel)+'</span>');});
    host.querySelectorAll('.ptwr-person dt').forEach(el=>{if(el.textContent==='본드')el.textContent='본드 보류';});
    host.querySelectorAll('.ptwr-split-labels span:nth-child(2)').forEach(el=>{el.firstChild.textContent=el.firstChild.textContent.replace('본드 ','본드 보류 ');});
    host.querySelector('.ptwr-primary p').insertAdjacentText('beforeend',' · 리젝을 먼저 차감한 총액을 지급/본드 보류로 나눕니다.');
    const metrics=host.querySelector('.ptwr-metrics'),primary=host.querySelector('.ptwr-primary'),overview=document.createElement('div');overview.className='ptwr-overview';metrics.lastElementChild.remove();metrics.before(overview);overview.append(primary,metrics);
    const controls=[{range:host.querySelector('#ptwrRate'),key:'',rate:state.rate},...data.rows.map((r,i)=>({range:host.querySelector('#ptwr-person-'+i),key:r.uid||r.name,rate:r.rate}))];
    for(const control of controls){const input=control.range;input.step='any';const id=input.id+'Number';input.insertAdjacentHTML('beforebegin','<div class="ptwr-rate-number"><label for="'+id+'">'+(control.key?'개인 리젝률':'전체 기본 리젝률')+'</label><span><input id="'+id+'" type="number" inputmode="decimal" min="0" max="100" step="any" value="'+control.rate+'" aria-describedby="'+id+'Error"> %</span></div><small id="'+id+'Error" role="status" class="ptwr-rate-error"></small>');}
    for(const old of retainedInputs){const next=host.querySelector('#'+old.id);if(next){if(old.type!=='number')old.value=next.value;next.replaceWith(old);if(old.getAttribute('aria-invalid')==='true')host.querySelector('#'+old.id+'Error').textContent='0~100 사이의 리젝률을 입력해 주세요. 마지막 유효값으로 계산합니다.';}}
    host.querySelector('.ptwr-intro').insertAdjacentText('beforeend',' 필드기록이 있는 재직자 기준입니다.');
    host.querySelector('[data-weekly-back]').onclick=()=>env.back?.();
    const update=(key,value)=>{if(key)state.overrides[key]=value;else{state.rate=value;for(const item of controls)if(item.key&&state.overrides[item.key]===undefined){const numeric=host.querySelector('#'+item.range.id+'Number');if(numeric)numeric.value=value;}}};
    const refreshNumbers=()=>{
      const current=summarize(env,period,state.rate,state.overrides);host.querySelector('.ptwr-primary>strong').textContent=money(current.estimate);host.querySelector('.ptwr-primary .ptwr-split').outerHTML=breakdown(current.estimate,current.cash,current.bond);host.querySelector('.ptwr-primary p').textContent='세일즈 생산성 '+money(current.gross)+' − 예상 리젝 '+(current.gross===null?'—':money(current.gross-current.estimate))+' · 리젝을 먼저 차감한 총액을 지급/본드 보류로 나눕니다.';host.querySelector('.ptwr-controls>label strong').textContent=state.rate+'%';host.querySelector('#ptwrRate').value=state.rate;host.querySelector('.ptwr-controls>p').textContent='예상 리젝 '+fmt(current.expectedRejects)+'건 · '+current.policyNote;
      host.querySelectorAll('.ptwr-person').forEach((article,i)=>{const r=current.rows[i];article.querySelectorAll('dl>div').forEach(cell=>{const label=cell.querySelector('dt').textContent,dd=cell.querySelector('dd');if(label==='예상 리젝률')dd.textContent=r.rate+'%';else if(label==='예상 리젝')dd.textContent=fmt(r.expectedRejects)+'건';else if(label==='리젝 후 총액')dd.textContent=money(r.estimate);else if(label==='예상지급액')dd.textContent=money(r.cash);else if(label==='본드 보류')dd.textContent=money(r.bond);});article.querySelector('summary').textContent='개인 리젝률 조절 · '+r.rate+'%';article.querySelector('.ptwr-split').outerHTML=breakdown(r.estimate,r.cash,r.bond);article.querySelector('input[type=range]').value=r.rate;});host.querySelectorAll('.ptwr-split-labels span:nth-child(2)').forEach(el=>{el.firstChild.textContent=el.firstChild.textContent.replace('본드 ','본드 보류 ');});
    };
    for(const control of controls){const range=host.querySelector('#'+control.range.id),numeric=host.querySelector('#'+range.id+'Number');range.oninput=()=>{update(control.key,Number(range.value));numeric.value=range.value;render(host,env);host.querySelector('#'+range.id)?.focus({preventScroll:true});};numeric.oninput=()=>{const value=numeric.valueAsNumber,valid=numeric.value!==''&&Number.isFinite(value)&&value>=0&&value<=100;numeric.setAttribute('aria-invalid',String(!valid));const error=host.querySelector('#'+numeric.id+'Error');if(!valid){error.textContent='0~100 사이의 리젝률을 입력해 주세요. 마지막 유효값으로 계산합니다.';return;}update(control.key,value);error.textContent='';refreshNumbers();};numeric.onblur=()=>{numeric.value=control.key?(state.overrides[control.key]??state.rate):state.rate;numeric.removeAttribute('aria-invalid');host.querySelector('#'+numeric.id+'Error').textContent='';};}
    host.querySelectorAll('[data-reset-rate]').forEach(button=>{button.onclick=()=>{delete state.overrides[button.dataset.resetRate];const control=controls.find(c=>c.key===button.dataset.resetRate);if(control)host.querySelector('#'+control.range.id+'Number').value=state.rate;render(host,env);};});
  }
  root.PresenceTeamWeeklyRecap={render,previousWeek,summarize,allowed,dispose:host=>{if(host){sessions.delete(host);host.replaceChildren();}}};
})(typeof window==='undefined'?globalThis:window);
