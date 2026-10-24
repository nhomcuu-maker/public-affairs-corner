'use strict';
/** Public ORIGINAL-SOURCE INDEX built from an approved government RSS channel.
 * It is NOT knowledge_version publication and does not claim legal validity.
 * Optional PDF downloader reads only the RSS-linked official detail page, and
 * accepts only HTTPS PDF files on an explicit government CDN allow-list.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {validateRecord}=require('./official-rss.cjs');
const root=path.resolve(__dirname,'../..');
const inboxPath=path.join(root,'data/source_sync/congbao-pending.json');
const outputPath=path.join(root,'public/official-reference-catalog.json');
const downloadDir=path.join(root,'public/library-files');
const ACCEPTED_PDF_HOSTS=new Set(['congbao.chinhphu.vn','g7.cdnchinhphu.vn']);
const MAX_HTML_BYTES=1000000,MAX_PDF_BYTES=15*1024*1024;
function subject(text){
 const x=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
 const cases=[
  [/bao hiem|tro cap|that nghiep|viec lam|lao dong|tien luong|thai san|huu tri/,'Lao động, việc làm và an sinh'],
  [/ho chieu|cu tru|can cuoc|ho tich|khai sinh|quoc tich|xuat nhap canh|xuat canh|nhap canh/,'Cư trú, hộ tịch và giấy tờ'],
  [/giao duc|hoc phi|hoc sinh|sinh vien|dao tao|truong hoc/,'Giáo dục và đào tạo'],
  [/y te|benh vien|kham chua|suc khoe|thuoc|bao hiem y te/,'Y tế và sức khỏe'],
  [/dat dai|bat dong san|nha o|xay dung|quy hoach/,'Nhà ở, đất đai và xây dựng'],
  [/giao thong|duong bo|bang lai|dang kiem|phuong tien|van tai/,'Giao thông và phương tiện'],
  [/phi, le phi|le phi|ngan sach|tai chinh|thue|tin dung/,'Tài chính, thuế và phí'],
  [/an ninh mang|du lieu ca nhan|lua dao|phong chong toi pham/,'An toàn thông tin và phòng chống lừa đảo'],
  [/hon nhan|gia dinh|tre em|nuoi con/,'Gia đình và trẻ em'],
  [/thu tuc hanh chinh|dich vu cong|mot cua/,'Thủ tục hành chính'],
 ];
 return cases.find(([pattern])=>pattern.test(x))?.[1]||'Văn bản khác – cần phân loại';
}
function officialCode(text){
 const m=String(text).match(/\b\d{1,4}\/(?:20\d{2})\/(?:QH\d{1,2}|TT-[A-Z]{2,8}|NĐ-CP|ND-CP|QĐ-TTg|QD-TTg|NQ-CP|VBHN-(?:NĐ|TT|LQ)-[A-Z]{2,8}|VBHN-[A-Z]{2,8})\b/i);
 return m?m[0]:null;
}
function normalizeRecord(r){
 validateRecord(r);
 const title=r.title.trim();
 const topic=subject(title+' '+r.description);
 return {id:'congbao-'+r.uid.slice(0,18).toLowerCase(),title,documentCode:officialCode(title+' '+r.description),
  domain:/thu tuc hanh chinh|dich vu cong/i.test(title)?'ADMIN':'LEGAL',topic,
  description:r.description||title,excerpt:r.description||title,searchText:(title+' '+r.description+' '+topic).slice(0,2500),
  sourceName:'Công báo điện tử – Chính phủ',sourceUrl:r.url,url:r.url,publishedAtUtc:r.publishedAtUtc,
  status:'official_source_validity_unchecked',textExtracted:false,origin:'official_rss',
  note:'Nguồn trên Công báo; chưa đối chiếu hiệu lực, sửa đổi, thay thế. Không dùng làm kết luận pháp lý.',
  sha256:null,localPdfUrl:null};
}
function verifyUrl(raw,hosts){
 const u=new URL(raw);
 if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts.has(u.hostname.toLowerCase()))throw Error('Blocked external URL');
 if(!/^https:\/\//i.test(u.href))throw Error('HTTPS required');
 return u.href;
}
function isOfficialPdfUrl(href){
 const u=new URL(href);
 verifyUrl(u.href,ACCEPTED_PDF_HOSTS);
 if(/\.pdf$/i.test(u.pathname))return true;
 // The real government CDN uses /api/download/stream?Url=...&file_name=...pdf.
 // URL path is not a .pdf, but its explicit download filename is.
 return u.hostname.toLowerCase()==='g7.cdnchinhphu.vn' &&
  u.pathname==='./api/download/stream' &&
  /\.pdf$/i.test(u.searchParams.get('file_name')||'');
}
function pdfLinksFromHtml(html,base){
 if(/<!DOCTYPE\s+html/i.test(html)===false && !/<html[\s>]/i.test(html))return [];
 const links=[];
 for(const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gi)){
  const raw=m[2].replace(/&amp;/g,'&');
  try{
   const href=new URL(raw,base).href;
   verifyUrl(href,ACCEPTED_PDF_HOSTS);
   if(isOfficialPdfUrl(href))links.push(href);
  }catch{}
 }
 return [...new Set(links)];
}
function matchingPdf(links,documentCode){
 if(!links.length)return null;
 // Avoid linking an unrelated attachment from the same official detail page.
 if(!documentCode)return links.length===1?links[0]:null;
 const code=documentCode.toLowerCase().replace(/[^a-z0-9]/g,'');
 const candidates=links.filter(link=>{
  try {const u=new URL(link);const label=u.searchParams.get('file_name')||decodeURIComponent(u.pathname);return label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'').includes(code);}
  catch{return false;}
 });
 return candidates.length===1?candidates[0]:null;
}
async function limitedFetch(url,hosts,limit,contentTypes){
 let at=url;
 for(let n=0;n<3;n++){
  verifyUrl(at,hosts);
  const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),18000);
  let response;
  try{
    try{response=await fetch(at,{redirect:'manual',signal:ctl.signal,headers:{'User-Agent':'GocDanSinhSourceReference/1.0 (public-reference only)','Accept':contentTypes}});}
    catch(err){
     // Node's 'fetch failed' conceals the useful DNS/TLS/socket reason in `cause`.
     const why=err?.cause?.code||err?.cause?.message||err?.name||'unknown';
     throw Error('Network '+String(why).slice(0,140)+' ('+new URL(at).hostname+')');
    }
   if([301,302,307,308].includes(response.status)){
    if(n===2)throw Error('Too many redirects');
    const loc=response.headers.get('location');if(!loc)throw Error('Redirect without Location');
    at=new URL(loc,at).href;continue;
   }
   if(!response.ok)throw Error('HTTP '+response.status);
   if(Number(response.headers.get('content-length')||0)>limit)throw Error('Body too large');
   const chunks=[];let size=0;
   for await(const part of response.body){size+=part.length;if(size>limit)throw Error('Body size limit exceeded');chunks.push(part);}
   return {bytes:Buffer.concat(chunks),media:response.headers.get('content-type')||'',url:at};
  } finally{clearTimeout(timeout);}
 }
 throw Error('Too many redirects');
}
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp-'+process.pid;try{fs.writeFileSync(temp,value,{flag:'wx'});fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}
function previousItems(){
 if(!fs.existsSync(outputPath))return [];
 const o=JSON.parse(fs.readFileSync(outputPath,'utf8'));
 return o.schemaVersion===1&&Array.isArray(o.items)?o.items:[];
}
async function pullPdf(item){
 const page=await limitedFetch(item.sourceUrl,new Set(['congbao.chinhphu.vn']),MAX_HTML_BYTES,'text/html');
 if(!/text\/html/i.test(page.media))throw Error('Official detail did not return HTML');
 const links=pdfLinksFromHtml(page.bytes.toString('utf8'),page.url);
 if(!links.length)return {note:'Chưa xác định được liên kết PDF hợp lệ trên trang nguồn.'};
 const chosen=matchingPdf(links,item.documentCode);
 if(!chosen)return {note:'Trang nguồn có nhiều tệp hoặc không xác định được PDF đúng văn bản.'};
 const pdf=await limitedFetch(chosen,ACCEPTED_PDF_HOSTS,MAX_PDF_BYTES,'application/pdf');
 if(pdf.bytes.subarray(0,5).toString('ascii')!=='%PDF-')throw Error('Download is not a PDF');
 if(!/application\/pdf|octet-stream/i.test(pdf.media))throw Error('Unsupported PDF Content-Type');
 const sha=crypto.createHash('sha256').update(pdf.bytes).digest('hex');
 fs.mkdirSync(downloadDir,{recursive:true});
 const basename='official-'+sha.slice(0,24)+'.pdf';
 const destination=path.join(downloadDir,basename);
 if(!fs.existsSync(destination))atomic(destination,pdf.bytes);
 return {localPdfUrl:'/library-files/'+basename,sha256:sha,url:'/library-files/'+basename,
  pdfOriginUrl:pdf.url};
}
async function publish({apply=false,download=false,limit=12}={}){
 if(!fs.existsSync(inboxPath))throw Error('No official RSS inbox. Run npm run source:rss-collect first.');
 const inbox=JSON.parse(fs.readFileSync(inboxPath,'utf8'));
 if(inbox.schemaVersion!==1||inbox.source!=='congbao-van-ban-moi'||!Array.isArray(inbox.entries)||inbox.verified!==false||inbox.published!==false)throw Error('Untrusted RSS inbox');
 const prior=new Map(previousItems().map(x=>[x.id,x]));
 const items=inbox.entries.map(r=>{
  const basic=normalizeRecord(r), old=prior.get(basic.id);
  if(old&&old.sourceUrl===basic.sourceUrl&&typeof old.localPdfUrl==='string'&&/^\/library-files\/official-[0-9a-f]{24}\.pdf$/.test(old.localPdfUrl)&&fs.existsSync(path.join(root,'public',old.localPdfUrl)))
   return {...basic,localPdfUrl:old.localPdfUrl,url:old.localPdfUrl,sha256:old.sha256,pdfOriginUrl:old.pdfOriginUrl};
  return basic;
 });
 const counts={indexed:items.length,previouslyDownloaded:items.filter(x=>x.localPdfUrl).length,downloaded:0,failed:0,unavailable:0};
 if(apply&&download){
  // Source terms acknowledgement required by the upstream RSS owner.
  if(process.env.GDS_OFFICIAL_RSS_PERMISSION_ACK!=='TERMS_REVIEWED_AND_PERMITTED')throw Error('Confirm terms before retrieving official PDFs');
  for(const item of items.filter(x=>!x.localPdfUrl).slice(0,Math.min(50,Math.max(0,limit)))){
   try{
    const r=await pullPdf(item);
    if(r.localPdfUrl){Object.assign(item,r);counts.downloaded++;}else counts.unavailable++;
   }catch(err){counts.failed++;console.warn('PDF SKIPPED '+item.id+': '+String(err.message||err));}
  }
 }
 const catalog={schemaVersion:1,generatedAt:new Date().toISOString(),source:'congbao.chinhphu.vn',
  termsUrl:'https://congbao.chinhphu.vn/rss.htm',notice:'Thư mục văn bản gốc từ nguồn Công báo. Chưa xác minh hiệu lực hoặc tính áp dụng. Không phải dữ liệu tư vấn đã phê duyệt.',
  count:items.length,items:items.sort((a,b)=>(b.publishedAtUtc||'').localeCompare(a.publishedAtUtc||''))};
 if(apply)atomic(outputPath,JSON.stringify(catalog,null,2)+'\n');
 console.log(`OFFICIAL LIBRARY ${apply?'APPLIED':'PREVIEW'}: ${JSON.stringify(counts)}`);
 if(counts.failed>0)console.warn('PDF DOWNLOAD INCOMPLETE: run node tools/source/diagnose-official-download.cjs for network/link checks. Existing metadata and official links remain available.');
 return {counts,catalog};
}
if(require.main===module){const args=process.argv.slice(2);const idx=args.indexOf('--max-pdfs');const limit=idx>=0?Number(args[idx+1]):12;
 if(!Number.isInteger(limit)||limit<0||limit>50)throw Error('--max-pdfs must be 0..50');
 publish({apply:args.includes('--apply'),download:args.includes('--download-pdf'),limit}).catch(err=>{console.error('OFFICIAL_LIBRARY_ERROR: '+err.message);process.exitCode=1;});}
module.exports={subject,officialCode,normalizeRecord,isOfficialPdfUrl,pdfLinksFromHtml,matchingPdf,verifyUrl,limitedFetch,publish};
