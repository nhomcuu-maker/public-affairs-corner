'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(file,deps={}){
 const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
 const m={exports:{}};
 new Function('require','module','exports',code)((name)=>{if(Object.hasOwn(deps,name))return deps[name];throw Error('Unknown '+name)},m,m.exports);return m.exports;
}
const search=load('src/search/search.logic.ts');
const logic=load('src/assistant/assistant.logic.ts',{'../search/search.logic':search});
const triage=load('src/assistant/assistant.triage.ts',{'../search/search.logic':search});
const svcModule=load('src/assistant/assistant.service.ts',{
 '@nestjs/common':{Injectable:()=>x=>x,Logger:class{warn(){}},ServiceUnavailableException:class extends Error{}},
 '../search/search.service':{},'./assistant.logic':logic,'./assistant.triage':triage,
});
let searches=0;
const svc=new svcModule.AssistantService({search:async()=>{searches++;throw Error('SQL intentionally offline')},excerptsForAssistant:async()=>new Map()});
(async()=>{
 const first='nhân viên bhx yêu cầu tôi cung cấp otp';
 const a=await svc.ask({question:first},false);
 assert.equal(a.status,'SAFETY_GUIDANCE');assert.equal(a.urgentSafety,true);
 assert.match(a.answer.warnings.join(' '),/không.*OTP/i);
 assert.equal(a.answer.citationIds.length,0);
 const b=await svc.ask({question:'tôi cung cấp rồi',history:[first]},false);
 assert.equal(b.status,'SAFETY_GUIDANCE');
 assert.match(b.answer.summary,/đã cung cấp mã OTP/i);
 assert(b.answer.nextSteps.some(x=>/BHXH|VssID/i.test(x)));
 assert(b.answer.nextSteps.some(x=>/ngân hàng/i.test(x)));
 const detailed=await svc.ask({question:'h\u01b0\u1edbng d\u1eabn chi ti\u1ebft \u0111i',history:[first,'t\u00f4i cung c\u1ea5p r\u1ed3i']},false);
 assert.equal(detailed.status,'SAFETY_GUIDANCE','A continuation must never be classified OUT_OF_SCOPE');
 assert.match(detailed.answer.summary,/\u0111\u00e3 cung c\u1ea5p m\u00e3 OTP/i);
 assert(detailed.answer.nextSteps.length>=3,'Offer actionable next steps');
 assert.match(detailed.answer.nextSteps[0],/B\u01b0\u1edbc 1/,'Detail follow-up should provide numbered steps');
 const inaccessible=await svc.ask({question:'tôi không thể đăng nhập vào tài khoản ngân hàng của mình',history:[first,'tôi cung cấp rồi']},false);
 assert.equal(inaccessible.status,'SAFETY_GUIDANCE');
 assert.match(inaccessible.answer.summary,/không đăng nhập được/i);
 assert(inaccessible.answer.nextSteps.some(x=>/tổng đài/i.test(x)));
 assert(!inaccessible.answer.citationIds.length);
 const citizenTopics=['C\u00f3 con nh\u1ecf','H\u1ecdc t\u1eadp','S\u1ee9c kh\u1ecfe v\u00e0 y t\u1ebf','Ph\u01b0\u01a1ng ti\u1ec7n v\u00e0 ng\u01b0\u1eddi l\u00e1i'];
 for (const t of citizenTopics) assert.equal(triage.routeScope(t),'IN_SCOPE',t+' is a portal category');
 const c=await svc.ask({question:'tôi chưa cung cấp',history:[first]},false).catch(e=>e);
 assert(c instanceof Error && /SQL intentionally offline/.test(c.message));
 // Do not infer BHXH from a previous, unrelated conversation.
 const unrelated=triage.otpFirstAid('tôi cung cấp rồi',['Cách làm giấy khai sinh cho con']);
 assert.equal(unrelated,null);
 const unrelatedBank=await svc.ask({question:'ngân hàng yêu cầu tôi gửi otp'},false);
 assert.equal(unrelatedBank.status,'SAFETY_GUIDANCE');
 assert(!/BHXH|VssID/.test(JSON.stringify(unrelatedBank.answer)));
 assert.equal(searches,1); // only the ordinary non-urgent question reaches SQL
 assert.equal(triage.otpFirstAid('tôi không cung cấp mã otp',[]).summary.includes('đã cung cấp'),false);
 console.log('OTP SAFETY REGRESSION: PASS (first aid, multi-turn confirmation, no SQL dependency, no invented citations)');
})().catch(e=>{console.error(e);process.exitCode=1});
