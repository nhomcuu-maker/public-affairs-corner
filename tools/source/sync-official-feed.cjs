'use strict';
/** Collect official RSS metadata into a local PENDING_REVIEW inbox, never publish.
 * No live network by default. Requires explicit acknowledgement of source terms. */
const fs=require('node:fs');
const path=require('node:path');
const {FEED,sha,parseFeed,validateRecord}=require('./official-rss.cjs');
const root=path.resolve(__dirname,'../..');
const dest=path.join(root,'data/source_sync/congbao-pending.json');
const log=path.join(root,'data/source_sync/congbao-run-log.jsonl');
const args=process.argv.slice(2);
const apply=args.includes('--apply');
const fixtureAt=args.indexOf('--fixture');
const fixture=fixtureAt>=0 ? args[fixtureAt+1] : null;
if (fixtureAt>=0 && (!fixture || fixture.startsWith('--'))) {console.error('ERROR: --fixture requires a path');process.exit(2);}
function urlCheck(u){
  const p=new URL(u);
  if(p.protocol!=='https:'||p.hostname!=='congbao.chinhphu.vn'||p.port||p.username||p.password)throw Error('Unapproved feed URL');
}
async function fetchFeed() {
  if(process.env.GDS_OFFICIAL_RSS_PERMISSION_ACK !== 'TERMS_REVIEWED_AND_PERMITTED') {
    throw Error('LIVE ACCESS DISABLED: confirm source RSS terms and set GDS_OFFICIAL_RSS_PERMISSION_ACK=TERMS_REVIEWED_AND_PERMITTED');
  }
  const ctl=new AbortController(), timeout=setTimeout(()=>ctl.abort(),15000);
  try {
    let uri=FEED.url;
    for(let redirects=0;redirects<=2;redirects++) {
      urlCheck(uri);
      const response=await fetch(uri,{signal:ctl.signal,redirect:'manual',headers:{accept:'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8', 'user-agent':'GocDanSinhOfficialFeed/1.0 (source review only)'}});
      if([301,302,307,308].includes(response.status)) {
        const location=response.headers.get('location');
        if(!location)throw Error('Redirect missing Location');
        uri=new URL(location,uri).href;continue;
      }
      if(!response.ok)throw Error(`RSS HTTP ${response.status}`);
      const media=response.headers.get('content-type')||'';
      if(!/(?:xml|rss)/i.test(media))throw Error(`Unexpected RSS Content-Type: ${media}`);
      if(Number(response.headers.get('content-length')||0)>2*1024*1024)throw Error('RSS larger than 2 MB');
      let bytes=0;const chunks=[];
      if(!response.body)throw Error('RSS empty response body');
      for await(const part of response.body){bytes+=part.byteLength;if(bytes>2*1024*1024)throw Error('RSS byte limit exceeded');chunks.push(part);}
      return Buffer.concat(chunks).toString('utf8');
    }
    throw Error('Too many redirects');
  } finally {clearTimeout(timeout);}
}
function currentInbox() {
  if(!fs.existsSync(dest))return {schemaVersion:1,source:FEED.id,entries:[],lastCheckedAtUtc:null};
  const doc=JSON.parse(fs.readFileSync(dest,'utf8'));
  if(doc.schemaVersion!==1||doc.source!==FEED.id||!Array.isArray(doc.entries)||doc.entries.length>20000)throw Error('Incompatible inbox');
  for(const r of doc.entries)validateRecord(r);
  return doc;
}
function update(inbox,records,at) {
  const map=new Map(inbox.entries.map(x=>[x.uid,x]));
  let added=0,changed=0;
  for(const r of records) {
    validateRecord(r);
    const previous=map.get(r.uid);
    if(!previous) {map.set(r.uid,{...r,firstSeenAtUtc:at,lastSeenAtUtc:at});added++;}
    else if(previous.digest!==r.digest) {
      map.set(r.uid,{...r,firstSeenAtUtc:previous.firstSeenAtUtc||at,lastSeenAtUtc:at});changed++;
    } else {map.set(r.uid,{...previous,lastSeenAtUtc:at});}
  }
  return {schemaVersion:1,source:FEED.id,sourceUrl:FEED.url,sourceTerms:FEED.terms,
    lastCheckedAtUtc:at,verified:false,published:false,entries:[...map.values()].sort((a,b)=>b.lastSeenAtUtc.localeCompare(a.lastSeenAtUtc)).slice(0,20000),
    summary:{fetched:records.length,added,changed,unchanged:records.length-added-changed}};
}
function atomicWrite(file, data){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.tmp-'+process.pid;
  try {fs.writeFileSync(tmp,data,{flag:'wx',mode:0o600});fs.renameSync(tmp,file);}
  finally {if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
}
async function main(){
  const xml=fixture?fs.readFileSync(path.resolve(fixture),'utf8'):await fetchFeed();
  const records=parseFeed(xml);
  const at=new Date().toISOString(), result=update(currentInbox(),records,at);
  console.log(`SOURCE ${FEED.id}: fetched=${result.summary.fetched}; new=${result.summary.added}; changed=${result.summary.changed}; unchanged=${result.summary.unchanged}`);
  console.log('All entries: PENDING_REVIEW. No source verification or public publication.');
  if(!apply){console.log('PREVIEW ONLY: no files or database changed; use --apply after reviewing terms.');return;}
  if(fixture && process.env.NODE_ENV!=='test')throw Error('--fixture --apply allowed only in test mode');
  const lock=path.join(root,'data/source_sync/congbao-pending.lock');
  fs.mkdirSync(path.dirname(lock),{recursive:true});
  const fd=fs.openSync(lock,'wx');
  try{
    // Refuse stale state in case a second process has modified the inbox.
    const baseline=currentInbox();
    const refreshed=update(baseline,records,at);
    atomicWrite(dest,JSON.stringify(refreshed,null,2)+'\n');
    fs.appendFileSync(log,JSON.stringify({at,source:FEED.id,fixture:!!fixture,...refreshed.summary,status:'PENDING_REVIEW',dbChanged:false})+'\n');
    console.log('SAVED data/source_sync/congbao-pending.json (local review queue only)');
  }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
if(require.main===module)main().catch(err=>{console.error('SOURCE_SYNC_ERROR: '+(err.message||err));process.exitCode=1;});

module.exports={update,currentInbox};
