'use strict';
/** Windows native Task Scheduler installer. Avoids PowerShell script signing/policy.
 * Run `node tools/source/install-auto-official-library-task.cjs --preview`
 * then `... --acknowledge-terms` only if terms are actually accepted.
 */
const path=require('node:path');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const TASK='GocDanSinh-PublicOfficialLibrary';
const runner=path.join(__dirname,'run-auto-official-library.cmd');
const ack=path.join(root,'data/source_sync/rss-terms-ack.txt');
function main(args=process.argv.slice(2)){
 const preview=args.includes('--preview');
 const accepted=args.includes('--acknowledge-terms');
 const replace=args.includes('--replace');
 const i=args.indexOf('--time');
 const time=i<0?'08:15':args[i+1];
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time||''))throw Error('Use --time HH:mm, for example 08:15');
 if(!fs.existsSync(runner))throw Error('Missing Windows CMD runner');
 if(preview){console.log('PREVIEW ONLY: '+TASK+' daily '+time+', command='+runner);return;}
 if(process.platform!=='win32')throw Error('Task Scheduler installation requires Windows');
 if(!accepted)throw Error('Review https://congbao.chinhphu.vn/rss.htm and pass --acknowledge-terms');
 const existing=spawnSync('schtasks.exe',['/Query','/TN',TASK],{encoding:'utf8',windowsHide:true});
 if(existing.status===0&&!replace)throw Error('Task already exists; inspect it or pass --replace');
 fs.mkdirSync(path.dirname(ack),{recursive:true});
 fs.writeFileSync(ack,'TERMS_REVIEWED_AND_PERMITTED\r\n','utf8');
 // schtasks accepts the quoted absolute .cmd as task executable. Scheduled task
 // uses the creating user's existing Windows context; no password is stored.
 const command='"'+runner+'"';
 const opts=['/Create','/TN',TASK,'/SC','DAILY','/ST',time,'/TR',command];
 if(replace)opts.push('/F');
 const created=spawnSync('schtasks.exe',opts,{encoding:'utf8',windowsHide:true});
 if(created.status!==0)throw Error('Task creation failed: '+(created.stderr||created.stdout||'unknown').trim());
 const disabled=spawnSync('schtasks.exe',['/Change','/TN',TASK,'/DISABLE'],{encoding:'utf8',windowsHide:true});
 if(disabled.status!==0)throw Error('Task was created but could not be disabled; inspect Task Scheduler immediately.');
 console.log('Created DISABLED task '+TASK+' at '+time+'.');
 console.log('First run: cmd /d /c tools\\source\\run-auto-official-library.cmd');
 console.log('Review data\\source_sync\\logs\\official-library-latest.log, then: schtasks /Change /TN "'+TASK+'" /ENABLE');
}
if(require.main===module){try{main();}catch(e){console.error('TASK_INSTALL_ERROR: '+e.message);process.exitCode=1;}}
module.exports={main};
