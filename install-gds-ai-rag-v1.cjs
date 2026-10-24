'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=process.cwd(), base=__dirname;
if(!fs.existsSync(path.join(root,'package.json')) || !fs.existsSync(path.join(root,'src','assistant','assistant.service.ts'))){
 console.error('ERROR: Chay lenh tai thu muc goc GocDanSinh.');process.exit(1);
}
const files=['src/assistant/assistant.service.ts','src/assistant/assistant.logic.ts','src/assistant/assistant.catalog.ts'];
const backup=path.join(root,'backup-ai-rag-'+new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(backup,{recursive:true});
for(const file of files){const dst=path.join(root,file),src=path.join(base,'payload',file);
 if(!fs.existsSync(src))throw new Error('Missing payload: '+file);
 if(fs.existsSync(dst)){fs.mkdirSync(path.dirname(path.join(backup,file)),{recursive:true});fs.copyFileSync(dst,path.join(backup,file));}
}
for(const file of files){const dst=path.join(root,file);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(base,'payload',file),dst);}
console.log('AI RAG V1 installed. Backup: '+backup);
console.log('Run: npm run build');
console.log('Restart NestJS, then test chatbot.');
