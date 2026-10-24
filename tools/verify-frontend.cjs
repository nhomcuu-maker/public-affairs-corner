const fs=require('node:fs');const path=require('node:path');
const base=path.join(__dirname,'..');
const pages=['index','phap-luat-quyen-loi','thu-tuc-hanh-chinh','canh-bao-lua-dao','login','register'];
for(const page of pages){
  const file=path.join(base,'public',page+'.html');
  const s=fs.readFileSync(file,'utf8');
  if(!s.includes('src="./js/gds-live.js"'))throw Error('Missing JS '+page);
  if(!s.includes('href="./css/gds-live.css"'))throw Error('Missing CSS '+page);
  for(const m of s.matchAll(/href="([a-z][^":]*\.html)"/g)) if(!fs.existsSync(path.join(base,'public',m[1]))) throw Error('Broken link '+m[1]);
}
for(const f of ['public/js/gds-live.js','public/css/gds-live.css','public/ảnh banner.jpg'])if(!fs.existsSync(path.join(base,f)))throw Error('Missing '+f);
if(fs.existsSync(path.join(base,'public','.env')))throw Error('Sensitive .env in public');
console.log('PASS: 6 pages, JS/CSS, links, banner and .env isolation');

// Regression: original homepage must have no auto-created connection dashboard.
const assert=require('node:assert/strict');
const client=fs.readFileSync(path.join(base,'public/js/gds-live.js'),'utf8');
assert.ok(client.includes('function ensurePanel()'), 'Lazy search panel missing');
assert.ok(!client.includes('Kết nối dữ liệu Góc Dân Sinh'), 'Technical dashboard reappeared in homepage script');
const init=client.slice(client.indexOf('  function init()'));
assert.doesNotMatch(init,/ensurePanel\(\)|buildPanel\(/, 'Panel must not be inserted at page load');
const dashboard=fs.readFileSync(path.join(base,'public/kiem-tra-he-thong.html'),'utf8');
assert.match(dashboard,/Kiểm tra kết nối và dữ liệu/);
assert.match(dashboard,/request\('health'\)/);
assert.match(dashboard,/kiem-tra-ban-nhap\.html/);
const main=fs.readFileSync(path.join(base,'src/main.ts'),'utf8');
assert.match(main,/kiem-tra-he-thong\.html/);
assert.match(main,/NODE_ENV !== 'development'/);
console.log('PASS: original homepage unchanged on load; separate localhost-only status page; draft preview preserved');
