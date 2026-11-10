(function (global) {
  'use strict';

  var session = { root: null, actor: null, snapshot: null, actorUid: '', mode: 'admin', onModeChange: null, onNavigate: null };
  var historyBound = false;
  var repairSerial=0,repair={open:false,busy:false,ready:false,message:'',rows:[],inputs:{}};

  function resolveRoot(target) {
    if (!target) return null;
    if (typeof target === 'string') return document.getElementById(target);
    return target && typeof target === 'object' ? target : null;
  }

  function liveActor(options) {
    if (options && Object.prototype.hasOwnProperty.call(options, 'actor')) return options.actor;
    try { return typeof me !== 'undefined' ? me : null; } catch (error) { return null; }
  }

  function liveState(options) {
    if (options && options.state) return options.state;
    try { return typeof state !== 'undefined' && state ? state : (session.snapshot || {}); } catch (error) { return session.snapshot || {}; }
  }

  function currentActor() {
    try { if (typeof me !== 'undefined') return me; } catch (error) {}
    return session.actor;
  }

  function isAuthorized(actor) {
    if (!actor || actor.status !== 'active') return false;
    try {
      if (typeof isFounder === 'function') return !!isFounder(actor);
    } catch (error) {}
    if (global.__previewRole || global.__adminOff) return false;
    return actor.uid === 'admin' || actor.isFounder === true || actor.isAdmin === true || actor.role === 'ADMIN' || actor.role === 'FOUNDER';
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeList(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function values(value) {
    return value && typeof value === 'object' ? Object.keys(value).map(function (key) { return value[key]; }) : [];
  }

  function isTestUser(user) {
    try { if (typeof isTestBot === 'function') return !!isTestBot(user); } catch (error) {}
    return !!(user && user.test === true);
  }

  function approvalRows(snapshot) {
    try {
      if (typeof pendingApprovalUsers === 'function') return safeList(pendingApprovalUsers());
    } catch (error) {}
    return values(snapshot.users).filter(function (user) { return user && user.status === 'pending'; });
  }

  function surveyRows(snapshot) {
    try {
      if (typeof promotionRecords === 'function') {
        return safeList(promotionRecords()).filter(function (record) { return record && record.status === 'pending'; });
      }
    } catch (error) {}
    var rows = [];
    values(snapshot.promotionSurveys).forEach(function (entry) {
      if (!entry || typeof entry !== 'object') return;
      if (entry.status) rows.push(entry);
      else values(entry).forEach(function (record) { if (record) rows.push(record); });
    });
    return rows.filter(function (record) { return record && record.status === 'pending'; });
  }

  function activeRows(snapshot) {
    return values(snapshot.users).filter(function (user) {
      return user && user.status === 'active' && !isTestUser(user);
    });
  }

  function departedCount(snapshot) {
    var names = Object.create(null);
    safeList(snapshot.removedMembers).forEach(function (name) {
      var key = String(name || '').replace(/\s/g, '');
      if (key) names[key] = true;
    });
    Object.keys(snapshot.memberInfo || {}).forEach(function (memberName) {
      var entry = snapshot.memberInfo[memberName];
      if (!entry || !entry.left) return;
      var name = entry.name || entry.memberName || memberName;
      var key = String(name).replace(/\s/g, '');
      if (key) names[key] = true;
    });
    return Object.keys(names).length;
  }

  function badge(count, label) {
    return count > 0
      ? '<span class="pah-badge" aria-label="' + esc(label) + ' ' + count + '건">' + count + '</span>'
      : '<span class="pah-ready" aria-label="' + esc(label) + ' 없음">READY</span>';
  }

  function actionIcon(action){
    var paths={'birthday':'<path d="M4 11h16v10H4zM4 15c2 3 4-3 6 0s4-3 6 0 4-3 4 0M8 11V7m4 4V6m4 5V7M8 4v1m4-3v2m4 0v1"/>','recap-repair':'<path d="M5 8a7 7 0 1 1-1 8M5 3v5h5"/><path d="m9 13 2 2 4-4"/>','survey':'<path d="M8 4H5v17h14V4h-3M9 2h6v4H9zM8 11h8M8 15h6"/>','new-member':'<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 12-5m5-1v8m-4-4h8"/>','permissions':'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6z"/><path d="m8 11 3 3 5-6"/>','departed':'<path d="M10 4H4v16h6m4-12 4 4-4 4m-6-4h14"/>','approvals':'<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 11-6m2 5 3 3 5-6"/>'};
    return '<svg class="pah-action-icon" viewBox="0 0 24 24" aria-hidden="true">'+(paths[action]||paths.permissions)+'</svg>';
  }
  function actionCard(action, code, title, description, meta) {
    return '<button type="button" class="pah-action" data-pah-action="' + action + '">' +
      '<span class="pah-action-top"><span class="pah-action-code" aria-hidden="true"><span class="pah-action-letter">' + code + '</span>'+actionIcon(action)+'</span>' + meta + '</span>' +
      '<span class="pah-action-copy"><strong>' + title + '</strong><small>' + description + '</small></span>' +
      '<span class="pah-action-go" aria-hidden="true">→</span>' +
      '</button>';
  }

  function modeSwitch(mode) {
    return '<div class="pah-mode-switch" role="group" aria-label="Home 화면 전환">' +
      '<button type="button" data-pah-mode="admin" aria-pressed="' + (mode === 'admin' ? 'true' : 'false') + '" class="' + (mode === 'admin' ? 'is-active' : '') + '">Admin Home</button>' +
      '<button type="button" data-pah-mode="general" aria-pressed="' + (mode === 'general' ? 'true' : 'false') + '" class="' + (mode === 'general' ? 'is-active' : '') + '">일반 Home</button>' +
    '</div>';
  }

  function go(name) {
    try {
      if (typeof goTab === 'function') { goTab(name); return true; }
    } catch (error) {}
    if (typeof global.goTab === 'function') { global.goTab(name); return true; }
    return false;
  }

  function historyState(extra) {
    var base = {};
    try {
      if (global.history && global.history.state && typeof global.history.state === 'object') {
        Object.keys(global.history.state).forEach(function (key) { base[key] = global.history.state[key]; });
      }
    } catch (error) {}
    Object.keys(extra || {}).forEach(function (key) { base[key] = extra[key]; });
    return base;
  }

  function markHomeHistory(mode) {
    try {
      if (!global.history || typeof global.history.replaceState !== 'function') return;
      global.history.replaceState(historyState({ presenceAdminHome: mode === 'admin' ? 'home' : 'general', presenceAdminHomeVersion: 1 }), document.title, global.location && global.location.href);
    } catch (error) {}
  }

  function pushDestinationHistory(name) {
    markHomeHistory('admin');
    try {
      if (global.history && typeof global.history.pushState === 'function') {
        global.history.pushState(historyState({ presenceAdminHome: 'destination', presenceAdminHomeDestination: name, presenceAdminHomeVersion: 1 }), document.title, global.location && global.location.href);
      }
    } catch (error) {}
  }

  function navigate(name) {
    pushDestinationHistory(name);
    if (typeof session.onNavigate === 'function') {
      try { session.onNavigate({ from: 'adminhome', to: name }); } catch (error) {}
    }
    return go(name);
  }

  function scrollTarget(selector, focus) {
    var target = null;
    try { target = document.querySelector(selector); } catch (error) {}
    if (!target) return false;
    try {
      var collapsed = typeof target.closest === 'function' ? target.closest('.adm-card.adm-collapsed') : null;
      if (collapsed && collapsed.classList) collapsed.classList.remove('adm-collapsed');
    } catch (error) {}
    var reduce = false;
    try { reduce = !!global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (error) {}
    try { target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center', inline: 'nearest' }); }
    catch (error) { try { target.scrollIntoView(); } catch (ignored) {} }
    if (focus && typeof target.focus === 'function') {
      try { target.focus({ preventScroll: true }); } catch (error) { try { target.focus(); } catch (ignored) {} }
    }
    return true;
  }

  function afterAdmin(selector, focus) {
    navigate('admin');
    var found = scrollTarget(selector, focus);
    if (!found || focus) global.setTimeout(function () { scrollTarget(selector, focus); }, 140);
  }

function repairActorIsCurrent(uid) {
 var actor = currentActor();
 return !!session.root && !!session.actor && session.actor.uid === uid && actor && actor.uid === uid && isAuthorized(actor);
}

function repairSourceValue(branch, name) {
 var key=String(name||'').replace(/\s/g,''),source=branch||{},match=Object.keys(source).find(function(k){return k.replace(/\s/g,'')===key;});
 return match&&source[match]&&typeof source[match]==='object'?source[match]:{};
}

function repairDate(value) {
 return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''))&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
}

function repairDiagnostics(plan) {
 var snapshot=liveState({}),out=[];
 ['conflicts','unresolved'].forEach(function(branch){(Array.isArray(plan&&plan[branch])?plan[branch]:[]).forEach(function(raw){
  if(!raw||typeof raw!=='object')return;
  var row={};['type','uid','name','teamKey','upline','month','payDate'].forEach(function(field){if(typeof raw[field]==='string')row[field]=raw[field].trim().slice(0,180);});
  if(!row.type)return;
  var account=row.uid&&snapshot.users&&snapshot.users[row.uid],name=account&&account.name||row.name||'',dossier=repairSourceValue(snapshot.dossier,name),info=repairSourceValue(snapshot.memberInfo,name);
  row.name=String(name).slice(0,180);row.role=String(account&&account.role||'미확인').slice(0,30);row.upline=String(dossier.upline||row.upline||'미등록').slice(0,180);
  row.join=repairDate(info.join)?info.join:'';row.canApprove=branch==='unresolved'&&row.type==='unapproved-descendant'&&!!row.uid&&['presence','fuse','youngwave'].includes(row.teamKey);
  out.push(row);
 });});
 return out;
}

function repairRepaint(){
 if(!session.root)return;
 render(session.root,{actor:currentActor(),state:liveState({}),mode:session.mode,onModeChange:session.onModeChange,onNavigate:session.onNavigate});
}

async function reviewRecapRepair(message){
 var actor=currentActor();if(!isAuthorized(actor)||!session.actor||actor.uid!==session.actor.uid||repair.busy)return;
 var uid=actor.uid,token=++repairSerial;
 repair.pending=null;repair.open=true;repair.busy=true;repair.ready=false;repair.message='원본을 변경하지 않고 기간 배정과 조직 연결을 확인하고 있습니다.';repairRepaint();
 try{
  if(typeof global.recapStudioPreflightV3!=='function')throw new Error('사전 검증 도구를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
  var plan=await global.recapStudioPreflightV3();
  if(token!==repairSerial||!repairActorIsCurrent(uid))return;
  repair.rows=repairDiagnostics(plan);repair.ready=!!plan&&plan.blocked===false&&!((plan.conflicts||[]).length||(plan.unresolved||[]).length);
  repair.message=(message?message+' ':'')+(repair.ready?'사전 검증을 통과했습니다. 복구 실행은 아래 별도 버튼으로 진행합니다.':'미확인 배정과 충돌을 검토해 주세요. 검토만으로 데이터는 변경되지 않습니다.');
 }catch(error){if(token!==repairSerial||!repairActorIsCurrent(uid))return;repair.rows=[];repair.message=String(error&&error.message||'사전 검증에 실패했습니다.').slice(0,220);}
 finally{if(token===repairSerial&&repairActorIsCurrent(uid)){repair.busy=false;repairRepaint();}}
}

async function approveRecapRepair(index,confirmed){
 var actor=currentActor(),row=repair.rows[index];if(!isAuthorized(actor)||!session.actor||actor.uid!==session.actor.uid||repair.busy||!row||!row.canApprove)return;
 var form=session.root.querySelector('[data-pah-review="'+index+'"]');if(!form)return;
 var start=form.querySelector('[data-pah-from]'),end=form.querySelector('[data-pah-to]');
 end.setCustomValidity(end.value&&end.value<start.value?'종료일은 시작일 이후여야 합니다.':'');
 if(!start.reportValidity()||!end.reportValidity()||!repairDate(start.value)||end.value&&!repairDate(end.value))return;
 var input={uid:row.uid,teamKey:row.teamKey,activeFrom:start.value};if(end.value)input.activeTo=end.value;
 if(!confirmed){stageRepairConfirmation({kind:'approve',actorUid:actor.uid,serial:repairSerial,index:index,input:input,row:{name:row.name,role:row.role}});return;}
 var pending=repair.pending,account=(liveState({}).users||{})[row.uid];
 if(!pending||pending.kind!=='approve'||pending.actorUid!==actor.uid||pending.index!==index||pending.serial!==repairSerial||JSON.stringify(pending.input)!==JSON.stringify(input)||account&&String(account.role||'미확인')!==pending.row.role){repair.pending=null;repair.message='승인 정보가 변경되었습니다. 대상과 기간을 다시 검토해 주세요.';repairRepaint();return;}
 repair.pending=null;
 if(!repairActorIsCurrent(actor.uid))return;
 repair.busy=true;repair.ready=false;repair.message='선택한 기간 배정을 승인하고 있습니다.';repairRepaint();
 try{
  if(typeof global.recapStudioApproveAssignment!=='function')throw new Error('배정 승인 도구를 불러오지 못했습니다.');
  await global.recapStudioApproveAssignment(input);
  if(!repairActorIsCurrent(actor.uid))return;
  repair.busy=false;await reviewRecapRepair('선택한 배정을 승인했습니다.');
 }catch(error){if(repairActorIsCurrent(actor.uid)){repair.busy=false;repair.message=String(error&&error.message||'배정 승인에 실패했습니다.').slice(0,220);repairRepaint();}}
}

async function executeRecapRepair(confirmed){
 var actor=currentActor();if(!isAuthorized(actor)||!session.actor||actor.uid!==session.actor.uid||repair.busy||!repair.ready)return;
 if(!confirmed){stageRepairConfirmation({kind:'migrate',actorUid:actor.uid,serial:repairSerial});return;}
 if(!repair.pending||repair.pending.kind!=='migrate'||repair.pending.actorUid!==actor.uid||repair.pending.serial!==repairSerial)return;
 repair.pending=null;
 if(!repairActorIsCurrent(actor.uid))return;
 repair.busy=true;repair.ready=false;repair.message='승인된 배정의 리캡 복구를 실행하고 있습니다.';repairRepaint();
 try{
  if(typeof global.recapStudioMigrateV3!=='function')throw new Error('복구 도구를 불러오지 못했습니다.');
  var report=await global.recapStudioMigrateV3();
  if(!repairActorIsCurrent(actor.uid))return;
  repair.rows=repairDiagnostics(report);repair.message=report&&!report.blocked?'복구 완료 · '+Math.max(0,Number(report.written)||0)+'건 반영':'복구가 중단되었습니다. 표시된 검토 항목을 확인해 주세요.';
 }catch(error){if(repairActorIsCurrent(actor.uid))repair.message=String(error&&error.message||'복구에 실패했습니다.').slice(0,220);}
 finally{if(repairActorIsCurrent(actor.uid)){repair.busy=false;repairRepaint();}}
}

function repairConfirmationHTML(){
 var pending=repair.pending;if(!pending)return '';
 var subject=pending.kind==='approve'?'<div class="pah-repair-facts"><div><b>승인 대상 / UID</b>'+esc(pending.row.name)+' / '+esc(pending.input.uid)+'</div><div><b>팀 / 현재 직급</b>'+esc(pending.input.teamKey)+' / '+esc(pending.row.role)+'</div><div><b>적용 시작일</b>'+esc(pending.input.activeFrom)+'</div><div><b>적용 종료일</b>'+esc(pending.input.activeTo||'종료일 없음')+'</div></div><p>이 기간의 팀 배정을 승인하면 이후 복구 시 과거 리캡의 포함 범위에 영향을 줍니다. 기존 주간 금액·직급 기록은 이 승인 화면에서 변경하지 않습니다.</p>':'<p>검증을 통과한 배정으로 리캡 복구를 실행합니다. 기존 복구 API의 검증·잠금·감사 기록 절차를 사용합니다.</p>';
 return '<section class="pah-repair-confirm" role="alertdialog" aria-modal="false" aria-labelledby="pahRepairConfirmTitle" tabindex="-1"><h3 id="pahRepairConfirmTitle">'+(pending.kind==='approve'?'기간 배정 최종 확인':'리캡 복구 최종 확인')+'</h3>'+subject+'<div class="pah-repair-controls"><button type="button" data-pah-final>'+(pending.kind==='approve'?'이 기간으로 승인':'복구 실행 확정')+'</button><button type="button" data-pah-cancel>취소</button></div></section>';
}

function stageRepairConfirmation(pending){
 repair.pending=pending;repairRepaint();var button=session.root&&session.root.querySelector('[data-pah-final]');if(button)button.focus();
}

function confirmRecapRepair(){
 var pending=repair.pending;if(!pending||!repairActorIsCurrent(pending.actorUid)||pending.serial!==repairSerial){repair.pending=null;repairRepaint();return;}
 if(pending.kind==='approve')approveRecapRepair(pending.index,true);else executeRecapRepair(true);
}

function repairPanelHTML(actor){
 if(!isAuthorized(actor)||!repair.open)return '';
 var labels={'unapproved-descendant':'기간 배정 승인 필요','descendant-without-uid':'계정 UID 확인 필요','unresolved-upline':'상위 리더 확인 필요','duplicate-name-uid':'이름·UID 중복','ancestry-cycle':'조직 연결 순환','assignment-overlap':'승인 기간 중복'};
 var styles='<style>.pah-repair-confirm{margin:16px 0;padding:18px;border:2px solid #a3c4ed;border-radius:12px;background:#1d2c43}.pah-repair-confirm:focus{outline:2px solid #b7d3f5;outline-offset:3px}.pah-repair{margin-top:24px;padding:22px;border:1px solid #42516b;border-radius:16px;background:#141e2d;color:#e3ebf7;min-width:0}.pah-repair h3{font-size:19px;margin:0 0 8px}.pah-repair p{font-size:13px;line-height:1.65;color:#aebdd3;overflow-wrap:anywhere}.pah-repair-controls{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.pah-repair button{min-height:44px;padding:10px 14px;border:1px solid #627493;border-radius:9px;background:#25354c;color:#e5eefc;font:inherit;cursor:pointer}.pah-repair button:disabled{opacity:.5;cursor:wait}.pah-repair button:focus-visible,.pah-repair input:focus-visible{outline:2px solid #a6c8ff;outline-offset:3px}.pah-repair-list{list-style:none;padding:0;margin:16px 0 0;display:grid;gap:14px}.pah-repair-item{padding:16px;border:1px solid #36455e;border-radius:12px;background:#101925;min-width:0}.pah-repair-item strong{font-size:15px;overflow-wrap:anywhere}.pah-repair-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}.pah-repair-facts div{min-width:0;font-size:13px;line-height:1.6;overflow-wrap:anywhere}.pah-repair-facts b{display:block;color:#8095b5;font-size:11px}.pah-repair-dates{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}.pah-repair label{display:block;font-size:12px;color:#aabbd5}.pah-repair input{display:block;width:100%;min-width:0;min-height:44px;padding:10px;margin-top:7px;box-sizing:border-box;border:1px solid #50617e;border-radius:8px;color:#e3ebf7;background:#0d1522;font:inherit}.pah-repair small{display:block;font-size:12px;line-height:1.65;color:#94a9c7;margin:10px 0}.pah-repair [role=status]{padding:12px;background:#233149;border-radius:9px}@media(max-width:600px){.pah-repair{padding:16px}.pah-repair-facts,.pah-repair-dates{grid-template-columns:1fr}.pah-repair input{font-size:16px}.pah-repair-controls button{flex:1;min-width:0}}</style>';
 var items=repair.rows.map(function(row,index){
  var dates=repair.inputs[row.uid]||{from:row.join,to:''};
  var form=row.canApprove?'<div class="pah-repair-dates"><label>적용 시작일<input type="date" required data-pah-from value="'+esc(dates.from)+'"></label><label>적용 종료일 · 선택<input type="date" data-pah-to value="'+esc(dates.to)+'"></label></div><small>시작일은 회원정보의 입사일 제안입니다. 실제 팀 배정 시작일을 확인하세요. 현재 직급을 과거 승급일로 간주하지 않습니다.</small><button type="button" data-pah-approve="'+index+'"'+(repair.busy?' disabled':'')+'>검토한 기간 배정 승인</button>':'<small>이 항목은 기간 승인으로 해결할 수 없습니다. 원본 계정·조직 연결 또는 충돌한 기간을 먼저 확인해 주세요.</small>';
  return '<li class="pah-repair-item" data-pah-review="'+index+'"><strong>'+esc(labels[row.type]||row.type)+'</strong><div class="pah-repair-facts"><div><b>팀원 / UID</b>'+esc(row.name||'미확인')+' / '+esc(row.uid||'미확인')+'</div><div><b>팀</b>'+esc(row.teamKey||'미확인')+'</div><div><b>현재 직급 · 과거 직급 아님</b>'+esc(row.role)+'</div><div><b>현재 상위 리더</b>'+esc(row.upline)+'</div></div>'+form+'</li>';
 }).join('');
 return styles+'<section class="pah-repair" aria-label="리캡 기간 배정 검토"><h3>리캡 배정 복구 · 검토</h3><p>먼저 읽기 전용 검증으로 막힌 항목을 확인합니다. 배정 승인과 복구 실행은 각각 버튼을 눌러 확정해야 합니다.</p><p role="status" aria-live="polite">'+esc(repair.message)+'</p><div class="pah-repair-controls"><button type="button" data-pah-recheck'+(repair.busy?' disabled':'')+'>변경 없이 다시 검증</button>'+(repair.ready?'<button type="button" data-pah-execute'+(repair.busy?' disabled':'')+'>검증 완료 · 복구 실행</button>':'')+'</div>'+repairConfirmationHTML()+'<ol class="pah-repair-list">'+items+'</ol></section>';
}

function bindRepair(root){
 root.querySelectorAll('[data-pah-final]').forEach(function(button){button.onclick=confirmRecapRepair;});
 root.querySelectorAll('[data-pah-cancel]').forEach(function(button){button.onclick=function(){repair.pending=null;repairRepaint();};});
 var dialog=root.querySelector('.pah-repair-confirm');if(dialog)dialog.onkeydown=function(event){if(event.key==='Escape'){repair.pending=null;repairRepaint();}};
 root.querySelectorAll('[data-pah-recheck]').forEach(function(button){button.onclick=function(){reviewRecapRepair();};});
 root.querySelectorAll('[data-pah-execute]').forEach(function(button){button.onclick=function(){executeRecapRepair(false);};});
 root.querySelectorAll('[data-pah-approve]').forEach(function(button){button.onclick=function(){approveRecapRepair(Number(button.dataset.pahApprove));};});
 root.querySelectorAll('[data-pah-review]').forEach(function(form){var row=repair.rows[Number(form.dataset.pahReview)];if(!row||!row.canApprove)return;var from=form.querySelector('[data-pah-from]'),to=form.querySelector('[data-pah-to]');function update(){to.setCustomValidity('');repair.inputs[row.uid]={from:from.value,to:to.value};if(repair.pending){repair.pending=null;var confirmation=root.querySelector('.pah-repair-confirm');if(confirmation)confirmation.remove();}}from.oninput=update;to.oninput=update;});
}

  function runAction(action) {
    var actor = currentActor();
    if (!isAuthorized(actor) || !session.actor || actor.uid !== session.actor.uid) return;
    if (action === 'birthday') { navigate('events'); return; }
    if (action === 'promotion-campaign') { window.PresencePromotionCampaignController?.openAdmin(); return; }
    if (action === 'recap-repair') { reviewRecapRepair(); return; }
    if (action === 'survey') { navigate('survey'); return; }
    if (action === 'new-member') { afterAdmin('#newMemberIn', true); return; }
    if (action === 'permissions') { afterAdmin('.mem-rows', false); return; }
    if (action === 'departed') { afterAdmin('#departedBody', false); return; }
    if (action === 'approvals') {
      try {
        if (typeof openPendingApprovals === 'function') { openPendingApprovals(); return; }
      } catch (error) {}
      if (typeof global.openPendingApprovals === 'function') { global.openPendingApprovals(); return; }
      afterAdmin('#pendList', false);
    }
  }

  function syncAdminActive(root, active) {
    if (!root || typeof root.closest !== 'function') return;
    var panel = null;
    try { panel = root.closest('#m-home'); } catch (error) {}
    if (!panel || !panel.classList || typeof panel.classList.toggle !== 'function') return;
    panel.classList.toggle('pah-admin-active', active === true);
  }

  function emitMode(root) {
    if (!root) return;
    syncAdminActive(root, session.mode === 'admin');
    root.setAttribute('data-pah-mode', session.mode);
    if (typeof session.onModeChange === 'function') {
      try { session.onModeChange(session.mode); } catch (error) {}
    }
    try {
      if (typeof global.CustomEvent === 'function' && typeof root.dispatchEvent === 'function') {
        root.dispatchEvent(new global.CustomEvent('presence:admin-home-mode', { bubbles: true, detail: { mode: session.mode } }));
      }
    } catch (error) {}
    markHomeHistory(session.mode);
  }

  function handlePopState(event) {
    var marker = event && event.state && event.state.presenceAdminHome;
    if (marker !== 'home') return false;
    var actor = currentActor();
    if (!session.root || !isAuthorized(actor) || !session.actor || actor.uid !== session.actor.uid) return false;
    session.mode = 'admin';
    go('home');
    render(session.root, { actor: actor, state: liveState({}), mode: 'admin', onModeChange: session.onModeChange, onNavigate: session.onNavigate });
    return true;
  }

  function bindHistory() {
    if (historyBound || typeof global.addEventListener !== 'function') return;
    historyBound = true;
    global.addEventListener('popstate', handlePopState);
  }

  function bind(root) {
    root.querySelectorAll('[data-pah-action]').forEach(function (button) {
      button.onclick=function () { runAction(button.dataset.pahAction); };
    });
    root.querySelectorAll('[data-pah-mode]').forEach(function (button) {
      button.addEventListener('click', function () { setMode(button.dataset.pahMode); });
    });
  }

  function clear(root) {
    if (!root) return;
    syncAdminActive(root, false);
    root.innerHTML = '';
    root.hidden = true;
    root.removeAttribute('data-pah-ready');
    root.removeAttribute('data-pah-mode');
  }

  function render(target, options) {
    var root = resolveRoot(target);
    var actor = liveActor(options || {});
    var snapshot = liveState(options || {});
    if (!root) return false;
    var nextUid = actor && actor.uid ? String(actor.uid) : '';
    var changedActor = nextUid !== session.actorUid;
    session.root = root;
    session.actor = actor;
    session.snapshot = snapshot;
    session.actorUid = nextUid;
    session.onModeChange = options && typeof options.onModeChange === 'function' ? options.onModeChange : session.onModeChange;
    session.onNavigate = options && typeof options.onNavigate === 'function' ? options.onNavigate : session.onNavigate;
    if (!isAuthorized(actor)) { repairSerial++;repair.pending=null;clear(root); return false; }
    if (changedActor) {session.mode = 'admin';repairSerial++;repair={open:false,busy:false,ready:false,message:'',rows:[],inputs:{}};}
    if (options && (options.mode === 'admin' || options.mode === 'general')) session.mode = options.mode;

    root.hidden = false;
    root.setAttribute('data-pah-ready', 'true');
    if (session.mode === 'general') {
      root.innerHTML = '<section class="pah-general-shell" aria-label="Home 화면 모드">' +
        '<div><span>HOME VIEW</span><strong>일반 Home을 보고 있습니다</strong><small>관리 업무로 돌아갈 때 Admin Home을 선택하세요.</small></div>' +
        modeSwitch('general') +
      '</section>';
      bind(root);
      emitMode(root);
      return true;
    }

    var approvals = approvalRows(snapshot);
    var surveys = surveyRows(snapshot);
    var active = activeRows(snapshot);
    var departed = departedCount(snapshot);
    var attention = approvals.length + surveys.length;
    var name = esc(actor.name || '관리자');
    var summary = attention
      ? '지금 확인할 운영 항목이 <b>' + attention + '건</b> 있습니다. 필요한 화면으로 바로 이동하세요.'
      : '현재 긴급한 승인 항목은 없습니다. 팀 운영 화면으로 바로 이동할 수 있어요.';

    root.innerHTML = '<section class="pah-shell" aria-labelledby="pahTitle">' +
      '<div class="pah-mode-row"><span>HOME VIEW</span>' + modeSwitch('admin') + '</div>' +
      '<div class="pah-hero">' +
        '<div class="pah-heading">' +
          '<span class="pah-kicker">ADMIN HOME · OPERATIONS</span>' +
          '<h2 id="pahTitle">' + name + '님, 오늘의 운영 흐름입니다</h2>' +
          '<p>' + summary + '</p>' +
        '</div>' +
        '<dl class="pah-summary" aria-label="관리 운영 현황">' +
          '<div><dt><span class="pah-label-default">ACTIVE TEAM</span><span class="pah-label-season">운영 팀</span></dt><dd>' + active.length + '<small>명</small></dd></div>' +
          '<div class="' + (approvals.length ? 'is-alert' : '') + '"><dt><span class="pah-label-default">JOIN APPROVAL</span><span class="pah-label-season">가입 승인</span></dt><dd>' + approvals.length + '<small>건</small></dd></div>' +
          '<div class="' + (surveys.length ? 'is-alert' : '') + '"><dt><span class="pah-label-default">SURVEY QUEUE</span><span class="pah-label-season">설문 대기</span></dt><dd>' + surveys.length + '<small>건</small></dd></div>' +
        '</dl>' +
      '</div>' +
      '<div class="pah-section-head"><div><span>QUICK OPERATIONS</span><h3>자주 쓰는 관리 업무</h3></div><p>한 번의 클릭으로 기존 관리 화면을 엽니다.</p></div>' +
      '<div class="pah-actions" aria-label="관리자 빠른 실행">' +
        actionCard('birthday', 'BD', '기념일 관리', '생일 날짜와 사진을 미리 확인하고 당일 표시를 관리합니다.', '<span class="pah-status">BIRTHDAY</span>') +
        actionCard('promotion-campaign', 'GOAL', '프로모션 관리', '주간 목표와 일별 모금액을 관리합니다.', '<span class="pah-status">AOP</span>') +
        actionCard('recap-repair', 'RX', '리캡 배정 복구', '기간 배정을 변경 없이 검토하고, 확인한 항목만 승인합니다.', '<span class="pah-status">REPAIR</span>') +
        actionCard('survey', 'SV', '설문 보기', '팀원 설문과 승진 응답을 확인합니다.', badge(surveys.length, '대기 설문')) +
        actionCard('new-member', '+', '신입 등록', '새 팀원을 등록하는 입력창으로 이동합니다.', '<span class="pah-status">CREATE</span>') +
        actionCard('permissions', 'AC', '권한 관리', '직급·매니저·섹터 권한을 관리합니다.', '<span class="pah-status">ACCESS</span>') +
        actionCard('departed', 'DP', '퇴사자 관리', '퇴사 기록과 재입사 대상을 관리합니다.', departed ? '<span class="pah-badge" aria-label="퇴사자 ' + departed + '명">' + departed + '</span>' : '<span class="pah-ready">CLEAR</span>') +
        actionCard('approvals', 'OK', '가입 승인', '가입 신청자를 검토하고 승인합니다.', badge(approvals.length, '가입 승인 대기')) +
      '</div>' +
    repairPanelHTML(actor) + '<div id="pahTLWorkspacePermissions"></div></section>';
    bind(root);
    bindRepair(root);
    if(global.PresenceTLWorkspace)global.PresenceTLWorkspace.renderAdmin('pahTLWorkspacePermissions',{actor:actor,state:snapshot,leaders:typeof presenceTLWorkspaceLeaders==='function'?presenceTLWorkspaceLeaders():[],onOpenRegistration:typeof presenceTLWorkspaceOpenRegistration==='function'?presenceTLWorkspaceOpenRegistration:null});
    if(isAuthorized(actor)&&global.PresenceSeason)global.PresenceSeason.mountAdmin(root);
    emitMode(root);
    return true;
  }

  function setMode(mode) {
    var next = mode === 'general' ? 'general' : 'admin';
    var actor = currentActor();
    if (!session.root || !isAuthorized(actor) || !session.actor || actor.uid !== session.actor.uid) return false;
    session.mode = next;
    render(session.root, { actor: actor, state: liveState({}), mode: next, onModeChange: session.onModeChange, onNavigate: session.onNavigate });
    return true;
  }

  function toggle() {
    return setMode(session.mode === 'admin' ? 'general' : 'admin');
  }

  function getMode() { return session.mode; }

  function reset(target) {
    var root = resolveRoot(target) || session.root;
    clear(root);
    repairSerial++;repair={open:false,busy:false,ready:false,message:'',rows:[],inputs:{}};
    session = { root: null, actor: null, snapshot: null, actorUid: '', mode: 'admin', onModeChange: null, onNavigate: null };
  }

  function invalidate() {
    if (!session.root) return false;
    return render(session.root, { actor: currentActor(), state: liveState({}), mode: session.mode, onModeChange: session.onModeChange, onNavigate: session.onNavigate });
  }

  function guardRoute(requested, actor, target) {
    var name = String(requested || '').toLowerCase();
    if (name !== 'adminhome' && name !== 'admin-home') return requested;
    var root = resolveRoot(target) || session.root;
    if (!isAuthorized(actor)) {
      reset(root);
      return 'home';
    }
    if (root) render(root, { actor: actor, state: liveState({}), mode: 'admin', onModeChange: session.onModeChange, onNavigate: session.onNavigate });
    return 'home';
  }

  bindHistory();
  global.PresenceAdminHome = Object.freeze({ render: render, reset: reset, invalidate: invalidate, setMode: setMode, toggle: toggle, getMode: getMode, guardRoute: guardRoute, handlePopState: handlePopState });
})(typeof window !== 'undefined' ? window : this);
