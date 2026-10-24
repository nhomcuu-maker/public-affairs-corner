/** Read-only reference retrieval. Not a substitute for SQL editorial approval. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AssistantEvidence } from './assistant.logic';

type CatalogItem = Record<string, unknown>;
const CATALOGS: Array<{file: string; domain: string}> = [
  {file:'curated-official-catalog.json',domain:'LEGAL'},
  {file:'verified-procedures.json',domain:'ADMIN'},
  {file:'scam-official-references.json',domain:'SCAM'},
];
function field(x: unknown, n=350): string { return typeof x==='string' ? x.trim().slice(0,n) : ''; }
export function normalized(s:string):string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9/]+/g,' ').replace(/\s+/g,' ').trim();
}
const STOP = new Set(['toi','muon','hoi','ve','la','gi','nhu','the','nao','can','lam','sao','co','duoc','khong','cho','biet','xin','vui','long','cua','va','o','tai','theo','de','mot','nhung','cac','voi','khi','thi','phai','hay','ho','so','thu','tuc']);
function terms(s:string):string[] { return normalized(s).split(' ').filter(t=>t.length>=2&&!STOP.has(t)); }
function trustedUrl(url:string):boolean {
  if(!url || url.length>600) return false;
  try { const u=new URL(url); return u.protocol==='https:' && (
    u.hostname==='chinhphu.vn'||u.hostname.endsWith('.chinhphu.vn')||
    u.hostname==='dichvucong.gov.vn'||u.hostname.endsWith('.dichvucong.gov.vn')||
    u.hostname==='bocongan.gov.vn'||u.hostname.endsWith('.bocongan.gov.vn')
  ); } catch { return false; }
}
function load(file:string):CatalogItem[] {
  try {
    const path=join(process.cwd(),'public',file);
    const data=JSON.parse(readFileSync(path,'utf8')) as {items?:unknown};
    return Array.isArray(data.items) ? data.items.filter((x):x is CatalogItem=>!!x&&typeof x==='object'&&!Array.isArray(x)).slice(0,500) : [];
  } catch { return []; }
}
export function catalogEvidence(question:string, domain:string, existing=0):AssistantEvidence[] {
  const q=normalized(question), qTerms=[...new Set(terms(question))];
  if(!qTerms.length) return [];
  const hits: Array<{score:number; item:CatalogItem; domain:string; url:string}> = [];
  for(const catalog of CATALOGS) {
    if(domain!=='ALL' && domain!==catalog.domain) continue;
    for(const item of load(catalog.file)) {
      const url=field(item.url,600);
      if(!trustedUrl(url)) continue;
      const title=normalized(field(item.title));
      const topic=normalized(field(item.topic||item.category));
      const code=normalized(field(item.documentCode));
      const desc=normalized(field(item.description));
      const corpus=title+' '+topic+' '+code+' '+desc;
      const matched=qTerms.filter(t=>(' '+corpus+' ').includes(' '+t+' '));
      // Require meaningful multiword overlap; never use noisy searchText as evidence.
      if(!matched.length || (qTerms.length>=3 && matched.length<2)) continue;
      let score=matched.length*5;
      if(title.includes(q)) score+=30;
      if(topic.includes(q)) score+=15;
      if(code && code.includes(q)) score+=25;
      if(matched.length===qTerms.length) score+=12;
      if(qTerms.length>=2 && matched.length/qTerms.length<0.5) continue;
      hits.push({score,item,domain:catalog.domain,url});
    }
  }
  hits.sort((a,b)=>b.score-a.score);
  return hits.slice(0,Math.max(0,7-existing)).map((h,i)=>({
    id:'S'+(existing+i+1), businessCode:field(h.item.documentCode,90), domain:h.domain,
    title:field(h.item.title,180), summary:field(h.item.description||h.item.topic||h.item.category,500),
    excerpt:'', editorialStatus:'EXTERNAL_REFERENCE_NOT_SQL_APPROVED',
    sourceTitle:field(h.item.source,150)||'Nguồn tham khảo từ cổng cơ quan nhà nước',
    sourceUrl:h.url, sourceStatus:'reference_not_verified_in_sql',
    effectiveFrom:null,effectiveTo:null,publishedAt:null,sourceVerifiedAt:null,sourceValidUntil:null,
  }));
}
