'use strict';
// Anonymous/read-only checks only; never inserts a feedback row or sends private data.
const base=(process.env.GDS_BASE_URL||'http://127.0.0.1:3001').replace(/\/+$/,'');
const checks=[
  ['GET','/api/health',200],
  ['GET','/api/admin/feedback',401],
  ['POST','/api/assistant/ask',400,{}],
  ['POST','/api/assistant/feedback',403,{vote:'helpful',reason:'none',receipt:'invalid'}],
];
(async()=>{
  let errors=0;
  for(const [method,route,status,body] of checks){
    try{
      const r=await fetch(base+route,{method,headers:{'Accept':'application/json',...(method==='POST'?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});
      const ok=r.status===status;console.log(`${ok?'PASS':'FAIL'} ${method} ${route}: ${r.status}, expected ${status}`);if(!ok)errors++;
    }catch(err){errors++;console.log(`FAIL ${method} ${route}: ${err.message}`);}
  }
  if(errors){console.error('STEP 12 HTTP FAILED: '+errors);process.exitCode=1;}
  else console.log('STEP 12 HTTP: 4/4 PASS (anonymous/read-only). Staff & submit actions should be tested manually.');
})().catch(e=>{console.error(e);process.exitCode=1;});
