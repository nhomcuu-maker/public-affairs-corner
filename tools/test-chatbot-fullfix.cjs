'use strict';
// New strict safety regression: no real SQL queries, internet calls or Ollama needed.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(rel,deps={}){
 const result=ts.transpileModule(fs.readFileSync(path.join(root,rel),'utf8'),{
  fileName:rel,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}
 });
 const m={exports:{}};new Function('require','module','exports',result.outputText)(key=>{
  if(Object.prototype.hasOwnProperty.call(deps,key))return deps[key];
  throw Error('Unmocked '+key);
 },m,m.exports);return m.exports;
}
const searchLogic=load('src/search/search.logic.ts');
const logic=load('src/assistant/assistant.logic.ts',{'../search/search.logic':searchLogic});
const triage=load('src/assistant/assistant.triage.ts',{'../search/search.logic':searchLogic});
const svc=load('src/assistant/assistant.service.ts',{
 '@nestjs/common':{Injectable:()=>x=>x,Logger:class{warn(){ }log(){ }},ServiceUnavailableException:class extends Error{}},
 '../search/search.service':{},'./assistant.logic':logic,'./assistant.triage':triage,
 './assistant.catalog':{catalogEvidence:()=>[]}
});
let calls=0,requests=0,lookup={results:[],related:[],links:[],retrieval:'RULE_BASED_LEXICAL',intent:'GENERAL',urgentSafety:false,missingInformation:[]};
const service=new svc.AssistantService({search:async()=>{calls++;return lookup;},excerptsForAssistant:async()=>new Map()});
const oldOpt=process.env.AI_ALLOW_UNVERIFIED_GENERAL,oldFetch=global.fetch;
delete process.env.AI_ALLOW_UNVERIFIED_GENERAL;
process.env.AI_PROVIDER='ollama';process.env.AI_MODEL='llama3.2:3b';
global.fetch=async()=>{requests++;throw Error('Should not call provider without trusted source');};
let done=0;
const check=(title,fn)=>{fn();console.log('PASS '+(++done)+' '+title);};
(async()=>{
 check('Cross-topic residence source blocked',()=>assert.equal(triage.gdsEvidenceFits('Tôi chuyển chỗ ở, phải làm gì?',{title:'Chứng thực bản sao',summary:'Thủ tục chứng thực bản sao'}),false));
 check('Cross-topic maternity/unemployment blocked',()=>assert.equal(triage.gdsEvidenceFits('Tôi đang mang thai bị ép nghỉ việc',{title:'Giải quyết hưởng trợ cấp thất nghiệp',summary:'BHTN'}),false));
 check('BHYT lost versus infant coverage blocked',()=>assert.equal(triage.gdsEvidenceFits('Mất thẻ BHYT cần cấp lại',{title:'Khai sinh và cấp thẻ bảo hiểm y tế',summary:'Trẻ em dưới 6 tuổi'}),false));
 check('Proper unemployment source allowed',()=>assert.equal(triage.gdsEvidenceFits('Tôi thất nghiệp',{title:'Giải quyết hưởng trợ cấp thất nghiệp',summary:'BHTN'}),true));
 check('External references are never SQL verified',()=>assert.equal(triage.gdsTrustedEvidence({sourceStatus:'reference_not_verified_in_sql',editorialStatus:'published',excerpt:'x'.repeat(50)}),false));
 check('Accepted SQL requires excerpt',()=>assert.equal(triage.gdsTrustedEvidence({sourceStatus:'accepted',editorialStatus:'published',excerpt:''}),false));
 let a=await service.ask({question:'Tôi chuyển nơi ở cần đăng ký cư trú thế nào?'},false);
 check('Residence no-source response blocks AI/legal guess',()=>{assert.equal(a.modelActive,false);assert.match(a.answer.summary,/tạm trú|thường trú/);assert.equal(requests,0);});
 a=await service.ask({question:'Tôi mang thai bị ép nghỉ việc tại công ty'},false);
 check('Maternity guidance not unemployment template',()=>{assert.match(a.answer.summary,/lao động/i);assert(!/thất nghiệp/.test(a.answer.nextSteps.join(' ')));assert.equal(requests,0);});
 a=await service.ask({question:'Công ty nợ lương hai tháng'},false);
 check('Unpaid wage has actionable next steps',()=>{assert(a.answer.nextSteps.some(x=>/hợp đồng|chấm công/i.test(x)));assert.equal(requests,0);});
 a=await service.ask({question:'Con tôi sốt cao và co giật, phải làm gì?'},false);
 check('Emergency guidance independent of retrieval/AI',()=>{assert.equal(a.status,'SAFETY_GUIDANCE');assert.equal(a.modelActive,false);assert.match(a.answer.summary,/115/);});
 a=await service.ask({question:'Cách nấu bún cá ngon nhất?'},false);
 check('Unrelated content remains out of scope',()=>{assert.equal(a.status,'OUT_OF_SCOPE');assert.equal(requests,0);});
 check('Unsupported numeric model claim rejected',()=>assert.equal(triage.gdsUnsupportedClaim('Thủ tục đăng ký cư trú',{summary:'Phải nộp trong 14 ngày',nextSteps:[],conditions:[],warnings:[],citationIds:['S1']},[{title:'Cư trú',summary:'Căn cứ chung',excerpt:'Hướng dẫn cư trú không nêu thời hạn'}]),true));
 console.log('CHATBOT FULLFIX SAFETY REGRESSION: '+done+'/'+done+' PASS (offline)');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{
 global.fetch=oldFetch;
 if(oldOpt===undefined)delete process.env.AI_ALLOW_UNVERIFIED_GENERAL;else process.env.AI_ALLOW_UNVERIFIED_GENERAL=oldOpt;
});
