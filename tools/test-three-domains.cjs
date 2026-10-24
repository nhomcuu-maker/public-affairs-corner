'use strict';
// DOM-less runtime regression check for the real browser script.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const T = require('../public/js/gds-taxonomy.js');
const browserScript = fs.readFileSync(path.join(__dirname, '../public/js/gds-topic-browser.js'),'utf8');
class Element {
  constructor(tag='div') {
    this.tagName=tag.toUpperCase();this.className='';this.dataset={};this.children=[];
    this.events={};this.attrs={};this.textContent='';this.value='';this.style={};this.open=false;
  }
  append(...x){ this.children.push(...x); }
  replaceChildren(...x){ this.children=x; }
  setAttribute(n,v){this.attrs[n]=String(v);}
  getAttribute(n){return this.attrs[n]||null;}
  addEventListener(n,fn){(this.events[n]??=[]).push(fn);}
  click(){for(const fn of this.events.click||[])fn();}
  scrollIntoView(){}
  showModal(){this.open=true;}
  close(){this.open=false;}
}
function walk(node){return [node,...node.children.flatMap(walk)];}
function all(root,cls){return walk(root).filter(x=>x.className.split(' ').includes(cls));}
function names(node){return walk(node).map(x=>x.textContent).filter(Boolean).join(' ');}
const tick=()=>new Promise(done=>setImmediate(done));
async function scenario(domain, category, permitted, forbidden) {
  const mount=new Element();mount.dataset.domain=domain;
  const body=new Element('body');
  const document={createElement:t=>new Element(t),getElementById:id=>id==='gds-topic-browser'?mount:null,body};
  const location={href:'https://example.invalid/'+({LEGAL:'phap-luat-quyen-loi.html',ADMIN:'thu-tuc-hanh-chinh.html',SCAM:'canh-bao-lua-dao.html'}[domain])+'?topic='+category,search:'?topic='+category};
  const calls=[];
  const records={
    LEGAL:{DAT_DAI:[
      {businessCode:'land',primaryCategoryCode:'DAT_DAI',title:'Luật Đất đai 2024'},
      {businessCode:'bad',primaryCategoryCode:'DAT_DAI',title:'Luật Việc làm số 74'}],
      LAO_DONG:[{businessCode:'labour',primaryCategoryCode:'LAO_DONG',title:'Luật Việc làm số 74'}]},
    ADMIN:{HO_CHIEU_HO_TICH:[
      {businessCode:'passport',primaryCategoryCode:'HO_CHIEU_HO_TICH',title:'Thủ tục cấp hộ chiếu'},
      {businessCode:'badadmin',primaryCategoryCode:'HO_CHIEU_HO_TICH',title:'Thủ tục trợ cấp thất nghiệp'}]},
    SCAM:{GIA_DANH:[{businessCode:'fake',primaryCategoryCode:'GIA_DANH',title:'Cảnh báo giả danh cơ quan'}],
      TUYEN_DUNG:[{businessCode:'job',primaryCategoryCode:'TUYEN_DUNG',title:'Cảnh báo tuyển dụng giả'}],
      DAU_TU:[{businessCode:'invest',primaryCategoryCode:'DAU_TU',title:'Cảnh báo đầu tư giả'}]}
  };
  const fetch=async raw=>{
    calls.push(raw);
    const u=new URL(raw,'https://example.invalid');
    if(u.pathname==='/category-index.json')return {ok:true,json:async()=>({items:[]})};
    if(u.pathname==='/api/content'){
      const d=u.searchParams.get('domain'),c=u.searchParams.get('category');
      return {ok:true,json:async()=>records[d]?.[c]||[]};
    }
    throw Error('Unexpected fetch: '+raw);
  };
  const sandbox={document,window:{location,GDSTaxonomy:T},location,history:{replaceState(){}},fetch,URL,URLSearchParams,console};
  vm.runInNewContext(browserScript,sandbox,{filename:'gds-topic-browser.js'});
  await tick();await tick();await tick();
  assert.equal(all(mount,'gds-topic-button').length,3,domain+' must display exactly 3 categories');
  const text=names(mount);
  for(const x of permitted)assert(text.includes(x),domain+' expected: '+x+'; got: '+text.slice(0,600));
  for(const x of forbidden)assert(!text.includes(x),domain+' unrelated article: '+x+'; got: '+text.slice(0,600));
  assert(calls.some(x=>String(x).includes('category=')),domain+' API must receive the selected category');
  console.log('PASS',domain,category,'3 categories; API filtered; conflicts excluded');
}
(async()=>{
 await scenario('LEGAL','dat-dai',['Luật Đất đai 2024'],['Luật Việc làm số 74']);
 await scenario('LEGAL','lao-dong-viec-lam',['Luật Việc làm số 74'],['Luật Đất đai 2024']);
 await scenario('ADMIN','ho-chieu-va-ho-tich',['Thủ tục cấp hộ chiếu'],['Thủ tục trợ cấp thất nghiệp']);
 await scenario('SCAM','gia-danh-co-quan-to-chuc',['Cảnh báo giả danh cơ quan'],['Cảnh báo tuyển dụng giả']);
 await scenario('SCAM','lua-dao-tuyen-dung-dau-tu',['Cảnh báo tuyển dụng giả','Cảnh báo đầu tư giả'],['Cảnh báo giả danh cơ quan']);
})().catch(e=>{console.error(e);process.exitCode=1});
