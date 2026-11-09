(function(global){
 'use strict';
 const DAY=86400000,KST=32400000,keys=['version','revision','date','targetUid','displayName','enabled','faceDataUrl','crop','updatedAt','updatedBy'];
 function dateKey(stamp=Date.now()){const d=new Date(Number(stamp)+KST);if(!Number.isFinite(+d))throw Error('날짜를 확인해 주세요.');return d.toISOString().slice(0,10);}
 function windowForDate(date){if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('날짜를 확인해 주세요.');const midnight=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(midnight)||new Date(midnight).toISOString().slice(0,10)!==date)throw Error('날짜를 확인해 주세요.');return {startsAt:midnight-KST,endsAt:midnight-KST+DAY};}
 function isAdmin(actor){return !!actor&&actor.uid==='admin'&&actor.status==='active';}
 function actor(){try{return typeof me!=='undefined'?me:null;}catch{return null;}}
 function admin(){const u=actor();if(!isAdmin(u))throw Error('관리자만 변경할 수 있습니다.');return u;}
 function database(){if(typeof LIVE==='undefined'||!LIVE||!global.__firebaseReady||typeof DB==='undefined'||typeof DB.get!=='function'||typeof DB.update!=='function')throw Error('온라인 워크북 연결을 확인해 주세요.');return DB;}
 function eventId(value){if(typeof value!=='string'||!/^[-A-Za-z0-9_]{1,100}$/.test(value))throw Error('생일 이벤트 ID를 확인해 주세요.');return value;}
 function record(input,previous){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('생일 설정을 확인해 주세요.');const id=eventId(input.eventId);if(previous?.eventId&&previous.eventId!==id)throw Error('이벤트 ID가 변경되었습니다.');
  for(const k of Object.keys(input))if(k!=='eventId'&&!keys.includes(k))throw Error('허용되지 않은 생일 설정 항목입니다.');
  const r=Object.fromEntries(keys.filter(k=>input[k]!==undefined).map(k=>[k,input[k]]));windowForDate(r.date);
  if(r.version!==1||!Number.isInteger(r.revision)||r.revision!==(previous?Number(previous.revision)+1:1))throw Error('생일 설정 버전이 변경되었습니다. 다시 불러와 주세요.');
  if(typeof r.targetUid!=='string'||!r.targetUid||/[.#$\[\]\/]/.test(r.targetUid)||typeof r.displayName!=='string'||!r.displayName||r.displayName.length>100||typeof r.enabled!=='boolean')throw Error('팀원과 공개 여부를 확인해 주세요.');
  if(r.faceDataUrl!==undefined&&(typeof r.faceDataUrl!=='string'||r.faceDataUrl.length>205000||!/^data:image\/webp;base64,UklGR[A-Za-z0-9+/]*={0,2}$/.test(r.faceDataUrl)))throw Error('512px WebP 얼굴 사진을 다시 준비해 주세요.');
  if(r.enabled&&!r.faceDataUrl)throw Error('얼굴 사진을 준비한 뒤 공개해 주세요.');
  if(r.crop!==undefined){if(!r.crop||typeof r.crop!=='object'||Array.isArray(r.crop)||Object.keys(r.crop).sort().join(',')!=='x,y,zoom'||!Number.isFinite(r.crop.zoom)||r.crop.zoom<1||r.crop.zoom>3||!Number.isFinite(r.crop.x)||r.crop.x<0||r.crop.x>1||!Number.isFinite(r.crop.y)||r.crop.y<0||r.crop.y>1)throw Error('사진 크롭 위치를 확인해 주세요.');r.crop={zoom:r.crop.zoom,x:r.crop.x,y:r.crop.y};}
  if(!Number.isInteger(r.updatedAt)||r.updatedAt<Date.now()-300000||r.updatedAt>Date.now()+10000||r.updatedBy!=='admin')throw Error('저장 시각과 관리자 계정을 확인해 주세요.');return {id,config:r};
 }
 function buildAtomicUpdate(input,previous){const {id,config:r}=record(input,previous),updates={['private/admin/'+id]:r};
  if(previous){windowForDate(previous.date);if(previous.date!==r.date||!r.enabled)updates['public/'+previous.date+'/events/'+id]=null;}
  if(r.enabled){const window=windowForDate(r.date),publicRecord=Object.fromEntries(['version','targetUid','displayName','date','faceDataUrl','updatedAt'].map(k=>[k,r[k]]));updates['public/'+r.date+'/startsAt']=window.startsAt;updates['public/'+r.date+'/endsAt']=window.endsAt;updates['public/'+r.date+'/events/'+id]=publicRecord;}
  return updates;
 }
 async function save(input,previous){admin();const db=database(),id=eventId(input?.eventId),expected=previous?Number(previous.revision):0;
  if(input.revision!==undefined&&input.revision!==expected)throw Error('작성 중인 생일 설정 버전이 변경되었습니다. 다시 불러와 주세요.');
  const [profile,target,current]=await Promise.all([db.get('users/admin'),db.get('users/'+String(input.targetUid||'')),db.get('birthdayCelebrations/private/admin/'+id)]);admin();
  if(!profile||profile.status!=='active'||!target||target.status!=='active'||typeof target.name!=='string'||!target.name)throw Error('현재 관리자와 팀원 계정을 확인해 주세요.');
  if(Number(current?.revision||0)!==expected)throw Error('다른 창에서 생일 설정이 변경되었습니다. 다시 불러와 주세요.');
  const config={eventId:id,version:1,revision:expected+1,date:input.date,targetUid:input.targetUid,displayName:target.name,enabled:input.enabled,updatedAt:Date.now(),updatedBy:'admin'};
  if(input.faceDataUrl!==undefined)config.faceDataUrl=input.faceDataUrl;if(input.crop!==undefined)config.crop=input.crop;
  const updates=buildAtomicUpdate(config,current?{...current,eventId:id}:null);admin();database();await db.update('birthdayCelebrations',updates);return config;
 }
 global.PresenceBirthdayCloud={dateKey,windowForDate,isAdmin,buildAtomicUpdate,save};
})(window);
