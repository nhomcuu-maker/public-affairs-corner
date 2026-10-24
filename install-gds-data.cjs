const fs=require('node:fs'),path=require('node:path');
const base=process.cwd(),pub=path.join(base,'public'),source=path.join(__dirname,'payload','public');
if(!fs.existsSync(path.join(pub,'index.html'))||!fs.existsSync(path.join(pub,'js','gds-library.js')))throw Error('Hay chay trong thu muc goc GocDanSinh');
const backup=path.join(base,'backup-gds-data-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(backup,{recursive:true});
function save(rel){const target=path.join(pub,rel);if(fs.existsSync(target)){const b=path.join(backup,rel);fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(target,b);}return target;}
function read(rel){return fs.readFileSync(path.join(source,rel),'utf8');}
// Merge curated records, never discard entries the user has added independently.
let target=save('curated-official-catalog.json'),old={items:[]};if(fs.existsSync(target)){old=JSON.parse(fs.readFileSync(target,'utf8').replace(/^\uFEFF/,''));}
if(!Array.isArray(old.items))throw Error('curated catalog items invalid');
const add=JSON.parse(read('curated-official-catalog.json')).items;const ids=new Set(old.items.map(x=>x.documentCode?'code:'+x.documentCode:'url:'+x.url+'|'+x.topic));for(const x of add){const id=x.documentCode?'code:'+x.documentCode:'url:'+x.url+'|'+x.topic;if(!ids.has(id)){old.items.push(x);ids.add(id);}}
fs.writeFileSync(target,JSON.stringify(old,null,2)+'\n','utf8');
// Modify current library JS only at known anchors: keep other user changes.
target=save('js/gds-library.js');let lib=fs.readFileSync(target,'utf8');
if(!lib.includes('curated-official-catalog.json'))throw Error('gds-library.js khong phai ban dong bo - khong sua');
lib=lib.replace("'dichvucong.gov.vn'].includes", "'dichvucong.gov.vn','vanban.chinhphu.vn'].includes");
lib=lib.replace("const description=norm(x.description||x.excerpt)","const description=norm([x.description,x.excerpt,x.searchText].join(' '))");
lib=lib.replace("item.origin==='curated'?'Nguồn cơ quan nhà nước':'PDF lưu tại thư viện'", "item.origin==='directory'?'Trang tra cứu theo lĩnh vực':item.origin==='curated'?'Nguồn cơ quan nhà nước':'PDF lưu tại thư viện'");
lib=lib.replace("const key=x.documentCode&&norm(x.documentCode).length>5?norm(x.documentCode):url;", "const key=x.origin==='directory'?'directory:'+norm(x.topic):x.documentCode&&norm(x.documentCode).length>5?norm(x.documentCode):url;");
lib=lib.replace("url.startsWith('/library-files/')?'Đọc tài liệu PDF ↗':'Xem văn bản tại nguồn ↗'", "item.origin==='directory'?'Mở danh mục thủ tục tại Cổng DVC ↗':url.startsWith('/library-files/')?'Đọc tài liệu PDF ↗':'Xem văn bản tại nguồn ↗'");
fs.writeFileSync(target,lib,'utf8');
for(const rel of ['scam-official-references.json','js/gds-scam-references.js']){target=save(rel);fs.writeFileSync(target,read(rel),'utf8');}
target=save('canh-bao-lua-dao.html');let html=fs.readFileSync(target,'utf8');if(!html.includes('scam-official-references')){const marker='<div id="scamPublishedMount"';if(!html.includes(marker))throw Error('Khong thay scamPublishedMount');html=html.replace(marker,'<section id="scam-official-references" style="margin:24px 0;padding:20px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:14px"></section>\n        '+marker);html=html.replace('</body>','<script defer src="./js/gds-scam-references.js"></script>\n</body>');fs.writeFileSync(target,html,'utf8');}
console.log('DA BO SUNG NGUON THAM KHAO. Backup:',backup);console.log('Chay node --check public/js/gds-library.js va node --check public/js/gds-scam-references.js');