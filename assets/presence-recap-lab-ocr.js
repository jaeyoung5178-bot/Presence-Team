/* Device-only OCR. Images remain in this browser; all engine assets are self-hosted. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./presence-recap-lab-model.js'),null);else root.PresenceRecapLabOCR=factory(root.PresenceRecapLabModel,document.currentScript&&document.currentScript.src);})(typeof globalThis!=='undefined'?globalThis:this,function(M,scriptURL){
 'use strict';var loadPromise=null,busy=false,activeWorker=null,jobSequence=0;
 var base=scriptURL?new URL('./vendor/tesseract-6.0.1/',scriptURL).href:null;
 function hash(text){var h=2166136261;for(var i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
 var MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
 var MONTH_NAME='(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
 function namedMonth(value){return MONTHS.indexOf(String(value||'').slice(0,3).toLowerCase())+1;}
 function dateOK(value){try{return M.isoDate(value);}catch(_){return null;}}
 function weDate(line){
  var iso=line.match(/\bWE\s*(\d{4})[-./](\d{1,2})[-./](\d{1,2})\b/i),compact=line.match(new RegExp('\\bWE\\s*([0O]?[1-9]|[12]\\d|3[01])\\s*'+MONTH_NAME+'\\s*(20\\d{2})\\b','i')),value=null;
  if(iso)value=iso[1]+'-'+iso[2].padStart(2,'0')+'-'+iso[3].padStart(2,'0');
  else if(compact)value=compact[3]+'-'+String(namedMonth(compact[2])).padStart(2,'0')+'-'+compact[1].replace(/^O/i,'0').padStart(2,'0');
  return value?dateOK(value):null;
 }
 function withoutDates(line){return line.replace(new RegExp('\\bWE\\s*(?:\\d{4}[-./]\\d{1,2}[-./]\\d{1,2}|[0O]?\\d{1,2}\\s*'+MONTH_NAME+'\\s*20\\d{2})\\b','gi'),' ').replace(/\b\d{4}[-./]\d{1,2}(?:[-./]\d{1,2})?\b/g,' ');}
 function amounts(line){
  line=line.replace(/[Ww]{2,3}(?=\s*[+-]?\s*\d)/g,'W');
  var re=/(?:[+-]\s*)?(?:[₩￦\\¥￥Ww]\s*)?(?:[+-]\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/g,out=[],match;
  while((match=re.exec(line))){var raw=match[0].trim(),at=match.index,before=line[at-1]||'',after=line[at+match[0].length]||'';
   if(/[\d.A-Za-z]/.test(before)||/[\d.A-Za-z]/.test(after))continue;
   if(!/[₩￦\\¥￥Ww,.]/.test(raw))continue; // plain years / row numbers are not money
   var normalized=raw.replace(/[₩￦\\¥￥Ww\s,+]/g,'');
   try{out.push({raw:raw,value:M.parseMoneyCents(normalized,{allowNegative:true}),currency:/[₩￦\\¥￥Ww]/.test(raw)});}catch(_){}
  }return out;
 }
 function parseText(text,options){
  options=options||{};var rows=[],warnings=[],sourceHash=options.sourceHash||'text-'+hash(String(text)),year=/^20\d{2}$/.test(String(options.year||''))?String(options.year):null,yearExplicit=false,documentMonth=null,pendingBalance=false,summary={};
  var lines=String(text||'').replace(/[−–—﹣－]/g,'-').split(/\r?\n/),weekly=lines.some(function(line){return !!weDate(line)&&amounts(withoutDates(line)).length>=2;}),seen=new Set();
  function add(kind,month,amount,raw,index,extra){
   var identity=kind+'|'+(month||'unknown')+'|'+(extra?.weekEnding||extra?.asOfDate||index),id='ocr-'+hash(sourceHash+'|'+identity);
   if(seen.has(id)){warnings.push('같은 종류·월·주차의 중복 행은 한 번만 표시했습니다.');return;}seen.add(id);
   var row=Object.assign({id:id,kind:kind,month:month,amountCents:amount,asOfDate:null,occurredOn:null,weekEnding:null,source:'ocr',sourceHash:sourceHash,rawText:raw,confidence:null,confirmed:false},extra||{});
   if(kind==='snapshot')row.balanceCents=amount;rows.push(row);
  }
  lines.forEach(function(raw,index){
   var line=raw.trim();if(!line)return;
   var onlyYear=line.match(/^(?:[<>]\s*)?(20\d{2})\s*(?:년)?$/);if(onlyYear){year=onlyYear[1];yearExplicit=true;return;}
   var previousYear=year,previousExplicit=yearExplicit,named=line.match(new RegExp('\\b'+MONTH_NAME+'\\b','i')),explicitYear=line.match(/\b(20\d{2})\b/),isoMonth=line.match(/\b(20\d{2})[-./](0?[1-9]|1[0-2])(?:월|(?=[^\d]|$))/),ko=line.match(/(?:^|\s)(1[0-2]|0?[1-9])월/),month=null;
   if(isoMonth){year=isoMonth[1];yearExplicit=true;month=year+'-'+String(+isoMonth[2]).padStart(2,'0');}
   else if(named){if(explicitYear){year=explicitYear[1];yearExplicit=true;}if(year)month=year+'-'+String(namedMonth(named[1])).padStart(2,'0');}
   else if(ko&&year)month=year+'-'+String(+ko[1]).padStart(2,'0');
   var we=weDate(line),values=amounts(withoutDates(line)),isMaturity=/만\s*기|maturity|review\s*(date|on)/i.test(line),isTotal=/총\s*계|합\s*계|\btotal\b/i.test(line);
   if(isMaturity){year=previousYear;yearExplicit=previousExplicit;if(we)summary.sourceMaturityOn=we;else{var dm=line.match(/\b20\d{2}-\d{2}-\d{2}\b/);if(dm)summary.sourceMaturityOn=dateOK(dm[0]);}return;}
   if(month&&!values.length&&!we){documentMonth=month;return;}
   if(isTotal){summary.totals={creditCents:values[0]?.value??null,debitCents:values[1]?.value??null};return;}
   if(weekly&&we&&values.length>=2){
    if(new Date(we+'T00:00:00Z').getUTCDay()!==0){warnings.push('WE가 일요일이 아니어서 해당 행을 배정하지 않았습니다.');return;}
    add('credit',we.slice(0,7),values[0].value,raw,index,{weekEnding:we,column:'본드 누적'});
    add('debit',we.slice(0,7),values[1].value,raw,index,{weekEnding:we,column:'본드 차감'});return;
   }
   if(weekly&&/마\s*감|잔액|balance/i.test(line)){pendingBalance=true;if(we)summary.asOfDate=we;}
   if(weekly&&(pendingBalance||/마\s*감|잔액|balance/i.test(line))&&values.length){summary.balanceCents=values[0].value;summary.month=documentMonth||month;pendingBalance=false;return;}
   if(!values.length)return;
   if(weekly)return; // headings/status/maturity amounts never become ledger events
   var hasMonth=!!(isoMonth||named||ko),kind=/(credit|credited|입금|적립)/i.test(line)?'credit':/(debit|출금|차감)/i.test(line)?'debit':/(adjustment|조정)/i.test(line)?'adjustment':/(balance|snapshot|잔액|잔고)/i.test(line)||hasMonth?'snapshot':'unclassified';
   var asOf=null,occurred=null,dateMatch=line.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
   if(dateMatch){var date=dateOK(dateMatch[1]);if(date&&/as\s*of|기준일/i.test(line))asOf=date;if(date&&/입금일|거래일|credited\s*on|transaction\s*date/i.test(line))occurred=date;}
   if(!month&&asOf)month=asOf.slice(0,7);
   if(!month&&kind!=='snapshot'&&kind!=='unclassified'&&/^20\d{2}-\d{2}$/.test(options.month||'')){month=options.month;warnings.push('사진에 월이 없는 거래는 선택한 월을 참고했습니다. 월을 확인해 주세요.');}
   var amount=values.length===1?values[0].value:null;if(values.length>1)warnings.push('여러 금액이 있는 행은 직접 확인해 주세요: '+(index+1));
   add(kind,month,amount,raw,index,{yearUnconfirmed:!!month&&!yearExplicit,asOfDate:asOf,occurredOn:occurred,weekEnding:we&&new Date(we+'T00:00:00Z').getUTCDay()===0?we:null});
  });
  if(weekly){var credit=rows.filter(function(r){return r.kind==='credit';}).reduce(function(n,r){return n+r.amountCents;},0),debit=rows.filter(function(r){return r.kind==='debit';}).reduce(function(n,r){return n+r.amountCents;},0);if(summary.totals&&(summary.totals.creditCents!==credit||summary.totals.debitCents!==debit))warnings.push('주차별 금액의 합계와 사진의 총계가 다릅니다. 저장 전에 확인해 주세요.');}
  if(!rows.length)warnings.push('읽은 금액이 없습니다. 직접 입력할 수 있습니다.');if(rows.some(function(r){return r.kind==='unclassified'||r.amountCents==null||!r.month;}))warnings.push('종류·월·금액이 미확정인 행을 수정해 주세요.');
  if(rows.some(function(r){return r.yearUnconfirmed;}))warnings.push('연도가 사진에 확인되지 않은 행은 직접 연도를 확인하기 전까지 저장하지 않습니다.');
  if(rows.some(function(r){return r.kind==='snapshot'&&!r.asOfDate;}))warnings.push('사진에 잔액 기준일이 없습니다. 원본의 기준일을 확인해 입력해 주세요.');
  if(summary.sourceMaturityOn)warnings.push('사진의 만기일은 검토 예정일이며 실제 지급일로 입력하지 않습니다.');
  warnings.push('사진의 금액과 날짜를 확인한 뒤 저장해 주세요. OCR은 원장을 변경하지 않습니다.');return {rows:rows,text:String(text||''),sourceHash:sourceHash,layout:weekly?'weekly-detail':rows.some(function(r){return r.kind==='snapshot';})?'monthly-overview':'generic',summary:summary,warnings:Array.from(new Set(warnings))};
 }
 async function prepare(file){
  if(typeof document==='undefined')return file;
  var bitmap,url;
  try{
   if(typeof createImageBitmap==='function')bitmap=await createImageBitmap(file);
   else{url=URL.createObjectURL(file);bitmap=await new Promise(function(resolve,reject){var image=new Image();image.onload=function(){resolve(image);};image.onerror=reject;image.src=url;});}
   var scale=Math.min(1,3200/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
   var ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   var pixels=ctx.getImageData(0,0,canvas.width,canvas.height),dark=0,count=0;for(var i=0;i<pixels.data.length;i+=4*83){if((pixels.data[i]+pixels.data[i+1]+pixels.data[i+2])/3<100)dark++;count++;}
   if(dark/count>.6){ctx.filter='grayscale(1) invert(1) contrast(1.6)';ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);}
   else if(scale===1)return file;
   return await new Promise(function(resolve){canvas.toBlob(function(blob){resolve(blob||file);},'image/png');});
  }finally{if(bitmap&&typeof bitmap.close==='function')bitmap.close();if(url)URL.revokeObjectURL(url);}
 }
 function load(){if(typeof window==='undefined'||!base)return Promise.reject(new Error('브라우저에서 사진을 선택해 주세요.'));if(window.Tesseract)return Promise.resolve(window.Tesseract);if(loadPromise)return loadPromise;loadPromise=new Promise(function(resolve,reject){var s=document.createElement('script');s.src=new URL('tesseract.min.js',base).href;s.onload=function(){if(window.Tesseract)resolve(window.Tesseract);else{loadPromise=null;reject(new Error('OCR을 불러오지 못했습니다. 직접 입력할 수 있습니다.'));}};s.onerror=function(){loadPromise=null;s.remove();reject(new Error('OCR 파일을 불러오지 못했습니다. 직접 입력할 수 있습니다.'));};document.head.appendChild(s);});return loadPromise;}
 async function recognize(file,options){
  options=options||{};if(busy)throw new Error('다른 사진을 읽고 있습니다. 잠시 기다려 주세요.');if(!(file instanceof Blob)||!/^image\//.test(file.type||'')||!file.size||file.size>20*1024*1024)throw new Error('20MB 이하의 이미지 파일을 선택해 주세요.');busy=true;var timeout,generation=++jobSequence,ownedWorker=null;
  try{var bytes=await file.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes),sourceHash=Array.from(new Uint8Array(digest)).map(function(n){return n.toString(16).padStart(2,'0');}).join(''),T=await load();
   var task=(async function(){ownedWorker=await T.createWorker('eng+kor',1,{workerPath:new URL('worker.min.js',base).href,corePath:new URL('core/',base).href,langPath:new URL('lang/',base).href,workerBlobURL:false,gzip:true,cacheMethod:'none',logger:function(p){if(options.onProgress)options.onProgress({status:p.status,progress:Number(p.progress)||0});}});if(generation!==jobSequence){await ownedWorker.terminate();throw new Error('사진 읽기를 취소했습니다.');}activeWorker=ownedWorker;var result=await ownedWorker.recognize(file);if(generation!==jobSequence)throw new Error('사진 읽기를 취소했습니다.');var parseOptions=Object.assign({},options,{sourceHash:sourceHash}),parsed=parseText(result.data.text,parseOptions);
    // Inversion repairs small light month labels on dark lists, but can damage compact WE dates.
    // Keep the original pass for weekly tables and select a second pass only when it reads more complete rows.
    if(parsed.layout!=='weekly-detail'){var prepared=await prepare(file);if(generation!==jobSequence)throw new Error('사진 읽기를 취소했습니다.');if(prepared!==file){var second=await ownedWorker.recognize(prepared);if(generation!==jobSequence)throw new Error('사진 읽기를 취소했습니다.');var candidate=parseText(second.data.text,parseOptions),score=function(value){return value.rows.filter(function(r){return r.month&&r.amountCents!==null&&r.kind!=='unclassified'&&r.yearUnconfirmed!==true;}).length;};if(score(candidate)>score(parsed)){parsed=candidate;result=second;}}}
    parsed.confidence=result.data.confidence;return parsed;})();
   return await Promise.race([task,new Promise(function(_,reject){timeout=setTimeout(function(){reject(new Error('사진 읽기가 오래 걸립니다. 직접 입력하거나 다시 시도해 주세요.'));},90000);})]);
  }finally{clearTimeout(timeout);if(generation===jobSequence){jobSequence++;busy=false;}if(ownedWorker){try{await ownedWorker.terminate();}catch(ignore){}if(activeWorker===ownedWorker)activeWorker=null;}}
 }
 async function dispose(){jobSequence++;busy=false;if(activeWorker){try{await activeWorker.terminate();}catch(ignore){}activeWorker=null;}}
 return Object.freeze({recognize:recognize,parseText:parseText,cancel:dispose,dispose:dispose,get busy(){return busy;}});
});
