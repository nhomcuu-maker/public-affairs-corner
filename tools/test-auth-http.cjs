'use strict';
// Smoke test for a running LOCAL GocDanSinh NestJS instance; no login/session used.
// No write requests, no database mutation, no secret extraction.
const assert=require('node:assert/strict');
const base='http://127.0.0.1:3001';
async function test(){
  const checks=[
    ['/api/health',200],
    ['/api/domains',200],
    ['/api/admin/overview',401],
    ['/api/admin/content',401],
    ['/api/admin/content/1',401],
    ['/api/content?domain=LEGAL',200],
    ['/api/content?domain=ADMIN',200],
    ['/api/content?domain=SCAM',200],
  ];
  let passed=0;
  for(const [path,want] of checks){
    const response=await fetch(base+path,{redirect:'manual',cache:'no-store'});
    assert.equal(response.status,want,`${path}: HTTP ${response.status}, expected ${want}`);
    const data=await response.text();
    if(path==='./api/health') {
      const parsed=JSON.parse(data);
      assert.equal(parsed.ok,true); assert.equal(parsed.db,'connected');
    }
    if(path==='./api/content?domain=ADMIN'){
      assert.ok(!data.includes('GDS-ADMIN-HOCHIEU-26270'),
        'Passport draft unexpectedly exposed by public content API');
    }
    passed++; console.log(`PASS ${passed}: GET ${path} -> ${want}`);
  }
  console.log(`ALL ${passed} HTTP SMOKE CHECKS PASSED (unauthenticated/read-only).`);
}
test().catch(err=>{console.error('FAIL:',err.message);process.exitCode=1});
