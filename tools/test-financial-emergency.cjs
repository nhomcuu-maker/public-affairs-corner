'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(file,deps={}){const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;const mod={exports:{}};new Function('require','module','exports',code)((id)=>{if(Object.hasOwn(deps,id))return deps[id];throw Error('Unknown dep '+id)},mod,mod.exports);return mod.exports;}
const search=load('src/search/search.logic.ts');
const logic=load('src/assistant/assistant.logic.ts',{'../search/search.logic':search});
const triage=load('src/assistant/assistant.triage.ts',{'../search/search.logic':search});
const service=load('src/assistant/assistant.service.ts',{'@nestjs/common':{Injectable:()=>x=>x,Logger:class{warn(){}},ServiceUnavailableException:class extends Error{}},'../search/search.service':{},'./assistant.logic':logic,'./assistant.triage':triage});
let searchCalls=0;const svc=new service.AssistantService({search:async()=>{searchCalls++;throw Error('SQL offline')}});
(async()=>{
 const h=['nhân viên ngân hàng yêu cầu tôi cung cấp otp','tôi lỡ cung cấp rồi'];
 const x=await svc.ask({question:'tôi không còn truy cập vào ví điện tử của tôi nữa và tôi thấy thông báo trừ hết tiền của tôi rồi',history:h},false);
 assert.equal(x.status,'SAFETY_GUIDANCE');assert.equal(x.urgentSafety,true);
 assert.match(x.answer.summary,/ví điện tử.*trừ tiền|ví điện tử có giao dịch trừ tiền/i);
 assert(x.answer.nextSteps.some(s=>/tổng đài/i.test(s)));
 assert(x.answer.nextSteps.some(s=>/tra soát/i.test(s)));
 assert(x.answer.nextSteps.some(s=>/công an/i.test(s)));
 assert(!x.answer.citationIds.length);
 const y=await svc.ask({question:'tôi không đăng nhập được vào ví điện tử',history:h},false);
 assert.equal(y.status,'SAFETY_GUIDANCE');
 const z=await svc.ask({question:'Tôi bị trừ tiền dù không thực hiện giao dịch',history:[]},false);
 assert.equal(z.status,'SAFETY_GUIDANCE');
 const unrelated=triage.financialEmergencyFirstAid('tôi đi làm hộ chiếu',h);
 assert.equal(unrelated,null);
 assert.equal(searchCalls,0,'Time critical first-aid must not wait for SQL');
 console.log('FINANCIAL EMERGENCY: PASS (wallet lost money, OTP follow-up, account lock, no false citations)');
})().catch(e=>{console.error(e);process.exitCode=1});
