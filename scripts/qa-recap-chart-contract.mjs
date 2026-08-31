import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require('/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.route(/firebasedatabase\.app|firebaseio\.com|script\.google\.com/,route=>route.abort());
await page.goto((process.env.PRESENCE_QA_URL||'http://127.0.0.1:4173')+'/?qa=recap-chart-contract',{waitUntil:'domcontentloaded'});
const result=await page.evaluate(async()=>{
  // Synthetic public fixture; never commit real payroll amounts to this repository.
  const data={pays:['2026-08-07','2026-08-14','2026-08-21','2026-08-28'],period:{from:'2026-07-27',to:'2026-08-23'},
    totals:{sales:200,fieldDays:100,income:12345678,netSales:110,avg:2},
    weeklySales:[40,50,50,60],weeklyRejects:[20,21,25,25],weeklyIncome:[2123456,2345678,3456789,4419755],
    rows:[{records:[{payType:'performance',rejectCLCount:81,resubmitCLCount:1,rejectSWCount:10,resubmitSWCount:0}]}]};
  const p=prcProductivityOf(data),assert=(v,m)=>{if(!v)throw new Error(m);};
  assert(p.actualIncome===12345678&&p.rejectValue===9900000&&p.clValue===8800000&&p.swValue===1100000,'Input income / loss formula changed');
  assert(p.netRejects===90&&p.sales===200,'Counts changed');
  assert(Math.abs(p.rejectPctOfSales-90/200*100)<1e-9,'Wrong percentage denominator');
  const previewHtml=prcProductivityHTML(data),ring=new DOMParser().parseFromString(previewHtml,'text/html').querySelector('svg');
  assert(ring.querySelector('[data-series="CL"]')?.textContent==='40.0%'&&ring.querySelector('[data-series="SW"]')?.textContent==='5.0%','Single-line CL/SW percentages missing on slices');
  assert(!ring.textContent.includes('CL 리젝')&&!ring.textContent.includes('SW 리젝'),'Old centre-hole labels remain');
  assert(!/팀원이 입력|실제 입금액 합계/.test(previewHtml),'Unwanted input-source explanation');
  for(const [sales,cl,sw] of [[0,0,0],[10,0,0],[10,10,0],[10,0,10],[10,8,5]]){
    const d={totals:{sales,income:0},rows:[{records:[{payType:'performance',rejectCLCount:cl,rejectSWCount:sw}]}]};
    const html=prcProductivityHTML(d);
    assert(!/NaN|Infinity|undefined/.test(html),'Non-finite label');
    if(cl+sw>sales)assert(html.includes('원형 비중은 표시하지'),'Invalid composition needs warning');
  }
  const Pptx=await prcPptLoad(),pptx=new Pptx();pptx.layout='LAYOUT_WIDE';pptx.title='Presence recap visual QA';
  prcPptSummary(pptx,data,2);prcPptProductivity(pptx,data,3);
  const raw=await pptx.write({outputType:'arraybuffer'}),zip=await JSZip.loadAsync(raw);
  const trendXml=await zip.file('ppt/charts/chart1.xml').async('string'),ringSlide=await zip.file('ppt/slides/slide2.xml').async('string');
  assert(trendXml.includes('세일즈 추이')&&!trendXml.includes('세일즈 · 막대'),'Chart title is not presentation-ready');
  assert(!ringSlide.includes('CL 리젝 40.0%')&&!ringSlide.includes('SW 리젝 5.0%')&&!ringSlide.includes('팀원이 입력'),'PPT centre-hole labels remain');
  const combo=await zip.file('ppt/charts/chart3.xml').async('string');
  const doc=new DOMParser().parseFromString(combo,'application/xml'),ns='http://schemas.openxmlformats.org/drawingml/2006/chart';
  const ids=Array.from(doc.getElementsByTagNameNS(ns,'ser')).map(s=>s.getElementsByTagNameNS(ns,'idx')[0].getAttribute('val'));
  assert(new Set(ids).size===2,'Combo charts reuse a mutated data object');
  doc.getElementsByTagNameNS(ns,'ser')[1].getElementsByTagNameNS(ns,'idx')[0].setAttribute('val',ids[0]);
  let rejected=false;try{PresenceRecapPptx.normalizeChart(new XMLSerializer().serializeToString(doc));}catch(e){rejected=/Duplicate/.test(e.message);}
  assert(rejected,'Duplicate series ID guard did not stop corrupt export');
  const output=await PresenceRecapPptx.prepare(raw);
  const finalZip=await JSZip.loadAsync(await output.arrayBuffer()),finalChart=new DOMParser().parseFromString(await finalZip.file('ppt/charts/chart4.xml').async('string'),'application/xml');
  const nativeLabels=Array.from(finalChart.getElementsByTagNameNS(ns,'dLbl'));
  assert(nativeLabels.length===3,'Missing native slice labels');
  for(const label of nativeLabels.slice(0,2)){
    assert(!label.getElementsByTagNameNS(ns,'dLblPos').length,'Doughnut must use Office default centre position');
    assert(label.getElementsByTagNameNS(ns,'showPercent')[0]?.getAttribute('val')==='1','Native percentage disabled');
    assert(label.getElementsByTagNameNS(ns,'numFmt')[0]?.getAttribute('formatCode')==='0.0%','Native label number format');
    assert(label.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main','bodyPr')[0]?.getAttribute('wrap')==='none','Native label can wrap');
  }
  assert(nativeLabels[2].getElementsByTagNameNS(ns,'showPercent')[0]?.getAttribute('val')==='0','Unrequested grey slice label');
  window.__qaChartData=data;
  return {bytes:Array.from(new Uint8Array(await output.arrayBuffer())),summary:{sales:p.sales,rejects:p.netRejects,income:p.actualIncome,loss:p.rejectValue,cl:p.clValue,sw:p.swValue,seriesIds:ids}};
});
const output=process.env.PRESENCE_CHART_OUTPUT||'/tmp/presence-recap-design-v47.pptx';
await writeFile(output,Buffer.from(result.bytes));
const preview=await page.evaluate(()=>({styles:Array.from(document.querySelectorAll('style,link[rel="stylesheet"]')).map(e=>e.outerHTML).join(''),html:prcProductivityHTML(window.__qaChartData)}));
const visual=await browser.newPage();
await visual.setContent('<html><head>'+preview.styles+'<style>body{background:white!important;display:block!important;margin:0!important;padding:12px!important}#m-recap{display:block!important;max-width:1400px;margin:auto}</style></head><body><section id="m-recap"><div class="pra-deck">'+preview.html+'</div></section></body></html>');
// Include the reference proportions and narrow/empty/full slices without real payroll data.
const variants=await page.evaluate(()=>[[1000,556,49],[100,12,4],[100,49,1],[100,100,0],[100,0,100],[0,0,0]].map(([sales,cl,sw])=>prcProductivityHTML({totals:{sales,income:0},rows:[{records:[{payType:'performance',rejectCLCount:cl,rejectSWCount:sw}]}]})));
for(const html of [preview.html,...variants]){
await visual.locator('.pra-deck').evaluate((el,html)=>el.innerHTML=html,html);
for(const width of [1440,1024,390]){
  await visual.setViewportSize({width,height:1000});
  if(html===preview.html)await visual.locator('#m-recap').screenshot({path:`/tmp/presence-recap-preview-${width}.png`});
  const overflow=await visual.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  if(overflow)throw new Error('Preview overflow '+width);
  const clipped=await visual.evaluate(()=>{
    const card=document.querySelector('.pra-income-reject-slide').getBoundingClientRect();
    return [...document.querySelectorAll('.pra-story-panel,.pra-story-breakdown,.pra-income-reject-slide > .pra-prod-note')].some(e=>e.getBoundingClientRect().bottom>card.bottom-20);
  });
  if(clipped)throw new Error('Preview content clipped '+width);
  const escaped=await visual.evaluate(()=>[...document.querySelectorAll('.pra-slice-label')].flatMap(label=>{
    const b=label.getBBox(),start=Number(label.dataset.start)*Math.PI/50,span=Number(label.dataset.share)*Math.PI/50;
    const corners=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]];
    const outside=corners.some(([x,y])=>{
      const dx=x-180,dy=y-165,r=Math.hypot(dx,dy),angle=(Math.atan2(dx,-dy)+2*Math.PI)%(2*Math.PI),delta=(angle-start+2*Math.PI)%(2*Math.PI);
      return r<97||r>139||delta>span;
    });
    return outside?[label.dataset.series]:[];
  }));
  if(escaped.length)throw new Error('Text extends beyond coloured slice '+width+' fixture '+variants.indexOf(html)+': '+escaped.join(','));
}
}
console.log(JSON.stringify({pass:true,...result.summary,pptx:output}));
await browser.close();
