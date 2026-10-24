(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const make = (tag, text, klass) => {
    const n = document.createElement(tag);
    if (text !== undefined && text !== null) n.textContent = String(text);
    if (klass) n.className = klass;
    return n;
  };
  function add(el,tag,text,klass) { const n=make(tag,text,klass); el.append(n); return n; }
  async function api(path) {
    const res = await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
    const json = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(res.status===401?'Bạn cần đăng nhập ở login.html.':res.status===403?'Tài khoản chưa có quyền biên tập/quản trị.':(json.message||`HTTP ${res.status}`));
    return json;
  }
  function liList(section,items,label,fn) {
    add(section,'h3',label+' ('+items.length+')');
    if (!items.length) return add(section,'p','Chưa có dữ liệu trong bản nháp.');
    const ul=add(section,'ul'); items.forEach(x=>add(ul,'li',fn(x)));
  }
  async function detail(code) {
    const root=byId('detail');root.hidden=false;root.textContent='Đang tải...';
    try {
      const d=await api('/api/admin/mvp/item/'+encodeURIComponent(code));
      root.replaceChildren();
      add(root,'h2',d.title);add(root,'p',d.businessCode+' · '+d.domain+' · '+d.editorialStatus,'tag draft');
      add(root,'p',d.summary);
      const intro=add(root,'section');add(intro,'h3','Nội dung bản nháp');add(intro,'p',d.bodyMarkdown);
      const conditions=add(root,'section');liList(conditions,d.conditions,'Thông tin cần kiểm tra',x=>x.text);
      const steps=add(root,'section');liList(steps,d.steps,'Các bước',x=>x.no+'. '+x.title+' — '+x.text);
      const requirements=add(root,'section');liList(requirements,d.requirements,'Nhóm hồ sơ để rà soát',x=>x.title+' — '+x.note);
      const indicators=add(root,'section');liList(indicators,d.indicators,'Dấu hiệu cảnh báo',x=>x.type+': '+x.text);
      const cross=add(root,'section');liList(cross,d.linked,'Nội dung liên quan',x=>x.linkedCode+' — '+x.linkedTitle);
      const sources=add(root,'section');add(sources,'h3','Nguồn tham khảo chờ xác minh ('+d.sources.length+')');
      for(const s of d.sources) {
        const row=add(sources,'p');
        const a=make('a',s.title+' ↗');
        if (typeof s.url==='string' && /^https:\/\//i.test(s.url)) {a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';row.append(a);} else row.append(make('span',s.title));
        add(row,'span',' · '+s.reviewStatus+' · '+s.reviewNote);
      }
      add(root,'p',d.warning,'tag draft');
      root.scrollIntoView({behavior:'smooth',block:'start'});
    } catch(e){root.replaceChildren(make('p',e.message||String(e),'error'));}
  }
  async function start() {
    const status=byId('status');
    try {
      const d=await api('/api/admin/mvp');
      const list=byId('items');list.replaceChildren();
      for(const x of d.articles){
        const card=add(list,'article',null,'card');
        add(card,'span',x.domain+' · '+x.editorialStatus,'tag draft');
        add(card,'h3',x.title);add(card,'p',x.summary);add(card,'p','Mã: '+x.businessCode);
        add(card,'p','Nguồn chờ rà soát: '+x.sourceCandidates);
        const btn=add(card,'button','Xem chi tiết');btn.type='button';btn.addEventListener('click',()=>detail(x.businessCode));
      }
      const links=byId('links');links.replaceChildren();
      for(const x of d.links){const box=add(links,'div',null,'link');add(box,'strong',x.fromCode+' → '+x.toCode);add(box,'p',x.note);}
      status.textContent=`Đã đọc ${d.articles.length}/3 bản ghi MVP và ${d.links.length}/3 liên kết từ SQL. Chỉ sử dụng nội bộ.`;
      if(d.articles.length!==3 || d.links.length!==3) status.textContent+=' Cần chạy SQL 07 và 08 để kiểm tra.';
    }catch(e){status.textContent=e.message||String(e);status.className='error';}
  }
  void start();
})();
