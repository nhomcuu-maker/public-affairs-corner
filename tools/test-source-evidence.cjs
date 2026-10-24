'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const report=JSON.parse(fs.readFileSync(path.join(root,'data/source_capture_report.json'),'utf8'));
assert.equal(report.verified,false);
assert.equal(report.published,false);
let n=0, pending=0;
for(const item of report.records){
 if(item.status!=='CANDIDATE_NOT_VERIFIED'){pending++;continue;}
 const p=path.join(root,item.filename);
 assert(p.startsWith(path.join(root,'evidence','review')+path.sep),'Evidence path escapes review directory');
 const digest=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
 assert.equal(digest,item.sha256,`Stale or corrupted evidence: ${item.key}`);
 n++;
}
assert(n>=1,'No source candidate with valid hash');
assert(pending>=1,'Some sources need manual content verification');
console.log(`PASS: ${n} source candidate(s) have matching file hash; ${pending} marked pending; none are verified or published`);
