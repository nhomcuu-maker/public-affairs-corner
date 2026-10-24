(()=>{'use strict';
  const root=document.getElementById('gds-reference-library'); if(!root)return;
  const area=root.dataset.domain||'ALL';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
  const el=(name,cls,text)=>{const node=document.createElement(name);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const shell=el('div','gds-lib gds-lib-organized');
  const head=el('div','gds-lib-header');
  head.append(el('h2','',area==='ADMIN'?'Tài liệu thủ tục theo lĩnh vực':area==='LEGAL'?'Kho văn bản pháp luật':'Thư viện văn bản và nguồn chính thức'),
    el('p','gds-lib-subtitle','Tìm theo nhu cầu, lĩnh vực hoặc số hiệu. Đọc bản gốc và kiểm tra hiệu lực trước khi áp dụng.'));
  shell.append(head);
  const searchRow=el('div','gds-lib-controls');
  const searchBox=el('div','gds-lib-searchbox');const label=el('label','','Tìm kiếm tài liệu');label.htmlFor='gds-lib-search';
  const input=el('input');input.id='gds-lib-search';input.type='search';input.placeholder='Ví dụ: trợ cấp thất nghiệp, làm hộ chiếu, cư trú...';input.autocomplete='off';
  searchBox.append(label,input);searchRow.append(searchBox);
  const topicBox=el('div','gds-lib-topicbox');const topicLabel=el('label','','Lĩnh vực');topicLabel.htmlFor='gds-lib-topic';
  const select=el('select');select.id='gds-lib-topic';select.append(el('option','','Tất cả lĩnh vực'));
  topicBox.append(topicLabel,select);searchRow.append(topicBox);shell.append(searchRow);
  const tabbar=el('nav','gds-lib-tabs');tabbar.setAttribute('aria-label','Lọc theo lĩnh vực');shell.append(tabbar);
  const count=el('p','gds-lib-count');count.setAttribute('aria-live','polite');shell.append(count);
  const container=el('div','gds-lib-sections');shell.append(container);
  const foot=el('p','gds-lib-footnote','Văn bản lấy từ nguồn chính thức được phép hiển thị đường dẫn gốc. Điều này không xác nhận văn bản còn hiệu lực hoặc đủ căn cứ tư vấn từng trường hợp.');shell.append(foot);
  if(area!=='ALL'){const more=el('a','gds-lib-open','Xem thư viện toàn bộ lĩnh vực →');more.href='./thu-vien.html';shell.append(more);}
  root.replaceChildren(shell);
  let items=[], selected='', expanded=new Set();
  const read=async url=>{try{const res=await fetch(url,{cache:'no-store'});return res.ok?await res.json():null;}catch{return null;}};
  const safeUrl=item=>{const url=String(item.url||'');
    if(/^\/library-files\/[A-Za-z0-9_-]+\.pdf$/.test(url))return url;
    try{const u=new URL(url);if(u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&u.hostname==='congbao.chinhphu.vn')return u.href;}catch{}
    return null;};
  function makeCard(item){
    const card=el('article','gds-lib-document');
    const title=el('h3','gds-lib-document-title',String(item.title||'Văn bản chưa có tên'));
    const metadata=el('div','gds-lib-meta');
    metadata.append(el('span','gds-lib-chip',item.origin==='official_rss'?'Công báo Chính phủ':'PDF lưu tại thư viện'));
    if(item.documentCode)metadata.append(el('span','gds-lib-code',String(item.documentCode)));
    const summary=el('p','gds-lib-excerpt',String(item.description||item.excerpt||'Chưa có trích yếu.').slice(0,190));
    const action=el('a','gds-lib-read',item.origin==='official_rss'&&!item.localPdfUrl?'Mở trang văn bản gốc ↗':'Đọc tài liệu PDF ↗');
    action.href=safeUrl(item);action.target='_blank';action.rel='noopener noreferrer';action.referrerPolicy='no-referrer';
    card.append(title,metadata,summary,action);
    return card;
  }
  function available(){const words=norm(input.value.trim()).split(/\s+/).filter(Boolean);
    return items.filter(x=>(area==='ALL'||x.domain===area)&&(!selected||x.topic===selected)&&words.every(w=>norm([x.title,x.documentCode,x.topic,x.description,x.searchText].join(' ')).includes(w)));
  }
  function render(){
    const relevant=available();container.replaceChildren();
    count.textContent=`${relevant.length} văn bản phù hợp · ${items.filter(x=>x.origin==='official_rss').length} mục nguồn Công báo · ${items.filter(x=>x.origin!=='official_rss').length} PDF nội bộ`;
    tabbar.replaceChildren();
    const categories=[...new Set(items.filter(x=>area==='ALL'||x.domain===area).map(x=>x.topic||'Khác'))].sort((a,b)=>a.localeCompare(b,'vi'));
    const choices=['',...categories];
    choices.forEach(key=>{const name=key||'Tất cả';const btn=el('button',key===selected?'gds-lib-tab active':'gds-lib-tab',name);btn.type='button';
      btn.setAttribute('aria-pressed',String(key===selected));btn.addEventListener('click',()=>{selected=key;select.value=key;expanded.clear();render();});tabbar.append(btn);});
    select.replaceChildren();choices.forEach(key=>{const opt=el('option','',key||'Tất cả lĩnh vực');opt.value=key;select.append(opt);});select.value=selected;
    if(!relevant.length){container.append(el('p','gds-lib-empty',items.length?'Chưa có văn bản khớp chủ đề và từ khóa. Hãy thử chọn lĩnh vực khác hoặc tìm bằng số hiệu.':'Thư viện chưa có dữ liệu. Hãy chạy tác vụ đồng bộ nguồn hoặc kiểm tra danh mục.'));return;}
    const groups=new Map();for(const item of relevant){const group=item.topic||'Khác';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(item);}
    for(const [topic,documents] of [...groups.entries()].sort(([a],[b])=>a.localeCompare(b,'vi'))){
      const group=el('section','gds-lib-group');
      const heading=el('div','gds-lib-group-heading');heading.append(el('h3','',topic),el('span','gds-lib-group-total',`${documents.length} văn bản`));group.append(heading);
      const grid=el('div','gds-lib-grid');group.append(grid);
      const shown=expanded.has(topic)?documents:documents.slice(0,area==='ALL'?3:4);
      shown.forEach(item=>grid.append(makeCard(item)));
      if(shown.length<documents.length){const more=el('button','gds-lib-show-more',`Xem thêm ${documents.length-shown.length} văn bản trong nhóm này ↓`);more.type='button';more.addEventListener('click',()=>{expanded.add(topic);render();});group.append(more);}
      container.append(group);
    }
  }
  input.addEventListener('input',()=>{expanded.clear();render();});
  select.addEventListener('change',()=>{selected=select.value;expanded.clear();render();});
  Promise.all([read('/library-catalog.json'),read('/official-reference-catalog.json')]).then(([local,official])=>{
    const unique=new Set();const values=[...(local?.items||[]).map(x=>({...x,origin:'local'})),...(official?.items||[]).map(x=>({...x,origin:'official_rss'}))];
    items=values.filter(item=>{const url=safeUrl(item);if(!url)return false;const key=item.documentCode&&norm(item.documentCode).length>5?norm(item.documentCode):url;if(unique.has(key))return false;unique.add(key);return true;});
    count.textContent='';render();
    if(!official){const note=el('p','gds-lib-source-notice','Chưa có danh mục đồng bộ Công báo trên máy chủ. Các PDF cục bộ vẫn có thể tra cứu.');shell.append(note);}
    const params=new URLSearchParams(location.search);const q=params.get('q');if(q){input.value=q;render();}
  }).catch(()=>{count.textContent='Không tải được danh mục tài liệu. Hãy kiểm tra tệp catalog và làm mới trang.';});
})();
