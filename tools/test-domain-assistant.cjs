 'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(file,deps={}){
  const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}
  }).outputText;
  const m={exports:{}};
  new Function('require','module','exports',code)((name)=>{
    if(Object.prototype.hasOwnProperty.call(deps,name))return deps[name];throw Error('Unknown '+name);
  },m,m.exports);
  return m.exports;
}
const search=load('src/search/search.logic.ts');
const logic=load('src/assistant/assistant.logic.ts',{'../search/search.logic':search});
const triage=load('src/assistant/assistant.triage.ts',{'../search/search.logic':search});
const svcMod=load('src/assistant/assistant.service.ts',{
  '@nestjs/common':{Injectable:()=>x=>x,Logger:class{warn(){}},ServiceUnavailableException:class extends Error{}},
  '../search/search.service':{},'./assistant.logic':logic,'./assistant.triage':triage,
});
const old={...process.env},orig=global.fetch;
process.env.AI_PROVIDER='ollama';process.env.AI_MODEL='llama3.2:3b';delete process.env.AI_BASE_URL;
let searchCalls=0,modelCalls=0,lastBody;
const svc=new svcMod.AssistantService({
  search:async()=>{searchCalls++;return {retrieval:'RULE_BASED_LEXICAL',intent:'GENERAL',urgentSafety:false,
    missingInformation:[],results:[],related:[],links:[]};},
  excerptsForAssistant:async()=>new Map(),
});
global.fetch=async(_url,opts)=>{
  modelCalls++;lastBody=JSON.parse(opts.body);
  const data=JSON.parse(lastBody.messages[1].content);
  assert.deepEqual(data.evidence,[]);
  const key=data.question.includes('nghỉ việc')?'nghỉ việc':data.question.includes('hộ chiếu')?'hộ chiếu':data.question;
  return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({summary:'Hướng dẫn riêng cho '+key+' (chưa có chứng cứ công khai).',
    conditions:[],nextSteps:['Tra cứu tại cơ quan có thẩm quyền.'],warnings:[],citationIds:[]})}}]})};
};
(async()=>{
  assert.equal(triage.routeScope('Cach nau bun ca ngon'), 'OUT_OF_SCOPE');
  assert.equal(triage.routeScope('Bong da hom nay doi nao thang?'), 'OUT_OF_SCOPE');
  assert.equal(triage.routeScope('Thủ tục làm hộ chiếu như thế nào?'), 'IN_SCOPE');
  assert.equal(triage.routeScope('Tôi nghỉ việc có nhận trợ cấp thất nghiệp không?'), 'IN_SCOPE');
  assert.equal(triage.routeScope('Qua Facebook',['Tôi bị lừa chuyển khoản 2 triệu']), 'IN_SCOPE');
  const refuse=await svc.ask({question:'Cách nấu bún cá ngon nhất?'},false);
  assert.equal(refuse.status,'OUT_OF_SCOPE');assert.equal(modelCalls,0);assert.equal(searchCalls,0);
  const topic1=await svc.ask({question:'Tôi nghỉ việc có thể hỏi quyền lợi ở đâu?'},false);
  assert.equal(topic1.status,'AI_GENERATED');assert.equal(topic1.modelActive,true);
  assert.equal(topic1.answer.citationIds.length,0);
  const topic2=await svc.ask({question:'Thủ tục làm hộ chiếu như thế nào?'},false);
  assert.equal(topic2.status,'AI_GENERATED');assert.notEqual(topic1.answer.summary,topic2.answer.summary);
  assert.equal(modelCalls,2);
  const loss=await svc.ask({question:'Tôi bị lừa chuyển khoản 2 triệu'},false);
  assert.equal(loss.status,'NEEDS_CLARIFICATION');assert.equal(modelCalls,2);
  assert(!/BHXH|bảo hiểm xã hội/i.test(JSON.stringify(loss)));
  const following=await svc.ask({question:'Qua Facebook',history:['Tôi bị lừa chuyển khoản 2 triệu']},false);
  assert.equal(following.status,'NEEDS_CLARIFICATION');assert.equal(modelCalls,2);
  assert(!/BHXH|bảo hiểm xã hội/i.test(JSON.stringify(following)));
  const unrelatedAfter=await svc.ask({question:'Cho tôi công thức nấu bún cá',history:['Tôi bị lừa chuyển khoản 2 triệu']},false);
  assert.equal(unrelatedAfter.status,'OUT_OF_SCOPE');assert.equal(modelCalls,2);
  const gds=fs.readFileSync(path.join(root,'public/js/gds-chat.js'),'utf8');
  assert(gds.includes('recentQuestions') && gds.includes('history'));
  console.log('DOMAIN AI REGRESSION: PASS (out of scope, 2 distinct source-free model replies, clarification, context, no BHXH bias)');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{
  global.fetch=orig;for(const k of ['AI_PROVIDER','AI_MODEL','AI_API_KEY','AI_ALLOW_STAFF_DRAFTS','AI_BASE_URL']){
    if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];
  }
});
