'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const {FEED,sha,parseFeed,validateRecord}=require('./source/official-rss.cjs');
const {update}=require('./source/sync-official-feed.cjs');
const rss=`<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel><title>Cong bao</title>
<item><title>Lu&#7853;t m&#7899;i &amp; th&#244;ng tin</title><link>http://congbao.chinhphu.vn/van-ban/luat-2026.htm</link><guid>111</guid>
<description><![CDATA[Thông tin&nbsp;đăng mới]]></description><pubDate>Sat, 10 Oct 2026 08:00:00 GMT</pubDate></item>
<item><title>Unsafe Link</title><link>https://private.example/doc</link><description>ignored</description></item>
<item><title> Duplicate </title><link>https://congbao.chinhphu.vn/van-ban/luat-2026.htm</link><description>duplicate item</description></item>
</channel></rss>`;
let checks=0;
// The real Cong Bao RSS (observed October 2026) has empty <title>, with the
// document title in CDATA description. Regression-test that exact structure.
const noTitleRss=`<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel><title>Công báo</title>
<item><title></title><description><![CDATA[Hợp nhất Nghị định Quy định điều kiện kinh doanh dịch vụ đào tạo thuyền viên, người lái phương tiện thủy nội địa]]></description><pubDate>Sat, 03 Oct 2026 00:00:00 GMT</pubDate><link>https://congbao.chinhphu.vn/van-ban/van-ban-hop-nhat-so-128-2026-vbhn-nd-bxd-470758.htm</link><guid>https://congbao.chinhphu.vn/van-ban/van-ban-hop-nhat-so-128-2026-vbhn-nd-bxd-470758.htm</guid></item>
<item><title></title><description><![CDATA[ <strong>Tên văn bản từ mô tả</strong> ]]></description><link>https://congbao.chinhphu.vn/van-ban/test-fallback.htm</link></item>
<item><title></title><description><![CDATA[  ]]></description><link>https://congbao.chinhphu.vn/van-ban/test-empty.htm</link></item>
<item><title></title><description><![CDATA[Văn bản liên kết ngoài]]></description><link>https://example.com/test.htm</link></item>
</channel></rss>`;
const fallback = parseFeed(noTitleRss);
assert.equal(fallback.length,2);checks++;
assert.equal(fallback[0].title,'Hợp nhất Nghị định Quy định điều kiện kinh doanh dịch vụ đào tạo thuyền viên, người lái phương tiện thủy nội địa');checks++;
assert.equal(fallback[0].description,fallback[0].title);checks++;
assert.equal(fallback[1].title,'Tên văn bản từ mô tả');checks++;
assert(fallback.every(validateRecord));checks++;
assert(!fallback.some(r=>r.url.includes('example.com') || r.url.includes('test-empty')));checks++;
const records=parseFeed(rss);assert.equal(records.length,1);checks++;
assert.equal(records[0].url,'https://congbao.chinhphu.vn/van-ban/luat-2026.htm');checks++;
assert.equal(records[0].verificationStatus,'PENDING_REVIEW');checks++;
assert.equal(records[0].uid,sha(records[0].url));checks++;
assert(validateRecord(records[0]));checks++;
const now='2026-10-10T12:00:00.000Z';
const first=update({entries:[]},records,now);assert.equal(first.summary.added,1);checks++;
const again=update(first,records,'2026-10-10T13:00:00.000Z');assert.equal(again.summary.added,0);assert.equal(again.summary.unchanged,1);checks++;
const changed=JSON.parse(JSON.stringify(records[0]));changed.title+=' (updated)';changed.digest=sha(JSON.stringify([changed.title,changed.description,changed.publishedAtUtc,changed.url]));
const updated=update(again,[changed],'2026-10-10T14:00:00.000Z');assert.equal(updated.summary.changed,1);checks++;
assert.throws(()=>parseFeed('<!DOCTYPE rss><rss><channel></channel></rss>'));checks++;
assert.throws(()=>parseFeed('<html>no rss</html>'));checks++;
assert.throws(()=>validateRecord({...records[0],verificationStatus:'accepted'}));checks++;
assert.throws(()=>validateRecord({...records[0],url:'https://example.com'}));checks++;
const dbPreview=spawnSync(process.execPath,[path.join(root,'tools/source/import-official-feed.cjs')],{cwd:root,encoding:'utf8'});
// If inbox absent, import preview should return a clear error; NEVER query the database.
assert(!/SQL IMPORT DONE/.test(dbPreview.stdout));checks++;
const sql=fs.readFileSync(path.join(root,'sql/Nguon_CongBao_Hang_Cho_KiemDuyet.sql'),'utf8');
assert(sql.includes('DECLARE @Apply BIT = 0') && sql.includes('ROLLBACK TRANSACTION'));checks++;
assert(!/UPDATE dbo\.knowledge_version|INSERT dbo\.knowledge_version_source/i.test(sql));checks++;
console.log(`PASS OFFICIAL RSS: ${checks}/${checks} checks; no live network; no SQL writes; source terms gate`);
