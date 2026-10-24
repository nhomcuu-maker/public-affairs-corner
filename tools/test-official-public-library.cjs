'use strict';
const assert=require('node:assert/strict');
const {parseFeed}=require('./source/official-rss.cjs');
const {subject,officialCode,normalizeRecord,isOfficialPdfUrl,pdfLinksFromHtml,matchingPdf,verifyUrl,limitedFetch}=require('./source/official-public-library.cjs');
const xml='<?xml version="1.0"?><rss version="2.0"><channel><item><title>Thông tư số 117/2026/TT-BTC quy định miễn, giảm phí và lệ phí</title><link>https://congbao.chinhphu.vn/van-ban/thu-tuc-tai-chinh.htm</link><description>Văn bản mới đăng Công báo</description></item></channel></rss>';
const item=normalizeRecord(parseFeed(xml)[0]);
assert.equal(item.topic,'Tài chính, thuế và phí');
assert.equal(item.documentCode,'117/2026/TT-BTC');
assert.equal(item.origin,'official_rss');
assert.equal(item.status,'official_source_validity_unchecked');
assert.equal(item.localPdfUrl,null);
assert.equal(item.sourceUrl,'https://congbao.chinhphu.vn/van-ban/thu-tuc-tai-chinh.htm');
assert(!JSON.stringify(item).includes('published:true'));
assert.equal(subject('Hướng dẫn cấp hộ chiếu'),'Cư trú, hộ tịch và giấy tờ');
assert.equal(officialCode('Thông tư số 117/2026/TT-BTC'),'117/2026/TT-BTC');
const html=`<html><a href="https://g7.cdnchinhphu.vn/abc/2026/117.pdf">PDF</a><a href="https://evil.example/fake.pdf">X</a><a href="http://g7.cdnchinhphu.vn/u.pdf">insecure</a></html>`;
assert.deepEqual(pdfLinksFromHtml(html,item.sourceUrl),['https://g7.cdnchinhphu.vn/abc/2026/117.pdf']);
assert.equal(matchingPdf(['https://g7.cdnchinhphu.vn/2026_495_117-2026-TT-BTC.pdf','https://g7.cdnchinhphu.vn/other.pdf'],'117/2026/TT-BTC'),'https://g7.cdnchinhphu.vn/2026_495_117-2026-TT-BTC.pdf');
assert.equal(matchingPdf(['https://g7.cdnchinhphu.vn/other.pdf'],'117/2026/TT-BTC'),null);
assert.throws(()=>verifyUrl('http://congbao.chinhphu.vn/a.pdf',new Set(['congbao.chinhphu.vn'])));
assert.throws(()=>verifyUrl('https://congbao.chinhphu.vn.evil.example/a.pdf',new Set(['congbao.chinhphu.vn'])));
assert.throws(()=>verifyUrl('https://127.0.0.1/a.pdf',new Set(['congbao.chinhphu.vn'])));
assert.equal(pdfLinksFromHtml('<html><a href="javascript:alert(1)">foo</a></html>',item.sourceUrl).length,0);
const cdn='https://g7.cdnchinhphu.vn/api/download/stream?Url=opaque-token&file_name=2026_548-VBHN_128%2F2026%2FVBHN-N%C4%90-BXD.pdf';
assert.equal(isOfficialPdfUrl(cdn),true);
assert.equal(isOfficialPdfUrl('https://g7.cdnchinhphu.vn/api/download/stream?Url=opaque-token&file_name=unrelated.docx'),false);
const fromRealPattern=pdfLinksFromHtml('<html><a href="'+cdn.replace(/&/g,'&amp;')+'">PDF</a></html>',item.sourceUrl);
assert.deepEqual(fromRealPattern,[cdn]);
assert.equal(matchingPdf(fromRealPattern,'128/2026/VBHN-NĐ-BXD'),cdn);
assert.equal(officialCode('Văn bản hợp nhất số 128/2026/VBHN-NĐ-BXD'),'128/2026/VBHN-NĐ-BXD');
const originalFetch=global.fetch;
global.fetch=async()=>{throw Object.assign(Error('fetch failed'),{cause:Object.assign(Error('connect failed'),{code:'ETIMEDOUT'})});};
limitedFetch('https://congbao.chinhphu.vn/van-ban/sample.htm',new Set(['congbao.chinhphu.vn']),1000,'text/html').then(
 ()=>{throw Error('Expected network failure');},
 err=>{assert.match(err.message,/Network ETIMEDOUT \(congbao\.chinhphu\.vn\)/);}
).then(()=>{global.fetch=originalFetch;},err=>{global.fetch=originalFetch;process.nextTick(()=>{throw err;});});
console.log('PASS OFFICIAL PUBLIC LIBRARY: metadata, topic, source citation, HTTPS/CDN allowlist, unverified validity');
