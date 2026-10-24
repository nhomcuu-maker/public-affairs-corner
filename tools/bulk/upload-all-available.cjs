'use strict';
/** One command to stage ALL known local evidence + already collected RSS metadata.
 * Does NOT claim completeness for 34 provinces, verify/approve/publish, or train a model.
 * No secrets printed. All inputs are validated and staged idempotently by original importer.
 */
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const args=process.argv.slice(2);
if(args.some(x=>!['--audit','--apply','--backup-confirmed'].includes(x))|| (args.includes('--apply')&&!args.includes('--backup-confirmed'))) {
  console.error('Usage: node tools/bulk/upload-all-available.cjs --audit OR --apply --backup-confirmed');
  process.exit(2);
}
const apply=args.includes('--apply');
function run(flag,env=process.env){
  const out=spawnSync(process.execPath,[path.join(root,'tools/bulk/stage-all-existing.cjs'),flag],{
    cwd:root,stdio:'inherit',env,timeout:300000});
  if(out.error)throw out.error;
  if(out.status!==0)throw Error(flag+' failed; stop and inspect logs; nothing auto-published');
}
try {
  if(apply){
    run('--preview');
    run('--apply',{...process.env,GDS_BULK_STAGE_ACK:'PENDING_ONLY_CONFIRMED'});
  }
  run('--audit');
  console.log('UPLOAD AVAILABLE: COMPLETE. Only known snapshots and RSS metadata staged; pending records are NOT AI-public evidence.');
}catch(e){console.error('UPLOAD AVAILABLE ERROR: '+e.message);process.exitCode=1;}
