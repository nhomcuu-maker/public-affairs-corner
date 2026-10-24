'use strict';
// Read-only deterministic unit checks for lexical search logic + API separation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=read('src/search/search.logic.ts');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m=new Module(path.join(root,'src/search/search.logic.js'),module);m.filename=path.join(root,'src/search/search.logic.js');m.paths=module.paths;m._compile(js,m.filename);
const {fold,analyze,rank,searchGraph}=m.exports;
const rows=[
  {itemId:1,versionId:11,businessCode:'GDS-MVP-LEGAL-BHTN',domain:'LEGAL',category:'Lao động',title:'Quyền lợi bảo hiểm thất nghiệp: điều kiện cần kiểm tra',summary:'Người lao động nghỉ việc cần đối chiếu thời gian đóng BHTN',sample:'Trợ cấp thất nghiệp là quyền lợi cần kiểm tra, lịch sử bảo hiểm thất nghiệp',editorialStatus:'draft'},
  {itemId:2,versionId:22,businessCode:'GDS-MVP-ADMIN-TCTN',domain:'ADMIN',category:'Dịch vụ công',title:'Hưởng trợ cấp thất nghiệp - hướng dẫn chuẩn bị hồ sơ',summary:'Thủ tục hưởng trợ cấp khi nghỉ việc',sample:'Nộp hồ sơ bảo hiểm thất nghiệp tại nơi tiếp nhận',editorialStatus:'draft'},
  {itemId:3,versionId:33,businessCode:'GDS-MVP-SCAM-MAODANH-BHXH',domain:'SCAM',category:'Giả danh',title:'Cảnh báo cuộc gọi giả danh bảo hiểm xã hội đòi chuyển tiền',summary:'Cảnh báo BHXH giả danh chuyển tiền, OTP',sample:'Không cung cấp mã OTP và không chuyển tiền',editorialStatus:'draft'}
];
const links=[{fromId:1,toId:2,fromCode:rows[0].businessCode,toCode:rows[1].businessCode,relationType:'guides_procedure',note:'LEGAL -> ADMIN'},
{fromId:3,toId:2,fromCode:rows[2].businessCode,toCode:rows[1].businessCode,relationType:'warns_related',note:'SCAM -> ADMIN'},
{fromId:3,toId:1,fromCode:rows[2].businessCode,toCode:rows[0].businessCode,relationType:'risk_context',note:'SCAM -> LEGAL'}];
const tests=[
  ['Vietnamese accent folding',()=>assert.equal(fold('TRỢ CẤP THẤT NGHIỆP'),'tro cap that nghiep')],
  ['Safety intent for suspicious payment demand',()=>assert.equal(analyze('BHXH gọi yêu cầu chuyển tiền').intent,'SAFETY')],
  ['Benefit intent for unemployment',()=>assert.equal(analyze('Tôi vừa nghỉ việc có hưởng trợ cấp thất nghiệp?').intent,'BENEFIT')],
  ['Procedural intent for documents',()=>assert.equal(analyze('Hồ sơ nộp thủ tục ở đâu?').intent,'PROCEDURE')],
  ['Benefit search prioritizes LEGAL',()=>{const x=searchGraph(rows,links,{question:'Tôi vừa nghỉ việc có được hưởng trợ cấp thất nghiệp không?',domain:'ALL',limit:8});assert.equal(x.primary[0].domain,'LEGAL');assert.ok(x.links.length>0);}],
  ['Scam search prioritizes SCAM',()=>{const x=searchGraph(rows,links,{question:'Có người tự xưng BHXH gọi yêu cầu chuyển tiền',domain:'ALL',limit:8});assert.equal(x.primary[0].domain,'SCAM');}],
  ['Cross-domain graph yields linked procedure',()=>{const x=searchGraph(rows,links,{question:'Giả danh đòi OTP',domain:'SCAM',limit:8});assert.equal(x.primary[0].domain,'SCAM');assert.ok(x.related.some(y=>y.domain==='ADMIN'));}],
  ['Unknown question does not invent a result',()=>{const x=searchGraph(rows,links,{question:'xqzv blorpfizz',domain:'ALL',limit:8});assert.equal(x.primary.length,0);}],
  ['No private links when endpoint candidate is not eligible',()=>{const x=searchGraph(rows.filter(r=>r.domain!=='SCAM'),links,{question:'nghỉ việc',domain:'ALL',limit:8});assert.ok(x.links.every(l=>l.fromCode!==rows[2].businessCode&&l.toCode!==rows[2].businessCode));}],
  ['No matches for absent public published dataset',()=>assert.equal(searchGraph([],links,{question:'trợ cấp thất nghiệp',domain:'ALL',limit:8}).primary.length,0)],
  ['MVP candidate ranking requires term matching',()=>assert.equal(rank(rows[0],['kinh doanh casino'],'GENERAL').score,0)],
  ['Separate public/staff route and guard',()=>{const c=read('src/search/search.controller.ts');assert.match(c,/@Controller\('api\/search'\)/);assert.match(c,/@Controller\('api\/admin\/search'\)/);assert.match(c,/@UseGuards\(AdminGuard\)/);}],
  ['Public SQL uses existing verified publication predicate',()=>{const s=read('src/search/search.service.ts');assert.match(s,/PUBLIC_VISIBILITY/);assert.match(s,/staff \? .* : PUBLIC_VISIBILITY/);assert.match(s,/latest\.decision=N'accepted'/);}],
  ['No SQL injection by direct query text',()=>{const s=read('src/search/search.service.ts');assert.doesNotMatch(s,/\$\{params\.question\}/);assert.match(s,/MAX_CANDIDATES = 1500/);}],
  ['UI fetches API, not inline content',()=>{const html=read('public/tim-kiem-tri-thuc.html'),js=read('public/js/gds-search.js');assert.match(js,/fetch\(url/);assert.match(js,/textContent/);assert.doesNotMatch(js,/innerHTML/);assert.match(html,/id="search-form"/);}],
  ['Search verification is SQL READ_ONLY',()=>assert.match(read('sql/09_Kiem_Tra_Tim_Kiem_READ_ONLY.sql'),/READ_ONLY/)],
];
let failed=0;for(const [name,fn] of tests){try{fn();console.log('PASS '+name);}catch(e){console.error('FAIL '+name,e.message);failed++;}}
if(failed){console.error(`STEP 10 UNIT: ${failed}/${tests.length} failed`);process.exitCode=1;}else console.log(`STEP 10 UNIT: ${tests.length}/${tests.length} PASS (no live database)`);
