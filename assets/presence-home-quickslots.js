/* ─────────────────────────────────────────────────────────────
   FIX 2026-07-21 · 홈 퀵독(검색 버튼) 무반응 수정
   index.html 본문이 me / TABMETA / state / LIVE / DB 등을 let·const 로
   선언해 window 객체에는 올라가지 않는다. 이 모듈이 window.* 로만 읽어서
   uid() 가 "" , ready() 가 false 를 반환 → render() 조기 return →
   .open 클래스가 붙지 않아 버튼을 눌러도 아무 반응이 없었다.
   classic script 의 최상위 let/const 는 전역 렉시컬 스코프에 존재하므로
   맨몸 식별자로는 조회된다. window → 렉시컬 순으로 폴백한다.
   ───────────────────────────────────────────────────────────── */
function __pg_me(){
  try{ if(typeof window.me!=="undefined"&&window.me!==null) return window.me; }catch(e){}
  try{ if(typeof me!=="undefined") return me; }catch(e){}
  return undefined;
}
function __pg_TABMETA(){
  try{ if(typeof window.TABMETA!=="undefined"&&window.TABMETA!==null) return window.TABMETA; }catch(e){}
  try{ if(typeof TABMETA!=="undefined") return TABMETA; }catch(e){}
  return undefined;
}
function __pg_state(){
  try{ if(typeof window.state!=="undefined"&&window.state!==null) return window.state; }catch(e){}
  try{ if(typeof state!=="undefined") return state; }catch(e){}
  return undefined;
}
function __pg_LIVE(){
  try{ if(typeof window.LIVE!=="undefined"&&window.LIVE!==null) return window.LIVE; }catch(e){}
  try{ if(typeof LIVE!=="undefined") return LIVE; }catch(e){}
  return undefined;
}
function __pg_DB(){
  try{ if(typeof window.DB!=="undefined"&&window.DB!==null) return window.DB; }catch(e){}
  try{ if(typeof DB!=="undefined") return DB; }catch(e){}
  return undefined;
}
function __pg_tabVisible(){
  try{ if(typeof window.tabVisible!=="undefined"&&window.tabVisible!==null) return window.tabVisible; }catch(e){}
  try{ if(typeof tabVisible!=="undefined") return tabVisible; }catch(e){}
  return undefined;
}
function __pg_goTab(){
  try{ if(typeof window.goTab!=="undefined"&&window.goTab!==null) return window.goTab; }catch(e){}
  try{ if(typeof goTab!=="undefined") return goTab; }catch(e){}
  return undefined;
}
function __pg_toast(){
  try{ if(typeof window.toast!=="undefined"&&window.toast!==null) return window.toast; }catch(e){}
  try{ if(typeof toast!=="undefined") return toast; }catch(e){}
  return undefined;
}

(function(){
  'use strict';
  var slots=[],loadedUid='',editing=false,dockOpen=false,pickerOpen=false,maxSlots=8,outsideBound=false,loadSeq=0;
  function e(s){return String(s==null?'':s).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];});}
  function uid(){return __pg_me()&&me.uid||'';}
  function localKey(){return 'presence_home_quickslots_'+uid();}
  function localMetaKey(){return localKey()+'_updated_at';}
  function ready(){return !!(__pg_TABMETA()&&Object.keys(TABMETA).length);}
  function visible(k){try{return k!=='home'&&__pg_TABMETA()&&TABMETA[k]&&(!__pg_tabVisible()||tabVisible(k));}catch(x){return false;}}
  function clean(list){var seen={};return (Array.isArray(list)?list:[]).filter(function(k){if(!visible(k)||seen[k])return false;seen[k]=1;return true;}).slice(0,maxSlots);}
  function save(){var u=uid(),stamp=Date.now();if(!u||!ready())return;slots=clean(slots);try{localStorage.setItem(localKey(),JSON.stringify(slots));localStorage.setItem(localMetaKey(),String(stamp));}catch(x){}try{if(__pg_state()){state.userPreferences=state.userPreferences||{};state.userPreferences[u]=Object.assign({},state.userPreferences[u]||{},{quickSlots:slots.slice(),updatedAt:stamp});}if(__pg_LIVE()&&__pg_DB()&&DB.set){DB.set('userPreferences/'+u+'/quickSlots',slots.slice());DB.set('userPreferences/'+u+'/quickSlotsUpdatedAt',stamp);}}catch(x){}render();}
  function load(){var u=uid();if(!u){loadedUid='';slots=[];return;}if(!ready()||u===loadedUid)return;loadedUid=u;var seq=++loadSeq,localStamp=0;slots=[];try{slots=clean(JSON.parse(localStorage.getItem(localKey())||'[]'));localStamp=Number(localStorage.getItem(localMetaKey())||0)||0;}catch(x){}render();try{if(__pg_LIVE()&&__pg_DB()&&DB.get)Promise.all([DB.get('userPreferences/'+u+'/quickSlots'),DB.get('userPreferences/'+u+'/quickSlotsUpdatedAt')]).then(function(values){if(seq!==loadSeq||u!==uid())return;var remote=values[0],remoteStamp=Number(values[1]||0)||0,remoteWins=Array.isArray(remote)&&(!localStamp||remoteStamp>=localStamp);if(remoteWins){slots=clean(remote);try{localStorage.setItem(localKey(),JSON.stringify(slots));if(remoteStamp)localStorage.setItem(localMetaKey(),String(remoteStamp));}catch(x){}render();}});}catch(x){}}
  function bindOutside(){if(outsideBound)return;outsideBound=true;document.addEventListener('click',function(ev){var dock=document.getElementById('homeQuickDock');if(dockOpen&&dock&&!dock.contains(ev.target)){dockOpen=false;pickerOpen=false;render();}});document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&dockOpen){dockOpen=false;pickerOpen=false;render();}});}
  function ensure(){var home=document.querySelector('#m-home .wrap');if(!home)return null;var dock=document.getElementById('homeQuickDock');if(!dock){dock=document.createElement('section');dock.id='homeQuickDock';dock.className='home-quick-dock';dock.innerHTML='<div class="hqd-bar"><div class="hqd-search" id="hqdSearchWrap"><input id="hqdSearch" placeholder="기능 검색" autocomplete="off" oninput="renderHomeQuickSearch()" onkeydown="homeQuickSearchKey(event)"><button onclick="runHomeQuickSearch()" aria-label="첫 검색 결과 열기">→</button></div><button class="hqd-launch" id="hqdLaunch" onclick="toggleHomeQuickDock(event)" aria-label="검색과 바로가기 열기" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7"></circle><path d="m16 16 5 5"></path></svg></button></div><div class="hqd-popover" id="hqdPopover"><div class="hqd-pop-head"><div><b>QUICK ACCESS</b><span>내가 자주 쓰는 기능</span></div><button class="hqd-edit" id="hqdEdit" onclick="toggleQuickslotEdit()">편집</button></div><div class="hqd-results" id="hqdResults"></div><div class="hqd-slots" id="homeQuickSlots"></div><div class="qsm-inline" id="quickslotPicker"><div class="qsm-inline-head"><b>바로가기 추가</b><button onclick="closeQuickslotPicker()" aria-label="닫기">×</button></div><div class="qsm-grid" id="quickslotOptions"></div></div></div>';home.insertBefore(dock,home.firstChild);}var old=document.getElementById('quickslotModal');if(old)old.remove();bindOutside();return dock;}
  function searchList(){var input=document.getElementById('hqdSearch'),q=(input&&input.value||'').trim(),list=[];if(!q)return list;try{if(typeof hsSearch==='function')list=hsSearch(q).filter(function(r){return r&&r.k&&visible(r.k);});}catch(x){}if(!list.length){var nq=q.toLowerCase().replace(/\s/g,'');Object.keys(__pg_TABMETA()||{}).filter(visible).forEach(function(k){var label=String(TABMETA[k].l||k),nl=label.toLowerCase().replace(/\s/g,'');if(nl.indexOf(nq)>=0)list.push({k:k,score:nl===nq?100:50});});}return list.slice(0,6);}
  function renderSearch(){var box=document.getElementById('hqdResults');if(!box)return;var q=(document.getElementById('hqdSearch')||{}).value||'',list=searchList();box.classList.toggle('show',!!q);box.innerHTML=!q?'':(list.length?list.map(function(r){var m=TABMETA[r.k];return '<button onclick="openHomeQuickslot(\''+r.k+'\')"><i>'+(m.e||'◆')+'</i><span>'+e(m.l||r.k)+'</span><small>열기</small></button>';}).join(''):'<div class="hqd-no-result">찾는 기능이 없어요.</div>');}
  function renderPicker(){var picker=document.getElementById('quickslotPicker'),box=document.getElementById('quickslotOptions');if(!picker||!box)return;picker.classList.toggle('show',pickerOpen);if(!pickerOpen)return;var keys=Object.keys(__pg_TABMETA()||{}).filter(visible);box.innerHTML=keys.map(function(k){var m=TABMETA[k],on=slots.indexOf(k)>=0;return '<button class="qsm-option '+(on?'added':'')+'" '+(on?'disabled':'')+' onclick="addHomeQuickslot(\''+k+'\')"><i>'+(m.e||'◆')+'</i><span>'+e(m.l||k)+'</span><small>'+(on?'추가됨':'+')+'</small></button>';}).join('');}
  function render(){var dock=ensure(),u=uid();if(!dock)return;dock.hidden=!u;if(!u||!ready())return;dock.classList.toggle('open',dockOpen);var launch=document.getElementById('hqdLaunch'),box=document.getElementById('homeQuickSlots'),btn=document.getElementById('hqdEdit');if(launch)launch.setAttribute('aria-expanded',dockOpen?'true':'false');if(!box)return;box.classList.toggle('editing',editing);if(btn){btn.textContent=editing?'완료':'편집';btn.style.visibility=slots.length?'visible':'hidden';}var html=slots.map(function(k,i){var m=TABMETA[k];return '<button class="hqd-slot" onclick="openHomeQuickslot(\''+k+'\')"><span>'+(m.e||'◆')+'</span><b>'+e(m.l||k)+'</b><span class="hqd-actions"><i onclick="event.stopPropagation();moveHomeQuickslot('+i+',-1)">←</i><i onclick="event.stopPropagation();moveHomeQuickslot('+i+',1)">→</i><i onclick="event.stopPropagation();removeHomeQuickslot('+i+')">×</i></span></button>';}).join('');if(slots.length<maxSlots)html+='<button class="hqd-add" onclick="openQuickslotPicker()"><span>＋</span><b>바로가기 추가</b></button>';box.innerHTML=html;renderSearch();renderPicker();}
  window.toggleHomeQuickDock=function(ev){if(ev)ev.stopPropagation();dockOpen=!dockOpen;if(!dockOpen){pickerOpen=false;editing=false;}render();if(dockOpen)setTimeout(function(){var input=document.getElementById('hqdSearch');if(input)input.focus();},30);};
  window.openHomeQuickslot=function(k){if(editing)return;if(visible(k)&&__pg_goTab()){dockOpen=false;pickerOpen=false;goTab(k);render();}};
  window.toggleQuickslotEdit=function(){editing=!editing;render();};
  window.moveHomeQuickslot=function(i,d){var j=i+d;if(j<0||j>=slots.length)return;var t=slots[i];slots[i]=slots[j];slots[j]=t;save();};
  window.removeHomeQuickslot=function(i){slots.splice(i,1);save();};
  window.openQuickslotPicker=function(){dockOpen=true;pickerOpen=true;editing=false;render();};
  window.closeQuickslotPicker=function(){pickerOpen=false;render();};
  window.addHomeQuickslot=function(k){if(!visible(k)||slots.indexOf(k)>=0||slots.length>=maxSlots)return;slots.push(k);save();pickerOpen=slots.length<maxSlots;render();if(__pg_toast())toast('＋ '+(TABMETA[k].l||k)+' 바로가기를 추가했어요');};
  window.renderHomeQuickSearch=renderSearch;
  window.runHomeQuickSearch=function(){var first=searchList()[0];if(first)openHomeQuickslot(first.k);};
  window.homeQuickSearchKey=function(ev){if(ev.key==='Enter'){ev.preventDefault();runHomeQuickSearch();}else if(ev.key==='Escape'){dockOpen=false;pickerOpen=false;render();}};
  function homeButton(){var b=document.getElementById('homeEntryBtn');if(!b)return;b.innerHTML='<span aria-hidden="true">⌂</span><b>Home</b>';b.setAttribute('aria-label','Home으로 이동');b.title='Home';}
  function hideLegacySearch(){var b=document.getElementById('homeSearchBtn');if(b)b.style.setProperty('display','none','important');}
  function boot(){homeButton();ensure();load();render();hideLegacySearch();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,420);});else setTimeout(boot,420);setInterval(boot,4000);
})();
