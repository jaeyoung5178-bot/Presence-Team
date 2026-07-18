import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const cases = [
  ['mobile',390,844],['tablet',1024,768],['desktop',1440,900]
];
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const reports=[];
for(const [name,width,height] of cases){
  const page=await browser.newPage({viewport:{width,height}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/?v=farm-login-qa`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(500);
  const report=await page.evaluate(()=>{const gate=document.getElementById('authGate'),card=document.querySelector('#authGate .auth-card'),logo=document.querySelector('#authGate .hero-plate img');return {gate:!!gate,card:!!card,logo:!!(logo&&logo.complete&&logo.naturalWidth>0),overflow:document.documentElement.scrollWidth>innerWidth+1,cardFits:!!(card&&card.getBoundingClientRect().left>=0&&card.getBoundingClientRect().right<=innerWidth),title:getComputedStyle(document.querySelector('#authGate .auth-logo'),'::before').content};});
  const screenshot=`/tmp/presence-farm-login-${name}.png`;await page.screenshot({path:screenshot,fullPage:true});reports.push({name,width,height,report,errors,screenshot});await page.close();
}
await browser.close();console.log(JSON.stringify(reports,null,2));
if(reports.some(x=>!x.report.gate||!x.report.card||!x.report.logo||x.report.overflow||!x.report.cardFits||x.errors.length))process.exit(1);
