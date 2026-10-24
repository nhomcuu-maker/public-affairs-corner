'use strict';
// Public PDF cards must be discoverable without representing them as published legal guidance.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'public/js/gds-live.js'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'public/library-catalog.json'),'utf8'));
const next=()=>new Promise(r=>setImmediate(r));
const create=tag=>({tag,children:[],textContent:'',value:'',className:'',style:{},attributes:{},handlers:{},
 append(...xs){this.children.push(...xs)},appendChild(x){this.children.push(x);return x},
 replaceChildren(...xs){this.children=[...xs]},removeChild(x){this.children=this.children.filter(c=>c!==x)},
 addEventListener(n,f){this.handlers[n]=f},setAttribute(n,v){this.attributes[n]=v},removeAttribute(n){delete this.attributes[n]},
 scrollIntoView(){},get firstChild(){return this.children[0]||null}});
function flatten(n){return [n,...(n.children||[]).flatMap(flatten)]}
async function inspect(page,code,expected){
 let panel;const main={appendChild(n){panel=n}},input={value:'',addEventListener(){}};
 const document={readyState:'complete',createElement:create,
  getElementById(id){return id===(code==='ADMIN'?'procedureSearch':'legalSearch')?input:null},
  querySelector(sel){return sel==='.main-container'?main:null},
  querySelectorAll(){return []},addEventListener(){}};
 const urls=[];
 const env={document,window:{},location:{pathname:'/'+page+'.html',search:''},
  URLSearchParams,encodeURIComponent,setTimeout,alert(){},
  fetch:async(url)=>{urls.push(url);return {ok:true,json:async()=>url==='./library-catalog.json'?catalog:[]}}};
 vm.runInNewContext(source,env);
 input.value='';await env.window[code==='ADMIN'?'handleProcedureSearch':'handleLegalSearch']();await next();
 assert(panel,'A search panel should be visible');
 const all=flatten(panel);const pdf=all.filter(x=>typeof x.href==='string'&&x.href.startsWith('/library-files/'));
 assert.equal(pdf.length,expected,'Actual PDFs must appear directly in search results for '+code);
 assert(pdf.every(x=>/^\/library-files\/[a-zA-Z0-9_-]+\.pdf$/.test(x.href)));
 assert(all.some(x=>String(x.textContent).includes('Ch\u01b0a ki\u1ec3m duy\u1ec7t')));
 assert(urls.includes('/library-catalog.json'));
 assert(urls.some(u=>u==='./api/content?domain='+code));
}
(async()=>{
 await inspect('thu-tuc-hanh-chinh','ADMIN',1);
 await inspect('phap-luat-quyen-loi','LEGAL',8);
 console.log('PASS PUBLIC REFERENCE VISIBILITY: ADMIN 1, LEGAL 8 local PDFs; labeled unverified; SQL public endpoints unchanged');
})().catch(e=>{console.error(e);process.exitCode=1});
