const fs=require('node:fs'),path=require('node:path');
const root=process.cwd(),target=path.join(root,'public','js','gds-library.js');
if(!fs.existsSync(path.join(root,'public','index.html'))||!fs.existsSync(target))throw Error('Chay tai thu muc goc GocDanSinh');
const old=fs.readFileSync(target,'utf8');if(!old.includes('gds-reference-library')||!old.includes('curated-official-catalog.json'))throw Error('Ban gds-library.js khong dung voi V3, dung lai de tranh ghi de');
const backup=path.join(root,'backup-gds-search-v4-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(backup);fs.copyFileSync(target,path.join(backup,'gds-library.js'));
fs.copyFileSync(path.join(__dirname,'payload','gds-library.js'),target);
console.log('DA SUA TIM KIEM. Backup:',backup);console.log('Kiem tra: node --check .\\public\\js\\gds-library.js; Ctrl+F5');
