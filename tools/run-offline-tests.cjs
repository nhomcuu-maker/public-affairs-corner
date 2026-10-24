'use strict';
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const testFiles=[
  'static-check.cjs','verify-frontend.cjs','integration-check.cjs',
  'test-auth-static.cjs','test-admin-static.cjs','test-workflow.cjs',
  'test-project-integrity.cjs','test-knowledge-static.cjs','test-search.cjs',
  'test-assistant.cjs','test-assistant-ai-mock.cjs','test-ai-intent.cjs','test-otp-context.cjs','test-financial-emergency.cjs','test-scam-handbook.cjs','test-redesign-integration.cjs','test-domain-assistant.cjs','test-feedback.cjs',
  'test-recovery-patch.cjs','test-nationwide.cjs','test-source-sync.cjs','test-official-public-library.cjs','test-official-download-and-task.cjs','test-official-feed-admin.cjs','test-public-start.cjs','test-evidence-intake.cjs','ui-smoke-test.cjs','test-public-reference-visibility.cjs','test-scam-categories.cjs','test-scam-article-flow.cjs','test-file-consistency.cjs','test-source-evidence.cjs',
];
const more=[
  ['tools/source/collect-sources.cjs','--self-test'],
  ['tools/source/review-evidence.cjs','--self-test'],
];
let passed=0;
for(const file of testFiles){
 console.log('\n=== '+file+' ===');
 const cp=spawnSync(process.execPath,[path.join(root,'tools',file)],{cwd:root,stdio:'inherit',env:{...process.env,NODE_ENV:'test'}});
 if(cp.status!==0){console.error('FAILED '+file+' (exit='+cp.status+')');process.exit(cp.status||1);}
 passed++;
}
for(const [file,arg] of more){
 console.log('\n=== '+file+' ===');
 const cp=spawnSync(process.execPath,[path.join(root,file),arg],{cwd:root,stdio:'inherit',env:{...process.env,NODE_ENV:'test'}});
 if(cp.status!==0){console.error('FAILED '+file);process.exit(cp.status||1);}
 passed++;
}
console.log('\nOFFLINE TESTS: '+passed+'/'+(testFiles.length+more.length)+' suites PASSED. Live SQL/HTTP not included.');
