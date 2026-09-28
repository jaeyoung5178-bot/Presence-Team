import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const require = createRequire(import.meta.url);
const {chromium} = require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.PRESENCE_QA_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const failures = [];
const views = [{width:390,height:844},{width:1024,height:768},{width:1440,height:900}];
const output = process.env.PRESENCE_QA_OUTPUT;
if (output) await mkdir(output,{recursive:true});

try {
  for (const role of ['admin','sector','leader','member']) for (const viewport of views) {
    const context = await browser.newContext({viewport, permissions:['clipboard-read','clipboard-write'], reducedMotion:'reduce'});
    const page = await context.newPage();
    const label = role+' '+viewport.width;
    page.on('pageerror', e => failures.push(label+': '+e.message));
    await page.route(/(firebaseio\.com|firebasedatabase\.app|identitytoolkit|securetoken|gstatic\.com\/firebasejs|googleapis\.com\/(?!css))/, r => r.abort());
    await page.route(/nominatim\.openstreetmap\.org/, r => r.abort());
    await page.route(/api\.open-meteo\.com\/v1\/forecast/, r => r.fulfill({
      status:200, contentType:'application/json',
      body:JSON.stringify({daily:{
        time:['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03','2026-10-04'],
        weather_code:[0,1,2,3,0,1,2],
        temperature_2m_max:[21,20,19,18,20,21,19],
        temperature_2m_min:[13,12,11,10,12,13,11],
        precipitation_probability_max:[0,10,20,30,0,10,20]
      }})
    }));
    try {
      await page.goto(base+'/?qa=sites-focus-'+Date.now(), {waitUntil:'domcontentloaded'});
      await page.waitForFunction(() => typeof goTab==='function' && typeof tfSearch==='function');
      await page.evaluate(role => {
        state.users = {
          admin:{uid:'admin',name:'운영관리자',id:'qa-admin',role:'AOP',status:'active'},
          sector:{uid:'sector',name:'고윤경',id:'qa-sector',role:'TL',status:'active'},
          leader:{uid:'leader',name:'현장리더',id:'qa-leader',role:'LR',status:'active'},
          member:{uid:'member',name:'현장멤버',id:'qa-member',role:'IC',status:'active'}
        };
        state.sectorLeaders=['고윤경'];
        state.sites={}; state.siteFeedback={}; state.sitePhotos={};
        window.__previewRole=''; window.__adminOff=false;
        DB.set=async()=>{};
        DB.update=DB.set; DB.push=DB.set; DB.get=async()=>null; DB.on=()=>()=>{};
        me=state.users[role];
        document.getElementById('authGate')?.classList.add('hidden');
        document.getElementById('app')?.classList.remove('hidden');
        document.body.classList.add('app-on');
        document.querySelectorAll('#presenceGameLoader,#presenceEntryLobby,#presenceLoader').forEach(el=>el.remove());
        buildRail();
        goTab('sites');
      }, role);
      if (role==='member') {
        assert.notEqual(await page.evaluate(() => curTab),'sites',label+' member route');
        assert.equal(await page.locator('#m-sites.active').count(),0,label+' member panel');
        await context.close();
        continue;
      }
      assert.equal(await page.locator('#sp-find.active').count(),1,label+' default finder');
      assert.equal(await page.locator('#sp-main.active').count(),0,label+' old main hidden');
      const extraVisible = await page.locator('#m-sites .ft-sb[data-sp="main"]').isVisible();
      assert.equal(extraVisible,role!=='leader',label+' tab permission');
      if (role==='leader') {
        await page.evaluate(() => siteTab('main'));
        assert.equal(await page.locator('#sp-find.active').count(),1,label+' direct tab guard');
      } else {
        await page.evaluate(() => siteTab('main'));
        assert.equal(await page.locator('#sp-main.active').count(),1,label+' main remains available');
        await page.evaluate(() => siteTab('new'));
        assert.equal(await page.locator('#sp-new.active').count(),1,label+' new-site form remains available');
        await page.evaluate(() => siteTab('apply'));
        assert.equal(await page.locator('#sp-apply.active').count(),1,label+' site application remains available');
        await page.evaluate(() => goTab('sites'));
        assert.equal(await page.locator('#sp-find.active').count(),1,label+' reentry default');
      }
      const finderImage = page.locator('#sp-find .tf-intro-art');
      await finderImage.evaluate(img => img.decode());
      assert.equal(await finderImage.evaluate(img => img.naturalWidth>0),true,label+' finder image');
      assert.equal(await page.locator('#tfQuery').isVisible(),true,label+' search visible');
      await page.waitForFunction(() => document.querySelectorAll('#pmsWx .wx-d').length===7);
      const placement=await page.evaluate(() => {
        const search=document.querySelector('#sp-find .ms-searchbar').getBoundingClientRect();
        const weather=document.getElementById('pmsWx').getBoundingClientRect();
        return {searchTop:search.top,searchBottom:search.bottom,weatherTop:weather.top};
      });
      assert.ok(placement.weatherTop>placement.searchBottom+8,label+' weather follows finder '+JSON.stringify(placement));
      if (viewport.width===390) assert.ok(placement.searchTop<=440,label+' search in first mobile view '+JSON.stringify(placement));
      if (output && viewport.width===390) await page.screenshot({path:output+'/'+role+'-390-weather-order.png',fullPage:false});
      await page.locator('#tfQuery').fill('부평역');
      await page.locator('#tfQuery').press('Enter');
      assert.ok(await page.locator('#tfResults .tf-row').count()>0,label+' name match');
      if (output) await page.screenshot({path:output+'/'+role+'-'+viewport.width+'-finder.png',fullPage:false});
      const firstCode=(await page.locator('#tfResults .tf-value strong').first().textContent()).split('/').at(-1);
      assert.ok(firstCode.length>=3,label+' code visible');
      await page.locator('#tfResults .tf-code').first().click();
      const copied=await page.evaluate(() => navigator.clipboard.readText());
      assert.ok(copied.includes('부평역')&&copied.includes(firstCode),label+' copy full code');
      await page.locator('#tfQuery').fill(firstCode);
      await page.locator('#tfQuery').press('Enter');
      assert.ok(await page.locator('#tfResults .tf-row').count()>0,label+' code match');
      await page.locator('#tfResults .tf-mapbtn').first().click();
      assert.equal(await page.locator('#tfMapCard').isVisible(),true,label+' map open');
      assert.match(await page.locator('#tfMap').textContent(),/찾는 중|좌표|로딩/,label+' map loading');
      assert.match(await page.locator('#tfNaverBtn').getAttribute('href'),/^https:\/\/map\.naver\.com\//,label+' map link');
      await page.waitForFunction(() => /좌표를 못 찾았어요|지도 로딩 대기/.test(document.getElementById('tfMap')?.textContent||''),null,{timeout:12000});
      await page.locator('#tfMapCard .tf-mapclose').click();
      assert.equal(await page.locator('#tfMapCard').isVisible(),false,label+' map close');
      await page.locator('#tfQuery').fill('절대없는장소QA987654');
      await page.locator('#tfQuery').press('Enter');
      assert.match(await page.locator('#tfResults .tf-empty').textContent(),/맞는 코드가 없어요/,label+' empty');
      const geometry=await page.evaluate(() => {
        const root=document.documentElement, panel=document.getElementById('sp-find');
        const controls=[...panel.querySelectorAll('button,input')].filter(el => {
          const s=getComputedStyle(el),r=el.getBoundingClientRect();
          return s.display!=='none' && s.visibility!=='hidden' && r.width>0 && r.height>0;
        }).map(el => ({label:el.getAttribute('aria-label')||el.textContent.trim()||el.id,w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height}));
        return {scroll:root.scrollWidth,width:innerWidth,controls};
      });
      assert.ok(geometry.scroll<=geometry.width+1,label+' no horizontal overflow '+JSON.stringify(geometry));
      assert.deepEqual(geometry.controls.filter(c=>c.w<43.5||c.h<43.5),[],label+' touch targets');
    } catch (e) {
      failures.push(label+': '+(e.stack||e));
    }
    await context.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(failures.join('\n\n'));
  process.exitCode=1;
} else {
  console.log('Sites finder: 4 roles × 3 viewports passed');
}
