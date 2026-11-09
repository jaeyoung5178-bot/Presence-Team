import{createRequire}from'node:module';import{readFile}from'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:390,height:844}});
await page.route('https://presence.co.kr/season-player-qa',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width"><body class="app-on"></body>'}));
await page.goto('https://presence.co.kr/season-player-qa');await page.addStyleTag({content:await readFile(new URL('../assets/presence-season.css',import.meta.url),'utf8')});await page.addScriptTag({content:await readFile(new URL('../assets/presence-youtube-bgm.js',import.meta.url),'utf8')});
await page.evaluate(()=>PresenceBgm.setTrack('pOIGQ2Zu7a4','Christmas Carol'));await page.locator('#presenceBgmQuick').click();await page.locator('[data-play]').click();
await page.waitForFunction(()=>PresenceBgm.playing||document.querySelector('#presenceMusicPanel p').textContent.includes('재생할 수 없어요'),{timeout:20000}).catch(()=>{});
console.log(JSON.stringify(await page.evaluate(()=>({videoId:PresenceBgm.videoId,playing:PresenceBgm.playing,status:document.querySelector('#presenceMusicPanel p').textContent,iframe:document.querySelector('iframe')?.src||null})),null,2));
await page.screenshot({path:'/tmp/presence-season-qa/network-player-390.png'});await browser.close();
