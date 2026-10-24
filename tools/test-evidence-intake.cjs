'use strict';
// Offline unit tests. No network, no database writes or approval of real sources.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'src/admin/evidence-intake.service.ts'),'utf8');
const compiled=ts.transpileModule(code,{fileName:'evidence-intake.service.ts',
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,esModuleInterop:true},reportDiagnostics:true});
assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
const error=status=>class extends Error {constructor(msg){super(msg);this.status=status;}getStatus(){return this.status;}};
const common={BadRequestException:error(400),ConflictException:error(409),ForbiddenException:error(403),NotFoundException:error(404),Injectable:()=>klass=>klass};
const stubSql={BigInt:'bigint',Date:'date',NVarChar:()=> 'nvarchar',VarBinary:()=> 'varbinary',MAX:900000};
const mod={exports:{}};
vm.runInNewContext(compiled.outputText,{
  module:mod,exports:mod.exports,process,Buffer,URL,Date,
  require(name){if(name==='@nestjs/common')return common;
    if(name==='mssql')return stubSql;
    if(name==='../database/database.service')return {DatabaseService:class {}};
    return require(name);},Reflect:{decorate:(_decorators,x)=>x}
},{filename:'test-evidence-intake.transpiled.js'});
const {EvidenceIntakeService,safeEvidenceName}=mod.exports;
const author={id:1,roles:['editor'],displayName:'Editor',email:'editor@example.invalid'};
const reviewer={id:2,roles:['reviewer'],displayName:'Reviewer',email:'reviewer@example.invalid'};
const visitor={id:3,roles:[],displayName:'Public',email:'anon@example.invalid'};
const filename='canh_bao_mao_danh_bhxh_2025_v2.pdf';
const pdf=fs.readFileSync(path.join(root,'evidence/review',filename));
const hash=crypto.createHash('sha256').update(pdf).digest();
const calls=[];
const db={request(){const inputs={};return {input(k,_type,v){inputs[k]=v;return this;},
  async query(q){calls.push({q,inputs});
    if(q.includes('SELECT TOP(1) v.id,v.item_id'))return {recordset:[{itemId:4,status:db.status||'draft',createdBy:1,submittedBy:1}]};
    if(q.includes('src.canonical_url AS url'))return {recordset:[{url:'https://baohiemxahoi.gov.vn/tintuc/Pages/example.aspx'}]};
    if(q.includes('fa.storage_key AS storageKey'))return {recordset:[{storageKey:'evidence/review/'+filename,originalHash:hash,snapshotHash:hash,sizeBytes:pdf.length,officialUrl:'https://baohiemxahoi.gov.vn/tintuc/Pages/example.aspx'}]};
    if(q.includes('SELECT src.id AS sourceId'))return {recordset:[{sourceId:13,title:'Official warning',url:'https://baohiemxahoi.gov.vn/tintuc/Pages/example.aspx'}]};
    return {recordset:[{snapshotId:55}]};
  }};}};
const svc=new EvidenceIntakeService(db);
const goodAttach={sourceId:13,fileName:filename,locator:'Phần cảnh báo OTP và chuyển tiền',reason:'Lưu từ trang chính thức để đối chiếu thủ công. Chưa xác nhận tính đầy đủ.'};
const date=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
const goodVerify={snapshotId:55,decision:'accepted',reason:'Đã so sánh thủ công văn bản và bản lưu với trang chính thức. Nội dung chính xác trong phạm vi các dấu hiệu, phần ảnh thiếu không được dùng làm căn cứ. Đối chiếu lại theo hạn đã đặt.',validUntil:date,
  checkedOriginal:true,checkedHash:true,checkedContent:true,checkedCompleteness:true};
const tests=[];
async function test(name,fn){await fn();tests.push(name);console.log('PASS EVIDENCE '+tests.length+': '+name);}
async function fail(run,status){await assert.rejects(run,e=>{assert.equal(e.status,status);return true;});}
(async()=>{
 await test('Filename validation blocks traversal',async()=>{
   for(const name of ['../../foo.pdf','C:\\secrets.pdf','bad.html','.hidden.pdf','evil..pdf'])await fail(async()=>safeEvidenceName(name),400);
   assert.equal(safeEvidenceName(filename),filename);
 });
 await test('Unauthenticated user cannot register evidence',async()=>{calls.length=0;await fail(()=>svc.attach('4',visitor,goodAttach),403);assert.equal(calls.length,0);});
 await test('Bad source IDs and filenames fail before SQL',async()=>{calls.length=0;await fail(()=>svc.attach('4',author,{...goodAttach,sourceId:0}),400);assert.equal(calls.length,0);});
 await test('Registration checks the local PDF and adds pending-only snapshot',async()=>{
   db.status='draft';calls.length=0;
   const res=await svc.attach('4',author,goodAttach);
   assert.equal(res.verification,'PENDING_REVIEW');assert.equal(res.published,false);
   assert.equal(res.sha256,hash.toString('hex').toUpperCase());
   const query=calls.at(-1).q;
   assert.match(query,/INSERT dbo\.source_snapshot/);assert.match(query,/INSERT dbo\.knowledge_version_source/);
   assert.doesNotMatch(query,/INSERT dbo\.source_verification|usp_approve_knowledge_version|usp_publish_knowledge_version/);
   assert.match(query,/BEGIN TRAN/);
 });
 await test('Attach cannot target already submitted version',async()=>{db.status='review';await fail(()=>svc.attach('4',author,goodAttach),409);});
 await test('Reviewer cannot verify without mandatory human checks',async()=>{db.status='review';calls.length=0;await fail(()=>svc.verify('4',reviewer,{...goodVerify,checkedCompleteness:false}),400);assert.equal(calls.length,0);});
 await test('Author cannot self-verify',async()=>{calls.length=0;await fail(()=>svc.verify('4',author,goodVerify),403);assert.equal(calls.length,0);});
 await test('Independent reviewer records immutable verification, never approves content',async()=>{
   calls.length=0;const r=await svc.verify('4',reviewer,goodVerify);
   assert.equal(r.decision,'accepted');
   const q=calls.at(-1).q;
   assert.match(q,/INSERT dbo\.source_verification/);
   assert.match(q,/@author=@actor OR @submitter=@actor/);
   assert.match(q,/evidence_attach.*actor_id=@actor/);
   assert.doesNotMatch(q,/usp_publish_knowledge_version|usp_approve_knowledge_version|UPDATE dbo\.knowledge_version/);
 });
 await test('Known host allow-list forbids fake source URL',async()=>{
   db.status='draft';
   const altered={...db,request(){const request=db.request(); const orig=request.query.bind(request);
     request.query=async q=>q.includes('src.canonical_url AS url')?{recordset:[{url:'https://fakedomain.example/legal'}]}:orig(q);
     return request;}};
   await fail(()=>new EvidenceIntakeService(altered).attach('4',author,goodAttach),400);
 });
 console.log('EVIDENCE INTAKE UNIT: '+tests.length+'/'+tests.length+' PASS; no database writes, no publication.');
})().catch(err=>{console.error('EVIDENCE UNIT FAILED:',err);process.exitCode=1;});
