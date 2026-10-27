
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

const load = (p,deps={}) => {
  const code = ts.transpileModule(fs.readFileSync(path.join(root,p),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:false}
  }).outputText;
  const m={exports:{}};
  new Function('require','module','exports',code)((n)=>{if(!(n in deps))throw Error('Unexpected import: '+n);return deps[n];},m,m.exports);
  return m.exports;
};
const search=load('src/search/search.logic.ts');
const logic=load('src/assistant/assistant.logic.ts',{'../search/search.logic':search});
const triage=load('src/assistant/assistant.triage.ts',{'../search/search.logic':search});
const svcClass=load('src/assistant/assistant.service.ts',{
  '@nestjs/common':{
    Injectable:()=>x=>x,
    Logger:class{warn(){} log(){} debug(){}},
    ServiceUnavailableException:class extends Error{}
  },
  '../search/search.service':{SearchService:class{}},
  './assistant.logic':logic,
  './assistant.triage':triage,
  './assistant.catalog':{catalogEvidence:()=>[]}
}).AssistantService;
const doc={versionId:6,businessCode:'GDS-MVP-SCAM-MAODANH-BHXH',domain:'SCAM',title:'Cảnh báo cuộc gọi giả danh bảo hiểm xã hội đòi chuyển tiền',summary:'Bảo hiểm xã hội cảnh báo giả danh cán bộ BHXH và yêu cầu chuyển tiền',editorialStatus:'published',sources:[{title:'BHXH chính thức',url:'https://baohiemxahoi.gov.vn/tintuc',status:'accepted'}]};
let calls=0;
const searchService={search:async()=>{calls++;return {retrieval:'RULE_BASED_LEXICAL',intent:'SAFETY',urgentSafety:true,missingInformation:[],results:[doc],related:[],links:[]};},excerptsForAssistant:async()=>new Map([[6,'Không cung cấp OTP']])};
const svc=new svcClass(searchService);
(async()=>{
  assert.equal(triage.shouldClarifyScam('Tôi bị lừa chuyển khoản 2 triệu'), 'scam');
  assert.equal(triage.shouldClarifyScam('Tôi có nói gì liên quan đến BHXH đâu?'), 'correction');
  assert.equal(triage.shouldClarifyScam('Có người giả danh BHXH đòi OTP'), null);
  assert(!search.analyze('tôi bị lừa chuyển khoản 2 triệu').terms.includes('bhxh'));
  assert(!search.analyze('tôi bị lừa chuyển khoản 2 triệu').terms.includes('bao hiem xa hoi'));
  const res=await svc.ask({question:'Tôi bị lừa chuyển khoản 2 triệu'},false);
  assert.equal(res.status,'NEEDS_CLARIFICATION');
  assert.equal(res.evidence.length,0);assert.equal(calls,0);
  assert.equal(res.answer.citationIds.length,0);
  assert(!/BHXH|bảo hiểm xã hội/i.test(JSON.stringify(res)));
  assert.match(res.answer.summary,/kể lại/i);
  assert(res.answer.nextSteps.some(x=>/ngân hàng/i.test(x)));
  const denial=await svc.ask({question:'Tôi có nói gì liên quan đến BHXH đâu?'},false);
  assert.equal(denial.status,'NEEDS_CLARIFICATION');assert.equal(calls,0);
  const wrong=await svc.ask({question:'Tôi bị lừa tuyển dụng việc làm online'},false);
  assert.notEqual(wrong.status,'OUT_OF_SCOPE');assert.equal(wrong.evidence.length,0);
  assert(!JSON.stringify(wrong.answer).includes('BHXH'));
  const specific=await svc.ask({question:'Có người giả danh BHXH gọi tôi yêu cầu đưa mã OTP'},false);
  assert.equal(specific.status,'SAFETY_GUIDANCE');assert.equal(specific.evidence.length,0);
  assert.equal(calls,1); // OTP first aid must not depend on a working SQL service.
  assert(triage.evidenceMatchesQuestion('BHXH yêu cầu chuyển tiền',{domain:'SCAM',title:doc.title,summary:doc.summary}));
  assert(!triage.evidenceMatchesQuestion('Tuyển dụng việc nhẹ lương cao',{domain:'SCAM',title:doc.title,summary:doc.summary}));
  assert.equal(triage.readRecentQuestions(['aaa','Tôi bị lừa mất tiền','qua Facebook']).length,2);
  assert.equal(triage.shouldClarifyScam('qua Facebook',['Tôi bị lừa mất tiền']),'details');
  const frontend=fs.readFileSync(path.join(root,'public/js/gds-chat.js'),'utf8');
  assert.match(frontend,/recentQuestions/);assert.match(frontend,/question:q,domain,history/);
  console.log('SCAM INTENT REGRESSION: PASS (12 scenarios, no SQL writes, no Ollama needed)');
})().catch(e=>{console.error(e);process.exitCode=1});
