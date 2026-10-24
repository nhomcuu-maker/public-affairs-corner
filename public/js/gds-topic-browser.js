/* Góc Dân Sinh: one catalogue + one search filter per page, no cross-domain fallback. */
(() => {
  'use strict';
  const mount = document.getElementById('gds-topic-browser');
  const taxonomy = window.GDSTaxonomy;
  if (!mount || !taxonomy) return;
  const params = new URLSearchParams(window.location.search);
  const domain = taxonomy.matchDomain(mount.dataset.domain === 'AUTO' ? params.get('domain') : mount.dataset.domain);
  const categories = taxonomy.sections[domain];
  let selected = taxonomy.resolveId(domain, params.get('topic')) || categories[0].id;
  let term = (params.get('q') || '').trim().slice(0, 120);
  let references = [], documentError = '', requestId = 0;

  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  };
  const title = { LEGAL: 'Pháp luật và Quyền lợi', ADMIN: 'Thủ tục hành chính', SCAM: 'Cảnh báo lừa đảo' }[domain];
  const app = node('div', 'gds-topic-app');
  const layout = node('div', 'gds-topic-layout');
  const sidebar = node('aside', 'gds-topic-nav');
  sidebar.append(node('h2', '', title), node('p', 'gds-topic-help', 'Chọn một trong ba nhóm. Chỉ tài liệu được phân loại đúng mới xuất hiện.'));
  const menu = node('div', 'gds-topic-menu'); sidebar.append(menu);
  const body = node('section', 'gds-topic-body');
  const heading = node('h2', '', '');
  const form = node('form', 'gds-topic-search');
  const input = node('input');input.type = 'search';input.maxLength = 120;input.placeholder = 'Tìm trong nhóm đã chọn';input.setAttribute('aria-label', 'Tìm trong nhóm đã chọn');input.value = term;
  const submit = node('button', '', 'Tìm kiếm'); submit.type = 'submit';form.append(input, submit);
  const status = node('p', 'gds-topic-status');status.setAttribute('role', 'status');status.setAttribute('aria-live', 'polite');
  const published = node('div');const extra = node('div');
  body.append(heading, form, status, published, extra,
    node('p', 'gds-topic-caution', domain === 'SCAM'
      ? 'Chỉ hiển thị cảnh báo đã kiểm duyệt và công bố; các tình huống trong cẩm nang bên dưới là hướng dẫn chung.'
      : 'Tài liệu tham khảo không đồng nghĩa văn bản còn hiệu lực hoặc được cơ quan có thẩm quyền xác nhận. Hãy đối chiếu bản gốc.'));
  layout.append(sidebar, body);app.append(layout);mount.replaceChildren(app);
  const dialog = node('dialog', 'gds-topic-dialog');dialog.setAttribute('aria-label','Chi tiết bài viết');document.body.append(dialog);

  function addMessage(parent, message){parent.append(node('p','gds-topic-empty',message));}
  function normalize(text) { return taxonomy.canonical(text); }
  function validUrl(url) {
    if (/^\/library-files\/[a-zA-Z0-9_-]+\.pdf$/.test(String(url || ''))) return url;
    try {
      const u = new URL(url);
      if (u.protocol === 'https:' && !u.username && !u.password && !u.port &&
         (u.hostname === 'congbao.chinhphu.vn' || u.hostname === 'vbpl.vn')) return u.href;
    } catch (_) {}
    return null;
  }
  const category = () => categories.find(c=>c.id===selected) || categories[0];
  function reflectUrl(){
    const url = new URL(window.location.href);
    url.searchParams.set('domain',domain);url.searchParams.set('topic',selected);
    if(term)url.searchParams.set('q',term);else url.searchParams.delete('q');
    history.replaceState(null,'',url.pathname + url.search + url.hash);
  }
  function renderMenu(){
    menu.replaceChildren();
    for(const c of categories){
      const button = node('button','gds-topic-button',c.title);
      button.type='button';button.setAttribute('aria-pressed', String(selected===c.id));
      button.addEventListener('click',()=>{
        if(selected===c.id)return;
        selected=c.id;term='';input.value='';reflectUrl();renderMenu();void loadResults();
      });
      menu.append(button);
    }
  }
  async function readJSON(url){
    const res=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}});
    if(!res.ok)throw Error('HTTP '+res.status);
    return res.json();
  }
  async function loadReferences(){
    if(domain==='SCAM')return;
    try{
      const index=await readJSON('/category-index.json');
      const list=Array.isArray(index.items)?index.items:[];
      references=list.filter(x=>x.domain===domain && typeof x.title==='string' && validUrl(x.url));
    }catch(err){documentError='Không thể tải chỉ mục tài liệu tham khảo ('+err.message+').';}
    void loadResults();
  }
  // Guard against obvious legacy mislabelling: a title explicitly belonging to a
  // different one of the three groups is not displayed under the SQL tag.
  function conflictsWithTitle(item){
    if(domain==='SCAM')return false;
    const detected=taxonomy.classifyReference({domain,title:item.title});
    if(detected && detected!==selected)return true;
    const title=normalize(item.title);
    if(domain==='ADMIN' && /\b(that nghiep|bao hiem that nghiep|tro cap that nghiep)\b/.test(title) && detected!==selected)return true;
    return false;
  }
  function keywordMatches(item){
    const words = normalize(term).split(/\s+/).filter(Boolean);
    if(!words.length)return true;
    const target=normalize([item.title,item.summary||'',item.excerpt||''].join(' '));
    return words.every(w=>target.includes(w));
  }
  function createSection(parent,label){
    const section=node('section','gds-topic-section');section.append(node('h3','',label));parent.append(section);return section;
  }
  function renderReferenceArticles(){
    extra.replaceChildren();
    if(domain==='SCAM')return;
    const section=createSection(extra,'Tài liệu tham khảo theo nhóm');
    const docs=references.filter(x => x.domain===domain &&
      Array.isArray(x.topics) && x.topics.includes(selected) &&
      taxonomy.classifyReference({domain:x.domain,title:x.title,topic:''})===selected && keywordMatches(x));
    // An original official title may be a placeholder. Do not infer a category from its excerpt.
    if(!docs.length){addMessage(section,documentError||'Chưa có tài liệu tham khảo khớp danh mục này. Không dùng tài liệu của nhóm khác để thay thế.');return docs.length;}
    for(const doc of docs.slice(0,40)){
      const card=node('article','gds-topic-article');
      card.append(node('h4','',doc.title),node('p','',doc.kind==='pdf'
        ? 'PDF trong thư viện · chưa kiểm chứng hiệu lực'
        : 'Nguồn công khai · chưa xác minh hiệu lực'));
      const link=node('a','','Mở bản gốc ↗');link.href=validUrl(doc.url);link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';
      card.append(link);section.append(card);
    }
    return docs.length;
  }
  function showDialog(item){
    dialog.replaceChildren();const close=node('button','','Đóng');close.type='button';close.addEventListener('click',()=>dialog.close());
    dialog.append(close,node('h2','',item.title),node('p','',item.summary||''),node('p','', 'Đang tải nội dung và nguồn xác minh…'));dialog.showModal();
    void readJSON('/api/content/'+encodeURIComponent(item.businessCode)).then(d=>{
      if(!dialog.open)return;
      dialog.replaceChildren(close,node('h2','',d.title),node('p','',d.summary||''),node('p','',d.bodyMarkdown||'Chưa có nội dung chi tiết.'));
      const list=Array.isArray(d.sources)?d.sources:[];
      if(list.length){dialog.append(node('h3','','Nguồn đã xác minh'));
        for(const s of list){try{const u=new URL(s.url);if(u.protocol!=='https:')continue;const a=node('a','',s.title||u.hostname);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';dialog.append(a,node('p','',''));}catch(_){}}
      }else dialog.append(node('p','','Chưa có nguồn đủ điều kiện hiển thị.'));
    }).catch(err=>{if(dialog.open)dialog.append(node('p','','Không thể đọc chi tiết ('+err.message+').'));});
  }
  async function loadResults(){
    const serial=++requestId;const selectedCategory=category();
    heading.textContent=selectedCategory.title;published.replaceChildren();extra.replaceChildren();
    status.textContent='Đang tải bài viết thuộc nhóm '+selectedCategory.title+'…';
    const codes=selectedCategory.sqlCodes;
    let rows=[], error='';
    try{
      const list=await Promise.all(codes.map(code=>readJSON('/api/content?'+new URLSearchParams({domain,category:code}))));
      if(serial!==requestId)return;
      const seen=new Set();
      rows=list.flat().filter(item=>item && item.businessCode && !seen.has(item.businessCode) &&
        (seen.add(item.businessCode), taxonomy.sqlCategory(domain,item.primaryCategoryCode)===selected && !conflictsWithTitle(item)));
    }catch(err){if(serial!==requestId)return;error='Chưa truy cập được bài đã công bố: '+err.message;}
    const matches=rows.filter(keywordMatches);
    const section=createSection(published,domain==='SCAM'?'Cảnh báo đã được công bố':'Bài viết đã được công bố');
    if(!matches.length)addMessage(section,error||'Chưa có bài viết đã công bố phù hợp trong nhóm này.');
    else for(const item of matches){
      const card=node('article','gds-topic-article');
      const open=node('button','','Xem bài viết và căn cứ ↗');open.type='button';open.addEventListener('click',()=>showDialog(item));
      card.append(node('h4','',item.title),node('p','',item.summary||''),open);section.append(card);
    }
    const refCount=renderReferenceArticles();
    if(serial!==requestId)return;
    status.textContent=`${matches.length} bài đã công bố${domain==='SCAM'?'':` · ${refCount} tài liệu tham khảo`} trong nhóm “${selectedCategory.title}”${term?' · Lọc theo: '+term:''}.`;
    if(error)status.textContent+=' '+error;
  }
  form.addEventListener('submit',event=>{event.preventDefault();term=input.value.trim();reflectUrl();void loadResults();});
  const useTopSearch = (id,callbackName) => {
    const target=document.getElementById(id);if(!target)return;
    const callback=()=>{term=target.value.trim().slice(0,120);input.value=term;reflectUrl();void loadResults();mount.scrollIntoView({behavior:'smooth',block:'start'});};
    window[callbackName]=callback;
    target.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();callback();}});
  };
  if(domain==='LEGAL')useTopSearch('legalSearch','handleLegalSearch');
  if(domain==='ADMIN')useTopSearch('procedureSearch','handleProcedureSearch');
  if(domain==='SCAM')useTopSearch('scamSearch','handleSearch');
  renderMenu();void loadResults();void loadReferences();
})();
