/* Device-only OCR. Images remain in this browser; all engine assets are self-hosted. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./presence-recap-lab-model.js'),null);else root.PresenceRecapLabOCR=factory(root.PresenceRecapLabModel,document.currentScript&&document.currentScript.src);})(typeof globalThis!=='undefined'?globalThis:this,function(M,scriptURL){
 'use strict';var loadPromise=null,busy=false,activeWorker=null,jobSequence=0;
 var base=scriptURL?new URL('./vendor/tesseract-6.0.1/',scriptURL).href:null;
 function hash(text){var h=2166136261;for(var i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
 function parseText(text,options){
  options=options||{};var rows=[],warnings=[],months=['january','february','march','april','may','june','july','august','september','october','november','december'];
  var sourceHash=options.sourceHash||'text-'+hash(String(text)),year=/^\d{4}$/.test(String(options.year||''))?String(options.year):null,defaultMonth=/^\d{4}-\d{2}$/.test(options.month||'')?options.month:null;
  String(text||'').replace(/[−–]/g,'-').split(/\r?\n/).forEach(function(raw,index){
   var line=raw.trim();if(!line)return;var lower=line.toLowerCase(),month=defaultMonth,monthMatch=line.match(/(\d{4})[./-](0?[1-9]|1[0-2])(?:월|(?=[^\d]|$))/),named=months.findIndex(function(m){return new RegExp('\\b'+m+'\\b','i').test(line);}),ko=line.match(/(?:^|\s)(1[0-2]|0?[1-9])월/);
   if(monthMatch)month=monthMatch[1]+'-'+String(+monthMatch[2]).padStart(2,'0');else if(named>=0&&year)month=year+'-'+String(named+1).padStart(2,'0');else if(ko&&year)month=year+'-'+String(+ko[1]).padStart(2,'0');
   var hasMonth=monthMatch||named>=0||ko,kind=/(credit|credited|입금|적립)/i.test(line)?'credit':/(debit|출금|차감)/i.test(line)?'debit':/(adjustment|조정)/i.test(line)?'adjustment':/(balance|snapshot|잔액|잔고)/i.test(line)||hasMonth?'snapshot':'unclassified';
   var cleaned=line.replace(/\bWE\s*(?:\d{4}-\d{2}-\d{2}|(?:0?[1-9]|1[0-2])[./](?:0?[1-9]|[12]\d|3[01]))\b/gi,' ').replace(/\d{4}[./-]\d{1,2}[./-]\d{1,2}/g,' ').replace(/\d{4}[./-]\d{1,2}(?:월)?/g,' ').replace(/(?:^|\s)\d{1,2}월/g,' ');
   var tokens=cleaned.match(/(?<![\d.])-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?(?![\d.])/g)||[];
   if(!tokens.length)return;var amount=null;if(tokens.length===1){try{amount=M.parseMoneyCents(tokens[0],{allowNegative:true});}catch(ignore){}}else warnings.push('여러 금액이 있는 행은 직접 확인해 주세요: '+(index+1));
   var asOf=null,occurred=null,we=null,dateMatch=line.match(/\b(\d{4}-\d{2}-\d{2})\b/);if(dateMatch){try{M.isoDate(dateMatch[1]);if(/as\s*of|기준일/i.test(line))asOf=dateMatch[1];if(/입금일|거래일|credited\s*on|transaction\s*date/i.test(line))occurred=dateMatch[1];}catch(ignore){warnings.push('유효하지 않은 날짜가 있습니다.');}}
   var weMatch=line.match(/\bWE\s*(\d{4}-\d{2}-\d{2})\b/i);if(weMatch){try{M.isoDate(weMatch[1]);if(new Date(weMatch[1]+'T00:00:00Z').getUTCDay()===0)we=weMatch[1];else warnings.push('WE가 일요일이 아니어서 배정하지 않았습니다.');}catch(ignore){}}
   if(!month&&asOf)month=asOf.slice(0,7);var row={id:'ocr-'+hash(sourceHash+'|'+index+'|'+line),kind:kind,month:month,amountCents:amount,asOfDate:asOf,occurredOn:occurred,weekEnding:we,source:'ocr',sourceHash:sourceHash,rawText:raw,confidence:null,confirmed:false};if(kind==='snapshot')row.balanceCents=amount;rows.push(row);
  });
  if(!rows.length)warnings.push('읽은 금액이 없습니다. 직접 입력할 수 있습니다.');if(rows.some(function(r){return r.kind==='unclassified'||r.amountCents==null||!r.month;}))warnings.push('종류·월·금액이 미확정인 행을 수정해 주세요.');warnings.push('사진의 금액과 날짜를 확인한 뒤 저장해 주세요. OCR은 원장을 변경하지 않습니다.');return {rows:rows,text:String(text||''),sourceHash:sourceHash,warnings:warnings};
 }
 function load(){if(typeof window==='undefined'||!base)return Promise.reject(new Error('브라우저에서 사진을 선택해 주세요.'));if(window.Tesseract)return Promise.resolve(window.Tesseract);if(loadPromise)return loadPromise;loadPromise=new Promise(function(resolve,reject){var s=document.createElement('script');s.src=new URL('tesseract.min.js',base).href;s.onload=function(){if(window.Tesseract)resolve(window.Tesseract);else{loadPromise=null;reject(new Error('OCR을 불러오지 못했습니다. 직접 입력할 수 있습니다.'));}};s.onerror=function(){loadPromise=null;s.remove();reject(new Error('OCR 파일을 불러오지 못했습니다. 직접 입력할 수 있습니다.'));};document.head.appendChild(s);});return loadPromise;}
 async function recognize(file,options){
  options=options||{};if(busy)throw new Error('다른 사진을 읽고 있습니다. 잠시 기다려 주세요.');if(!(file instanceof Blob)||!/^image\//.test(file.type||'')||!file.size||file.size>20*1024*1024)throw new Error('20MB 이하의 이미지 파일을 선택해 주세요.');busy=true;var timeout,generation=++jobSequence,ownedWorker=null;
  try{var bytes=await file.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes),sourceHash=Array.from(new Uint8Array(digest)).map(function(n){return n.toString(16).padStart(2,'0');}).join(''),T=await load();
   var task=(async function(){ownedWorker=await T.createWorker('eng+kor',1,{workerPath:new URL('worker.min.js',base).href,corePath:new URL('core/',base).href,langPath:new URL('lang/',base).href,workerBlobURL:false,gzip:true,cacheMethod:'none',logger:function(p){if(options.onProgress)options.onProgress({status:p.status,progress:Number(p.progress)||0});}});if(generation!==jobSequence){await ownedWorker.terminate();throw new Error('사진 읽기를 취소했습니다.');}activeWorker=ownedWorker;var result=await ownedWorker.recognize(file);if(generation!==jobSequence)throw new Error('사진 읽기를 취소했습니다.');var parsed=parseText(result.data.text,Object.assign({},options,{sourceHash:sourceHash}));parsed.confidence=result.data.confidence;return parsed;})();
   return await Promise.race([task,new Promise(function(_,reject){timeout=setTimeout(function(){reject(new Error('사진 읽기가 오래 걸립니다. 직접 입력하거나 다시 시도해 주세요.'));},90000);})]);
  }finally{clearTimeout(timeout);if(generation===jobSequence){jobSequence++;busy=false;}if(ownedWorker){try{await ownedWorker.terminate();}catch(ignore){}if(activeWorker===ownedWorker)activeWorker=null;}}
 }
 async function dispose(){jobSequence++;busy=false;if(activeWorker){try{await activeWorker.terminate();}catch(ignore){}activeWorker=null;}}
 return Object.freeze({recognize:recognize,parseText:parseText,cancel:dispose,dispose:dispose,get busy(){return busy;}});
});
