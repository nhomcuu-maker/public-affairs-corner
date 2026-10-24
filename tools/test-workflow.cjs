'use strict';
// Unit tests for workflow role/state protection, without touching SQL Server.
// Reads the CURRENT project's TypeScript source and compiles it in memory.
// Run: node tools/test-workflow.cjs   (typescript package must be installed)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const input = fs.readFileSync(path.join(root,'src/admin/workflow.service.ts'),'utf8');
const compiled = ts.transpileModule(input,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
    experimentalDecorators:true,emitDecoratorMetadata:false,esModuleInterop:true},
  fileName:'workflow.service.ts',reportDiagnostics:true
});
const diagnostics=(compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
assert.equal(diagnostics.length,0,'TypeScript transpile failed: '+diagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText,' ')).join('; '));
const exception = status => class extends Error {
  constructor(msg) {super(msg);this.status=status;}
  getStatus(){return this.status;}
};
const common={
  BadRequestException:exception(400),ConflictException:exception(409),
  ForbiddenException:exception(403),NotFoundException:exception(404),
  Injectable:()=>target=>target
};
const stubSql={BigInt:'bigint',Date:'date',NVarChar:()=> 'nvarchar',MAX:999999};
const moduleObj={exports:{}};
vm.runInNewContext(compiled.outputText,{
  exports:moduleObj.exports,module:moduleObj,
  require(name){
    if(name==='@nestjs/common')return common;
    if(name==='mssql')return stubSql;
    if(name==='../database/database.service')return {DatabaseService:class {}};
    throw new Error('Unexpected imported module: '+name);
  },
  Reflect:{decorate:(decorators,klass)=>klass}
},{filename:'workflow.test.transpiled.js'});
const {WorkflowService}=moduleObj.exports;
assert.equal(typeof WorkflowService,'function');
const author={id:1,displayName:'Author Demo',email:'author@example.invalid',roles:['author','editor']};
const reviewer={id:2,displayName:'Reviewer Demo',email:'reviewer@example.invalid',roles:['reviewer']};
const publisher={id:3,displayName:'Publisher Test',email:'publisher@example.invalid',roles:['publisher']};
const visitor={id:4,displayName:'Visitor',email:'visitor@example.invalid',roles:[]};
const admin={id:3,displayName:'Admin',email:'admin@example.invalid',roles:['admin']};
const sample={id:17,createdBy:1,submittedBy:1,status:'draft',approvedBy:null,businessCode:'GDS-TEST-ROLLBACK'};
function fixture(patch={}){
  const log=[];
  const db={request(){return {
    input(...args){log.push(['input',args[0]]);return this},
    async query(q){log.push(['query',q]);return {recordset:[{ok:1}]}}};}};
  const service=new WorkflowService(db);
  service.meta=async()=>({...sample,...patch});
  return {service,log};
}
function hasQuery(log,fragment){return log.some(([type,q])=>type==='query'&&q.includes(fragment));}
async function fails(task,status,reason){
  await assert.rejects(task,err=>{
    assert.equal(err.status,status,reason+' expected HTTP '+status+'; got '+(err&&err.status));
    return true;
  });
}
async function run(){
  let count=0;
  async function t(title,fn){await fn();count++;console.log('PASS '+count+': '+title);}
  await t('Normal user cannot edit a draft',async()=>{
    const {service,log}=fixture();
    await fails(()=>service.saveDraft('17',visitor,{title:'Example title',summary:'Long enough for summary',bodyMarkdown:'Long enough text for body'}),403,'role');
    assert.equal(log.length,0);
  });
  await t('Author can submit and moderation event is inserted',async()=>{
    const {service,log}=fixture();
    const result=await service.submit('17',author,{reason:'Synthetic approval request for a test'});
    assert.equal(result.status,'review');assert.ok(hasQuery(log,'moderation_event'));
  });
  await t('Reviewer role alone cannot submit',async()=>{
    await fails(()=>fixture().service.submit('17',reviewer,{reason:'Synthetic approval request for a test'}),403,'role');
  });
  await t('Self-review is forbidden, even with admin role',async()=>{
    await fails(()=>fixture({status:'review',createdBy:3,submittedBy:3}).service.approve('17',admin,
      {reason:'Synthetic approval reasoning documented here',verifiedLegal:true,verifiedEvidence:true}),403,'self approve');
  });
  await t('Approval requires evidence/legal confirmations',async()=>{
    await fails(()=>fixture({status:'review'}).service.approve('17',reviewer,
      {reason:'Synthetic approval reasoning documented here',verifiedLegal:false,verifiedEvidence:true}),400,'confirm');
  });
  await t('Independent reviewer calls protected approve procedure',async()=>{
    const {service,log}=fixture({status:'review'});
    const result=await service.approve('17',reviewer,
      {reason:'Synthetic approval reasoning documented here',verifiedLegal:true,verifiedEvidence:true});
    assert.equal(result.status,'approved');assert.ok(hasQuery(log,'usp_approve_knowledge_version'));
  });
  await t('Independent reviewer can reject with reason and audit event',async()=>{
    const {service,log}=fixture({status:'review'});
    const result=await service.reject('17',reviewer,{reason:'Synthetic rejection: further work is necessary'});
    assert.equal(result.status,'rejected');assert.ok(hasQuery(log,"N'reject'"));
  });
  await t('Publication requires exact typed confirmation',async()=>{
    await fails(()=>fixture({status:'approved',approvedBy:2}).service.publish('17',publisher,
      {reason:'Synthetic publishing reasoning documented here',verifiedLegal:true,verifiedEvidence:true,publishConfirm:'YES'}),400,'confirm');
  });
  await t('Publisher cannot be the approver or author',async()=>{
    await fails(()=>fixture({status:'approved',approvedBy:3}).service.publish('17',publisher,
      {reason:'Synthetic publishing reasoning documented here',verifiedLegal:true,verifiedEvidence:true,publishConfirm:'CONG_BO'}),403,'role separation');
  });
  await t('Independent publisher uses guarded SQL procedure',async()=>{
    const {service,log}=fixture({status:'approved',approvedBy:2});
    const result=await service.publish('17',publisher,
      {reason:'Synthetic publishing reasoning documented here',verifiedLegal:true,verifiedEvidence:true,publishConfirm:'CONG_BO'});
    assert.equal(result.status,'published');assert.ok(hasQuery(log,'usp_publish_knowledge_version'));
  });
  await t('Invalid version IDs rejected without querying SQL',async()=>{
    const {service,log}=fixture();
    await fails(()=>service.submit('17 OR 1=1',author,{reason:'Synthetic approval request for a test'}),400,'bad version');
    assert.equal(log.length,0);
  });
  await t('Cannot submit an already published version',async()=>{
    const {service,log}=fixture({status:'published'});
    await fails(()=>service.submit('17',author,{reason:'Synthetic approval request for a test'}),409,'immutable');
    assert.equal(log.length,0);
  });
  console.log('ALL '+count+' WORKFLOW UNIT TESTS PASSED. These are mocked service tests, not live SQL Server E2E tests.');
}
run().catch(error=>{console.error('FAIL:',error);process.exitCode=1});
