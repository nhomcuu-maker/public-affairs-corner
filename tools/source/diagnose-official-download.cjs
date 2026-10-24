'use strict';
/** Read-only network probe. No PDF download, SQL writes, publishing or secret output. */
const fs=require('node:fs');
const path=require('node:path');
const dns=require('node:dns').promises;
const {validateRecord}=require('./official-rss.cjs');
const {limitedFetch,pdfLinksFromHtml,matchingPdf,officialCode}=require('./official-public-library.cjs');
const inbox=path.resolve(__dirname,'../../data/source_sync/congbao-pending.json');
async function run(){
 for(const host of ['congbao.chinhphu.vn','g7.cdnchinhphu.vn']){
  try{const res=await dns.lookup(host);console.log('DNS '+host+': OK '+res.address);}
  catch(err){console.log('DNS '+host+': FAILED '+(err.code||err.message));}
 }
 if(!fs.existsSync(inbox)){console.error('RSS inbox missing. Run npm run source:rss-collect');process.exitCode=1;return;}
 const o=JSON.parse(fs.readFileSync(inbox,'utf8'));
 if(!Array.isArray(o.entries)||!o.entries.length)throw Error('RSS inbox contains no entries');
 const first=o.entries.find(r=>{try{return validateRecord(r)}catch{return false}});
 if(!first)throw Error('No valid official record in inbox');
 console.log('PROBE URL: '+new URL(first.url).hostname+' (1 official detail page, no PDFs downloaded)');
 try{
  const page=await limitedFetch(first.url,new Set(['congbao.chinhphu.vn']),1000000,'text/html');
  console.log('DETAIL FETCH: OK; Content-Type='+page.media+'; bytes='+page.bytes.length);
  const links=pdfLinksFromHtml(page.bytes.toString('utf8'),page.url);
  const code=officialCode(first.title+' '+first.description);
  console.log('PDF LINKS: '+links.length+' allowed; selected='+Boolean(matchingPdf(links,code)));
  if(!links.length)console.log('CHECK: page may render file links dynamically, or the HTML layout has changed.');
 }catch(err){console.error('DETAIL FETCH FAILED: '+String(err.message||err));
  console.log('CHECK: HTTPS availability, DNS, proxy and certificate settings on this Windows machine. Do not disable TLS checking.');
  process.exitCode=1;
 }
}
run().catch(e=>{console.error('PROBE ERROR: '+e.message);process.exitCode=1;});
