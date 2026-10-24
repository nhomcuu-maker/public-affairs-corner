'use strict';
// Read-only checks; no cookie is sent, and no data is modified.
const base='http://127.0.0.1:3001';
(async()=>{
 let fails=0;
 const cases=[
  ['/api/health',200,false],
  ['/api/admin/mvp',401,false],
  ['/api/admin/mvp/item/GDS-MVP-LEGAL-BHTN',401,false],
  ['/api/content?domain=LEGAL',200,true],
  ['/api/content?domain=ADMIN',200,true],
  ['/api/content?domain=SCAM',200,true],
 ];
 for(const [url,expected,checkDraft] of cases){
  try{
   const r=await fetch(base+url,{redirect:'manual'});
   const body=await r.text();
   const leaked=checkDraft && body.includes('GDS-MVP-');
   const ok=r.status===expected && !leaked;
   console.log(`${ok?'PASS':'FAIL'} ${url}: HTTP ${r.status} (expected ${expected})${leaked?', DRAFT LEAK DETECTED':''}`);
   if(!ok)fails++;
  }catch(e){fails++;console.error('FAIL',url,String(e));}
 }
 if(fails){process.exitCode=1;console.error('STEP9 HTTP FAIL',fails);}
 else console.log('STEP9 HTTP: 6/6 PASS (unauthenticated, no draft leak)');
})().catch(e=>{console.error(e);process.exitCode=1;});
