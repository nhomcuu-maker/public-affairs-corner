'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');
const output=path.join(root,'public','category-index.json');
const source=path.join(root,'public','library-catalog.json');
const taxonomy={
 LEGAL:[['lao-dong','Luật lao động', ['lao động','lương','việc làm','thất nghiệp']],['dan-su','Luật dân sự',['dân sự','dân sự','bộ luật dân sự','thừa kế']],['dat-dai','Luật đất đai',['đất đai','quyền sử dụng đất','sổ đỏ']],['hon-nhan','Luật hôn nhân và gia đình',['hôn nhân','gia đình','ly hôn','nuôi con']]],
 ADMIN:[['con-nho','Có con nhỏ',['khai sinh','trẻ em','con nhỏ','bảo hiểm y tế trẻ']],['hoc-tap','Học tập',['giáo dục','học tập','trường học','tuyển sinh']],['viec-lam','Việc làm',['việc làm','thất nghiệp','bảo hiểm thất nghiệp']],['cu-tru','Cư trú và giấy tờ tùy thân',['cư trú','căn cước','hộ chiếu','tạm trú']],['hon-nhan','Hôn nhân và gia đình',['đăng ký kết hôn','kết hôn','khai sinh','ly hôn']],['dat-dai','Điện lực, nhà ở, đất đai',['đất đai','nhà ở','điện lực','sổ đỏ']],['y-te','Sức khỏe và y tế',['y tế','bảo hiểm y tế','khám chữa bệnh']],['phuong-tien','Phương tiện và người lái',['lái xe','đăng ký xe','phương tiện']],['huu-tri','Hưu trí',['hưu trí','lương hưu','bảo hiểm xã hội']],['tu-vong','Người thân qua đời',['khai tử','tử tuất','mai táng']],['khieu-kien','Giải quyết khiếu kiện',['khiếu nại','tố cáo','khiếu kiện']]]
};
function clean(s){return String(s||'').normalize('NFC').toLocaleLowerCase('vi-VN')}
function decode(s){return String(s||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)).replace(/<[^>]*>/g,'').trim()}
function xmlTag(s,t){const m=s.match(new RegExp('<'+t+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+t+'>','i'));return m?decode(m[1]):''}
function categorize(title,domain){let hits=[];for(const [id,name,words] of taxonomy[domain]||[]){if(words.some(w=>clean(title).includes(clean(w))))hits.push(id)}return hits}
function properTitle(x){if(x.title && /[À-ỹ]/u.test(x.title) && !/^\d+/.test(x.title))return x.title;const f=String(x.filename||''); const m=f.match(/(\d+)[-_.](\d{4})[-_.](QH15|TT[-_.]BTC|NQ[-_.]CP)/i);if(m)return `Văn bản số ${m[1]}/${m[2]}/${m[3].replace(/[-_.]/g,'-')} — cần xác định trích yếu`;return x.title||'Văn bản chưa rõ tên';}
async function feed(){let url='https://congbao.chinhphu.vn/cac-van-ban-moi-ban-hanh.rss';let controller=new AbortController;let tm=setTimeout(()=>controller.abort(),18000);try{let r=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'GocDanSinh/1.0 (public metadata catalog)'}});if(!r.ok)throw Error('HTTP '+r.status);let xml=await r.text();let items=[...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(a=>{let x=a[1],title=xmlTag(x,'title'),link=xmlTag(x,'link');return{title,link,pubDate:xmlTag(x,'pubDate')}}).filter(x=>x.title&&/^https?:\/\//.test(x.link)&&new URL(x.link).hostname.endsWith('chinhphu.vn'));return{items,error:null}}catch(e){return{items:[],error:e.message}}finally{clearTimeout(tm)}}
async function main(){let d=JSON.parse(fs.readFileSync(source,'utf8')),existing=[];if(fs.existsSync(output))try{existing=JSON.parse(fs.readFileSync(output,'utf8')).items.filter(x=>x.kind==='rss')}catch{};
let local=d.items.map(x=>({id:'local-'+x.id,kind:'pdf',domain:x.domain,title:properTitle(x),url:x.url,source:'Thư viện PDF cục bộ',verified:false,topics:categorize([x.title,x.topic,x.searchText?.slice(0,200)].join(' '),x.domain),excerpt:x.excerpt||''}));
// A document is only categorized using evidence-bearing metadata, never filler or guessed topic.
let res=await feed(),rss=res.error?existing:res.items.map(x=>({id:'rss-'+require('crypto').createHash('sha256').update(x.link).digest('hex').slice(0,18),kind:'rss',domain:'LEGAL',title:x.title,url:x.link,source:'Công báo điện tử Chính phủ',pubDate:x.pubDate,verified:false,topics:categorize(x.title,'LEGAL'),excerpt:'Thông tin đầu mục từ RSS; mở nguồn chính thức để xem toàn văn.'}));let uniq=new Map;for(const x of [...local,...rss])uniq.set(x.id,x);// Explicit topic mapping from verified-document URL seeds: never guess a topic.
const processed=path.join(root,'data','law_rag','processed','documents.jsonl');
if(fs.existsSync(processed)){
 for(const line of fs.readFileSync(processed,'utf8').split(/\r?\n/)){
  if(!line.trim())continue;
  try{
   const d=JSON.parse(line);
   if(!(taxonomy[d.domain]||[]).some(([id])=>id===d.topic))continue;
   if(!/^https:\/\//.test(d.url))continue;
   uniq.set('official-'+d.id,{id:'official-'+d.id,kind:'source',domain:d.domain,
    title:d.title,url:d.url,source:'Tài liệu từ đường dẫn nguồn chính thức',
    verified:false,topics:[d.topic],excerpt:'Toàn văn đã được thu thập để tra cứu; tình trạng hiệu lực chưa được kiểm định.',
    docNumber:d.doc_number||'',capturedAt:d.captured_at});
  }catch(e){console.warn('Skipped invalid document record:',e.message)}
 }
}
let items=[...uniq.values()];const categories=Object.fromEntries(Object.entries(taxonomy).map(([domain,arr])=>[domain,arr.map(([id,title])=>({id,title,count:items.filter(x=>x.domain===domain&&x.topics.includes(id)).length}))]));fs.writeFileSync(output,JSON.stringify({generatedAt:new Date().toISOString(),feedError:res.error||null,notice:'Tài liệu tham khảo/chỉ mục nguồn, chưa xác minh hiệu lực. Không phải danh sách thủ tục đã công bố.',categories,items},null,2));console.log(`CATEGORY SYNC: ${local.length} PDF; ${rss.length} RSS metadata; ${items.length} unique; ${Object.values(categories).flat().filter(x=>x.count===0).length} empty categories`);if(res.error)console.warn('RSS unavailable; kept previous entries:',res.error)}
main().catch(e=>{console.error(e.message);process.exitCode=1});
