'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(base,'public/canh-bao-lua-dao.html'),'utf8');
const live=fs.readFileSync(path.join(base,'public/js/gds-live.js'),'utf8');
const bridge=fs.readFileSync(path.join(base,'public/js/gds-ai-report-bridge.js'),'utf8');
assert.equal((html.match(/data-scam-category=/g)||[]).length,6);
assert.match(html,/id="scamCategoryToggle"/);
assert.match(html,/id="scamPublishedMount"/);
assert.match(html,/CẢNH BÁO ĐÃ ĐƯỢC CÔNG BỐ/);
assert.doesNotMatch(html,/onclick="alert\('Đang tải thêm danh sách cảnh báo/);
assert.doesNotMatch(bridge,/window\.handleSearch\s*=/);
assert.match(live,/content\?domain=SCAM/);
assert.doesNotMatch(live,/const BHXH_CODE|scamBhxhShortcut|knownScamTopics/);
assert.doesNotMatch(html,/scamBhxhShortcut|Bài BHXH thuộc nhóm/);
function newElement(tag='div') {
 const e={tagName:tag, className:'', textContent:'', value:'', hidden:false, style:{}, dataset:{},attributes:{},children:[], handlers:{},
 append(...items){this.children.push(...items);items.forEach(x=>x.parent=this);},
 appendChild(x){this.append(x);return x;},
 removeChild(x){this.children=this.children.filter(n=>n!==x);},
 get firstChild(){return this.children[0]||null;},
 get lastChild(){return this.children[this.children.length-1]||null;},
 setAttribute(n,v){this.attributes[n]=String(v)},getAttribute(n){return this.attributes[n]??null},
 addEventListener(n,f){(this.handlers[n]??=[]).push(f)},
 click(){for(const fn of this.handlers.click||[]) fn()},
 removeAttribute(n){delete this.attributes[n]},
 querySelector(){return null},querySelectorAll(){return []}, scrollIntoView(){},
 classList:{toggle(){},add(){},remove(){}}
 };return e;
}
const grid=newElement();
const titles=['Giả danh cơ quan nhà nước','Tuyển dụng, việc nhẹ lương cao','Đầu tư, vay tiền, tài chính','Mạo danh trên mạng xã hội','Website giả, đường dẫn phishing','Giả mạo dịch vụ công, hồ sơ'];
const ids=['impersonation','jobs','investments','social','phishing','public-services'];
const originals=ids.map((id,i)=>{
 const b=newElement('button');b.dataset.scamCategory=id;
 b.querySelector=selector=>selector==='.scam-card-text'?{textContent:titles[i]}:null;
 return b;
});
grid.children.push(...originals);
grid.querySelectorAll=()=>originals;
const toggle=newElement('button'), showAll=newElement('button'), search=newElement('input'), mount=newElement('div'),main=newElement('main');
const entries=[{title:'Cảnh báo cuộc gọi giả danh bảo hiểm xã hội đòi chuyển tiền',summary:'Khuyến cáo giả danh BHXH, đòi OTP.',businessCode:'GDS-MVP-SCAM-MAODANH-BHXH',kind:'SCAM',primaryCategoryCode:'GIA_DANH',primaryCategoryName:'Giả danh cơ quan, tổ chức'}];
let calls=[],renderedPanels=[];
const elements={scamCategoryGrid:grid,scamCategoryToggle:toggle,scamViewAll:showAll,scamSearch:search,scamPublishedMount:mount};
const document={readyState:'complete',createElement:newElement,
 getElementById:id=>elements[id]||null,
 querySelector:selector=>selector==='.main-container'?main:null,
 querySelectorAll:selector=>selector==='[data-scam-category]'?grid.children:[],
 addEventListener(){}
};
let scrollCount=0;
mount.appendChild=function(n){renderedPanels.push(n);this.children.push(n);return n};
const sandbox={document,window:{},URLSearchParams,URL,encodeURIComponent,alert(){},setTimeout,location:{pathname:'/canh-bao-lua-dao.html',search:''},
 fetch:async(url)=>{calls.push(url);assert.match(url,/^\/api\/content\?domain=SCAM/);return {ok:true,json:async()=>entries}}};
vm.runInNewContext(live,sandbox,{filename:'gds-live.js'});
vm.runInNewContext(bridge,sandbox,{filename:'gds-ai-report-bridge.js'});
const next=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 await next();
 assert.equal(calls.length,1,'One published-only call on SCAM page load');
 assert.equal(renderedPanels.length,1,'Published results must be separate from taxonomy');
 assert.equal(grid.children.length,12,'Six initial plus six extra scam categories');
 assert(grid.children.slice(6).every(c=>c.hidden));
 const panel=renderedPanels[0];
 const list=panel.children[3];
 assert.equal(list.children.length,1,'BHXH appears once in published section');
 assert.equal(list.children[0].children[1].textContent,entries[0].title);
 toggle.click();
 assert.equal(toggle.getAttribute('aria-expanded'),'true');
 assert(grid.children.slice(6).every(c=>!c.hidden));
 assert.equal(calls.length,1,'See-more must NOT fetch published notices');
 toggle.click();
 assert(grid.children.slice(6).every(c=>c.hidden));
 assert.equal(toggle.getAttribute('aria-expanded'),'false');
 originals[0].click();
 await next();
 assert.equal(calls.length,2);
 assert.equal(list.children.length,1,'BHXH should be categorized under impersonation');
 assert.equal(originals[0].getAttribute('aria-pressed'),'true');
 originals[1].click();
 await next();
 assert.equal(list.children.length,1,'Empty state for category without a published item');
 assert.match(list.children[0].textContent,/Chưa có bài cảnh báo đã công bố/);
 showAll.click();await next();
 assert.equal(list.children[0].children[1].textContent,entries[0].title);
 assert.equal(originals[0].getAttribute('aria-pressed'),'false');
 assert.equal(typeof sandbox.window.handleSearch,'function','Search remains on SCAM page; bridge must not redirect to assistant');
 search.value='BHXH';
 await sandbox.window.handleSearch();
 assert.equal(list.children.length,1);
 assert.equal(calls.length,5);
 console.log('PASS SCAM CATEGORIES: 6->12->6, no fetch on toggle; uses SQL primary category, no special BHXH shortcut; one generic published list');
})().catch(e=>{console.error(e);process.exitCode=1});
