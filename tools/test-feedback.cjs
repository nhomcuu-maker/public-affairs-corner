'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ts=require('typescript'),root=path.resolve(__dirname,'..');let count=0;
function test(name,fn){fn();console.log('PASS '+(++count)+': '+name);}
function read(pathname){return fs.readFileSync(path.join(root,pathname),'utf8');}
function loadTs(filename,overrides={}){
 const result=ts.transpileModule(read(filename),{fileName:filename,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:false},reportDiagnostics:true});
 assert.equal((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,filename);
 const mod={exports:{}};new Function('require','module','exports',result.outputText)(name=>{if(name in overrides)return overrides[name];throw Error('missing mock '+name);},mod,mod.exports);
 return mod.exports;
}
const logic=loadTs('src/feedback/feedback.logic.ts');
test('Rejects empty feedback',()=>assert.throws(()=>logic.validateFeedback({})));
test('Rejects unrecognized reason',()=>assert.throws(()=>logic.validateFeedback({receipt:'A'.repeat(42),vote:'not_helpful',reason:'hack'})));
test('Requires a reason when vote not helpful',()=>assert.throws(()=>logic.validateFeedback({receipt:'A'.repeat(42),vote:'not_helpful',reason:'none'})));
test('Allows valid helpful vote',()=>assert.equal(logic.validateFeedback({receipt:'A'.repeat(42),vote:'helpful',reason:'none'}).vote,'helpful'));
test('Does not return PII in safe metrics',()=>{const m=logic.safeMetrics({mode:'STAFF_DRAFT_PREVIEW',status:'RETRIEVAL_ONLY',intent:'BENEFIT',evidence:[{}],question:'my secret',email:'abc@def.org'});assert.equal(m.scope,'staff');assert(!JSON.stringify(m).includes('secret')&&!JSON.stringify(m).includes('@'));});
const fakeNest={Injectable:()=>clazz=>clazz,BadRequestException:class extends Error{},ForbiddenException:class extends Error{},ConflictException:class extends Error{},NotFoundException:class extends Error{}};
const Service=loadTs('src/feedback/feedback.service.ts',{'@nestjs/common':fakeNest,'node:crypto':crypto,'mssql':{Binary:n=>n,VarBinary:n=>n,NVarChar:n=>n,SmallInt:1,BigInt:2},'../database/database.service':{},'./feedback.logic':logic}).FeedbackService;
const captures=[];let mode='ok';
const request=()=>{const values=[];return {input(k,_type,v){values.push([k,v]);return this;},async query(q){captures.push({q,values});if(mode==='duplicate')throw Error('Violation of UNIQUE KEY 2627');return {recordset:[{changed:1}]};}};};
const service=new Service({request});
const publicAnswer={mode:'PUBLISHED_ONLY',status:'INSUFFICIENT_EVIDENCE',intent:'BENEFIT',evidence:[],question:'Do not save me'};
const token=service.issue(publicAnswer);
test('Receipt has HMAC signature',()=>assert.equal(token.split('.').length,2));
test('Receipt does not expose original question',()=>assert(!Buffer.from(token.split('.')[0],'base64url').toString().includes('Do not save me')));
test('Tampered receipt rejected',()=>assert.throws(()=>service.verify(token+'x')));
test('Forged answer metadata not taken from client',()=>{const x=service.verify(token);assert.equal(x.scope,'public');assert.equal(x.count,0);});
(async()=>{
  let i=0;async function asyncTest(name,fn){await fn();console.log('PASS A'+(++i)+': '+name);}
  await asyncTest('Submit feedback writes parameterized SQL',async()=>{const v=await service.submit({receipt:token,vote:'not_helpful',reason:'missing_source'});assert(v.ok);assert(captures[0].q.includes('INSERT dbo.assistant_feedback'));assert(!captures[0].q.includes(token));});
  await asyncTest('Receipt digest differs from raw token',async()=>{const digest=captures[0].values.find(x=>x[0]==='digest')[1];assert(Buffer.isBuffer(digest));assert.equal(digest.length,32);});
  await asyncTest('Duplicate SQL token returns conflict',async()=>{mode='duplicate';await assert.rejects(()=>service.submit({receipt:token,vote:'helpful',reason:'none'}),/đã được gửi/);mode='ok';});
  await asyncTest('Review action updates pending only',async()=>{await service.markReviewed('1',{id:3,roles:['reviewer']});assert(captures.some(x=>x.q.includes("review_status=N'pending'")));});
  await asyncTest('Non-reviewer cannot resolve',async()=>await assert.rejects(()=>service.markReviewed('1',{id:3,roles:['author']}),/Chỉ Admin\/Reviewer/));
  const sql=read('sql/10_Tao_Bang_Phan_Hoi_Tro_Ly.sql');
  test('SQL migration transactional and rerunnable',()=>{assert(sql.includes('BEGIN TRANSACTION'));assert(sql.includes('OBJECT_ID'));assert(sql.includes('COMMIT TRANSACTION'));});
  test('SQL schema excludes raw questions and IP',()=>{assert(!/\[?(?:question|answer_text|ip_address|email|raw_text)\]?\s+(?:NVARCHAR|VARCHAR)/i.test(sql));});
  const frontend=read('public/js/gds-assistant.js');const html=read('public/tro-ly-ai.html');
  test('Unified assistant page declared',()=>{assert(html.includes('id="gds-chat-host"'));assert(html.includes('/js/gds-chat.js'));});
  test('All frontend JavaScript parses',()=>{new Function(frontend);new Function(read('public/js/gds-feedback-admin.js'));});
  test('Source links HTTPS-only and DOM uses textContent',()=>{assert(frontend.includes("x.protocol==='https:'"));assert(frontend.includes('el.textContent'));});
  test('Feedback posted to same-origin API',()=>{assert(frontend.includes("'/api/assistant/feedback'"));assert(frontend.includes("credentials:'same-origin'"));});
  test('Script preserves custom HTML design',()=>{assert(!read('public/js/gds-assistant.js').includes('document.body.innerHTML'));});
  for(const filename of ['src/feedback/feedback.module.ts','src/feedback/feedback.controller.ts','src/assistant/assistant.controller.ts','src/assistant/assistant.module.ts','src/assistant/assistant.logic.ts','src/search/search.service.ts']){
    const out=ts.transpileModule(read(filename),{fileName:filename,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}});
    assert.equal(out.diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,filename);
  }
  test('New and modified TypeScript files parse',()=>{});
  console.log(`STEP 12 PASS: ${count} synchronous checks; ${i} async checks. SQL Server E2E requires user's SSMS.`);
})().catch(err=>{console.error(err);process.exitCode=1;});
