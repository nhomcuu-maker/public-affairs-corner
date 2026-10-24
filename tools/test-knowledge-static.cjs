'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const checks=[
 ['SQL seed',()=>read('sql/07_Nap_Tri_Thuc_MVP_Va_Lien_Ket.sql').includes('BEGIN TRAN')],
 ['Three domain drafts',()=>['GDS-MVP-LEGAL-BHTN','GDS-MVP-ADMIN-TCTN','GDS-MVP-SCAM-MAODANH-BHXH'].every(x=>read('sql/07_Nap_Tri_Thuc_MVP_Va_Lien_Ket.sql').includes(x))],
 ['Source candidates pending',()=>read('sql/07_Nap_Tri_Thuc_MVP_Va_Lien_Ket.sql').includes("N'pending_review'")],
 ['Explicit cross-links',()=>read('sql/07_Nap_Tri_Thuc_MVP_Va_Lien_Ket.sql').includes('knowledge_item_link')],
 ['Read only SQL check',()=>!/(?:^|\n)\s*(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE)\s/im.test(read('sql/08_Kiem_Tra_Tri_Thuc_READ_ONLY.sql'))],
 ['Guarded API',()=>read('src/mvp/mvp.controller.ts').includes('@UseGuards(AdminGuard)')],
 ['Module included',()=>read('src/app.module.ts').includes('MvpModule')],
 ['Frontend and JS separate',()=>read('public/mvp-noi-bo.html').includes('/js/gds-mvp.js')],
 ['Source manifest JSON',()=>JSON.parse(read('data/MVP_NGUON_THAM_KHAO.json')).do_not_publish===true],
 ['No old database name',()=>!read('sql/07_Nap_Tri_Thuc_MVP_Va_Lien_Ket.sql').includes('DanSinhAI_v4_1')],
 ['No fake source snapshot',()=>!read('sql/07_Nap_Tri_Thuc_MVP_Va_Lien_Ket.sql').includes('INSERT dbo.source_snapshot')],
 ['No auto publish or approve',()=>!/(EXEC\s+dbo\.usp_(publish|approve)_knowledge_version|editorial_status\s*=\s*N'published')/i.test(read('sql/07_Nap_Tri_Thuc_MVP_Va_Lien_Ket.sql'))],
 ['Frontend DOM ids match',()=>['status','items','links','detail'].every(x=>read('public/mvp-noi-bo.html').includes('id=\"'+x+'\"'))],
];
let failed=0;
for(const [name,test] of checks){try{if(!test())throw new Error('assertion false');console.log('PASS:',name);}catch(e){failed++;console.error('FAIL:',name,e.message)}}
console.log(`STEP 9 STATIC CHECKS: ${checks.length-failed}/${checks.length} PASS`);
if(failed)process.exitCode=1;
