'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const script=path.join(__dirname,'stage-all-existing.cjs');
const code=fs.readFileSync(script,'utf8');
assert.match(code,/GDS_BULK_STAGE_ACK/);
assert.match(code,/PENDING_ONLY_CONFIRMED/);
assert.match(code,/editorial_status IN\(N'draft',N'rejected'\)/);
assert.match(code,/ISOLATION_LEVEL\.SERIALIZABLE/);
assert.match(code,/CONVERT\(BIGINT,SCOPE_IDENTITY\(\)\)/);
assert.match(code,/INSERT dbo\.knowledge_version_source/);
assert.doesNotMatch(code,/INSERT dbo\.source_verification|EXEC dbo\.usp_approve|EXEC dbo\.usp_publish/);
assert.doesNotMatch(code,/UPDATE dbo\.knowledge_version|DELETE FROM dbo\.knowledge_version/);
const run=spawnSync(process.execPath,[script,'--preview'],{cwd:root,encoding:'utf8',env:{...process.env,DB_SERVER:'no-server-should-be-contacted'}});
assert.equal(run.status,0,run.stderr);
assert.match(run.stdout,/BULK PREVIEW ONLY/);
assert.match(run.stdout,/EVIDENCE LEGAL: HASH_OK/);
assert.match(run.stdout,/EVIDENCE ADMIN: HASH_OK/);
assert.match(run.stdout,/EVIDENCE SCAM2: HASH_OK/);
assert.match(run.stdout,/no database connection or writes/);
console.log('BULK STAGE UNIT: 12/12 PASS (offline, no network or SQL).');
// Regression: every parameter in the source_snapshot INSERT must have a value.
// The previous version supplied five VALUES expressions for six columns,
// yielding SQL Server: "more columns in INSERT statement than values".
function countTopLevelExpressions(list){
  let depth=0,count=1,quoted=false;
  for(let i=0;i<list.length;i++){
    const ch=list[i];
    if(ch==="'"){
      if(quoted && list[i+1]==="'"){i++;continue;}
      quoted=!quoted;
    }else if(!quoted){
      if(ch==='(')depth++;
      else if(ch===')')depth--;
      else if(ch===',' && depth===0)count++;
    }
  }
  assert.equal(depth,0);
  assert.equal(quoted,false);
  return count;
}
const snapshotInsert=code.match(/INSERT\s+dbo\.source_snapshot\s*\(([^)]*)\)\s*VALUES\s*\((@source,SYSUTCDATETIME\(\),@hash,@asset,@url,N'manual')\)/);
assert.ok(snapshotInsert,'source_snapshot INSERT must include @asset in fourth value position');
assert.equal(countTopLevelExpressions(snapshotInsert[1]),6);
assert.equal(countTopLevelExpressions(snapshotInsert[2]),6);
assert.match(code,/WHERE\s+version_id=@version\s+AND\s+snapshot_id=@snap/);
console.log('BULK SQL REGRESSION: PASS, 6 columns match 6 VALUES; no duplicate linkage.');
