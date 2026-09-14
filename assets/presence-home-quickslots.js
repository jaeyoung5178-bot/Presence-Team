(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?'':s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const maxSlots=8;
  let slots=[],loadedUid='',editing=false,dockOpen=false,pickerOpen=false,bound=false,loadSeq=0,remoteLoaded=false,remotePending=false,status='',saveQueue=Promise.resolve();
  const actor=()=>typeof me!=='undefined'?me:null;
  const uid=()=>actor()?.uid||'';
  const meta=()=>typeof TABMETA!=='undefined'?TABMETA:{};
  const localKey=u=>'presence_home_quickslots_'+u;
  const stampKey=u=>localKey(u)+'_updated_at';
  const visible=k=>!!(actor()?.status==='active'&&k!=='home'&&meta()[k]&&typeof tabVisible==='function'&&tabVisible(k));
  const clean=list=>[...new Set(Array.isArray(list)?list:[])].filter(k=>typeof k==='string'&&k!=='home'&&(meta()[k]||['garden','peoplehub','learnhub','profithub','supporthub'].includes(k))).slice(0,maxSlots);
  const online=()=>typeof LIVE!=='undefined'&&LIVE&&window.__firebaseReady&&typeof DB!=='undefined'&&!!DB.update;
  function readLocal(u){try{return {list:clean(JSON.parse(localStorage.getItem(localKey(u))||'[]')),stamp:Number(localStorage.getItem(stampKey(u))||0)||0};}catch(e){return {list:[],stamp:0};}}
  function writeLocal(u,list,stamp){try{localStorage.setItem(localKey(u),JSON.stringify(list));localStorage.setItem(stampKey(u),String(stamp));return true;}catch(e){return false;}}
  function persist(u,list,stamp){
    saveQueue=saveQueue.catch(()=>{}).then(async()=>{
      if(uid()!==u||!online())return;
      try{await DB.update('userPreferences/'+u,{quickSlots:list,quickSlotsUpdatedAt:stamp});if(uid()===u){status='계정에 저장했어요.';render();}}
      catch(e){if(uid()===u){status='이 기기에 저장했어요. 연결 후 다시 동기화합니다.';remoteLoaded=false;render();}}
    });
    return saveQueue;
  }
  function save(){const u=uid();if(!u||actor().status!=='active')return;slots=clean(slots);const stamp=Date.now(),cached=writeLocal(u,slots,stamp);status=cached?'이 기기에 저장했어요.':'기기에 저장하지 못했어요.';if(online()){status='저장 중…';persist(u,slots.slice(),stamp);}else if(cached)status='이 기기에 저장했어요. 연결되면 계정에 동기화합니다.';render();}
  function load(){
    const u=uid();if(!u||actor().status!=='active'){dispose();return;}
    if(loadedUid!==u){loadedUid=u;loadSeq++;slots=readLocal(u).list;editing=false;dockOpen=false;pickerOpen=false;remoteLoaded=false;remotePending=false;status='';if($('hqdSearch'))$('hqdSearch').value='';}
    if(!online()||remoteLoaded||remotePending)return;
    const seq=loadSeq;remotePending=true;
    Promise.all([DB.get('userPreferences/'+u+'/quickSlots'),DB.get('userPreferences/'+u+'/quickSlotsUpdatedAt')]).then(values=>{
      if(seq!==loadSeq||u!==uid())return;
      remoteLoaded=true;const local=readLocal(u),remoteStamp=Number(values[1]||0)||0,remote=Array.isArray(values[0])?values[0]:Object.values(values[0]||{});
      if(values[0]!=null&&remoteStamp>=local.stamp){slots=clean(remote);writeLocal(u,slots,remoteStamp);}
      else if(local.stamp>remoteStamp){slots=local.list;persist(u,slots.slice(),local.stamp);}
      render();
    }).catch(()=>{if(seq===loadSeq&&u===uid()){remoteLoaded=false;status='저장된 바로가기를 이 기기에서 불러왔어요.';render();}}).finally(()=>{if(seq===loadSeq)remotePending=false;});
  }
  function ensure(){
    const host=document.querySelector('.mpanel.active>.wrap');if(!host)return null;
    let dock=$('homeQuickDock');
    if(!dock){
      dock=document.createElement('section');dock.id='homeQuickDock';dock.className='home-quick-dock';dock.setAttribute('aria-label','기능 검색과 내 바로가기');
      dock.innerHTML='<div class="hqd-bar"><div class="hqd-search" role="search"><input type="search" id="hqdSearch" aria-label="메뉴와 기능 검색" placeholder="메뉴·기능 검색" autocomplete="off" aria-controls="hqdPopover"><button type="button" id="hqdLaunch" aria-label="기능 검색" aria-expanded="false" aria-controls="hqdPopover"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7"></circle><path d="m16 16 5 5"></path></svg><span>검색</span></button></div><button type="button" class="hqd-add" id="hqdAdd">＋ 바로가기 추가</button></div><div id="hqdSaved"><div class="hqd-saved-head"><span>내 바로가기</span><button type="button" id="hqdEdit">편집</button></div><div id="homeQuickSlots" class="hqd-slots" role="region" aria-label="저장한 바로가기"></div></div><div id="hqdPopover" class="hqd-popover" hidden><div class="hqd-pop-head"><div><b id="hqdTitle">기능 검색</b><span id="hqdHint">메뉴를 검색해서 바로 열어보세요.</span></div><button type="button" id="hqdClose" aria-label="검색과 바로가기 닫기">닫기</button></div><div class="hqd-results" id="hqdResults"></div><div id="quickslotPicker" hidden><div id="quickslotOptions" class="qsm-grid"></div></div></div><p id="hqdStatus" role="status"></p>';
      dock.addEventListener('click',event=>{
        const b=event.target.closest('button');if(!b)return;
        if(b.id==='hqdLaunch')open(false);else if(b.id==='hqdAdd')open(true);else if(b.id==='hqdClose')close(true);else if(b.id==='hqdEdit'){editing=!editing;render();$('hqdEdit')?.focus({preventScroll:true});}
        else if(b.dataset.open)window.openHomeQuickslot(b.dataset.open);
        else if(b.dataset.add){window.addHomeQuickslot(b.dataset.add);const next=[...dock.querySelectorAll('[data-add]')].find(el=>el.dataset.add===b.dataset.add);if(next&&!next.disabled)next.focus({preventScroll:true});else $('hqdSearch')?.focus({preventScroll:true});}
        else if(b.dataset.remove){slots=slots.filter(k=>k!==b.dataset.remove);save();$('hqdEdit')?.focus({preventScroll:true});}
        else if(b.dataset.move){const i=slots.indexOf(b.dataset.move),j=i+Number(b.dataset.direction);if(i>=0&&j>=0&&j<slots.length){[slots[i],slots[j]]=[slots[j],slots[i]];save();[...dock.querySelectorAll('[data-move]')].find(el=>el.dataset.move===b.dataset.move&&el.dataset.direction===b.dataset.direction)?.focus({preventScroll:true});}}
      });
      dock.addEventListener('input',event=>{if(event.target.id==='hqdSearch'){dockOpen=true;render();}});
      dock.addEventListener('focusin',event=>{if(event.target.id==='hqdSearch'&&!dockOpen){dockOpen=true;render();}});
      dock.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close(true);}else if(event.key==='Enter'&&event.target.id==='hqdSearch'){event.preventDefault();if(!pickerOpen){const first=searchList()[0];if(first)window.openHomeQuickslot(first.k);}}});
    }
    if(dock.parentNode!==host||host.firstChild!==dock)host.prepend(dock);
    if(!bound){bound=true;document.addEventListener('click',event=>{if(dockOpen&&document.documentElement.contains(event.target)&&!$('homeQuickDock')?.contains(event.target))close(false);});document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'&&uid()){event.preventDefault();open(false);$('homeQuickDock')?.scrollIntoView({block:'start',behavior:'instant'});}});}
    return dock;
  }
  function searchList(){const q=($('hqdSearch')?.value||'').trim();let list=[];if(typeof hsSearch==='function')list=hsSearch(q).filter(r=>r?.k&&visible(r.k));const found=new Set(list.map(r=>r.k));for(const k of Object.keys(meta()).filter(visible)){if(!found.has(k)&&(!q||(meta()[k].l||k).replace(/\s/g,'').toLowerCase().includes(q.replace(/\s/g,'').toLowerCase())))list.push({k});}return list.slice(0,pickerOpen?200:6);}
  function resultRow(k,picker){const m=meta()[k],on=slots.includes(k),full=slots.length>=maxSlots;return '<div class="hqd-result-row"><button type="button" class="hqd-result-open" data-open="'+esc(k)+'"><i aria-hidden="true">'+esc(m.e||'◆')+'</i><span>'+esc(m.l||k)+'</span></button><button type="button" class="hqd-pin" data-add="'+esc(k)+'" aria-label="'+esc(m.l||k)+' 바로가기 '+(on?'추가됨':'추가')+'" '+(on||full?'disabled':'')+'>'+(on?'추가됨':full?'가득 참':'+ 추가')+'</button></div>';}
  function render(){
    const dock=ensure();if(!dock)return;dock.hidden=!uid()||actor()?.status!=='active';if(dock.hidden)return;
    const visibleSlots=slots.filter(visible),focus=dock.contains(document.activeElement)?document.activeElement.id:'';
    dock.classList.toggle('open',dockOpen);$('hqdLaunch').setAttribute('aria-expanded',String(dockOpen));$('hqdSearch').setAttribute('aria-expanded',String(dockOpen));$('hqdPopover').hidden=!dockOpen;
    $('hqdSaved').hidden=!visibleSlots.length;$('hqdEdit').textContent=editing?'완료':'편집';$('homeQuickSlots').classList.toggle('editing',editing);
    $('homeQuickSlots').innerHTML=visibleSlots.map(k=>{const m=meta()[k],i=slots.indexOf(k);return '<div class="hqd-slot-card"><button type="button" class="hqd-slot" data-open="'+esc(k)+'"><span aria-hidden="true">'+esc(m.e||'◆')+'</span><b>'+esc(m.l||k)+'</b></button>'+(editing?'<div class="hqd-actions"><button type="button" data-move="'+esc(k)+'" data-direction="-1" aria-label="'+esc(m.l)+' 앞으로" '+(i===0?'disabled':'')+'>←</button><button type="button" data-move="'+esc(k)+'" data-direction="1" aria-label="'+esc(m.l)+' 뒤로" '+(i===slots.length-1?'disabled':'')+'>→</button><button type="button" data-remove="'+esc(k)+'" aria-label="'+esc(m.l)+' 바로가기 삭제">×</button></div>':'')+'</div>';}).join('');
    $('hqdTitle').textContent=pickerOpen?'바로가기 추가':'기능 검색';$('hqdHint').textContent=pickerOpen?'자주 쓰는 메뉴를 최대 8개까지 저장하세요.':'메뉴 열기 또는 바로가기 추가를 선택하세요.';
    const list=searchList(),html=list.length?list.map(r=>resultRow(r.k,pickerOpen)).join(''):'<p class="hqd-no-result">찾는 기능이 없어요. 다른 단어로 검색해 주세요.</p>';
    $('hqdResults').hidden=pickerOpen;$('hqdResults').innerHTML=pickerOpen?'':html;$('quickslotPicker').hidden=!pickerOpen;$('quickslotOptions').innerHTML=pickerOpen?html:'';
    $('hqdStatus').textContent=status;$('hqdStatus').hidden=!status;
    if(focus&&$(focus)&&document.activeElement.id!==focus)$(focus).focus({preventScroll:true});
  }
  function open(picker){ensure();load();dockOpen=true;pickerOpen=picker;editing=false;render();$('hqdSearch')?.focus({preventScroll:true});}
  function close(focus){dockOpen=false;pickerOpen=false;render();if(focus)$('hqdLaunch')?.focus({preventScroll:true});}
  function dispose(){loadSeq++;loadedUid='';slots=[];remoteLoaded=false;remotePending=false;dockOpen=false;editing=false;pickerOpen=false;status='';$('homeQuickDock')?.remove();}
  function boot(){ensure();load();render();const old=$('homeSearchBtn');if(old)old.style.setProperty('display','none','important');hookNav();}
  function hookNav(){if(typeof window.goTab!=='function'||window.goTab.__qs)return;const original=window.goTab;window.goTab=function(){const r=original.apply(this,arguments);close(false);boot();return r;};window.goTab.__qs=1;}
  window.toggleHomeQuickDock=()=>open(false);
  window.openHomeQuickslot=k=>{if(!visible(k))return;dockOpen=false;pickerOpen=false;$('hqdSearch').value='';goTab(k);render();};
  window.openQuickslotPicker=()=>open(true);window.closeQuickslotPicker=()=>close(true);
  window.addHomeQuickslot=k=>{if(!visible(k)||slots.includes(k)||slots.length>=maxSlots)return;slots.push(k);save();};
  window.renderHomeQuickSearch=()=>{dockOpen=true;render();};window.runHomeQuickSearch=()=>{const first=searchList()[0];if(first)window.openHomeQuickslot(first.k);};
  window.PresenceQuickAccess={refresh:boot,dispose};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.addEventListener('presence:firebase-ready',boot);setInterval(boot,4000);
})();
