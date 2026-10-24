'use strict';
// Offline-only tests; creates and deletes sample SQL in the OS temporary folder.
const { generate } = require('./create-staff-accounts-sql.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'gds-staff-test-'));
  const target = path.join(folder,'test.sql');
  try {
    const pass1 = 'UnitOnly.2026.Xyz', pass2 = 'SampleOnly.2026.Abc';
    const valid = {accounts:[
      {role:'editor',name:'Nguyễn Thị Thử',email:'editor.unit@test.local',password:pass1},
      {role:'publisher',name:'Trần Văn Kiểm',email:'publisher.unit@test.local',password:pass2}
    ]};
    await generate(JSON.stringify(valid), target);
    const sql = fs.readFileSync(target,'utf8');
    assert.match(sql,/DECLARE @Apply BIT = 0/);
    assert.match(sql,/PREVIEW_WILL_ROLLBACK/);
    assert.match(sql,/IF @@TRANCOUNT>0 ROLLBACK/);
    assert.match(sql,/INSERT dbo\.auth_credential/);
    assert.match(sql,/INSERT dbo\.user_role/);
    assert.match(sql,/IF EXISTS\(SELECT 1 FROM @Accounts a JOIN dbo\.app_user u ON u.email=a.email\)/);
    assert.ok(!sql.includes(pass1) && !sql.includes(pass2),'password never output');
    assert.ok(!sql.includes('Nguyễn Thị Thử'),'non-ASCII name safely encoded');
    assert.ok((sql.match(/0x[0-9a-f]{128}\)/g)||[]).length===2,'two 64-byte scrypt hashes');
    console.log('PASS STAFF ACCOUNTS: SQL preview guards, roles, 2 scrypt hashes, Unicode names, no cleartext');
    let duplicateFailed=false;
    try {await generate(JSON.stringify({accounts:[valid.accounts[0], {...valid.accounts[1],email:valid.accounts[0].email}]}),path.join(folder,'bad.sql'))}
    catch(e) {duplicateFailed=/distinct email/i.test(e.message)}
    assert.ok(duplicateFailed,'no duplicate emails allowed');
    let adminFailed=false;
    try {await generate(JSON.stringify({accounts:[{...valid.accounts[0],role:'admin'}]}),path.join(folder,'admin.sql'))}
    catch(e) {adminFailed=/role/i.test(e.message)}
    assert.ok(adminFailed,'admin provision disallowed');
    console.log('PASS STAFF ACCOUNTS: duplicate identities rejected, admin auto-grant blocked');
  } finally {fs.rmSync(folder,{recursive:true,force:true});}
})().catch(e=>{console.error('FAIL STAFF ACCOUNTS:',e.message);process.exitCode=1});
