'use strict';
// Structural audit; NEVER reads or prints secrets from .env.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const required = {
  configuration: ['package.json', 'tsconfig.json', 'nest-cli.json', '.env.example'],
  backend: [
    'src/main.ts','src/app.module.ts',
    'src/auth/auth.module.ts','src/auth/auth.service.ts','src/auth/auth.controller.ts',
    'src/admin/admin.module.ts','src/admin/admin.controller.ts','src/admin/admin.guard.ts',
    'src/admin/admin.service.ts','src/admin/workflow.service.ts',
    'src/mvp/mvp.module.ts','src/mvp/mvp.controller.ts','src/mvp/mvp.service.ts',
    'src/database/database.service.ts','src/content/content.service.ts',
    'src/procedures/procedures.service.ts',
    'src/search/search.controller.ts','src/search/search.module.ts','src/search/search.logic.ts','src/search/search.service.ts'
  ],
  frontend: [
    'public/index.html','public/admin.html','public/login.html','public/register.html',
    'public/thu-tuc-hanh-chinh.html','public/phap-luat-quyen-loi.html',
    'public/canh-bao-lua-dao.html','public/mvp-noi-bo.html',
    'public/js/gds-live.js','public/js/gds-auth.js','public/js/gds-admin.js','public/js/gds-mvp.js',
    'public/css/gds-live.css','public/css/gds-admin.css','public/css/gds-mvp.css',
    'public/tim-kiem-tri-thuc.html','public/js/gds-search.js','public/css/gds-search.css'
  ],
  sql: [
    'sql/01_GocDanSinh_Tao_Bang_Va_Nap_Du_Lieu.sql',
    'sql/02_GocDanSinh_Kiem_Tra_Toan_Bo.sql',
    'sql/03_Thiet_Lap_Dang_Nhap.sql',
    'sql/04_Phan_Quyen_Quan_Tri.sql',
    'sql/06_Kiem_Thu_Xac_Thuc_ROLLBACK.sql',
    'sql/07_Nap_Tri_Thuc_MVP_Va_Lien_Ket.sql',
    'sql/08_Kiem_Tra_Tri_Thuc_READ_ONLY.sql',
    'sql/09_Kiem_Tra_Tim_Kiem_READ_ONLY.sql'
  ],
  tests: [
    'tools/test-auth-static.cjs','tools/test-admin-static.cjs',
    'tools/test-workflow.cjs','tools/test-auth-http.cjs',
    'tools/test-knowledge-static.cjs','tools/test-knowledge-http.cjs',
    'tools/test-search.cjs','tools/test-search-http.cjs'
  ]
};
let errors = 0;
for (const [group, files] of Object.entries(required)) {
  const missing = files.filter(file => !fs.existsSync(path.join(root, file)));
  if (missing.length) {
    errors += missing.length;
    console.error('FAIL ' + group + ': ' + missing.join(', '));
  } else console.log('PASS ' + group + ': ' + files.length + ' files');
}
const application = fs.readFileSync(path.join(root,'src/app.module.ts'),'utf8');
for (const token of ['AdminModule','AuthModule','MvpModule','SearchModule']) {
  try { assert.ok(application.includes(token)); console.log('PASS module: ' + token); }
  catch { console.error('FAIL import: '+token); errors++; }
}
const live = fs.readFileSync(path.join(root,'public/js/gds-live.js'),'utf8');
if (/disableFakeAuth|chưa được kết nối Backend/.test(live)) { console.error('FAIL: obsolete fake authentication is still active'); errors++; }
else console.log('PASS auth: no fake form handler');
const sql9=fs.readFileSync(path.join(root,'sql/07_Nap_Tri_Thuc_MVP_Va_Lien_Ket.sql'),'utf8');
if (!sql9.includes('BEGIN TRAN') || !sql9.includes('N\'pending_review\'') || /EXEC\s+dbo\.usp_publish_knowledge_version/i.test(sql9)) {
  errors++; console.error('FAIL: knowledge seed guard');
} else console.log('PASS knowledge seed: transaction, unverified sources and no auto publish');
if (errors) { console.error('INTEGRITY FAIL: '+errors+' issue(s)'); process.exitCode = 1; }
else console.log('INTEGRITY PASSED: Source tree is structurally complete for current modules');
