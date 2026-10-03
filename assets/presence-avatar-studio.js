(function(){
  'use strict';
  /* Presence Avatar Studio v4 — 코디(옷) 중심 시스템.
     기존 피부색 리컬러/깃털/분리형 액세서리 방식을 폐지하고,
     원화 품질의 완성형 아바타 9종 중 하나를 고르는 방식으로 단일화한다.
     (메이플스토리식: 고정 캐릭터 + 완성형 룩 선택, 런타임 필터 리컬러 없음) */
  window.__PRESENCE_AVATAR_STUDIO_SINGLE_OWNER=true;
  var ROOT='assets/pets/';
  var OUTFITS=[
    ['scholar','스칼라 조끼'],
    ['cape','포레스트 케이프'],
    ['courier','쿠리어 베레'],
    ['raincoat','옐로 레인코트'],
    ['floral','플로럴 원피스'],
    ['sailor','세일러'],
    ['strawhat','밀짚 모자'],
    ['backpack','익스플로러 백팩'],
    ['scarf','니트 머플러']
  ];
  var OUTFIT_MAP=OUTFITS.reduce(function(o,x){o[x[0]]=x[1];return o;},{});
  var DEFAULT_OUTFIT='scholar';
  function validOutfit(v){return OUTFIT_MAP[v]?v:DEFAULT_OUTFIT;}
  function escapeHtml(s){return String(s==null?'':s).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];});}
  /* 하위호환: 예전 카탈로그를 참조하던 인라인 코드가 있어도 죽지 않도록 빈 값 제공 */
  window.PRESENCE_SHOP_ITEMS={};

  function currentUser(){if(window.me)return window.me;try{return typeof me!=='undefined'?me:null;}catch(e){return null;}}
  function currentState(){if(window.state)return window.state;try{return typeof state!=='undefined'?state:null;}catch(e){return null;}}
  function readLocalProfile(u){if(!u)return null;try{return JSON.parse(localStorage.getItem('presence_pet_'+u.uid)||'null');}catch(e){return null;}}
  function readRememberedProfile(){
    var best=null,bestTime=-1;
    try{
      for(var i=0;i<localStorage.length;i++){
        var key=localStorage.key(i);if(!key||key.indexOf('presence_pet_')!==0)continue;
        var value=JSON.parse(localStorage.getItem(key)||'null');if(!value)continue;
        var time=Number(value.updatedAt||value.adoptedAt||0);
        if(time>=bestTime){best=value;bestTime=time;}
      }
    }catch(e){}
    return best;
  }
  /* 예전 프로필(color/feather/equipped)에서 코디 하나로 마이그레이션 */
  function migrateOutfit(raw){
    if(!raw)return DEFAULT_OUTFIT;
    if(raw.outfit&&OUTFIT_MAP[raw.outfit])return raw.outfit;
    var eq=raw.equipped||{},legacy={
      body_raincoat_0:'raincoat',body_floral_0:'floral',body_swimsuit_0:'sailor',body_leader_0:'scholar',
      raincoat:'raincoat',floral:'floral',swimsuit:'sailor',leader:'scholar'
    };
    var b=eq.body||raw.look;
    if(b&&legacy[b])return legacy[b];
    return DEFAULT_OUTFIT;
  }
  function profile(){
    var u=currentUser(),st=currentState();
    var remote=u&&st&&st.petProfiles&&st.petProfiles[u.uid]||{},local=readLocalProfile(u)||{};
    var raw=u?(Number(local.updatedAt||0)>Number(remote.updatedAt||0)?local:remote):(readRememberedProfile()||{});
    var p=Object.assign({},raw);
    p.uid=u&&u.uid||p.uid;p.name=u&&u.name||p.name||'';
    p.nickname=p.nickname||((p.name||'나')+'의 삐약이');
    p.outfit=validOutfit(p.outfit||migrateOutfit(raw));
    p.schemaVersion=4;
    if(u||raw.outfit||raw.equipped||raw.look){
      try{localStorage.setItem('presence_last_avatar_src',ROOT+'avatar-'+p.outfit+'.png');}catch(e){}
    }
    return p;
  }
  /* 아바타 렌더 — 선택된 코디 원화 이미지 한 장 */
  function art(p,override,context){
    p=p||profile();
    var o=(override&&typeof override==='object'&&override.outfit)?override.outfit:(p&&p.outfit);
    o=validOutfit(o);
    var compact=context==='coop';
    var label=OUTFIT_MAP[o]||o;
    return '<div class="presence-game-pet pgp-avatar '+(compact?'pgp-coop':'')+'" role="img" aria-label="'+escapeHtml(label)+'를 입은 병아리">'+
           '<img class="pgp-master" src="'+ROOT+'avatar-'+o+'.png" alt="" draggable="false"></div>';
  }
  window.presencePetArt=art;window.presenceAvatarProfile=profile;

  function save(p,msg){
    var u=currentUser(),st=currentState();if(!u||!st)return;
    p.updatedAt=Date.now();p.adoptedAt=p.adoptedAt||Date.now();
    st.petProfiles=st.petProfiles||{};st.petProfiles[u.uid]=p;
    try{
      localStorage.setItem('presence_pet_'+u.uid,JSON.stringify(p));
      localStorage.setItem('presence_last_avatar_src',ROOT+'avatar-'+validOutfit(p.outfit)+'.png');
    }catch(e){}
    try{var live=typeof LIVE!=='undefined'?LIVE:window.LIVE,db=typeof DB!=='undefined'?DB:window.DB,test=typeof isTestBot==='function'&&isTestBot(u);
      if(live&&db&&db.set&&!test)db.set('petProfiles/'+u.uid,p);}catch(e){}
    render();
    try{if(window.renderPresencePersonalPet)renderPresencePersonalPet();if(window.renderAnimal)renderAnimal();if(window.renderEntryCostume)renderEntryCostume();}catch(e){}
    if(msg&&window.toast)toast(msg);
  }

  /* 코디 변경 (신규 단일 액션) */
  window.setPresenceOutfit=function(id){var p=profile();var v=validOutfit(id);if(p.outfit===v){return;}p.outfit=v;save(p,'✨ '+(OUTFIT_MAP[v])+' 코디로 갈아입었어요');};
  /* 하위호환 no-op (예전 UI 잔여 onclick 방어) */
  window.setPresencePetColor=function(){};
  window.setPresencePetFeather=function(){};
  window.petShopAction=function(id){if(OUTFIT_MAP[id])window.setPresenceOutfit(id);};

  function ensurePanel(){var panel=document.getElementById('m-petshop');if(panel)return panel;var main=document.querySelector('#app main')||document.querySelector('main');if(!main)return null;panel=document.createElement('div');panel.className='mpanel';panel.id='m-petshop';panel.innerHTML='<div class="wrap ps-shell"></div>';main.appendChild(panel);return panel;}
  function shell(){
    var panel=ensurePanel(),host=panel&&panel.querySelector('.ps-shell');if(!host)return null;
    var complete=host.querySelector('#asStage')&&host.querySelector('#asGrid');
    if(host.dataset.avatarStudio!=='4'||!complete){
      host.removeAttribute('data-inventory');host.dataset.avatarStudio='4';
      host.innerHTML='<div class="avatar-studio-shell"><section class="avatar-stage-card"><div class="as-kicker">MY PRESENCE AVATAR</div><h2 class="as-title" id="asName">나의 삐약이</h2><div class="as-sub">한 마리 · 9가지 코디 무료</div><div class="as-stage" id="asStage"></div><div class="as-summary"><b id="asStageLabel">나의 병아리</b><span id="asOutfitSummary">기본 코디</span></div></section><section class="avatar-wardrobe"><div class="aw-head"><div><h2>Avatar Studio</h2><p>원하는 코디를 골라 입어보세요.<br>언제든 무료로 바꿀 수 있고, 모든 화면(홈 닭장·저니)에 바로 반영돼요.</p></div><span class="aw-free">FREE · 언제든 변경</span></div><div class="aw-grid" id="asGrid"></div></section></div>';
    }
    return host;
  }
  function render(){
    if(!shell()||!currentUser())return;
    var p=profile();
    var name=document.getElementById('asName');if(name)name.textContent=p.nickname;
    var stage=document.getElementById('asStage');if(stage)stage.innerHTML=art(p);
    var summary=document.getElementById('asOutfitSummary');if(summary)summary.textContent=OUTFIT_MAP[p.outfit]||'기본 코디';
    var grid=document.getElementById('asGrid');
    if(grid)grid.innerHTML=OUTFITS.map(function(o){
      var on=p.outfit===o[0];
      return '<article class="aw-item '+(on?'on':'')+'"><div class="aw-preview">'+art(p,{outfit:o[0]})+'</div><div class="aw-info"><div><b>'+escapeHtml(o[1])+'</b></div><button onclick="setPresenceOutfit(\''+o[0]+'\')">'+(on?'입은 중':'입기')+'</button></div></article>';
    }).join('');
  }
  window.renderPetShop=render;

  function patchCoop(){
    var el=document.getElementById('myCoopPet');if(!el||!currentUser())return;
    var p=profile(),sig=[p.nickname,p.outfit].join('|');
    if(el.dataset.avatarSig===sig&&el.querySelector('.pgp-coop'))return;
    el.dataset.avatarSig=sig;el.dataset.quality='studio';
    el.innerHTML='<div class="mcp-name">'+escapeHtml(p.nickname)+'</div><div class="mcp-sprite">'+art(p,null,'coop')+'</div>';
  }
  function boot(){try{render();patchCoop();var b=document.getElementById('animalPetShopBtn');if(b)b.textContent='🎒 Avatar Studio';}catch(e){}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,480);});else setTimeout(boot,480);setInterval(boot,3500);
})();
