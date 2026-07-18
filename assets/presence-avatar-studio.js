(function(){
  'use strict';
  /* Single ownership contract: legacy inline inventory patches may still exist
     for migration, but they must never replace this renderer or its DOM. */
  window.__PRESENCE_AVATAR_STUDIO_SINGLE_OWNER=true;
  var ROOT='assets/pets/';
  var COLORS=[['honey','허니','#f6cf58'],['vanilla','바닐라','#f8e6b0'],['cream','크림','#e7d2a5'],['peach','피치','#f5b184'],['coral','코랄','#e99780'],['rose','로즈','#dc9eb3'],['lilac','라일락','#b99bd7'],['sky','스카이','#91bddc'],['mint','민트','#96cdb1'],['sage','세이지','#a8bf97'],['silver','실버','#c2c9d1'],['cocoa','코코아','#b28c65']];
  var FEATHERS=[['classic','클래식'],['cloud','클라우드'],['sweep','스윕'],['mohawk','모히칸'],['bob','보브'],['twins','트윈'],['wave','웨이브'],['plume','플룸']];
  var BODY=[['raincoat','레인 코트'],['leader','리더 재킷'],['floral','플로럴 원피스'],['swimsuit','스윔 수트']];
  var HEAD=[['shades','선글라스'],['straw','밀짚모자'],['wig','스타일 헤어']];
  var PROP=[['ball','비치볼'],['tube','스윔 튜브']];
  var WEAPON=[['watergun','워터건'],['sword','히어로 소드'],['wand','스타 완드'],['shield','가디언 실드']];
  var BACK=[['backpack','익스플로러 백팩'],['cape','히어로 케이프']];
  var NECK=[['medal','골드 메달'],['pearls','펄 네크리스']];
  var WRIST=[['friendship','프렌드십 팔찌'],['watch','리더 워치'],['sportband','스포츠 밴드'],['flowers','플라워 팔찌']];
  var FEET=[['rainboots','레인 부츠'],['winged-sneakers','윙 스니커즈'],['hero-boots','히어로 부츠']];
  var WAIST=[['utility-belt','익스플로러 벨트']];
  function escapeHtml(s){return String(s==null?'':s).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];});}
  /* One catalogue entry must represent one genuinely different piece of art.
     A hue filter is a style option, not a new costume.  The previous catalogue
     multiplied the same bitmap into dozens of differently named entries, which
     made the wardrobe look larger without adding any real choice. */
  function addUniqueItems(out,list,cat,desc,file){list.forEach(function(base){var id=cat+'_'+base[0]+'_0';out[id]={id:id,cat:cat,asset:base[0],name:base[1],desc:desc,filter:'none',file:file||'item',artKey:(file||'item')+':'+base[0]};});}
  function makeCatalog(){var out={};addUniqueItems(out,BODY,'body','체형 기준점에 맞춘 일체형 의상');addUniqueItems(out,HEAD,'head','눈·부리·정수리 기준 정밀 장식');addUniqueItems(out,PROP,'prop','날개 위치에 맞춘 놀이 소품');addUniqueItems(out,WEAPON,'weapon','손과 날개에 자연스럽게 잡히는 장비','accessory');addUniqueItems(out,BACK,'back','어깨와 등에 밀착되는 장비','accessory');addUniqueItems(out,NECK,'neck','목선과 가슴 중심에 맞춘 장신구','accessory');addUniqueItems(out,WRIST,'wrist','날개 끝 팔목에 맞춘 장신구','accessory');addUniqueItems(out,FEET,'feet','양 발에 맞춘 게임형 풋웨어','accessory');addUniqueItems(out,WAIST,'waist','아랫배와 허리에 맞춘 벨트','accessory');return out;}
  var ITEMS=makeCatalog();window.PRESENCE_SHOP_ITEMS=ITEMS;
  var COLOR_IDS=COLORS.reduce(function(out,x){out[x[0]]=1;return out;},{});
  var FEATHER_IDS=FEATHERS.reduce(function(out,x){out[x[0]]=1;return out;},{});
  function validColor(value){return COLOR_IDS[value]?value:'honey';}
  function validFeather(value){return FEATHER_IDS[value]?value:'classic';}
  function imageTag(cls,src,fallback){var onerror=fallback?' onerror="if(!this.dataset.fallback){this.dataset.fallback=\'1\';this.src=\''+fallback+'\';}else{this.hidden=true;}"':'';return '<img class="'+cls+'" src="'+src+'" alt="" draggable="false"'+onerror+'>';}
  /* 360° 후면·측면 원화와 신체 접촉면 QA가 끝나지 않은 분리형 액세서리는
     숫자를 채우기 위해 공개하지 않는다. 일체형 품질 게이트를 통과한 코디만 노출한다. */
  function isPublished(item){return !!item&&item.file!=='accessory';}
  function currentUser(){
    if(window.me)return window.me;
    try{return typeof me!=='undefined'?me:null;}catch(e){return null;}
  }
  function currentState(){
    if(window.state)return window.state;
    try{return typeof state!=='undefined'?state:null;}catch(e){return null;}
  }
  function readLocalProfile(u){
    if(!u)return null;
    try{return JSON.parse(localStorage.getItem('presence_pet_'+u.uid)||'null');}catch(e){return null;}
  }
  function normalizeEq(eq){eq=Object.assign({},eq||{});var legacy={leader:'body_leader_0',swimsuit:'body_swimsuit_0',floral:'body_floral_0',raincoat:'body_raincoat_0',shades:'head_shades_0',straw:'head_straw_0',wig:'head_wig_0',ball:'prop_ball_0',tube:'prop_tube_0'},slots=['back','body','neck','waist','head','wrist','feet','prop','weapon'];if(eq.look){var look=legacy[eq.look]||String(eq.look).replace(/_\d+$/,'_0'),lookItem=ITEMS[look];if(lookItem&&!eq[lookItem.cat])eq[lookItem.cat]=look;delete eq.look;}slots.forEach(function(k){if(legacy[eq[k]])eq[k]=legacy[eq[k]];if(eq[k]&&!ITEMS[eq[k]]){var canonical=String(eq[k]).replace(/_\d+$/,'_0');if(ITEMS[canonical])eq[k]=canonical;}if(eq[k]&&(!ITEMS[eq[k]]||!isPublished(ITEMS[eq[k]])))eq[k]='';});/* Existing fitted body+head masters have inconsistent crop/backgrounds. Until a pair passes visual QA, keep the last durable body outfit and avoid rendering a broken composite. */if(eq.body&&eq.head)eq.head='';return eq;}
  function profile(){var u=currentUser(),st=currentState(),remote=u&&st&&st.petProfiles&&st.petProfiles[u.uid]||{},local=readLocalProfile(u)||{},raw=(Number(local.updatedAt||0)>Number(remote.updatedAt||0)?local:remote),p=Object.assign({},raw);p.uid=u&&u.uid||p.uid;p.name=u&&u.name||p.name||'';p.nickname=p.nickname||((p.name||'나')+'의 삐약이');p.color=validColor(p.color);p.feather=validFeather(p.feather);p.schemaVersion=2;p.equipped=normalizeEq(p.equipped);p.owned={};Object.keys(ITEMS).forEach(function(k){p.owned[k]=1;});return p;}
  function itemLayer(item,cls){if(!item)return '';var accessory=item.file==='accessory',file=accessory?'presence-accessory-':'presence-item-',ext=accessory?'.png':'.webp',shadow=accessory?' drop-shadow(0 5px 4px rgba(20,28,36,.2))':'';return '<img class="'+cls+'" src="'+ROOT+file+item.asset+ext+'" alt="" draggable="false" style="filter:'+item.filter+shadow+' !important">';}
  function integratedMaster(body,head){
    var bodies={raincoat:1,leader:1,floral:1,swimsuit:1},heads={shades:1,straw:1,wig:1};
    if(body&&head&&bodies[body.asset]&&heads[head.asset])return ROOT+'presence-fitted-'+body.asset+'-'+head.asset+'.webp';
    if(body&&bodies[body.asset])return ROOT+'presence-pet-'+body.asset+'.webp';
    if(head&&heads[head.asset])return ROOT+'presence-pet-'+head.asset+'.webp';
    return '';
  }
  function art(p,override,context){
    p=p||profile();var eq=normalizeEq(p.equipped),o=override||{},slots=['back','body','neck','waist','head','wrist','feet','prop','weapon'],chosen={};
    slots.forEach(function(k){chosen[k]=o[k]===null?null:(o[k]?ITEMS[o[k]]:ITEMS[eq[k]]);});
    /* A body/head outfit is rendered from one fitted master. Never stack a
       jacket or glasses over the face in the final avatar. This is the hard
       quality gate that keeps collars, sleeves, wings, eyes and beak unified. */
    var master=integratedMaster(chosen.body,chosen.head),integrated=!!master;
    var color=validColor(p.color),tone=(COLORS.find(function(x){return x[0]===color;})||COLORS[0])[2],tint=0,feather=validFeather(p.feather);
    var label=slots.map(function(k){return chosen[k];}).filter(Boolean).map(function(x){return x.name;}).join(', ')||'기본 코디';
    var compact=context==='coop',extra=compact?['neck','waist']:['back','neck','waist','wrist','feet','prop','weapon'];
    var html='<div class="presence-game-pet '+(integrated?'pgp-integrated':'')+' '+(compact?'pgp-coop':'')+'" role="img" aria-label="'+escapeHtml(label)+'를 착용한 병아리" style="--pet-tone:'+tone+';--pet-tint:'+tint+'">';
    if(!compact)html+=itemLayer(chosen.back,'pgp-back');
    html+=imageTag(integrated?'pgp-master':'pgp-base',master||ROOT+'presence-base-'+color+'.png',ROOT+'presence-pet-base.png');
    if(!integrated){html+='<i class="pgp-tone" aria-hidden="true"></i>'+(feather!=='classic'?'<img class="pgp-feather" src="'+ROOT+'presence-feather-'+feather+'.png" alt="" draggable="false">':'')+itemLayer(chosen.body,'pgp-body')+itemLayer(chosen.head,'pgp-head');}
    extra.forEach(function(k){html+=itemLayer(chosen[k],'pgp-'+(k==='weapon'?'weapon':k));});
    return html+'</div>';
  }
  window.presencePetArt=art;window.presenceAvatarProfile=profile;
  function save(p,msg){var u=currentUser(),st=currentState();if(!u||!st)return;p.updatedAt=Date.now();p.adoptedAt=p.adoptedAt||Date.now();st.petProfiles=st.petProfiles||{};st.petProfiles[u.uid]=p;try{localStorage.setItem('presence_pet_'+u.uid,JSON.stringify(p));}catch(e){}try{var live=typeof LIVE!=='undefined'?LIVE:window.LIVE,db=typeof DB!=='undefined'?DB:window.DB,test=typeof isTestBot==='function'&&isTestBot(u);if(live&&db&&db.set&&!test)db.set('petProfiles/'+u.uid,p);}catch(e){}render();try{if(window.renderPresencePersonalPet)renderPresencePersonalPet();if(window.renderAnimal)renderAnimal();if(window.renderEntryCostume)renderEntryCostume();}catch(e){}if(msg&&window.toast)toast(msg);}
  function releasePresetForTrait(p){var eq=normalizeEq(p.equipped),released=!!(eq.body||eq.head);if(released){eq.body='';eq.head='';p.equipped=eq;}return released;}
  window.setPresencePetColor=function(id){var p=profile(),released=releasePresetForTrait(p);p.color=COLORS.some(function(x){return x[0]===id;})?id:'honey';save(p,released?'🎨 색상이 보이도록 프리셋 의상·헤어를 해제하고 바로 적용했어요':'🎨 병아리 색상을 바로 적용했어요');};
  window.setPresencePetFeather=function(id){var p=profile(),released=releasePresetForTrait(p);p.feather=FEATHERS.some(function(x){return x[0]===id;})?id:'classic';save(p,released?'✨ 털 모양이 보이도록 프리셋 의상·헤어를 해제하고 바로 적용했어요':'✨ 새로운 털 모양을 바로 적용했어요');};
  window.petShopAction=function(id){var item=ITEMS[id];if(!item)return;var p=profile(),eq=normalizeEq(p.equipped),on=eq[item.cat]===id;eq[item.cat]=on?'':id;if(!on&&item.cat==='body')eq.head='';if(!on&&item.cat==='head')eq.body='';p.equipped=eq;save(p,!on&&(item.cat==='body'||item.cat==='head')?'✨ 깨지는 겹침 없이 선택한 코디를 일체형으로 적용했어요':'✨ 선택한 아이템이 모든 화면에 반영됐어요');};
  window.__presenceInventoryCat=window.__presenceInventoryCat||'all';window.__presenceInventorySearch='';
  window.setPetShopCat=function(cat){window.__presenceInventoryCat=cat||'all';render();};window.searchPetInventory=function(v){window.__presenceInventorySearch=String(v||'').trim().toLowerCase();renderGrid();};
  function ensurePanel(){var panel=document.getElementById('m-petshop');if(panel)return panel;var main=document.querySelector('#app main')||document.querySelector('main');if(!main)return null;panel=document.createElement('div');panel.className='mpanel';panel.id='m-petshop';panel.innerHTML='<div class="wrap ps-shell"></div>';main.appendChild(panel);return panel;}
  function shell(){var panel=ensurePanel(),host=panel&&panel.querySelector('.ps-shell');if(!host)return null;var complete=host.querySelector('#asStage')&&host.querySelector('#asGrid')&&host.querySelector('#asColors');if(host.dataset.avatarStudio!=='3'||!complete){host.removeAttribute('data-inventory');host.dataset.avatarStudio='3';host.innerHTML='<div class="avatar-studio-shell"><section class="avatar-stage-card"><div class="as-kicker">MY PRESENCE AVATAR</div><h2 class="as-title" id="asName">나의 삐약이</h2><div class="as-sub">한 마리 · 무제한 무료 커스터마이징</div><div class="as-stage" id="asStage"></div><div class="as-summary"><b id="asStageLabel">나의 병아리</b><span id="asOutfitSummary">기본 코디</span></div></section><section class="avatar-wardrobe"><div class="aw-head"><div><h2>Avatar Studio</h2><p>같은 이미지의 이름만 바꾼 항목은 노출하지 않습니다.<br>독립 원화와 착장 검수를 통과한 코디만 선택할 수 있어요.</p></div><span class="aw-free">FREE · 언제든 변경</span></div><div class="avatar-traits"><div class="trait-row"><b class="trait-label">BODY COLOR</b><div class="trait-options" id="asColors"></div></div><div class="trait-row"><b class="trait-label">FEATHER STYLE</b><div class="trait-options" id="asFeathers"></div></div></div><div class="aw-tools"><div class="aw-tabs" id="asTabs"></div><input class="aw-search" id="asSearch" placeholder="아이템 검색" oninput="searchPetInventory(this.value)"></div><div class="aw-grid" id="asGrid"></div></section></div>';}return host;}
  function publishedItems(){return Object.keys(ITEMS).map(function(k){return ITEMS[k];}).filter(isPublished);}
  function renderGrid(){var p=profile(),eq=normalizeEq(p.equipped),cat=window.__presenceInventoryCat||'all',q=window.__presenceInventorySearch||'',grid=document.getElementById('asGrid');if(!grid)return;var list=publishedItems().filter(function(x){return (cat==='all'||x.cat===cat)&&(!q||(x.name+' '+x.desc).toLowerCase().indexOf(q)>=0);});grid.innerHTML=list.length?list.map(function(x){var on=eq[x.cat]===x.id,preview={back:null,body:null,neck:null,waist:null,head:null,wrist:null,feet:null,prop:null,weapon:null};preview[x.cat]=x.id;return '<article class="aw-item '+(on?'on':'')+'"><div class="aw-preview">'+art(p,preview)+'</div><div class="aw-info"><div><b>'+escapeHtml(x.name)+'</b><small>'+escapeHtml(x.desc)+'</small></div><button onclick="petShopAction(\''+x.id+'\')">'+(on?'해제':'착용')+'</button></div></article>';}).join(''):'<div class="aw-empty">검색 결과가 없어요.</div>';}
  function render(){if(!shell()||!currentUser())return;var p=profile(),eq=normalizeEq(p.equipped),name=document.getElementById('asName'),stage=document.getElementById('asStage'),summary=document.getElementById('asOutfitSummary');if(name)name.textContent=p.nickname;if(stage)stage.innerHTML=art(p);var slots=['back','body','neck','waist','head','wrist','feet','prop','weapon'],selected=slots.map(function(k){return ITEMS[eq[k]]&&ITEMS[eq[k]].name;}).filter(Boolean);if(summary)summary.textContent=(COLORS.find(function(x){return x[0]===p.color;})||[])[1]+' · '+(FEATHERS.find(function(x){return x[0]===p.feather;})||[])[1]+(selected.length?' · '+selected.join(' · '):'');var colors=document.getElementById('asColors');if(colors)colors.innerHTML=COLORS.map(function(x){return '<button class="trait-swatch '+(p.color===x[0]?'on':'')+'" style="--swatch:'+x[2]+'" title="'+x[1]+'" onclick="setPresencePetColor(\''+x[0]+'\')"><span>'+x[1]+'</span></button>';}).join('');var feathers=document.getElementById('asFeathers');if(feathers)feathers.innerHTML=FEATHERS.map(function(x){return '<button class="trait-feather '+(p.feather===x[0]?'on':'')+'" onclick="setPresencePetFeather(\''+x[0]+'\')"><img src="'+ROOT+'presence-feather-'+x[0]+'.png" alt=""><small>'+x[1]+'</small></button>';}).join('');var pub=publishedItems(),defs=[['all','전체'],['body','의상'],['head','머리'],['prop','놀이 소품']],cats=defs.map(function(x){var n=x[0]==='all'?pub.length:pub.filter(function(i){return i.cat===x[0];}).length;return [x[0],x[1]+' '+n];}).filter(function(x){return !/ 0$/.test(x[1]);}),tabs=document.getElementById('asTabs');if(tabs)tabs.innerHTML=cats.map(function(x){return '<button class="'+(window.__presenceInventoryCat===x[0]?'on':'')+'" onclick="setPetShopCat(\''+x[0]+'\')">'+x[1]+'</button>';}).join('');var search=document.getElementById('asSearch');if(search&&document.activeElement!==search)search.value=window.__presenceInventorySearch||'';renderGrid();}
  window.renderPetShop=render;
  function patchCoop(){var el=document.getElementById('myCoopPet');if(!el||!currentUser())return;var p=profile(),sig=[p.nickname,p.color,p.feather,p.equipped.body,p.equipped.head,p.equipped.prop].join('|');if(el.dataset.avatarSig===sig&&el.querySelector('.pgp-coop'))return;el.dataset.avatarSig=sig;el.dataset.quality='studio';el.innerHTML='<div class="mcp-name">'+escapeHtml(p.nickname)+'</div><div class="mcp-sprite">'+art(p,null,'coop')+'</div>';}
  function boot(){try{render();patchCoop();var b=document.getElementById('animalPetShopBtn');if(b)b.textContent='🎒 Avatar Studio';}catch(e){}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,480);});else setTimeout(boot,480);setInterval(boot,3500);
})();
