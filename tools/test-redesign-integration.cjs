'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const dir=path.resolve(__dirname,'../public');
for(const [file,domain] of [['phap-luat-quyen-loi.html','LEGAL'],['thu-tuc-hanh-chinh.html','ADMIN']]){
 const html=fs.readFileSync(path.join(dir,file),'utf8');
 assert(!html.includes('VD: Điều 98'),'Example must not appear on the public page');
 assert(!html.includes('Ví dụ thiết kế giao diện'),'Example must not appear on the public page');
 assert(!html.includes('Tổng đài liên hệ: XXXXXX'),'Footer cannot show fake hotline');
 assert(html.includes('data-domain="'+domain+'"'),'Browser has the correct domain');
 assert.equal((html.match(/id="gds-reference-library"/g)||[]).length,1);
 assert(html.indexOf('id="gds-reference-library"') < html.indexOf('<footer>'),'Browser should be above footer');
 assert(html.includes('/css/gds-redesign.css'));
}
const src=fs.readFileSync(path.join(dir,'js/gds-library.js'),'utf8');
assert(src.includes('gds-lib-group-heading')&&src.includes('gds-lib-show-more'));
assert(src.includes('item.topic')&&src.includes('Tất cả lĩnh vực'));
assert(src.includes('textContent')&&src.includes('noopener noreferrer'));
const live=fs.readFileSync(path.join(dir,'js/gds-live.js'),'utf8');
assert(!live.includes("notify('Chưa tải được danh sách nội dung đã công bố ("));
assert(live.includes('Keyword API error; published list fallback used'));
console.log('REDESIGN: PASS (no legal demo, inline grouped library, clean footer, API fallback)');
