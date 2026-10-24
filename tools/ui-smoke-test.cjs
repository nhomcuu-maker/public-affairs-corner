'use strict';
// Execute frontend JS against a tiny DOM substitute to ensure no search panel on page load.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../public/js/gds-live.js'),'utf8');
async function test(page, inputId, handler){
 let panels=0, calls=0, libraryFetches=0, officialFetches=0;
 const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/library-catalog.json'),'utf8'));
 const nodes=[];
 function element(tag){
   const x={tag, children:[],style:{},className:'',textContent:'',value:'',
     append(...v){this.children.push(...v);},
     replaceChildren(...v){this.children=[...v];},
     appendChild(v){this.children.push(v);return v;},
     removeChild(v){const i=this.children.indexOf(v);if(i>=0)this.children.splice(i,1);},
     addEventListener(){},setAttribute(){},removeAttribute(){},
     scrollIntoView(){},get firstChild(){return this.children[0]||null;}};
   nodes.push(x);return x;
 }
 const main={appendChild(){panels++}};
 const input={value:'',addEventListener(){}};
 const ai={onclick:null};
 const fakeDocument={readyState:'complete',createElement:element,
  getElementById(id){return id===inputId?input:null;},
  querySelector(s){if(s==='.main-container')return main;if(s==='.ai-btn')return ai;return null;},
  querySelectorAll(){return [];},addEventListener(){}};
 const windowObj={};
 const sandbox={window:windowObj,document:fakeDocument,
  location:{pathname:'/'+page+'.html',search:''},
  URLSearchParams,encodeURIComponent,
  alert(){},setTimeout,
  fetch:async(url)=>{if(url==='./official-reference-catalog.json'){officialFetches++;return {ok:false};}if(url==='./library-catalog.json'){libraryFetches++;return {ok:true,json:async()=>catalog};}
    calls++;return {ok:true,json:async()=>[]}}};
 vm.runInNewContext(source,sandbox,{filename:'gds-live.js'});
 const isScam=page==='canh-bao-lua-dao';
 assert.equal(panels,isScam?1:0,'Unexpected panel on page load '+page);
 assert.equal(calls,isScam?1:0,'Unexpected API calls on page load '+page);
 input.value='hộ chiếu';
 await windowObj[handler]();
 assert.equal(panels,1,'Search should use one result panel '+page);
 assert.equal(calls,page==='index'?3:(isScam?2:1),'Expected read-only API search '+page);
 assert.equal(libraryFetches,['thu-tuc-hanh-chinh','phap-luat-quyen-loi'].includes(page)?1:0,'Reference PDF fetch count '+page);
 assert.equal(officialFetches,['thu-tuc-hanh-chinh','phap-luat-quyen-loi'].includes(page)?1:0,'Official source catalog fetch count '+page);
}
(async()=>{
 await test('index','searchInput','handleSearch');
 await test('thu-tuc-hanh-chinh','procedureSearch','handleProcedureSearch');
 await test('phap-luat-quyen-loi','legalSearch','handleLegalSearch');
 await test('canh-bao-lua-dao','scamSearch','handleSearch');
 console.log('PASS: 4 pages keep their original layout on load; search creates results and calls real APIs');
})().catch(e=>{console.error(e);process.exitCode=1});
