const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const classes=new Set(),callbacks=[],errors=[],cache=new Map();let mounted=false,writes=0;
const button={attrs:{},textContent:'',setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}};
const status={textContent:''};
const section={dataset:{},set innerHTML(v){},querySelector:s=>s==='button'?button:status,remove(){mounted=false;}};
const container={querySelector:()=>null,prepend(){mounted=true;}};
const context={console,Date,Error,Promise,CustomEvent:function(name,options){this.type=name;this.detail=options.detail;},setInterval:()=>0,
 me:{uid:'admin',status:'active',role:'AOP'},LIVE:true,isFounder:u=>u.uid==='admin',
 document:{readyState:'complete',body:{classList:{toggle(k,v){v?classes.add(k):classes.delete(k);},remove(k){classes.delete(k);}}},createElement:()=>section,querySelectorAll:s=>mounted?(s==='[data-christmas-toggle]'?[button]:s==='[data-season-status]'?[status]:s==='[data-presence-season-control]'?[section]:[]):[]},
 DB:{on(path,ready,error){callbacks.push(ready);errors.push(error);return()=>{};},set(){writes++;return Promise.resolve();}},localStorage:{getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v)},__firebaseReady:true,dispatchEvent:()=>{}};
context.window=context;
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../assets/presence-season.js'),'utf8'),context);
const api=context.PresenceSeason;api.mountAdmin(container);
assert.equal(button.textContent,'설정 확인 중…');assert.equal(button.disabled,true);assert.equal(button.attrs['aria-checked'],undefined);
callbacks[0]({season:'winter'});assert.equal(api.isChristmas(),true);assert.equal(button.textContent,'크리스마스 모드 · ON');assert.equal(classes.has('presence-christmas'),true);assert.equal(cache.get('presence_christmas_visual_hint'),'winter');
errors[0](Error('offline'));assert.equal(api.isChristmas(),true);assert.equal(classes.has('presence-christmas'),true);assert.match(button.textContent,/연결 확인 필요.*ON/);assert.equal(button.disabled,true);assert.match(status.textContent,/마지막으로 확인된/);
(async()=>{await assert.rejects(api.toggle(),/다시 확인/);assert.equal(writes,0);callbacks[0]({season:'auto'});assert.equal(api.isChristmas(),false);assert.equal(button.textContent,'크리스마스 모드 · OFF');assert.equal(button.disabled,false);assert.equal(cache.get('presence_christmas_visual_hint'),'off');
 context.me={uid:'leader',status:'active',role:'TL'};api.sync();callbacks[1]({season:'winter'});errors[0](Error('stale actor'));assert.equal(api.isChristmas(),true);await assert.rejects(api.toggle(),/관리자만/);assert.equal(writes,0);console.log('PASS unknown pending, winter sync, offline preserves last confirmed state, explicit OFF, stale-session rejection and zero writes');})().catch(e=>{console.error(e);process.exitCode=1;});
