'use strict';
/** Import local OFFICIAL RSS METADATA into dedicated pending-only SQL tables.
 * READ-ONLY PREVIEW is default. Does not create knowledge/source_snapshot, approve or publish. */
const fs=require('node:fs');
const path=require('node:path');
const {FEED,validateRecord}=require('./official-rss.cjs');
const root=path.resolve(__dirname,'../..');
const inboxPath=path.join(root,'data/source_sync/congbao-pending.json');
function readInbox(){
  const value=JSON.parse(fs.readFileSync(inboxPath,'utf8'));
  if(value.source!==FEED.id||value.schemaVersion!==1||value.verified!==false||value.published!==false||
     !Array.isArray(value.entries)||value.entries.length>20000)throw Error('Invalid pending feed file');
  const uids=new Set();
  for(const r of value.entries){validateRecord(r);if(uids.has(r.uid))throw Error('Duplicate uid in inbox');uids.add(r.uid);}
  return value;
}
function loadLocalEnv(){
  const f=path.join(root,'.env');
  if(!fs.existsSync(f))return;
  for(const line of fs.readFileSync(f,'utf8').split(/\r?\n/)){
    const m=line.match(/^\s*(DB_[A-Z_]+)\s*=\s*(.*)\s*$/);if(!m||process.env[m[1]]!==undefined)continue;
    let value=m[2].trim();
    if(value.length>1&&((value[0]==='"'&&value.at(-1)==='"')||(value[0]==="'"&&value.at(-1)==="'")))value=value.slice(1,-1);
    process.env[m[1]]=value;
  }
}
async function connect(){
  loadLocalEnv();
  const database=process.env.DB_DATABASE||'GocDanSinh';
  if(database!=='GocDanSinh')throw Error('DB_DATABASE must be GocDanSinh');
  const server=process.env.DB_SERVER||'localhost';
  const encrypt=process.env.DB_ENCRYPT!=='false';
  const trust=process.env.DB_TRUST_CERT==='true';
  const auth=process.env.DB_AUTH_MODE||'windows';
  let sql=require('mssql'), opts;
  if(auth==='windows'){
    sql=require('mssql/msnodesqlv8');
    const driver=process.env.DB_ODBC_DRIVER||'ODBC Driver 17 for SQL Server';
    if(!/^ODBC Driver (17|18) for SQL Server$/.test(driver))throw Error('Invalid ODBC driver');
    opts={server,database,connectionString:`Driver={${driver}};Server=${server};Database=${database};Trusted_Connection=Yes;Encrypt=${encrypt?'Yes':'No'};TrustServerCertificate=${trust?'Yes':'No'};`,options:{trustedConnection:true}};
  } else if(auth==='sql'){
    if(!process.env.DB_USER||!process.env.DB_PASSWORD)throw Error('Missing DB_USER/DB_PASSWORD');
    const port=Number(process.env.DB_PORT||1433);
    if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid DB_PORT');
    opts={server,database,port,user:process.env.DB_USER,password:process.env.DB_PASSWORD,options:{encrypt,trustServerCertificate:trust}};
  }else throw Error('Unknown DB_AUTH_MODE');
  return {sql,pool:await new sql.ConnectionPool({...opts,pool:{max:2,min:0},requestTimeout:20000}).connect()};
}
async function main(){
  const apply=process.argv.includes('--apply');
  const data=readInbox();
  console.log(`RSS SQL INBOX: source=${data.source}; entries=${data.entries.length}; verified=false; published=false`);
  if(!apply){console.log('PREVIEW ONLY: 0 SQL requests; database NOT changed. Use --apply only AFTER creating inbox tables.');return;}
  if(process.env.GDS_OFFICIAL_RSS_DB_IMPORT!=='PENDING_ONLY_CONFIRMED')throw Error('Set GDS_OFFICIAL_RSS_DB_IMPORT=PENDING_ONLY_CONFIRMED before --apply');
  const {sql,pool}=await connect();let added=0,changed=0;
  try{
    const exists=await pool.request().query("SELECT CASE WHEN OBJECT_ID(N'dbo.official_feed_entry',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.official_feed_snapshot',N'U') IS NOT NULL THEN 1 ELSE 0 END AS ready");
    if(!exists.recordset[0].ready)throw Error('Run sql/Nguon_CongBao_Hang_Cho_KiemDuyet.sql with @Apply=1 first');
    // Entry identity and immutable snapshot uniqueness protect idempotence.
    for(const entry of data.entries){
      const tx=new sql.Transaction(pool); await tx.begin();
      try{
        const cmd=new sql.Request(tx);
        cmd.input('source',sql.NVarChar(80),entry.sourceKey);
        cmd.input('uid',sql.Binary(32),Buffer.from(entry.uid,'hex'));
        cmd.input('link',sql.NVarChar(1200),entry.url);
        cmd.input('digest',sql.Binary(32),Buffer.from(entry.digest,'hex'));
        cmd.input('title',sql.NVarChar(450),entry.title);
        cmd.input('description',sql.NVarChar(1200),entry.description);
        cmd.input('published',sql.DateTime2,entry.publishedAtUtc?new Date(entry.publishedAtUtc):null);
        cmd.input('captured',sql.DateTime2,new Date(entry.lastSeenAtUtc));
        const result=await cmd.query(`
          DECLARE @entryId BIGINT;
          SELECT @entryId=id FROM dbo.official_feed_entry WITH (UPDLOCK,HOLDLOCK)
            WHERE source_key=@source AND entry_uid=@uid;
          IF @entryId IS NULL BEGIN
            INSERT dbo.official_feed_entry(source_key,entry_uid,canonical_url,first_seen_at,last_seen_at)
            VALUES(@source,@uid,@link,@captured,@captured);
            SET @entryId=CONVERT(BIGINT,SCOPE_IDENTITY());
          END ELSE BEGIN
            UPDATE dbo.official_feed_entry SET last_seen_at=@captured WHERE id=@entryId AND last_seen_at<@captured;
          END;
          DECLARE @new INT=0;
          IF NOT EXISTS(SELECT 1 FROM dbo.official_feed_snapshot WITH (UPDLOCK,HOLDLOCK)
                        WHERE entry_id=@entryId AND metadata_sha256=@digest)
          BEGIN
            INSERT dbo.official_feed_snapshot(entry_id,metadata_sha256,title,description,published_at,captured_at,review_status)
            VALUES(@entryId,@digest,@title,@description,@published,@captured,N'pending_review');
            SET @new=1;
          END;
          SELECT @new AS newSnapshot;
        `);
        await tx.commit();
        if(result.recordset[0].newSnapshot)added++;else changed++;
      }catch(e){try{await tx.rollback();}catch{}throw e;}
    }
    console.log(`SQL IMPORT DONE: new pending snapshots=${added}, known snapshots=${changed}. No automatic approval or publication.`);
  }finally{await pool.close();}
}
main().catch(e=>{console.error('SOURCE_DB_IMPORT_ERROR: '+(e.message||e));process.exitCode=1;});
