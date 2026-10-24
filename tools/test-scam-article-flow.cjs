'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(base,'public/canh-bao-lua-dao.html'),'utf8');
const live=fs.readFileSync(path.join(base,'public/js/gds-live.js'),'utf8');
const css=fs.readFileSync(path.join(base,'public/css/gds-scam-categories.css'),'utf8');
const backend=fs.readFileSync(path.join(base,'src/content/content.service.ts'),'utf8');
assert.doesNotMatch(html,/scamBhxhShortcut|Bài BHXH thuộc nhóm/);
assert.doesNotMatch(live,/GDS-MVP-SCAM-MAODANH-BHXH|knownScamTopics|const BHXH_CODE/);
assert.match(backend,/primaryCategoryCode/);
assert.match(backend,/dbo.item_category/);
assert.match(live,/Nguồn chứng cứ đã xác minh/);
assert.match(css,/\.gds-official-source/);
assert.match(backend,/verification.decision = N'accepted'/);
assert.match(backend,/kvs.version_id = @versionId/);
const all=[];
function n(tag='div') {
 const x={tagName:tag.toUpperCase(),className:'',textContent:'',hidden:false,value:'',dataset:{},attributes:{},style:{},children:[],parent:null,events:{},
  append(...nodes){for(const node of nodes){this.children.push(node);node.parent=this;}},
  appendChild(node){this.append(node);return node},removeChild(node){this.children=this.children.filter(n=>n!==node);node.parent=null;return node},
  remove(){if(this.parent)this.parent.removeChild(this)},get firstChild(){return this.children[0]||null},get lastChild(){return this.children.at(-1)||null},
  addEventListener(name,fn){(this.events[name]??=[]).push(fn)},click(){(this.events.click||[]).forEach(fn=>fn({preventDefault(){}}))},
  setAttribute(name,v){this.attributes[name]=String(v)},getAttribute(name){return this.attributes[name]??null},removeAttribute(name){delete this.attributes[name]},
  classList:{add(){},remove(){},toggle(){}},scrollIntoView(){},
  querySelector(selector){return findDescendant(this,selector)},querySelectorAll(selector){return findAll(this,selector)}
 };all.push(x);return x;
}
function match(node,selector) {
 if(selector.startsWith('.')) return node.className.split(/\s+/).includes(selector.slice(1));
 if(selector.startsWith('#')) return node.id===selector.slice(1);
 if(selector==='[data-scam-category]') return !!node.dataset.scamCategory;
 return false;
}
function findAll(root,selector) {return root.children.flatMap(child=>[...(match(child,selector)?[child]:[]),...findAll(child,selector)]);}
function findDescendant(root,selector) {return findAll(root,selector)[0]||null;}
const grid=n('div');const mount=n('div');const main=n('main');const toggle=n('button');const show=n('button');
const search=n('input');const categories=['impersonation','jobs','investments','social','phishing','public-services'];
const names=['Giả danh cơ quan nhà nước','Tuyển dụng','Đầu tư','Mạo danh trên mạng xã hội','Website giả','Dịch vụ công'];
for (let i=0;i<6;i++){
 const b=n('button');b.dataset.scamCategory=categories[i];const label=n('span');label.className='scam-card-text';label.textContent=names[i];b.append(label);grid.append(b);
}
const root=n('div');root.append(grid,mount,main,toggle,show,search);
let overlay=null;
const byId={scamCategoryGrid:grid,scamCategoryToggle:toggle,scamViewAll:show,scamSearch:search,scamPublishedMount:mount};
const document={readyState:'complete',createElement:n,createTextNode:text=>{const x=n('#text');x.textContent=text;return x;},
 getElementById:id=>byId[id]||null,querySelector:selector=>selector==='.main-container'?main:selector==='.gds-modal-overlay'?overlay:null,
 querySelectorAll:selector=>findAll(root,selector),addEventListener(){},body:{appendChild(node){if(node.className.includes('gds-modal-overlay')) overlay=node;return node}}
};
let calls=[];
const entry={businessCode:'GDS-MVP-SCAM-MAODANH-BHXH', kind:'warning',title:'Cảnh báo cuộc gọi giả danh bảo hiểm xã hội đòi chuyển tiền',summary:'Bản nháp MVP: nhận diện dấu hiệu đáng ngờ',versionId:6,primaryCategoryCode:'GIA_DANH',primaryCategoryName:'Giả danh cơ quan, tổ chức'};
const unrelated={businessCode:'CASE-JOBS',kind:'warning',title:'Cảnh báo tuyển dụng việc nhẹ',summary:'Việc nhẹ lương cao',versionId:11,primaryCategoryCode:'TUYEN_DUNG',primaryCategoryName:'Lừa đảo tuyển dụng, đầu tư'};
const detail={...entry,domain:'SCAM',bodyMarkdown:'# Cảnh báo giả mạo BHXH\n\n**Mức cảnh báo: Cao**\n\n- Không cung cấp OTP\n- Không nhấp liên kết lạ',sources:[{title:'BHXH Việt Nam - cảnh báo giả mạo',url:'https://baohiemxahoi.gov.vn/tintuc/Pages/hoat-dong-he-thong-bao-hiem-xa-hoi.aspx?CateID=52&itemID=24971'}]};
const sandbox={document,window:{},URL,URLSearchParams,location:{pathname:'/canh-bao-lua-dao.html',search:''},encodeURIComponent,
 setTimeout,alert(){},fetch:async url=>{
 calls.push(url);
 if (String(url).startsWith('/api/content?domain=SCAM'))return {ok:true,json:async()=>[entry,unrelated]};
 if (String(url).startsWith('/api/content/GDS-MVP-SCAM-MAODANH-BHXH'))return {ok:true,json:async()=>detail};
 if (String(url).startsWith('/api/content/CASE-JOBS'))return {ok:true,json:async()=>({...unrelated,domain:'SCAM',bodyMarkdown:'# Cảnh báo tuyển dụng',sources:[]})};
 throw Error('unexpected URL '+url);
 }};
vm.runInNewContext(live,sandbox,{filename:'gds-live.js'});
const tick=()=>new Promise(done=>setImmediate(done));
(async()=>{
 await tick();
 assert.equal(mount.children.length,1,'Published panel mounted');
 const panel=mount.children[0], list=panel.children[3];
 assert.equal(list.children.length,2,'All published articles shown initially');
 assert.match(list.children[0].children[0].textContent,/Giả danh cơ quan, tổ chức/);
 assert.match(list.children[0].children[1].textContent,/BHXH|bảo hiểm xã hội/i);
 assert.match(list.children[0].children.at(-1).textContent,/Xem chi tiết/);
 assert.doesNotMatch(list.children[0].children[2].textContent,/Bản nháp MVP/);
 const callsBeforeToggle=calls.length;
 toggle.click();assert.equal(grid.children.length,12);assert.equal(calls.length,callsBeforeToggle);
 toggle.click();assert.equal(grid.children.filter(x=>x.hidden).length,6);
 grid.children[0].click();await tick();
 assert.equal(list.children.length,1,'BHXH is under impersonation');
 assert.match(list.children[0].children[0].textContent,/Giả danh cơ quan, tổ chức/);
 const beforeBanking=calls.length;
 const banking=grid.children.find(x=>x.dataset.scamCategory==='banking');banking.click();await tick();
 assert.equal(list.children.length,1);assert.match(list.children[0].textContent,/Chưa có bài cảnh báo/);
 assert.equal(calls.length,beforeBanking+1,'Banking fetch used only public endpoint');
 grid.children[0].click();await tick();
 list.children[0].click();await tick();await tick();
 assert(overlay&&overlay.style.display==='flex','Generic article card opens verified detail');
 const modal=overlay.querySelector('.gds-modal');
 const category=modal.children.find(x=>x.className==='gds-detail-category');
 assert.match(category.textContent,/Giả danh cơ quan, tổ chức/);
 const permalink=modal.children.find(x=>x.className==='gds-document-link');
 assert.match(permalink.href,/\?bai=GDS-MVP-SCAM-MAODANH-BHXH$/);
 const body=modal.children.find(x=>x.className==='gds-document-body');
 assert(body&&body.children.some(x=>x.tagName==='UL'),'Markdown list rendered as list');
 assert(!modal.children.some(x=>x.className==='gds-detail-summary'),'Obsolete MVP placeholder summary hidden in detail');
 const sources=modal.children.find(x=>x.className==='gds-verified-sources');
 assert(sources,'Verified sources panel shown');
 const link=sources.children.find(x=>x.tagName==='A');
 assert.match(link.href,/itemID=24971/);assert.equal(link.rel,'noopener noreferrer');
 assert(calls.some(x=>x.endsWith('/api/content/GDS-MVP-SCAM-MAODANH-BHXH')));
 // An unrelated published article must follow the SAME UI, category and detail rules.
 grid.children[1].click();await tick();
 assert.equal(list.children.length,1);
 assert.match(list.children[0].children[0].textContent,/Lừa đảo tuyển dụng/);
 list.children[0].click();await tick();await tick();
 assert.match(modal.children.find(x=>x.className==='gds-detail-category').textContent,/Lừa đảo tuyển dụng/);
 assert(calls.some(x=>x.endsWith('/api/content/CASE-JOBS')));
 console.log('PASS SCAM ARTICLE FLOW: primary DB category, no special test-article link, generic detail, verified source, one published listing');
})().catch(e=>{console.error(e);process.exitCode=1});
