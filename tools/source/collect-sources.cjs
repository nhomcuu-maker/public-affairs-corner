/**
 * Goc Dan Sinh - capture official source candidates: capture official source candidates safely.
 * Run this script from the tools/source directory of this project.
 * Does not edit .env, app source, database or previously captured files.
 * Does not create an SQL importer (captured is NOT verified).
 * Node 18+ required. No external packages.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const OUT = 'data/source_capture_report.json';
const TIMEOUT_MS = 45000;
const MAX_BYTES = 12 * 1024 * 1024;
const RETRIES = 2;
const HOSTS = new Set(['congbao.chinhphu.vn','datafiles.chinhphu.vn',
  'dichvucong.gov.vn','vpcp.dichvucong.gov.vn','baohiemxahoi.gov.vn','www.baohiemxahoi.gov.vn']);
const SOURCES = [
  { key:'LEGAL', module:'LEGAL', businessCode:'GDS-MVP-LEGAL-BHTN',
    canonicalUrl:'https://congbao.chinhphu.vn/van-ban/luat-so-74-2025-qh15-45562.htm',
    downloadUrls:['https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/7/74qh15.signed.pdf'],
    file:'evidence/review/luat_viec_lam_74_2025.pdf', kind:'pdf',
    reviewerNote:'Mo PDF, kiem tra Luat so 74/2025/QH15 va cac dieu BHTN; doi chieu hieu luc 01/01/2026.' },
  { key:'ADMIN', module:'ADMIN', businessCode:'GDS-MVP-ADMIN-TCTN',
    canonicalUrl:'https://vpcp.dichvucong.gov.vn/p/home/dvc-chi-tiet-thu-tuc-hanh-chinh.html?ma_thu_tuc=1.014748',
    downloadUrls:['https://dichvucong.gov.vn/p/home/dvc-chi-tiet-thu-tuc-dung-chung.html?ma_thu_tuc=1.014748'],
    file:'evidence/review/thu_tuc_tro_cap_that_nghiep_trang_web.html', kind:'html',
    reviewerNote:'HTML co the la khung JS rong. Chi duyet neu co noi dung thu tuc, ma, ho so va dia phuong.' },
  { key:'SCAM1', module:'SCAM', businessCode:'GDS-MVP-SCAM-MAODANH-BHXH',
    canonicalUrl:'https://baohiemxahoi.gov.vn/tintuc/Pages/hoat-dong-he-thong-bao-hiem-xa-hoi.aspx?CateID=52&ItemID=25391',
    downloadUrls:['https://baohiemxahoi.gov.vn/tintuc/Pages/hoat-dong-he-thong-bao-hiem-xa-hoi.aspx?CateID=52&ItemID=25391'],
    file:'evidence/review/canh_bao_mao_danh_bhxh_tp_hcm.html', kind:'html',
    reviewerNote:'Doi chieu chinh xac bai canh bao tai BHXH, khong dung trang chu hoac trang loi.' },
  { key:'SCAM2', module:'SCAM', businessCode:'GDS-MVP-SCAM-MAODANH-BHXH',
    canonicalUrl:'https://baohiemxahoi.gov.vn/tintuc/Pages/hoat-dong-he-thong-bao-hiem-xa-hoi.aspx?CateID=52&itemID=24971',
    downloadUrls:['https://baohiemxahoi.gov.vn/tintuc/Pages/hoat-dong-he-thong-bao-hiem-xa-hoi.aspx?CateID=52&itemID=24971'],
    file:'evidence/review/canh_bao_mao_danh_bhxh.html', kind:'html',
    reviewerNote:'Bai ngay 13/06/2025, ve gia mao can bo BHXH, tai khoan ngan hang.' },
];
const hash = b => crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
function validateUrl(s) {
  const u = new URL(s);
  if (u.protocol !== 'https:' || !HOSTS.has(u.hostname) || u.username || u.password)
    throw Error('Unapproved official host/URL: ' + s);
  return u;
}
function stripHtml(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ')
    .replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'")
    .replace(/\s+/g,' ').trim();
}
function inspect(bytes, s) {
  if (s.kind === 'pdf') {
    if (bytes.length < 20000 || bytes.subarray(0,5).toString('ascii') !== '%PDF-')
      return {ok:false,reason:'Not a plausible PDF (header or size incorrect)'};
    return {ok:true,reason:'PDF header + size OK; human must check document identity/content'};
  }
  const html = bytes.toString('utf8');
  if (bytes.length < 5000 || !/<html[\s>]/i.test(html))
    return {ok:false,reason:'HTML too small or lacks document markup; possible JS shell/error page'};
  const visible = stripHtml(html).toLowerCase();
  if (/captcha|access denied|robot check|application error|request blocked/i.test(visible.slice(0,1000)))
    return {ok:false,reason:'Website access/error page, not a source article'};
  if (s.key === 'ADMIN') {
    if (!/trợ cấp thất nghiệp|tr&#7907; c&#7845;p th&#7845;t nghi&#7879;p/i.test(visible)
        || !/hồ sơ|trình tự thực hiện|thời hạn|cơ quan thực hiện/i.test(visible))
      return {ok:false,reason:'Procedure text not present; likely JS-only shell'};
  } else if (s.module === 'SCAM') {
    if (!/bhxh|bảo hiểm xã hội/i.test(visible) || !/mạo danh|giả mạo|lừa đảo/i.test(visible))
      return {ok:false,reason:'Actual BHXH impersonation warning text not found'};
  }
  return {ok:true,reason:'Basic topic checks passed; manual review still required'};
}
function delay(ms) {return new Promise(r=>setTimeout(r,ms));}
async function fetchLimited(url) {
  validateUrl(url);
  const ctl = new AbortController();
  const t = setTimeout(()=>ctl.abort(),TIMEOUT_MS);
  try {
    const response = await fetch(url, {signal:ctl.signal,redirect:'follow',headers:{
      'user-agent':'Mozilla/5.0 (compatible; GocDanSinhSourceReview/2.0)',
      accept:'application/pdf,text/html;q=0.9,*/*;q=0.5'
    }});
    validateUrl(response.url);
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const claimed = Number(response.headers.get('content-length')||0);
    if (claimed > MAX_BYTES) throw Error('Content length exceeds 12MB');
    if (!response.body) throw Error('Empty response body');
    const chunks=[]; let len=0;
    for await (const part of response.body) {
      const buf=Buffer.from(part); len += buf.length;
      if (len>MAX_BYTES) throw Error('Downloaded data exceeds 12MB');
      chunks.push(buf);
    }
    return {data:Buffer.concat(chunks), finalUrl:response.url,
      mimeType:response.headers.get('content-type')||''};
  } catch(err) {
    if (ctl.signal.aborted) throw Error('TIMEOUT after 45s (origin may be slow/blocked)');
    throw err;
  } finally {clearTimeout(t);}
}
function uniqueFilename(original) {
  if (!fs.existsSync(path.join(root,original))) return original;
  const ext=path.extname(original), stem=original.slice(0,-ext.length);
  const at=new Date().toISOString().replace(/[-:.Z]/g,'').slice(0,14);
  for (let i=0;i<100;i++) {
    const next=`${stem}_capture_${at}${i?'_'+i:''}${ext}`;
    if(!fs.existsSync(path.join(root,next))) return next;
  }
  throw Error('Unable to choose unique output filename');
}
async function collect(s){
  const localPath=path.join(root,s.file);
  const notices=[];
  if (fs.existsSync(localPath)) {
    const buf=fs.readFileSync(localPath), check=inspect(buf,s);
    if (check.ok) {
      return {key:s.key,module:s.module,businessCode:s.businessCode,canonicalUrl:s.canonicalUrl,
        capturedUrl:null,filename:s.file,bytes:buf.length,sha256:hash(buf),
        status:'CANDIDATE_NOT_VERIFIED',method:'existing_local_file',
        capturedAtUtc:null,check:check.reason,reviewerNote:s.reviewerNote,
        notices:['Existing file: capture timestamp and URL cannot be independently proven by this script']};
    }
    notices.push(`Old file ${s.file} kept untouched; NOT accepted: ${check.reason}`);
  }
  let lastError='No successful attempt';
  for (const url of s.downloadUrls) {
    for (let attempt=1;attempt<=RETRIES;attempt++){
      try {
        const r=await fetchLimited(url);
        const c=inspect(r.data,s);
        if (!c.ok) {lastError=c.reason;break;}
        const filename=uniqueFilename(s.file);
        fs.writeFileSync(path.join(root,filename),r.data,{flag:'wx'});
        return {key:s.key,module:s.module,businessCode:s.businessCode,
          canonicalUrl:s.canonicalUrl,capturedUrl:r.finalUrl,filename,
          bytes:r.data.length,sha256:hash(r.data),status:'CANDIDATE_NOT_VERIFIED',
          method:'downloaded',capturedAtUtc:new Date().toISOString(),check:c.reason,
          reviewerNote:s.reviewerNote,notices};
      } catch(err){
        lastError=String(err.message||err);
        notices.push(`Attempt ${attempt}/${RETRIES}: ${lastError}`);
        if (attempt < RETRIES) await delay(attempt*1100);
      }
    }
  }
  return {key:s.key,module:s.module,status:'PENDING',error:lastError,notices,
    canonicalUrl:s.canonicalUrl,reviewerNote:s.reviewerNote};
}
function selfTest(){
  const testPdf=Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(22000)]);
  const badHtml=Buffer.from('<html><body>loading</body></html>');
  const validHtml=Buffer.from('<html><body>'+('BHXH cảnh báo giả mạo cán bộ và lừa đảo. '.repeat(250))+'</body></html>');
  let n=0;
  if(inspect(testPdf,SOURCES[0]).ok)n++;
  if(!inspect(badHtml,SOURCES[1]).ok)n++;
  if(inspect(validHtml,SOURCES[2]).ok)n++;
  if(hash(Buffer.from('abc'))==='BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD')n++;
  try{validateUrl('https://malicious.example/anything');}catch{n++;}
  if(n!==5) throw Error(`Self-test failed ${n}/5`);
  console.log('SELF-TEST SOURCE CAPTURE: 5/5 PASS (offline, no database writes)');
}
async function main(){
  if (!fs.existsSync(path.join(root,'package.json'))) throw Error('Place this script within the GocDanSinh project tools/source folder.');
  if (process.argv.includes('--self-test')) return selfTest();
  const records=[];
  for (const source of SOURCES){
    console.log(`CHECKING ${source.key} ...`);
    const result=await collect(source);records.push(result);
    console.log(`${result.status==='PENDING'?'PENDING':'CAPTURED_CANDIDATE'} ${source.key}: ${result.status==='PENDING'?result.error:result.filename}`);
    for (const n of result.notices||[]) console.log('  INFO: '+n);
  }
  const got=records.filter(r=>r.status==='CANDIDATE_NOT_VERIFIED');
  const modules=new Set(got.map(r=>r.module));
  const output={schemaVersion:2,project:'GocDanSinh',createdAtUtc:new Date().toISOString(),
    verified:false,published:false,dbChanged:false,modulesWithCandidates:[...modules],
    potentialDemoCoverage:['LEGAL','ADMIN','SCAM'].every(x=>modules.has(x)),
    warning:'No item has been verified. Do NOT use old generated SQL to certify these files.',
    records};
  fs.writeFileSync(path.join(root,OUT),JSON.stringify(output,null,2)+'\n');
  console.log(`\nSOURCE CAPTURE: candidate=${got.length}/4, pending=${4-got.length}, demo_modules=${[...modules].join(',')||'none'}`);
  console.log('REPORT: '+OUT);
  console.log('NO SQL GENERATED. Do not approve or publish before manual content/source review.');
}
main().catch(e=>{console.error('ERROR: '+String(e.message||e));process.exitCode=1;});
