'use strict';
/* Batch intake of EXISTING evidence candidates and locally captured official RSS.
   It never verifies, approves, publishes, or changes knowledge_version.
   Usage: node tools/bulk/stage-all-existing.cjs [--preview|--apply|--audit] */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const ROOT = path.resolve(__dirname, '../..');
const REPORT = path.join(ROOT, 'data/evidence_review_report.json');
const RSS = path.join(ROOT, 'data/source_sync/congbao-pending.json');
const URL_HOSTS = new Set(['baohiemxahoi.gov.vn','congbao.chinhphu.vn','vanban.chinhphu.vn','vbpl.vn','dichvucong.gov.vn','vpcp.dichvucong.gov.vn','datafiles.chinhphu.vn']);
function fail(message){throw Error(message);}
function localEnv(){
  const file=path.join(ROOT,'.env');
  if(!fs.existsSync(file))return;
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const m=line.match(/^\s*(DB_[A-Z_]+)\s*=\s*(.*)\s*$/);if(!m||process.env[m[1]]!==undefined)continue;
    let v=m[2].trim();if(v.length>1&&((v[0]==='"'&&v.at(-1)==='"')||(v[0]==="'"&&v.at(-1)==="'")))v=v.slice(1,-1);
    process.env[m[1]]=v;
  }
}
function validateHost(value){
  let u;try{u=new URL(value);}catch{fail('Bad official source URL');}
  if(u.protocol!=='https:'||u.username||u.password||!URL_HOSTS.has(u.hostname.toLowerCase()))fail('Unsupported official source hostname');
}
function safeFile(record){
  const file=record.filename;
  if(typeof file!=='string'||!/^evidence\/review\/[\p{L}\p{N}_.() -]+\.pdf$/iu.test(file)||file.includes('..'))fail('Unsafe evidence path');
  const full=path.resolve(ROOT,file);
  const base=path.resolve(ROOT,'evidence','review');
  if(!full.startsWith(base+path.sep))fail('Unsafe evidence location');
  if(!fs.existsSync(full))return {missing:true,file};
  const real=fs.realpathSync(full);
  if(!real.startsWith(base+path.sep))fail('Symlink escaping evidence root');
  const st=fs.statSync(real);
  if(!st.isFile()||st.size<100||st.size>25*1024*1024)fail('Invalid evidence size: '+file);
  const data=fs.readFileSync(real);
  if(data.subarray(0,5).toString('ascii')!=='%PDF-')fail('File not valid PDF signature: '+file);
  const digest=crypto.createHash('sha256').update(data).digest('hex').toUpperCase();
  if(digest!==record.sha256?.toUpperCase()||st.size!==record.bytes)fail('SHA256 or size mismatch; stop ALL writes: '+file);
  return {missing:false,file,bytes:st.size,sha256:digest};
}
function inputs(){
  const report=JSON.parse(fs.readFileSync(REPORT,'utf8'));
  if(!Array.isArray(report.records)||report.records.length>1000)fail('Invalid evidence_review_report records');
  const used=new Set();
  const records=report.records.map(r=>{
    if(r.status!=='CANDIDATE_NOT_VERIFIED'||!/^GDS-[A-Z0-9-]{5,100}$/.test(r.businessCode||''))fail('Invalid candidate status or business code');
    if(used.has(r.businessCode))fail('Duplicate business code in manifest');used.add(r.businessCode);
    validateHost(r.canonicalUrl);
    if(typeof r.sha256!=='string'||!/^[A-Fa-f0-9]{64}$/.test(r.sha256))fail('Invalid expected SHA256');
    const local=safeFile(r);
    return {key:r.key,code:r.businessCode,url:r.canonicalUrl,role:String(r.role||'supporting'),locator:String(r.locator||'Stored official source for review'),...local};
  });
  let rss=null;
  if(fs.existsSync(RSS)){
    rss=JSON.parse(fs.readFileSync(RSS,'utf8'));
    if(rss.schemaVersion!==1||rss.verified!==false||rss.published!==false||!Array.isArray(rss.entries)||rss.entries.length>20000)fail('RSS inbox must be unverified pending-only');
    rss={source:rss.source,entries:rss.entries.length};
  }
  return {records,rss};
}
function preview(plan, willApply=false){
  console.log(willApply ? 'BULK PREFLIGHT: checking local inputs before SQL transaction' : 'BULK PREVIEW ONLY: no database connection or writes');
  for(const p of plan.records)console.log(`EVIDENCE ${p.key}: ${p.missing?'MISSING':'HASH_OK'}; ${p.file}; ${p.code}`);
  console.log(`RSS INBOX: ${plan.rss?plan.rss.entries:'NOT FOUND'} entries (already-imported records will be detected)`);
  console.log('GUARD: no automatic verification, no approval, no publication, no SQL schema changes.');
}
async function connect(){
  localEnv();
  const database=process.env.DB_DATABASE||'GocDanSinh';if(database!=='GocDanSinh')fail('DB_DATABASE must be GocDanSinh');
  const server=process.env.DB_SERVER||'localhost';
  const encrypt=process.env.DB_ENCRYPT!=='false',trust=process.env.DB_TRUST_CERT==='true';
  const auth=process.env.DB_AUTH_MODE||'windows';let sql=require('mssql'),cfg;
  if(auth==='windows'){
    sql=require('mssql/msnodesqlv8');
    const driver=process.env.DB_ODBC_DRIVER||'ODBC Driver 17 for SQL Server';
    if(!/^ODBC Driver (17|18) for SQL Server$/.test(driver))fail('Unsupported DB ODBC driver');
    cfg={server,database,connectionString:`Driver={${driver}};Server=${server};Database=${database};Trusted_Connection=Yes;Encrypt=${encrypt?'Yes':'No'};TrustServerCertificate=${trust?'Yes':'No'};`,options:{trustedConnection:true}};
  } else if(auth==='sql'){
    if(!process.env.DB_USER||!process.env.DB_PASSWORD)fail('Missing database credentials');
    const port=Number(process.env.DB_PORT||1433);
    if(!Number.isInteger(port)||port<1||port>65535)fail('Invalid database port');
    cfg={server,database,port,user:process.env.DB_USER,password:process.env.DB_PASSWORD,options:{encrypt,trustServerCertificate:trust}};
  } else fail('Unsupported DB_AUTH_MODE');
  return {sql,pool:await new sql.ConnectionPool({...cfg,pool:{max:2,min:0},requestTimeout:30000}).connect()};
}
const STAGE_QUERY=`
 SET XACT_ABORT ON;
 DECLARE @item BIGINT,@version BIGINT,@source BIGINT,@status NVARCHAR(24),@asset BIGINT,@snap BIGINT,
 @existingHash BINARY(32),@existingSize BIGINT,@assetNew INT=0,@snapshotNew INT=0,@linkNew INT=0;
 SELECT TOP(1) @item=ki.id FROM dbo.knowledge_item ki WHERE ki.business_code=@code AND ki.deleted_at IS NULL;
 IF @item IS NULL THROW 59701,N'Unknown knowledge item; no invented data',1;
 SELECT TOP(1) @version=v.id,@status=v.editorial_status
 FROM dbo.knowledge_version v WITH(UPDLOCK,HOLDLOCK)
 WHERE v.item_id=@item AND v.editorial_status IN(N'draft',N'rejected')
 ORDER BY v.version_no DESC,v.id DESC;
 IF @version IS NULL BEGIN
    SELECT N'SKIP_NO_DRAFT' AS result,CAST(NULL AS BIGINT) AS versionId,CAST(NULL AS BIGINT) AS snapshotId;
 END ELSE BEGIN
   SELECT @source=s.id FROM dbo.knowledge_source_candidate k
     JOIN dbo.[source] s ON s.id=k.source_id AND s.archived_at IS NULL
     WHERE k.item_id=@item AND s.canonical_url=@url;
   IF @source IS NULL THROW 59702,N'Source not a candidate for this knowledge item',1;
   SELECT TOP(1) @asset=id,@existingHash=sha256,@existingSize=size_bytes
   FROM dbo.file_asset WITH(UPDLOCK,HOLDLOCK) WHERE storage_key=@key;
   IF @asset IS NOT NULL AND (@existingHash<>@hash OR @existingSize<>@bytes)
     THROW 59703,N'File name reused with different file; stop',1;
   IF @asset IS NULL BEGIN
     INSERT dbo.file_asset(storage_key,sha256,mime_type,size_bytes,uploaded_at)
     VALUES(@key,@hash,N'application/pdf',@bytes,SYSUTCDATETIME());
     SET @asset=CONVERT(BIGINT,SCOPE_IDENTITY());SET @assetNew=1;
   END;
   SELECT TOP(1) @snap=id FROM dbo.source_snapshot WITH(UPDLOCK,HOLDLOCK)
   WHERE source_id=@source AND file_asset_id=@asset AND content_sha256=@hash ORDER BY id;
   IF @snap IS NULL BEGIN
     INSERT dbo.source_snapshot(source_id,captured_at,content_sha256,file_asset_id,captured_url,capture_method)
       VALUES(@source,SYSUTCDATETIME(),@hash,@asset,@url,N'manual');
     SET @snap=CONVERT(BIGINT,SCOPE_IDENTITY());SET @snapshotNew=1;
   END;
   IF NOT EXISTS(SELECT 1 FROM dbo.knowledge_version_source WITH(UPDLOCK,HOLDLOCK)
     WHERE version_id=@version AND snapshot_id=@snap) BEGIN
       INSERT dbo.knowledge_version_source(version_id,snapshot_id,evidence_role,locator)
       VALUES(@version,@snap,@role,@locator);SET @linkNew=1;
   END;
   SELECT CASE WHEN @linkNew=1 THEN N'STAGED_PENDING_REVIEW' ELSE N'ALREADY_STAGED' END AS result,
     @version AS versionId,@snap AS snapshotId,@assetNew AS assetNew,@snapshotNew AS snapshotNew,@linkNew AS linkNew;
 END;`;
async function stage(plan){
  if(process.env.GDS_BULK_STAGE_ACK!=='PENDING_ONLY_CONFIRMED')fail('Set GDS_BULK_STAGE_ACK=PENDING_ONLY_CONFIRMED before --apply');
  if(plan.records.some(r=>r.missing))fail('Missing evidence file(s). No writes. Restore all files before apply.');
  if(!plan.rss)fail('RSS pending JSON missing; restore data/source_sync/congbao-pending.json before --apply');
  const {sql,pool}=await connect();
  const tx=new sql.Transaction(pool);
  let staged=[];let committed=false;
  try{
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    for(const rec of plan.records){
      const r=await new sql.Request(tx)
        .input('code',sql.NVarChar(100),rec.code)
        .input('url',sql.NVarChar(1200),rec.url)
        .input('key',sql.NVarChar(500),rec.file)
        .input('hash',sql.Binary(32),Buffer.from(rec.sha256,'hex'))
        .input('bytes',sql.BigInt,rec.bytes)
        .input('role',sql.NVarChar(24),rec.role.slice(0,24))
        .input('locator',sql.NVarChar(400),rec.locator.slice(0,400))
        .query(STAGE_QUERY);
      if(!r.recordset?.length)fail('SQL did not return stage result: '+rec.key);
      staged.push({source:rec.key,businessCode:rec.code,...r.recordset[0]});
    }
    await tx.commit();committed=true;
    console.log('LOCAL EVIDENCE COMMITTED: '+JSON.stringify(staged));
  }catch(e){if(!committed)try{await tx.rollback();}catch{}throw e;}
  finally{await pool.close();}
  // Existing RSS importer performs one transaction per entry. Reruns are idempotent.
  const cmd=spawnSync(process.execPath,[path.join(ROOT,'tools/source/import-official-feed.cjs'),'--apply'],{
    cwd:ROOT,stdio:'inherit',env:{...process.env,GDS_OFFICIAL_RSS_DB_IMPORT:'PENDING_ONLY_CONFIRMED'},timeout:180000
  });
  if(cmd.status!==0)fail('RSS stage failed AFTER evidence transaction. Retry once after fixing; already-staged records are idempotent.');
  console.log('BULK STAGE COMPLETE: local sources pending review; official RSS pending; NOTHING automatically verified/approved/published.');
}
async function audit(){
  const {pool}=await connect();
  try{
    const results=await pool.request().query(`
      SELECT kv.id AS versionId,ki.business_code AS businessCode,kv.editorial_status AS status,
      (SELECT COUNT(*) FROM dbo.knowledge_version_source x WHERE x.version_id=kv.id) AS linked,
      (SELECT COUNT(*) FROM dbo.knowledge_version_source x
       WHERE x.version_id=kv.id AND EXISTS(SELECT 1 FROM dbo.source_verification ver
         WHERE ver.source_snapshot_id=x.snapshot_id AND ver.decision=N'accepted'
         AND (ver.valid_until IS NULL OR ver.valid_until>SYSUTCDATETIME()))) AS hasAcceptedDecision
      FROM dbo.knowledge_version kv JOIN dbo.knowledge_item ki ON ki.id=kv.item_id
      WHERE ki.business_code IN(N'GDS-MVP-LEGAL-BHTN',N'GDS-MVP-ADMIN-TCTN',N'GDS-MVP-SCAM-MAODANH-BHXH')
      ORDER BY kv.id;
      IF OBJECT_ID(N'dbo.official_feed_entry',N'U') IS NOT NULL
      BEGIN
        SELECT (SELECT COUNT(*) FROM dbo.official_feed_entry) AS feedEntries,
        (SELECT COUNT(*) FROM dbo.official_feed_snapshot) AS feedSnapshots,
        (SELECT COUNT(*) FROM dbo.official_feed_snapshot WHERE review_status=N'pending_review') AS feedPending;
      END;
    `);
    for(const [i,rows] of results.recordsets.entries())console.log(`AUDIT RESULT ${i+1}: ${JSON.stringify(rows)}`);
    console.log('AUDIT IS READ-ONLY. Verify actual evidence and authorized publication separately.');
  }finally{await pool.close();}
}
async function main(){
  const arg=process.argv.slice(2);if(arg.length>1||arg.some(x=>!['--preview','--apply','--audit'].includes(x)))fail('Usage: --preview, --apply or --audit');
  if(arg[0]==='--audit')return audit();
  const p=inputs();preview(p,arg[0]==='--apply');
  if(arg[0]==='--apply')await stage(p);
}
main().catch(err=>{console.error('BULK_STAGE_ERROR: '+(err.message||err));process.exitCode=1;});
