'use strict';
/* Conservatively parse one officially published RSS 2.0 feed. No article crawling.
 * Feed data is UNTRUSTED: links are validated, data is length-limited, no HTML rendered. */
const crypto = require('node:crypto');
const FEED = Object.freeze({
  id: 'congbao-van-ban-moi',
  url: 'https://congbao.chinhphu.vn/cac-van-ban-moi-ban-hanh.rss',
  publisher: 'Cong bao dien tu - congbao.chinhphu.vn',
  terms: 'https://congbao.chinhphu.vn/rss.htm'
});
const sha = v => crypto.createHash('sha256').update(v).digest('hex').toUpperCase();
const normalize = v => String(v ?? '').replace(/\s+/g, ' ').trim();
function htmlEntities(s) {
  return s.replace(/&(#x[\da-f]{1,6}|#\d{1,7}|amp|lt|gt|quot|apos|nbsp);/gi, (full, key) => {
    const lower = key.toLowerCase();
    const named = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
    if (named[lower] !== undefined) return named[lower];
    if (!lower.startsWith('#')) return full;
    const code = lower.startsWith('#x') ? parseInt(lower.slice(2),16) : parseInt(lower.slice(1),10);
    if (code < 32 && code !== 10 && code !== 13 && code !== 9 || code > 0x10ffff || code >= 0xd800 && code <= 0xdfff) return '';
    return String.fromCodePoint(code);
  });
}
function field(xml, key) {
  const m = xml.match(new RegExp(`<${key}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${key}\\s*>`, 'i'));
  if (!m) return '';
  const raw = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return normalize(htmlEntities(raw.replace(/<[^>]*>/g,' ')));
}
function approvedLink(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol === 'http:' && u.hostname.toLowerCase() === 'congbao.chinhphu.vn') u.protocol = 'https:';
    if (u.protocol !== 'https:' || u.username || u.password || u.hostname.toLowerCase() !== 'congbao.chinhphu.vn' || u.port) return null;
    u.hash = '';
    return u.href;
  } catch { return null; }
}
function parseFeed(xml, base = FEED) {
  if (Buffer.byteLength(xml, 'utf8') > 2*1024*1024) throw Error('RSS exceeds 2 MB');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw Error('DTD and entities are not supported');
  if (!/<rss(?:\s|>)/i.test(xml) || !/<channel(?:\s|>)/i.test(xml)) throw Error('Not an RSS 2.0 channel');
  const items = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item\s*>/gi)].slice(0, 200);
  if (!items.length) throw Error('No RSS items: verify channel format before collection');
  const records = [];
  for (const [,part] of items) {
    const link = approvedLink(field(part,'link'));
    // The official Cong Bao RSS can publish <title></title> while placing the
    // document title in <description><![CDATA[...]]></description>.
    // Use the feed's own description as a fallback; never derive a title from
    // an URL or accept an item without a meaningful official text field.
    const description = field(part, 'description').slice(0,1200);
    const title = (field(part, 'title') || description).slice(0,450);
    if (!link || !title) continue; // never follow or store external links
    const date = field(part,'pubDate');
    const timestamp = date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : null;
    const uid = sha(link);
    const digest = sha(JSON.stringify([title,description,timestamp,link]));
    records.push({sourceKey:base.id, uid, digest, title, description, publishedAtUtc:timestamp,
      url:link, verificationStatus:'PENDING_REVIEW'});
  }
  if (!records.length) throw Error('No items with approved links and titles');
  return [...new Map(records.map(r=>[r.uid,r])).values()];
}
function validateRecord(r) {
  if (!r || r.sourceKey !== FEED.id || approvedLink(r.url) !== r.url) throw Error('Invalid official source record');
  if (typeof r.title !== 'string' || r.title.length > 450 || !r.title.trim() ||
      typeof r.description !== 'string' || r.description.length > 1200) throw Error('Invalid entry metadata');
  if (r.publishedAtUtc !== null && (typeof r.publishedAtUtc !== 'string' ||
      !/^\d{4}-\d\d-\d\dT/.test(r.publishedAtUtc) || Number.isNaN(Date.parse(r.publishedAtUtc)))) throw Error('Invalid publication timestamp');
  if (r.uid !== sha(r.url) || r.digest !== sha(JSON.stringify([r.title,r.description,r.publishedAtUtc,r.url])) ||
      r.verificationStatus !== 'PENDING_REVIEW') throw Error('Entry integrity check failed');
  return true;
}
module.exports={FEED,sha,parseFeed,validateRecord,approvedLink};
