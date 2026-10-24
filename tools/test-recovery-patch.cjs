'use strict';
/* Offline regression checks; never reads .env or accesses SQL Server. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const files=['src/assistant/assistant.logic.ts','src/assistant/assistant.service.ts',
  'public/js/gds-live.js','public/js/gds-assistant.js'];
for(const file of files)assert(fs.existsSync(path.join(root,file)),`Missing: ${file}`);
for(const file of files.filter(x=>x.endsWith('.ts'))){
  const result=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}});
  assert.equal(result.diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,file);
}
for(const file of files.filter(x=>x.endsWith('.js')))new Function(read(file));
const live=read('public/js/gds-live.js');
assert(!/disableFakeAuth|Chức năng đăng nhập\/đăng ký chưa được kết nối Backend/.test(live),
  'Obsolete fake authentication must not intercept real login/registration');
assert(/gds-auth\.js/.test(live),'Auth pages must leave authentication to gds-auth.js');
const ai=read('public/js/gds-assistant.js');
assert(/data-example/.test(ai),'Example questions should remain available');
const exampleHandler=ai.slice(ai.indexOf("document.querySelectorAll('[data-example]')"),ai.indexOf('const url='));
assert(!/byId\('gds-mode'\)\.value\s*=\s*'staff'/.test(exampleHandler),
  'Example questions must not force staff-only mode');
const logic=read('src/assistant/assistant.logic.ts');
assert(/accepted/.test(logic)&&/KHÔNG ĐỦ CĂN CỨ/.test(logic));
console.log('PASS: source restored (2 TS), UI restored (2 JS), no fake auth, public AI examples preserved');
