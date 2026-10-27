'use strict';
// Legacy model-mode regression only. Public server defaults to grounded-only mode.
process.env.AI_ALLOW_UNVERIFIED_GENERAL='1';
// Execute real AssistantService orchestration with a FAKE HTTP model, not paid AI.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript');
const root=path.resolve(__dirname,'../..');
function load(file,deps={}){
  const js=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:file,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
  const m={exports:{}};
  new Function('require','module','exports',js)(s=>{if(Object.hasOwn(deps,s))return deps[s];throw Error('unknown '+s);},m,m.exports);
  return m.exports;
}
const srch=load('src/search/search.logic.ts');
const logic=load('src/assistant/assistant.logic.ts',{'../search/search.logic':srch});
const triage=load('src/assistant/assistant.triage.ts',{'../search/search.logic':srch});
const mod=load('src/assistant/assistant.service.ts',{
  '@nestjs/common':{Injectable:()=>C=>C,Logger:class{warn(){}},ServiceUnavailableException:class extends Error{}},
  '../search/search.service':{},'./assistant.logic':logic,'./assistant.triage':triage,
});
const lookup={retrieval:'RULE_BASED_LEXICAL',intent:'SAFETY',urgentSafety:true,missingInformation:[],links:[],
  related:[],results:[{versionId:6,businessCode:'GDS-SCAM',domain:'SCAM',title:'Canh bao BHXH',
  summary:'Canh giac yeu cau OTP',editorialStatus:'published',sources:[{title:'BHXH',url:'https://example.org',status:'accepted'}]}]};
const service=new mod.AssistantService({
  search:async()=>lookup,
  excerptsForAssistant:async()=>new Map([[6,'Khong chuyen tien khong dua OTP.']]),
});
const old={...process.env},original=global.fetch;
(async()=>{
  delete process.env.AI_API_KEY;
  process.env.AI_PROVIDER='ollama';process.env.AI_MODEL='llama3.2:3b';
  delete process.env.AI_BASE_URL;
  let calls=0;
  global.fetch=async(url,options)=>{
    calls++;
    assert.equal(url,'http://127.0.0.1:11434/v1/chat/completions');
    assert.equal(options.headers.Authorization,'Bearer ollama');
    const q=JSON.parse(options.body);
    assert.equal(q.model,'llama3.2:3b');
    assert.deepEqual(q.response_format,{type:'json_object'});
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({summary:'Can kiem tra nguon BHXH',citationIds:['S1'],warnings:['Khong dua OTP']})}}]})};
  };
  const x=await service.ask({question:'BHXH yeu cau toi chuyen tien va OTP phai lam gi?',domain:'SCAM'},false);
  assert.equal(x.status,'AI_GENERATED');assert.equal(x.modelActive,true);assert.equal(calls,1);
  console.log('OLLAMA KEYLESS MOCK: PASS. Real Ollama model and user SQL not tested.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{
  global.fetch=original;
  for(const k of ['AI_API_KEY','AI_PROVIDER','AI_MODEL','AI_BASE_URL']){
    if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];
  }
});
