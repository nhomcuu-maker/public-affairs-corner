'use strict';
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const crypto=require('node:crypto');
const root=path.join(__dirname,'..');const read=(x)=>fs.readFileSync(path.join(root,x),'utf8');
const schema=read('sql/01_GocDanSinh_Tao_Bang_Va_Nap_Du_Lieu.sql');
const check=read('sql/02_GocDanSinh_Kiem_Tra_Toan_Bo.sql');
const config=read('.env.example');const db=read('src/database/database.service.ts');
const tables=[...schema.matchAll(/\bCREATE\s+TABLE\s+dbo\.\[/gi)].length;
const fk=[...schema.matchAll(/\bALTER\s+TABLE\s+dbo\.\[[^\n]+\]\s+ADD\s+CONSTRAINT\s+\[FK_/gi)].length;
assert.equal(tables,52,'Expect 52 tables in original schema');
assert.equal(fk,116,'Expect 116 foreign keys in original schema');
assert.match(schema,/CREATE DATABASE \[GocDanSinh\]/);
assert.match(schema,/USE \[GocDanSinh\]/);
assert.match(check,/USE \[GocDanSinh\]/);
assert.match(db,/DB_DATABASE \?\? 'GocDanSinh'/);
assert.match(config,/^DB_DATABASE=GocDanSinh$/m);
for(const [file,label] of [
 ['public/index.html','index'],['public/thu-tuc-hanh-chinh.html','admin'],
 ['public/phap-luat-quyen-loi.html','legal'],['public/canh-bao-lua-dao.html','scam'],
 ['public/login.html','login'],['public/register.html','register']]){
 const html=read(file);
 assert.match(html,/\/js\/gds-live\.js/,label);
 assert.match(html,/\/css\/gds-live\.css/,label);
}
assert.match(read('src/procedures/dev-preview.guard.ts'),/NODE_ENV !== 'development'/);
assert.match(read('src/procedures/dev-preview.guard.ts'),/timingSafeEqual/);
const relFiles=[...schema.matchAll(/N'(evidence\/[^']+\.pdf)'/g)].map(m=>m[1]);
assert.equal(new Set(relFiles).size,8);
for(const p of new Set(relFiles)){
 const local=path.join(root,p);assert.ok(fs.existsSync(local),'Missing PDF: '+p);
 const hex=crypto.createHash('sha256').update(fs.readFileSync(local)).digest('hex').toUpperCase();
 assert.ok(schema.includes('0x'+hex),'PDF SHA-256 mismatch: '+p);
}
for(const page of ['index','thu-tuc-hanh-chinh','phap-luat-quyen-loi','canh-bao-lua-dao','login','register']){
 const html=read('public/'+page+'.html');
 for (const match of html.matchAll(/href="([a-z-]+\.html)"/gi)) assert.ok(fs.existsSync(path.join(root,'public',match[1])),'Broken link '+match[1]);
}
const keys=/DEV_PREVIEW_KEY=/g;assert.ok(!fs.existsSync(path.join(root,'public','.env')));
assert.match(read('public/kiem-tra-ban-nhap.html'),/api\/dev\/procedures\/GDS-ADMIN-HOCHIEU-26270/);
console.log('PASS: 52 tables; 116 foreign keys; DB name GocDanSinh; 6 HTML; protected preview; 8 verified PDFs; links and assets');
