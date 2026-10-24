'use strict';
// Explicitly allowlisted public-reference importer. No database writes, no status changes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const { subject } = require('../source/official-public-library.cjs');
const root = path.resolve(__dirname,'../..');
const evidence = path.join(root,'evidence');
const destination = path.join(root,'public','library-files');
const manifest = path.join(root,'public','library-catalog.json');
const allowedFolders = ['legal','new','review','thu-tuc'];
const allowReview = /^(luat_viec_lam_74_2025|thu_tuc_tro_cap_that_nghiep_2026)\.pdf$/i;
const excluded = /danh_ba|phieu_huong_dan|ca_nhan|mat_khau|otp|password/i;
function walk(dir){if(!fs.existsSync(dir))return []; return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):(e.isFile()?[path.join(dir,e.name)]:[]));}
async function extractPdf(file) {
  // Prefer local, non-network Poppler when installed (Windows optional), avoiding
  // browser canvas native dependencies required by some pdf-parse v2 builds.
  const poppler=cp.spawnSync('pdftotext',['-layout','-enc','UTF-8',file,'-'],
    {encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024,windowsHide:true});
  if(!poppler.error && poppler.status===0 && typeof poppler.stdout==='string')
    return poppler.stdout.replace(/\u0000/g,'').replace(/\s+/g,' ').trim();
  // pdf-parse v2 API. Use Uint8Array rather than Buffer to avoid strict input types.
  let parser;
  try {
    const { PDFParse } = require('pdf-parse');
    if (typeof PDFParse !== 'function') throw new Error('PDFParse class unavailable; expected pdf-parse v2');
    parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
    const result = await parser.getText();
    const output = String(result.text || '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
    if (!output) console.warn('PDF NO TEXT: ' + path.basename(file) + ' (may be scanned)');
    return output;
  } catch (error) {
    console.warn('PDF EXTRACTION FAILED: ' + path.basename(file) + ' | ' + String(error.message || error));
    return '';
  } finally {
    if (parser) {
      try { await parser.destroy(); } catch (error) { console.warn('PDF CLEANUP WARNING: ' + path.basename(file) + ' | ' + error.message); }
    }
  }
}
function officialHeading(text){
  const first=String(text||'').slice(0,1500);
  // Use only the prominent title preceding the statutory "Căn cứ..." part,
  // never body text whose subject may be merely a cross-reference.
  const found=first.match(/(?:^|\s)(LUẬT|THÔNG TƯ|NGHỊ QUYẾT|QUYẾT ĐỊNH)\s+(.{10,290}?)(?=\s+Căn cứ|\s+BỘ TRƯỞNG|\s+QUỐC HỘI ban hành|\s+Điều 1[.])/u);
  return found?{type:found[1],name:found[2].trim().replace(/\s+/g,' ')}:null;
}
function classify(name,text='',heading=null){
  if(/that.nghiep|viec_lam/i.test(name))return {domain:/thu_tuc|tro_cap/i.test(name)&&!/luat_viec_lam/i.test(name)?'ADMIN':'LEGAL',topic:'Việc làm và trợ cấp thất nghiệp'};
  if(/ho_chieu|xuat_nhap_canh|26270/i.test(name))return {domain:'ADMIN',topic:'Cư trú, hộ tịch và giấy tờ'};
  const headingText=heading?.name||'';
  const topic=/an ninh|trật tự/i.test(headingText)?'An ninh và trật tự'
    :/phí, lệ phí|khoản phí|mức thu/i.test(headingText)?'Tài chính, thuế và phí'
    :/công dân số/i.test(headingText)?'Định danh và công dân số'
    :subject(headingText);
  return {domain:'LEGAL',topic:topic==='Văn bản khác – cần phân loại'?'Văn bản pháp luật khác':topic};
}
// Human-readable Vietnamese display titles; source filenames remain untouched for audit.
const vietnameseTitles = Object.freeze({
  'luat_viec_lam_74_2025.pdf': 'Luật Việc làm số 74/2025/QH15',
  'thu_tuc_tro_cap_that_nghiep_2026.pdf': 'Thủ tục hưởng trợ cấp thất nghiệp năm 2026'
});
function displayTitle(filename) {
  const lower=filename.toLowerCase();
  if (vietnameseTitles[lower]) return vietnameseTitles[lower];
  const name=filename.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ').trim();
  const m=name.match(/^(\d+(?:[.]\d+)?)\s+(\d{4})\s+(QH\d+|TT\s+BTC|NQ\s+CP|QĐ\s+TTg)$/i);
  if(m) return 'Văn bản số '+m[1]+'/'+m[2]+'/'+m[3].toUpperCase().replace(/\s+/g,'-');
  // Do not guess the official document title from a code or invent Vietnamese accents.
  return name;
}
const files=walk(evidence).filter(f=>{const rel=path.relative(evidence,f).split(path.sep);const name=path.basename(f);return rel.length>=2 && allowedFolders.includes(rel[0]) && /\.pdf$/i.test(name) && !excluded.test(name) && (rel[0]!=='review'||allowReview.test(name));});
async function main() {
  const entries=[]; fs.mkdirSync(destination,{recursive:true});
  for(const file of files){
    const name=path.basename(file);
    const rel=path.relative(evidence,file);
    const contents=fs.readFileSync(file);
    const sha=crypto.createHash('sha256').update(contents).digest('hex');
    const id=sha.slice(0,18);
    const publicName=id+'.pdf';
    const target=path.join(destination,publicName);
    if(!fs.existsSync(target)||crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==sha)fs.writeFileSync(target,contents);
    const text=await extractPdf(file);
    // Digitized signature metadata / page counters alone are not a searchable document.
    const substantive=text.replace(/--\s*\d+\s+of\s+\d+\s*--/gi,'').trim();
    const extracted=substantive.length>=350?text:'';
    const heading=officialHeading(extracted);
    const kind=classify(name,extracted,heading);
    const codeTitle=displayTitle(name);
    const title=/^Văn bản số /.test(codeTitle) && heading
      ? (heading.type==='LUẬT'?'Luật':heading.type==='THÔNG TƯ'?'Thông tư':heading.type==='QUYẾT ĐỊNH'?'Quyết định':'Nghị quyết')
        +' '+codeTitle.replace(/^Văn bản số /,'số ')+' – '+heading.name
      : codeTitle;
    entries.push({id,title,filename:name,domain:kind.domain,topic:kind.topic,url:'/library-files/'+publicName,sha256:sha,sourcePath:rel.split(path.sep).join('/'),excerpt:extracted.slice(0,1100),searchText:(name+' '+extracted).slice(0,70000),textExtracted:!!extracted,status:'reference_unverified'});
  }
  entries.sort((a,b)=>a.title.localeCompare(b.title,'vi'));
  // Write atomically to avoid a truncated catalog when the process is interrupted.
  const output=JSON.stringify({generatedAt:new Date().toISOString(),notice:'Tài liệu tham khảo từ thư mục cục bộ, chưa được kiểm duyệt; không phải nội dung pháp luật chính thức đã công bố.',count:entries.length,items:entries},null,2);
  const tmp=manifest+'.tmp';
  fs.writeFileSync(tmp,output,'utf8');
  fs.renameSync(tmp,manifest);
  console.log('LIBRARY IMPORT COMPLETE: '+entries.length+' reference PDFs; text searchable: '+entries.filter(x=>x.textExtracted).length);
  console.log('LIBRARY CATALOG: public/library-catalog.json');
  if(entries.some(x=>!x.textExtracted)) console.warn('PDFs without extracted text: '+entries.filter(x=>!x.textExtracted).map(x=>x.filename).join(', '));
  console.log('NOTICE: Unverified reference library, not official publication. No SQL or approval changes.');
}
main().catch(err=>{console.error('LIBRARY IMPORT ERROR: '+(err.stack||err));process.exitCode=1;});
