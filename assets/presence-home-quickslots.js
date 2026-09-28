(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?'':s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const maxSlots=8;
  let slots=[],loadedUid='',editing=false,pickerOpen=false,loadSeq=0,remoteLoaded=false,remotePending=false,status='',saveQueue=Promise.resolve();
  let returnFocus=null,previousOverflow='',bound=false,renderedHome='';
  const actor=()=>typeof me!=='undefined'?me:null;
  const uid=()=>actor()?.uid||'';
  const meta=()=>typeof TABMETA!=='undefined'?TABMETA:{};
  const localKey=u=>'presence_home_quickslots_'+u;
  const stampKey=u=>localKey(u)+'_updated_at';
  const active=()=>!!(uid()&&actor()?.status==='active');
  const visible=k=>!!(active()&&k!=='home'&&meta()[k]&&typeof tabVisible==='function'&&tabVisible(k));
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
  function save(){
    const u=uid();if(!active())return;
    slots=clean(slots);
    const stamp=Date.now(),cached=writeLocal(u,slots,stamp);
    status=cached?'이 기기에 저장했어요.':'기기에 저장하지 못했어요.';
    if(online()){status='저장 중…';persist(u,slots.slice(),stamp);}
    else if(cached)status='이 기기에 저장했어요. 연결되면 계정에 동기화합니다.';
    render();
  }
  function load(){
    const u=uid();if(!active()){if(loadedUid)dispose();return;}
    if(loadedUid!==u){
      close(false);clearDialog();loadedUid=u;loadSeq++;slots=readLocal(u).list;
      editing=false;pickerOpen=false;remoteLoaded=false;remotePending=false;status='';renderedHome='';
      if($('hqdSearch'))$('hqdSearch').value='';
    }
    if(!online()||remoteLoaded||remotePending)return;
    const seq=loadSeq;remotePending=true;
    Promise.all([DB.get('userPreferences/'+u+'/quickSlots'),DB.get('userPreferences/'+u+'/quickSlotsUpdatedAt')]).then(values=>{
      if(seq!==loadSeq||u!==uid())return;
      remoteLoaded=true;
      const local=readLocal(u),remoteStamp=Number(values[1]||0)||0;
      const remote=Array.isArray(values[0])?values[0]:Object.values(values[0]||{});
      if(values[0]!=null&&remoteStamp>=local.stamp){slots=clean(remote);writeLocal(u,slots,remoteStamp);}
      else if(local.stamp>remoteStamp){slots=local.list;persist(u,slots.slice(),local.stamp);}
      render();
    }).catch(()=>{if(seq===loadSeq&&u===uid()){remoteLoaded=false;status='저장된 바로가기를 이 기기에서 불러왔어요.';render();}})
      .finally(()=>{if(seq===loadSeq)remotePending=false;});
  }
  function ensure(){
    const header=document.querySelector('#app .top .bar');
    if(header){
      let launch=$('hqdLaunch');
      if(!launch){
        launch=document.createElement('button');launch.type='button';launch.id='hqdLaunch';launch.className='hqd-header-launch';
        launch.setAttribute('aria-label','기능 검색과 바로가기');launch.setAttribute('aria-haspopup','dialog');launch.setAttribute('aria-controls','hqdDialog');
        launch.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7"></circle><path d="m16 16 5 5"></path></svg><span>검색</span>';
        launch.addEventListener('click',()=>open(false));
      }
      const anchor=$('pwSupportEntry')||header.querySelector('.me-pill');
      if(launch.parentNode!==header||anchor&&launch.nextElementSibling!==anchor)header.insertBefore(launch,anchor||null);
      launch.hidden=!active();
    }
    let dialog=$('hqdDialog');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='hqdDialog';dialog.className='hqd-dialog';dialog.setAttribute('aria-labelledby','hqdTitle');
      dialog.innerHTML='<div class="hqd-dialog-head"><div><h2 id="hqdTitle">기능 검색</h2><p id="hqdHint">메뉴를 검색해서 바로 열어보세요.</p></div><button type="button" id="hqdClose" aria-label="검색과 바로가기 닫기">×</button></div><div class="hqd-dialog-scroll"><label class="hqd-search-label" for="hqdSearch">메뉴와 기능 검색</label><input type="search" id="hqdSearch" placeholder="메뉴·기능 검색" autocomplete="off" aria-controls="hqdResults"><div class="hqd-dialog-actions"><button type="button" id="hqdSearchMode" aria-pressed="true">검색</button><button type="button" id="hqdPickerMode" aria-pressed="false">바로가기</button></div><div id="hqdResults" class="hqd-results"></div><div id="quickslotPicker" hidden><div id="quickslotOptions" class="qsm-grid"></div></div><section id="hqdSaved" aria-label="저장한 바로가기"><div class="hqd-saved-head"><h3>내 바로가기</h3><button type="button" id="hqdEdit">편집</button></div><div id="homeQuickSlots" class="hqd-slots"></div></section><p id="hqdStatus" role="status"></p></div>';
      document.body.appendChild(dialog);
      dialog.addEventListener('click',event=>{
        const b=event.target.closest('button');if(!b)return;
        if(b.id==='hqdClose')close(true);
        else if(b.id==='hqdSearchMode'){pickerOpen=false;editing=false;render();$('hqdSearch')?.focus({preventScroll:true});}
        else if(b.id==='hqdPickerMode'){pickerOpen=true;render();$('hqdSearch')?.focus({preventScroll:true});}
        else if(b.id==='hqdEdit'){editing=!editing;render();$('hqdEdit')?.focus({preventScroll:true});}
        else if(b.dataset.open)window.openHomeQuickslot(b.dataset.open);
        else if(b.dataset.add){window.addHomeQuickslot(b.dataset.add);const next=[...dialog.querySelectorAll('[data-add]')].find(el=>el.dataset.add===b.dataset.add);(next&&!next.disabled?next:$('hqdSearch'))?.focus({preventScroll:true});}
        else if(b.dataset.remove){slots=slots.filter(k=>k!==b.dataset.remove);save();$('hqdEdit')?.focus({preventScroll:true});}
        else if(b.dataset.move){const i=slots.indexOf(b.dataset.move),j=i+Number(b.dataset.direction);if(i>=0&&j>=0&&j<slots.length){[slots[i],slots[j]]=[slots[j],slots[i]];save();[...dialog.querySelectorAll('[data-move]')].find(el=>el.dataset.move===b.dataset.move&&el.dataset.direction===b.dataset.direction)?.focus({preventScroll:true});}}
      });
      dialog.addEventListener('input',event=>{if(event.target.id==='hqdSearch')renderResults();});
      dialog.addEventListener('cancel',event=>{event.preventDefault();close(true);});
      dialog.addEventListener('keydown',event=>{
        if(event.key==='Escape'){event.preventDefault();close(true);return;}
        if(event.key==='Enter'&&event.target.id==='hqdSearch'&&!pickerOpen){event.preventDefault();const first=searchList()[0];if(first)window.openHomeQuickslot(first.k);}
        if(event.key!=='Tab')return;
        const focusable=[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled])')].filter(el=>el.getClientRects().length&&!el.closest('[hidden]'));
        if(!focusable.length)return;
        const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      });
      dialog.addEventListener('close',()=>{document.body.style.overflow=previousOverflow;$('hqdLaunch')?.setAttribute('aria-expanded','false');});
    }
    if(!bound){
      bound=true;
      document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'&&active()){event.preventDefault();open(false);}});
      document.addEventListener('click',event=>{const b=event.target.closest('#pwHomeQuickAccess button[data-open],#pwHomeQuickAccess button[data-all]');if(!b)return;if(b.dataset.open)window.openHomeQuickslot(b.dataset.open);else open(true);});
    }
  }
  function searchList(){
    const q=($('hqdSearch')?.value||'').trim(),seen=new Set(),list=[];
    const add=k=>{if(visible(k)&&!seen.has(k)){seen.add(k);list.push({k});}};
    if(typeof hsSearch==='function')hsSearch(q).forEach(r=>add(r?.k));
    const needle=q.replace(/\s/g,'').toLowerCase();
    for(const k of Object.keys(meta()))if(!q||(meta()[k].l||k).replace(/\s/g,'').toLowerCase().includes(needle))add(k);
    return list;
  }
  function resultRow(k){
    const m=meta()[k],on=slots.includes(k),full=slots.length>=maxSlots;
    return '<div class="hqd-result-row"><button type="button" class="hqd-result-open" data-open="'+esc(k)+'"><i aria-hidden="true">'+esc(m.e||'◆')+'</i><span>'+esc(m.l||k)+'</span></button><button type="button" class="hqd-pin" data-add="'+esc(k)+'" aria-label="'+esc(m.l||k)+' 바로가기 '+(on?'추가됨':'추가')+'" '+(on||full?'disabled':'')+'>'+(on?'추가됨':full?'가득 참':'+ 추가')+'</button></div>';
  }
  function renderResults(){
    const list=searchList(),q=($('hqdSearch')?.value||'').trim();
    const shown=!pickerOpen&&!q?list.slice(0,6):list;
    const html=shown.length?shown.map(r=>resultRow(r.k)).join(''):'<p class="hqd-no-result">찾는 기능이 없어요. 다른 단어로 검색해 주세요.</p>';
    $('hqdResults').innerHTML=pickerOpen?'':html;
    $('quickslotOptions').innerHTML=pickerOpen?html:'';
  }
  function renderHome(){
    const mount=$('pwHomeQuickAccess');if(!mount)return;
    if(!active()){mount.replaceChildren();renderedHome='';return;}
    const available=slots.filter(visible),shown=available.slice(0,3);
    const html=shown.length?
      '<div class="hqd-home-row" role="group" aria-label="내 바로가기">'+shown.map(k=>{const m=meta()[k];return '<button type="button" data-open="'+esc(k)+'" aria-label="'+esc(m.l||k)+' 열기"><span aria-hidden="true">'+esc(m.e||'◆')+'</span>'+esc(m.l||k)+'</button>';}).join('')+'<button type="button" data-all="true" aria-label="전체 바로가기 보기 및 관리">전체'+(available.length>3?' '+available.length:'')+' <span aria-hidden="true">＋</span></button></div>':
      '<div class="hqd-home-empty"><div><strong>내 바로가기</strong><span>자주 쓰는 메뉴를 여기에서 바로 열어보세요.</span></div><button type="button" data-all="true" aria-label="바로가기 추가">＋ 바로가기 추가</button></div>';
    if(renderedHome!==html||mount.innerHTML!==html){mount.innerHTML=html;renderedHome=html;}
  }
  function render(){
    ensure();renderHome();
    const dialog=$('hqdDialog');if(!dialog?.open||!active())return;
    $('hqdTitle').textContent=pickerOpen?'바로가기':'기능 검색';
    $('hqdHint').textContent=pickerOpen?'자주 쓰는 메뉴를 최대 8개까지 저장하세요.':'메뉴 열기 또는 바로가기 추가를 선택하세요.';
    $('hqdSearchMode').setAttribute('aria-pressed',String(!pickerOpen));$('hqdPickerMode').setAttribute('aria-pressed',String(pickerOpen));
    $('hqdResults').hidden=pickerOpen;$('quickslotPicker').hidden=!pickerOpen;
    const saved=$('hqdSaved'),picker=$('quickslotPicker'),statusNode=$('hqdStatus');
    if(pickerOpen&&saved.nextElementSibling!==picker)picker.before(saved);
    else if(!pickerOpen&&saved.nextElementSibling!==statusNode)statusNode.before(saved);
    const visibleSlots=slots.filter(visible);
    $('hqdSaved').hidden=!visibleSlots.length;$('hqdEdit').textContent=editing?'완료':'편집';
    $('homeQuickSlots').classList.toggle('editing',editing);
    $('homeQuickSlots').innerHTML=visibleSlots.map(k=>{const m=meta()[k],i=slots.indexOf(k);return '<div class="hqd-slot-card"><button type="button" class="hqd-slot" data-open="'+esc(k)+'"><span aria-hidden="true">'+esc(m.e||'◆')+'</span><b>'+esc(m.l||k)+'</b></button>'+(editing?'<div class="hqd-actions"><button type="button" data-move="'+esc(k)+'" data-direction="-1" aria-label="'+esc(m.l||k)+' 앞으로" '+(i===0?'disabled':'')+'>←</button><button type="button" data-move="'+esc(k)+'" data-direction="1" aria-label="'+esc(m.l||k)+' 뒤로" '+(i===slots.length-1?'disabled':'')+'>→</button><button type="button" data-remove="'+esc(k)+'" aria-label="'+esc(m.l||k)+' 바로가기 삭제">×</button></div>':'')+'</div>';}).join('');
    renderResults();$('hqdStatus').textContent=status;$('hqdStatus').hidden=!status;
  }
  function open(picker){
    load();if(!active())return;ensure();
    const dialog=$('hqdDialog');if(!dialog)return;
    if(!dialog.open){returnFocus=document.activeElement;previousOverflow=document.body.style.overflow;dialog.showModal();document.body.style.overflow='hidden';}
    pickerOpen=!!picker;editing=false;$('hqdLaunch')?.setAttribute('aria-expanded','true');render();$('hqdSearch')?.focus({preventScroll:true});
  }
  function close(restore){
    const dialog=$('hqdDialog');if(dialog?.open)dialog.close();
    pickerOpen=false;editing=false;document.body.style.overflow=previousOverflow;
    $('hqdLaunch')?.setAttribute('aria-expanded','false');
    if(restore){const target=returnFocus?.isConnected&&returnFocus.getClientRects().length?returnFocus:$('hqdLaunch');target?.focus({preventScroll:true});}
    returnFocus=null;
  }
  function clearDialog(){
    for(const id of ['hqdResults','quickslotOptions','homeQuickSlots'])if($(id))$(id).replaceChildren();
    if($('hqdStatus'))$('hqdStatus').textContent='';
  }
  function dispose(){
    close(false);clearDialog();loadSeq++;loadedUid='';slots=[];remoteLoaded=false;remotePending=false;status='';renderedHome='';
    $('hqdLaunch')?.setAttribute('hidden','');$('pwHomeQuickAccess')?.replaceChildren();
    if($('hqdSearch'))$('hqdSearch').value='';
  }
  function boot(){
    ensure();load();render();
    const old=$('homeSearchBtn');if(old)old.style.setProperty('display','none','important');
    hookNav();
  }
  function hookNav(){
    if(typeof window.goTab!=='function'||window.goTab.__qs)return;
    const original=window.goTab;
    window.goTab=function(){close(false);const r=original.apply(this,arguments);load();render();return r;};window.goTab.__qs=1;
  }
  window.toggleHomeQuickDock=()=>open(false);
  window.openHomeQuickslot=k=>{if(!visible(k))return;close(false);if($('hqdSearch'))$('hqdSearch').value='';goTab(k);render();};
  window.openQuickslotPicker=()=>open(true);window.closeQuickslotPicker=()=>close(true);
  window.addHomeQuickslot=k=>{if(!visible(k)||slots.includes(k)||slots.length>=maxSlots)return;slots.push(k);save();};
  window.renderHomeQuickSearch=()=>{if($('hqdDialog')?.open)render();else open(false);};
  window.runHomeQuickSearch=()=>{const first=searchList()[0];if(first)window.openHomeQuickslot(first.k);};
  window.PresenceQuickAccess={refresh:boot,dispose};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.addEventListener('presence:firebase-ready',boot);
  setInterval(()=>{if(uid()!==loadedUid||active()&&!remoteLoaded&&!remotePending&&online()||active()&&!$('hqdLaunch'))boot();},4000);
})();
