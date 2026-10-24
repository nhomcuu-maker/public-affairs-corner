'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root=path.resolve(__dirname,'..');
const name=path.join(root,'.env');
if(fs.existsSync(name)){
  const current=fs.readFileSync(name,'utf8');
  const match=current.match(/^DB_DATABASE=(.*)$/m);
  const db=(match?.[1]||'').trim();
  if(db!=='GocDanSinh'){
    console.error('File .env da ton tai nhung DB_DATABASE='+db+'. Hay chinh thanh DB_DATABASE=GocDanSinh. Khong ghi de .env.');
    process.exitCode=1;
  } else console.log('File .env da co san va DB_DATABASE=GocDanSinh; giu nguyen khoa bi mat.');
}else{
  const template=fs.readFileSync(path.join(root,'.env.example'),'utf8');
  const secret=crypto.randomBytes(32).toString('hex');
  const content=template.replace('GENERATED_BY_SETUP_SCRIPT',secret);
  fs.writeFileSync(name,content,{flag:'wx',mode:0o600});
  console.log('Da tao .env cho database GocDanSinh va tao DEV_PREVIEW_KEY ngau nhien.');
  console.log('KHONG chia se noi dung file .env va KHONG dua no vao public/.');
}
