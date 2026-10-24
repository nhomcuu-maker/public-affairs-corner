const fs=require('node:fs'),path=require('node:path');
const root=process.cwd(),pub=path.join(root,'public'),src=path.join(__dirname,'payload');
if(!fs.existsSync(path.join(pub,'thu-tuc-hanh-chinh.html'))||!fs.existsSync(path.join(pub,'js','gds-library.js')))throw Error('Hay chay trong thu muc goc GocDanSinh');
const target=path.join(pub,'js','gds-library.js');const old=fs.readFileSync(target,'utf8');
if(!old.includes('curated-official-catalog.json')||!old.includes('gdsSearchCategory'))throw Error('Khong nhan dien duoc ban V4; khong thay the.');
const backup=path.join(root,'backup-gds-v5-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(backup,{recursive:true});
for(const [from,to] of [['gds-library.js',target],['verified-procedures.json',path.join(pub,'verified-procedures.json')]]){if(fs.existsSync(to))fs.copyFileSync(to,path.join(backup,path.basename(to)));fs.copyFileSync(path.join(src,from),to);}
console.log('DA CAI V5. Backup:',backup);console.log('Kiem tra: node --check .\\public\\js\\gds-library.js');
