'use strict';
const base=(process.env.GDS_BASE_URL||'http://127.0.0.1:3001').replace(/\/$/,'');
let passed=0,failed=0;
async function check(label,fn){try{await fn();passed++;console.log('PASS '+label);}catch(e){failed++;console.error('FAIL '+label+': '+e.message);}}
async function request(endpoint,body){const r=await fetch(base+endpoint,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});let j={};try{j=await r.json();}catch{}return{r,j};}
(async()=>{
 await check('/api/health',async()=>{const{r}=await request('/api/health');if(r.status!==200)throw Error('HTTP '+r.status);});
 await check('Public assistant asks question without 500',async()=>{const{r,j}=await request('/api/assistant/ask',{question:'Tôi vừa nghỉ việc có được hưởng trợ cấp thất nghiệp không?'});if(r.status!==200)throw Error('HTTP '+r.status);if(!j.status||!j.answer||!Array.isArray(j.evidence))throw Error('invalid response');if(j.evidence.some(x=>x.editorialStatus!=='published'))throw Error('Draft leaked');});
 await check('Safety question handled',async()=>{const{r,j}=await request('/api/assistant/ask',{question:'Có người giả danh BHXH đòi chuyển tiền và OTP?'});if(r.status!==200)throw Error('HTTP '+r.status);if(j.urgentSafety!==true)throw Error('Expected safety intent');});
 await check('Too-short question rejected',async()=>{const{r}=await request('/api/assistant/ask',{question:'x'});if(r.status!==400)throw Error('HTTP '+r.status);});
 await check('Invalid domain rejected',async()=>{const{r}=await request('/api/assistant/ask',{question:'Tôi cần hỏi một thủ tục?',domain:'UNKNOWN'});if(r.status!==400)throw Error('HTTP '+r.status);});
 await check('Staff preview requires login',async()=>{const{r}=await request('/api/admin/assistant/ask',{question:'Tôi vừa nghỉ việc có được hưởng trợ cấp thất nghiệp không?'});if(r.status!==401)throw Error('HTTP '+r.status);});
 console.log('STEP 11 HTTP: '+passed+'/'+(passed+failed)+' PASS. Provider/authorized-staff E2E require separate acceptance.');
 if(failed)process.exitCode=1;
})();
