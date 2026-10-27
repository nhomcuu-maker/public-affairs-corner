'use strict';
// Legacy model-mode regression only. Public server defaults to grounded-only mode.
process.env.AI_ALLOW_UNVERIFIED_GENERAL='1';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function compile(f,overrides={}){
 const code=ts.transpileModule(fs.readFileSync(path.join(root,f),'utf8'),{
   fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:false},reportDiagnostics:true
 });
 assert.equal((code.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 const mod={exports:{}};
 new Function('require','module','exports',code.outputText)((s)=>{
   if(s in overrides)return overrides[s];
   throw new Error('unexpected dependency '+s);
 },mod,mod.exports);
 return mod.exports;
}
const searchLogic=compile('src/search/search.logic.ts');
const logic=compile('src/assistant/assistant.logic.ts',{'../search/search.logic':searchLogic});
const triage=compile('src/assistant/assistant.triage.ts',{'../search/search.logic':searchLogic});
const mod=compile('src/assistant/assistant.service.ts',{
 '@nestjs/common':{Injectable:()=>x=>x,Logger:class{warn(){} log(){} debug(){}},ServiceUnavailableException:class extends Error{}},
 '../search/search.service':{SearchService:class{}},
 './assistant.logic':logic,
 './assistant.catalog':{catalogEvidence:()=>[]},
 './assistant.triage':triage,
});
const doc=(status='published')=>({versionId:1,businessCode:'GDS-MVP-LEGAL',domain:'LEGAL',title:'Quyền lợi BHTN',summary:'Cần kiểm tra quá trình đóng và lý do nghỉ việc',editorialStatus:status,sources:[{title:'Nguồn tham khảo',url:'https://example.org/x',status:status==='published'?'accepted':'pending_review'}]});
const search={
  retrieval:'RULE_BASED_LEXICAL',intent:'BENEFIT',urgentSafety:false,missingInformation:['Thời gian đóng bảo hiểm'],links:[],
  results:[doc()],related:[],
};
let lookup={...search};
const svc=new mod.AssistantService({
 search:async(_query,staff)=>lookup,
 excerptsForAssistant:async()=>new Map([[1,'Quy trình đăng ký trợ cấp phải kiểm tra điều kiện được ghi trong dữ liệu.']]),
});
// This test intentionally mocks the remote OpenAI-compatible provider.
// It must NOT inherit the live Ollama launcher environment: the expectation
// below is Authorization: Bearer mock-key, not the Ollama token.
const old={AI_PROVIDER:process.env.AI_PROVIDER,AI_API_KEY:process.env.AI_API_KEY,AI_MODEL:process.env.AI_MODEL,AI_ALLOW_STAFF_DRAFTS:process.env.AI_ALLOW_STAFF_DRAFTS,AI_BASE_URL:process.env.AI_BASE_URL,fetch:global.fetch};
process.env.AI_PROVIDER='openai';
delete process.env.AI_BASE_URL;
delete process.env.AI_ALLOW_STAFF_DRAFTS;
let total=0;async function run(name,cb){await cb();console.log('PASS '+(++total)+': '+name);}
(async()=>{
 await run('Without API key: honest retrieval only',async()=>{
   delete process.env.AI_API_KEY;delete process.env.AI_MODEL;
   const a=await svc.ask({question:'Tôi nghỉ việc có trợ cấp không?'},false);
   assert.equal(a.status,'RETRIEVAL_ONLY');assert.equal(a.modelActive,false);
 });
 await run('No public evidence: model gives general guidance without fake citations',async()=>{
   process.env.AI_API_KEY='mock-key';process.env.AI_MODEL='mock-model';lookup={...search,results:[],related:[]};
   global.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({summary:'Bạn có thể tìm hiểu điều kiện hưởng nhưng cần đối chiếu văn bản hiện hành.',citationIds:[],nextSteps:['Liên hệ trung tâm dịch vụ việc làm để đối chiếu hồ sơ.']})}}]})});
   const a=await svc.ask({question:'Tôi nghỉ việc có trợ cấp không?'},false);
   assert.equal(a.status,'AI_GENERATED');assert.equal(a.answer.citationIds.length,0);lookup={...search};
 });
 await run('Mock provider returns AI-generated grounded answer',async()=>{
   let requests=0;
   global.fetch=async(_url,options)=>{requests++;assert(options.headers.Authorization==='Bearer mock-key');
     const body=JSON.parse(options.body);assert(body.messages[1].content.includes('S1'));
     return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({summary:'Theo chứng cứ cần đối chiếu điều kiện',citationIds:['S1'],conditions:['Cần biết thời gian đóng']})}}]})};
   };
   const a=await svc.ask({question:'Tôi nghỉ việc có trợ cấp không?'},false);
   assert.equal(a.status,'AI_GENERATED');assert.deepEqual(a.answer.citationIds,['S1']);assert.equal(requests,1);
 });
 await run('Provider failure falls back without hallucination',async()=>{
   global.fetch=async()=>({ok:false,status:503});
   const a=await svc.ask({question:'Tôi nghỉ việc có trợ cấp không?'},false);
   assert.equal(a.status,'PROVIDER_UNAVAILABLE');
 });
 await run('Staff drafts are NEVER sent by default',async()=>{
   lookup={...search,results:[doc('draft')]};process.env.AI_ALLOW_STAFF_DRAFTS='false';
   global.fetch=async()=>{throw Error('Draft leaked!');};
   const a=await svc.ask({question:'Tôi nghỉ việc có trợ cấp không?'},true);
   assert.equal(a.status,'RETRIEVAL_ONLY');assert.equal(a.mode,'STAFF_DRAFT_PREVIEW');
 });
 await run('Explicitly authorized staff preview is watermarked',async()=>{
   process.env.AI_ALLOW_STAFF_DRAFTS='true';
   global.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({summary:'Bản nháp cần xác minh',citationIds:['S1']})}}]})});
   const a=await svc.ask({question:'Tôi nghỉ việc có trợ cấp không?'},true);
   assert.equal(a.status,'AI_GENERATED');assert(a.answer.warnings[0].includes('CHƯA XÁC MINH'));
 });
 await run('Sensitive email is removed BEFORE provider call',async()=>{
   lookup={...search,results:[doc('published')]};
   global.fetch=async(_u,options)=>{
     assert(!options.body.includes('user@domain.com'));
     return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({summary:'Đối chiếu',citationIds:['S1']})}}]})};
   };
   const a=await svc.ask({question:'Hỏi quyền lợi qua user@domain.com được không?'},false);
   assert.equal(a.status,'AI_GENERATED');
 });
 console.log('STEP 11 PROVIDER MOCK: '+total+'/'+total+' PASS; no external AI costs.');
})().catch(err=>{console.error(err);process.exitCode=1;}).finally(()=>{
 for(const key of ['AI_PROVIDER','AI_API_KEY','AI_MODEL','AI_ALLOW_STAFF_DRAFTS','AI_BASE_URL']){
   if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];
 }
 global.fetch=old.fetch;
});

