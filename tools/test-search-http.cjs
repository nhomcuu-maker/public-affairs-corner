'use strict';
// Integration smoke test. Run against localhost:3001 with NestJS already started.
const base='http://127.0.0.1:3001';
(async()=>{
  const checks=[
    ['/api/health',200],
    ['/api/search?q=nghi%20viec',200],
    ['/api/search?q=lua%20dao&domain=SCAM',200],
    ['/api/search?q=',400],
    ['/api/search?q=thoi%20viec&domain=INVALID',400],
    ['/api/admin/search?q=nghi%20viec',401],
  ];
  let failed=0;
  for(const [uri,wanted] of checks){
    try{
      const res=await fetch(base+uri,{redirect:'manual',headers:{Accept:'application/json'}});
      const body=await res.text();
      const draftLeak=uri.startsWith('/api/search?') && /GDS-MVP-(LEGAL|ADMIN|SCAM)-/.test(body);
      const okay=res.status===wanted&&!draftLeak;
      console.log(`${okay?'PASS':'FAIL'} ${uri}: ${res.status}${draftLeak?' (DRAFT LEAK)':''}`);
      if(!okay)failed++;
    }catch(e){failed++;console.log('FAIL '+uri+' '+e.message);}
  }
  if(failed){console.error('STEP 10 HTTP FAILED: '+failed);process.exitCode=1;}
  else console.log('STEP 10 HTTP: 6/6 PASS (anonymous/read-only; staff search separately test after login)');
})();
