import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=new URL('../',import.meta.url),browser=await chromium.launch({headless:true,channel:'chrome'});
const source=await browser.newPage();await source.route(/^https?:/,r=>r.abort());await source.goto(new URL('index.html',base).href,{waitUntil:'domcontentloaded'});
const styles=await source.evaluate(()=>[...document.querySelectorAll('style,link[rel=stylesheet]')].map(el=>el.outerHTML).join(''));await source.close();
const script=await readFile(new URL('assets/presence-youtube-bgm.js',base),'utf8');
for(const [width,height]of[[390,844],[1024,768],[1440,900]]){
 const p=await browser.newPage({viewport:{width,height}});await p.route(/^https?:/,r=>r.abort());await p.goto(new URL('assets/presence-youtube-bgm.css',base).href);
 await p.setContent('<head><base href="'+base.href+'"><meta name="viewport" content="width=device-width">'+styles+'</head><body class="presence-workspace-v2 app-on can-mod presence-christmas"><div id="fxDock"><div id="fxPanel" role="dialog" style="display:block;opacity:0;transform:translateX(26px)"></div></div><div class="modal" style="display:none"></div></body>');
 await p.evaluate(()=>{window.me={uid:'admin',role:'AOP',status:'active'};window.toggleFxDock=()=>{};});await p.addScriptTag({content:script});
 assert.equal(await p.locator('#presenceBgmQuick').isVisible(),true,'Actual linked workspace legacy !important hider is overridden');
 await p.locator('#presenceBgmQuick').click();assert.equal(await p.locator('iframe').count(),1,'First tap starts visible player');
 const rect=await p.locator('#presenceMusicPanel').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width+1&&rect.y>=0&&rect.y+rect.height<=height+1);
 await p.locator('[data-close]').click();await p.evaluate(()=>{const m=document.querySelector('.modal');m.style.display='flex';m.classList.add('on');});
 assert.equal(await p.locator('#presenceBgmQuick').isVisible(),false,'Real modal still owns focus/visibility');
 await p.evaluate(()=>document.querySelector('.modal').classList.remove('on'));assert.equal(await p.locator('#presenceBgmQuick').isVisible(),true);
 await p.screenshot({path:'/tmp/presence-season-qa/cascade-'+width+'.png'});await p.close();
}
await browser.close();console.log('PASS actual all-linked CSS cascade3sizes; closed FX is ignored; 1tap player; modal hides music; no panel overflow.');
