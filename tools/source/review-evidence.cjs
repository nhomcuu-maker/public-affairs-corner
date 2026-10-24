/**
 * GocDanSinh - offline evidence review: offline review and guarded SQL generation.
 * Keep this script in tools/source of the existing project.
 * No network, no DB connections, no .env/code changes, no overwrites of evidence files.
 * Run: node .\tools/source/review-evidence.cjs
 *      node .\tools/source/review-evidence.cjs --self-test
 *      node .\tools/source/review-evidence.cjs --make-sql
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname, '../..');
const V2='data/source_capture_report.json';
const ADMIN='evidence/review/thu_tuc_tro_cap_that_nghiep_2026.pdf';
const REPORT='data/evidence_review_report.json';
const MANUAL_SCAM_PDF='data/evidence_manual_candidates.json';
const SQLFILE='sql/13_Nap_Chung_Cu_Sau_Doi_Chieu.sql';
const ADMIN_URL='https://vpcp.dichvucong.gov.vn/p/home/dvc-chi-tiet-thu-tuc-hanh-chinh.html?ma_thu_tuc=1.014748';
const SOURCE_META={
  LEGAL:{businessCode:'GDS-MVP-LEGAL-BHTN',canonicalUrl:'https://congbao.chinhphu.vn/van-ban/luat-so-74-2025-qh15-45562.htm',kind:'pdf',role:'legal_basis',locator:'Luật số 74/2025/QH15; đối chiếu điều BHTN và hiệu lực'},
  ADMIN:{businessCode:'GDS-MVP-ADMIN-TCTN',canonicalUrl:ADMIN_URL,kind:'pdf',role:'procedure',locator:'Thủ tục 1.014748, Quyết định 107/QĐ-BNV (2026); kiểm tra địa phương'},
  SCAM2:{businessCode:'GDS-MVP-SCAM-MAODANH-BHXH',canonicalUrl:'https://baohiemxahoi.gov.vn/tintuc/Pages/hoat-dong-he-thong-bao-hiem-xa-hoi.aspx?CateID=52&itemID=24971',kind:'html',role:'warning',locator:'Cảnh báo BHXH giả danh cán bộ ngày 13/06/2025'}
};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
function safePath(file) {
  if(typeof file!=='string'||!/^evidence\/review\/[a-z0-9_-]+\.(pdf|html)$/.test(file)||file.includes('..')) throw Error('Unexpected evidence filename: '+file);
  return path.join(ROOT,file);
}
function isPdf(b){return b.length>=20000&&b.subarray(0,5).toString('ascii')==='%PDF-'&&b.lastIndexOf(Buffer.from('%%EOF'))>=b.length-8192;}
function htmlText(b){return b.toString('utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|#160);/gi,' ').replace(/\s+/g,' ');}
function isScamHtml(b){const s=htmlText(b).toLowerCase();return b.length>=5000&&/<html[\s>]/i.test(b.toString('utf8'))&&/(bhxh|bảo hiểm xã hội)/i.test(s)&&/(giả mạo|mạo danh|lừa đảo)/i.test(s)&&!/(access denied|captcha|robot check)/i.test(s.slice(0,700));}
function sqlq(t){return "N'"+String(t).replace(/'/g,"''")+"'";}
function inspectRecord(key,file,expectedSha,method,capturedAt,capturedUrl,formatOverride){
  let location;
  try{location=safePath(file);}catch(e){return {key,status:'PENDING',error:e.message};}
  if(!fs.existsSync(location))return {key,status:'PENDING',error:'Missing local file: '+file};
  const b=fs.readFileSync(location),meta=SOURCE_META[key],actual=sha(b);
  const kind=formatOverride||meta.kind;
  if(!['pdf','html'].includes(kind)||(formatOverride&&key!=='SCAM2'))return {key,status:'PENDING',error:'Unrecognized evidence format',filename:file};
  if(expectedSha&&actual!==expectedSha)return {key,status:'PENDING',error:'SHA-256 differs from V2 report; do not use modified evidence',filename:file};
  if(kind==='pdf'&&!isPdf(b))return {key,status:'PENDING',error:'PDF header/size/EOF check failed',filename:file};
  if(key==='SCAM2'&&kind==='html'&&!isScamHtml(b))return {key,status:'PENDING',error:'Source HTML lacks enough relevant article text; may be JS-only/error page',filename:file};
  return {key,status:'CANDIDATE_NOT_VERIFIED',businessCode:meta.businessCode,canonicalUrl:meta.canonicalUrl,
    capturedUrl:capturedUrl||null,filename:file,bytes:b.length,sha256:actual,
    mimeType:kind==='pdf'?'application/pdf':'text/html',method:method||'unknown',
    capturedAtUtc:capturedAt||null,role:meta.role,locator:meta.locator,
    warning:kind==='pdf'&&key==='SCAM2'
      ?'Image-only, one-page browser PDF; the contact directory at the end may be incomplete. Manual comparison against the official article is required. SHA/format checks do NOT verify origin or completeness.'
      :'Format/hash checks do NOT verify contents, website origin, applicability, or legal validity.'};
}
// A user-provided browser PDF is a separate candidate, NOT an amendment to the old
// source_capture_report.json. Preserve the mismatched old HTML and its audit history.
function inspectManualScamPdf(){
 const location=path.join(ROOT,MANUAL_SCAM_PDF);
 if(!fs.existsSync(location))return null;
 let doc;
 try{doc=JSON.parse(fs.readFileSync(location,'utf8'));}
 catch(e){return {key:'SCAM2',status:'PENDING',error:'Invalid manual candidate JSON: '+e.message};}
 const r=doc && doc.SCAM2;
 if(doc.schemaVersion!==1||!r||r.filename!=='evidence/review/canh_bao_mao_danh_bhxh_2025_v2.pdf'||
   r.canonicalUrl!==SOURCE_META.SCAM2.canonicalUrl||
   typeof r.sha256!=='string'||!/^[A-F0-9]{64}$/.test(r.sha256)||
   r.method!=='browser_print_pdf'){
   return {key:'SCAM2',status:'PENDING',error:'Manual SCAM2 manifest is missing required metadata or SHA-256'};
 }
 const record=inspectRecord('SCAM2',r.filename,r.sha256,r.method,null,r.canonicalUrl,'pdf');
 if(record.status==='CANDIDATE_NOT_VERIFIED'){
   record.provenance='user-provided browser PDF; original HTML capture remains PENDING';
   record.requiresManualTextComparison=true;
   record.originalV2CaptureUnchanged=true;
 }
 return record;
}
function inspect(){
 if(!fs.existsSync(path.join(ROOT,'package.json'))) throw Error('Run this script from existing GocDanSinh root, next to package.json.');
 if(!fs.existsSync(path.join(ROOT,V2))) throw Error('Missing '+V2+'; need the output from step 14.2 V2.');
 const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,V2),'utf8'));
 if(manifest.schemaVersion!==2||!Array.isArray(manifest.records))throw Error('Unexpected V2 report schema');
 const rec=key=>manifest.records.find(r=>r.key===key);
 const legal=rec('LEGAL'),scam=rec('SCAM2');
 const records=[];
 for(const [key,r] of [['LEGAL',legal],['SCAM2',scam]]){
   if(key==='SCAM2'){
     const manual=inspectManualScamPdf();
     if(manual){records.push(manual);continue;}
   }
   if(!r||r.status!=='CANDIDATE_NOT_VERIFIED')records.push({key,status:'PENDING',error:'No V2 candidate exists'});
   else records.push(inspectRecord(key,r.filename,r.sha256,r.method,r.capturedAtUtc,r.capturedUrl));
 }
 records.splice(1,0,inspectRecord('ADMIN',ADMIN,null,'browser_print_pdf',null,ADMIN_URL));
 const ready=records.every(r=>r.status==='CANDIDATE_NOT_VERIFIED');
 const report={project:'GocDanSinh',stage:'evidence_review',generatedAtUtc:new Date().toISOString(),
    databaseWritten:false,published:false,verified:false,readyForHumanContentReview:ready,
    note:'3 file candidates passing format/hash are NOT 3 verified sources. SCAM2 PDF is image-only and may omit the last contact directory. Human comparison and approval remain mandatory; no automatic SQL changes.',records};
 fs.writeFileSync(path.join(ROOT,REPORT),JSON.stringify(report,null,2)+'\n');
 return report;
}
function genSql(report){
 if(!report.readyForHumanContentReview)throw Error('Not all 3 initial demo sources are present and format-checked. SQL NOT generated.');
 const rows=report.records.map(r=>{
    const parsed=r.capturedAtUtc?new Date(r.capturedAtUtc):null;
    const when=parsed&&!Number.isNaN(parsed.valueOf())?parsed.toISOString().slice(0,23):null;
    // Existing files with no independently established capture timestamp are registered now as manual review intake.
    const intakeTime=when||report.generatedAtUtc.slice(0,23);
    const method=when&&r.method==='downloaded'?'download':'local_review';
    const values=[r.businessCode,r.canonicalUrl,r.capturedUrl,r.filename,r.mimeType,r.bytes,r.sha256,intakeTime,method,r.role,r.locator];
    return '('+values.map((v,i)=>v===null?'NULL':([5].includes(i)?String(v):i===6?"'"+v+"'":sqlq(v))).join(',')+')';
 }).join(',\n');
 const sql=`/* GOC DAN SINH - MANUAL-REVIEW EVIDENCE INTAKE ONLY.
IMPORTANT: This SQL does not verify sources, accept verification, approve or publish content.
Open EACH local file, independently review its official URL, actual contents, date,
validity, and area of application. Confirm SHA-256 by Get-FileHash and backup the database.
Then ONLY IF VERIFIED, manually set @DaDoiChieuNguon=1 below.
File saved from browser has no independent proof of original web origin or time.
Captured_at for such files is LOCAL REVIEW INTAKE time, not web publication date.
Generated UTC: ${report.generatedAtUtc}
*/
USE [GocDanSinh];
GO
SET XACT_ABORT ON;
SET NOCOUNT ON;
DECLARE @DaDoiChieuNguon BIT = 0;
IF @DaDoiChieuNguon<>1 THROW 59500,N'CHUA DOI CHIEU NGUON: KHONG GHI CSDL',1;
IF DB_NAME()<>N'GocDanSinh' THROW 59501,N'Sai database',1;
DECLARE @T TABLE(code NVARCHAR(100),canonical NVARCHAR(1200),captured NVARCHAR(1200),
  file_name NVARCHAR(500),mime NVARCHAR(120),size_bytes BIGINT,sha VARCHAR(64),
  intake_utc NVARCHAR(23),method NVARCHAR(25),role NVARCHAR(24),locator NVARCHAR(400));
INSERT @T VALUES
${rows};
IF (SELECT COUNT(*) FROM @T)<>3 THROW 59502,N'Expected 3 sources',1;
IF EXISTS(SELECT 1 FROM @T WHERE LEN(sha)<>64 OR sha LIKE '%[^0-9A-F]%') THROW 59503,N'Invalid SHA',1;
IF EXISTS(SELECT 1 FROM @T t WHERE NOT EXISTS (
  SELECT 1 FROM dbo.knowledge_item ki JOIN dbo.knowledge_version kv ON kv.item_id=ki.id
  WHERE ki.business_code=t.code AND kv.version_no=1 AND kv.editorial_status=N'draft'))
 THROW 59504,N'Content no longer in draft state; stop and reconcile',1;
IF EXISTS(SELECT 1 FROM @T t WHERE NOT EXISTS (SELECT 1 FROM dbo.[source] s WHERE s.canonical_url=t.canonical))
 THROW 59505,N'Official canonical URL not in dbo.source; stop and reconcile',1;
IF EXISTS(SELECT 1 FROM @T t JOIN dbo.file_asset f ON f.storage_key=t.file_name
  WHERE f.sha256<>CONVERT(BINARY(32),t.sha,2) OR f.size_bytes<>t.size_bytes)
 THROW 59506,N'Existing filename has different SHA/size; stop',1;
BEGIN TRY
 BEGIN TRAN;
 DECLARE @code NVARCHAR(100),@canonical NVARCHAR(1200),@captured NVARCHAR(1200),
 @filename NVARCHAR(500),@mime NVARCHAR(120),@bytes BIGINT,@hex VARCHAR(64),
 @utc NVARCHAR(23),@method NVARCHAR(25),@role NVARCHAR(24),@loc NVARCHAR(400),
 @source BIGINT,@version BIGINT,@asset BIGINT,@snapshot BIGINT,@hash BINARY(32);
 DECLARE c CURSOR LOCAL FAST_FORWARD FOR
 SELECT code,canonical,captured,file_name,mime,size_bytes,sha,intake_utc,method,role,locator FROM @T;
 OPEN c;
 FETCH NEXT FROM c INTO @code,@canonical,@captured,@filename,@mime,@bytes,@hex,@utc,@method,@role,@loc;
 WHILE @@FETCH_STATUS=0
 BEGIN
   SELECT TOP(1) @source=id FROM dbo.[source] WHERE canonical_url=@canonical ORDER BY id;
   SELECT TOP(1) @version=kv.id FROM dbo.knowledge_item ki JOIN dbo.knowledge_version kv ON kv.item_id=ki.id
    WHERE ki.business_code=@code AND kv.version_no=1 AND kv.editorial_status=N'draft' ORDER BY kv.id;
   SET @hash=CONVERT(BINARY(32),@hex,2);
   SET @asset=(SELECT TOP(1) id FROM dbo.file_asset WHERE storage_key=@filename ORDER BY id);
   IF @asset IS NULL BEGIN
     INSERT dbo.file_asset(storage_key,sha256,mime_type,size_bytes,uploaded_at)
       VALUES(@filename,@hash,@mime,@bytes,SYSUTCDATETIME());
     SET @asset=CONVERT(BIGINT,SCOPE_IDENTITY());
   END;
   SET @snapshot=(SELECT TOP(1) id FROM dbo.source_snapshot
     WHERE source_id=@source AND file_asset_id=@asset AND content_sha256=@hash ORDER BY id);
   IF @snapshot IS NULL BEGIN
     INSERT dbo.source_snapshot(source_id,captured_at,content_sha256,file_asset_id,captured_url,capture_method)
      VALUES(@source,CONVERT(DATETIME2(3),@utc,126),@hash,@asset,@captured,@method);
     SET @snapshot=CONVERT(BIGINT,SCOPE_IDENTITY());
   END;
   IF NOT EXISTS(SELECT 1 FROM dbo.knowledge_version_source WHERE version_id=@version AND snapshot_id=@snapshot)
     INSERT dbo.knowledge_version_source(version_id,snapshot_id,evidence_role,locator)
     VALUES(@version,@snapshot,@role,@loc);
   SET @asset=NULL;SET @snapshot=NULL;
   FETCH NEXT FROM c INTO @code,@canonical,@captured,@filename,@mime,@bytes,@hex,@utc,@method,@role,@loc;
 END;
 CLOSE c;DEALLOCATE c;
 COMMIT;
END TRY BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;
SELECT ki.business_code,kv.id AS version_id,kv.editorial_status,
  COUNT(kvs.snapshot_id) AS linked_snapshots
FROM dbo.knowledge_item ki JOIN dbo.knowledge_version kv ON kv.item_id=ki.id
LEFT JOIN dbo.knowledge_version_source kvs ON kvs.version_id=kv.id
WHERE ki.business_code IN (N'GDS-MVP-LEGAL-BHTN',N'GDS-MVP-ADMIN-TCTN',N'GDS-MVP-SCAM-MAODANH-BHXH')
GROUP BY ki.business_code,kv.id,kv.editorial_status;
GO
`;
 fs.writeFileSync(path.join(ROOT,SQLFILE),sql,{flag:'wx'});
 return SQLFILE;
}
function selfTest(){let n=0;
 const pdf=Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(21000),Buffer.from('%%EOF')]);
 if(isPdf(pdf))n++;
 if(!isPdf(Buffer.from('<html>error</html>')))n++;
 if(sqlq("A'B")==="N'A''B'")n++;
 if(sha(Buffer.from('abc'))==='BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD')n++;
 const html=Buffer.from('<html><body>'+('BHXH cảnh báo giả mạo cán bộ và lừa đảo. '.repeat(200))+'</body></html>');
 if(isScamHtml(html))n++;
 if(n!==5)throw Error('SELF-TEST FAILED: '+n+'/5');
 console.log('SELF-TEST EVIDENCE REVIEW: 5/5 PASS (offline, zero database writes)');
}
function main(){if(process.argv.includes('--self-test'))return selfTest();
 const r=inspect();
 for(const x of r.records){
  console.log(`${x.status==='PENDING'?'PENDING':'CANDIDATE_NOT_VERIFIED'} ${x.key}: ${x.filename||x.error}`);
  if(x.status!=='PENDING')console.log('  SHA-256: '+x.sha256.slice(0,20)+'...; bytes='+x.bytes+'; method='+x.method);
 }
 console.log(`EVIDENCE REVIEW: candidate=${r.records.filter(x=>x.status!=='PENDING').length}/3; verified=0; db_changed=false`);
 console.log('REPORT: '+REPORT);
 if(process.argv.includes('--make-sql')){const f=genSql(r);console.log('GUARDED SQL CREATED: '+f);console.log('DO NOT RUN until each source was manually checked and database backed up.');}
 else if(r.readyForHumanContentReview)console.log('After independent human review and database backup, optionally generate guarded SQL with --make-sql.');
 else console.log('Next: inspect each PENDING source; save a valid official copy and repeat verification.');
}
try{main()}catch(e){console.error('EVIDENCE REVIEW ERROR: '+e.message);process.exitCode=1;}
