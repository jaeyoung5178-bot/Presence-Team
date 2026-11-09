import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=new URL('../',import.meta.url),out='/tmp/presence-christmas-intro-qa';
await mkdir(out,{recursive:true});
const css=await readFile(new URL('assets/presence-christmas-intro.css',base),'utf8');
const js=await readFile(new URL('assets/presence-christmas-intro.js',base),'utf8');
const browser=await chromium.launch({headless:true,channel:'chrome'});
for(const [width,height] of [[390,844],[1024,768],[1440,900]]){
  const page=await browser.newPage({viewport:{width,height}});
  await page.route(/^https?:/,r=>r.abort());
  await page.goto(new URL('index.html',base).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof showPresenceLoader==='function');
  const snapshot=await page.evaluate(()=>({styles:[...document.querySelectorAll('style,link[rel=stylesheet]')].map(el=>el.outerHTML).join(''),loader:document.getElementById('presenceGameLoader').outerHTML}));
  await page.setContent('<html><head><base href="'+base.href+'"><meta name="viewport" content="width=device-width">'+snapshot.styles+'</head><body>'+snapshot.loader+'</body></html>');
  await page.evaluate(()=>{
    window.showPresenceLoader=msg=>{document.getElementById('presenceGameLoader').classList.add('show');document.getElementById('presenceGameLoaderMsg').textContent=msg;window.__pglTimer=setInterval(()=>{},420);};
    window.hidePresenceLoader=()=>{clearInterval(window.__pglTimer);setTimeout(()=>document.getElementById('presenceGameLoader').classList.remove('show'),260);};
  });
  await page.addStyleTag({content:css});
  await page.addScriptTag({content:js});
  await page.evaluate(()=>{document.body.classList.add('presence-christmas');showPresenceLoader('워크북에 연결하고 있어요.');});
  await page.locator('.pci-party').evaluate(img=>img.decode());
  await page.locator('.pci-atelier').evaluate(img=>img.decode());
  const phaseStates={};
  for(const [name,time]of[['arrival',200],['doors',700],['party',1900]]){
    await page.locator('#presenceGameLoader').evaluate((el,time)=>{el.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=time;});},time);
    phaseStates[name]=await page.locator('.pci-door-left').evaluate(el=>({transform:getComputedStyle(el).transform,animation:getComputedStyle(el).animationName,portalOpacity:getComputedStyle(el.parentElement).opacity}));
    await page.screenshot({path:out+'/'+width+'-'+name+'.png'});
  }
  assert.equal(phaseStates.doors.animation,'pciDoorLeft');
  assert.notEqual(phaseStates.doors.transform,phaseStates.party.transform,'Door transform changes from opening to completed frame');
  assert.ok(Number(phaseStates.doors.portalOpacity)>.5,'Architectural doors are visible during opening');
  console.log(width,JSON.stringify(phaseStates));
  assert.equal(await page.locator('#pglPercent').isVisible(),false);
  assert.equal(await page.locator('#pglHeroPet').count(),1);
  assert.equal(await page.locator('#pglFill').count(),1);
  assert.equal(await page.locator('.pci-copy-first').textContent(),'Ready for winter?');
  assert.equal(await page.locator('.pci-copy-last').textContent(),'Let’s go, Presence!');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const card=await page.locator('.pgl-cinema').boundingBox();
  assert.ok(card.x>=0&&card.y>=0&&card.x+card.width<=width+1&&card.y+card.height<=height+1);
  const party=await page.locator('.pci-party').boundingBox();
  assert.ok(Math.abs(party.width/party.height-1.5)<.02,'Party art keeps complete 3:2 composition');
  const ready=await page.evaluate(()=>{const start=performance.now();hidePresenceLoader();return{duration:performance.now()-start,visible:document.getElementById('presenceGameLoader').classList.contains('show')};});
  assert.equal(ready.visible,false);assert.ok(ready.duration<100);
  await page.evaluate(()=>{document.body.classList.remove('presence-christmas');showPresenceLoader('기본 화면 연결 중');});
  assert.equal(await page.locator('.pci-scene').isVisible(),false);
  await page.close();
}
const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
await reduced.route(/^https?:/,r=>r.abort());await reduced.goto(new URL('index.html',base).href,{waitUntil:'domcontentloaded'});await reduced.addStyleTag({content:css});if(!await reduced.evaluate(()=>!!window.PresenceChristmasIntro))await reduced.addScriptTag({content:js});await reduced.evaluate(()=>{document.body.classList.add('presence-christmas');showPresenceLoader('연결 중');});await reduced.locator('.pci-party').evaluate(img=>img.decode());assert.equal(await reduced.locator('.pci-door').first().evaluate(el=>getComputedStyle(el).animationName),'none');await reduced.screenshot({path:out+'/390-reduced.png'});await reduced.close();
await browser.close();console.log('PASS intro3surfaces/3phases; originalIDs; exactcopy; wholepartyart; immediate-readyexit; offrestoration; reducedmotion. Screenshots '+out);
