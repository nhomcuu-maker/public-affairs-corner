'use strict';
// Non-destructive HTTP smoke checks. Limit to 4 questions to stay under public API throttle (12/min).
const base=(process.env.GDS_BASE_URL||'http://127.0.0.1:3001').replace(/\/$/,'');
const tests=[
 ['Cư trú','Tôi mới chuyển chỗ ở, cần thực hiện những thủ tục cư trú nào?',/(?:cư trú|tạm trú|thường trú)/i],
 ['Lao động mang thai','Tôi đang mang thai và bị gây áp lực nghỉ việc, nên tìm hỗ trợ ở đâu?',/(?:lao động|mang thai)/i],
 ['Nợ lương','Công ty nợ lương hai tháng, tôi cần làm gì để yêu cầu thanh toán?',/(?:lương|hợp đồng)/i],
 ['Cấp cứu','Con tôi bị sốt cao và co giật, bây giờ tôi phải làm gì?',/(?:115|cấp cứu)/i]
];
(async()=>{
 let ok=0;
 for(const [title,question,pattern] of tests){
  try {
   const r=await fetch(base+'/api/assistant/ask',{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({question}),signal:AbortSignal.timeout(25000)});
   const j=await r.json();const response=(j.answer?.summary||'')+' '+(j.answer?.nextSteps||[]).join(' ');
   if(!r.ok||!pattern.test(response))throw Error('HTTP '+r.status+'; status '+j.status+'; '+response.slice(0,130));
   if((j.answer?.citationIds||[]).some(id=>!j.evidence?.some(e=>e.id===id)))throw Error('Citation ID khong ton tai');
   if(title==='Cư trú' && /phai dang ky truoc khi den/i.test(response))throw Error('Phat hien loi quy dinh cu tru');
   console.log('PASS '+title+' / '+j.status+' / modelActive='+j.modelActive);ok++;
  }catch(e){console.error('FAIL '+title+': '+e.message);process.exitCode=1;}
 }
 console.log('GDS LIVE HTTP: '+ok+'/'+tests.length+' PASS');
})();
