(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const el = (tag, text, cls) => { const n=document.createElement(tag); if(text!==undefined) n.textContent=String(text); if(cls) n.className=cls; return n; };
  const append = (parent,tag,text,cls) => {const n=el(tag,text,cls);parent.append(n);return n;};
  const cases = {
    benefit:'Tôi vừa nghỉ việc, có được hưởng trợ cấp thất nghiệp không?',
    scam:'Có người xưng là BHXH gọi yêu cầu tôi chuyển tiền, có phải lừa đảo không?'
  };
  const intentLabels={SAFETY:'Tình huống có dấu hiệu rủi ro: ưu tiên phòng tránh thiệt hại',BENEFIT:'Tìm hiểu quyền lợi: cần kiểm tra điều kiện và dữ kiện còn thiếu',PROCEDURE:'Tìm hiểu thủ tục: ưu tiên hồ sơ và các bước thực hiện',GENERAL:'Tra cứu thông tin tổng quát'};
  function show(id,visible) {$(id).hidden=!visible;}
  function card(root,data) {
    const node=append(root,'article',undefined,'card');
    append(node,'span',data.domain+' · '+data.editorialStatus,'tag'+(data.editorialStatus==='draft'?' draft':''));
    append(node,'h3',data.title);
    append(node,'p',data.summary);
    append(node,'p','Mã: '+data.businessCode+' · Danh mục: '+(data.category||'Chưa phân loại'),'meta');
    append(node,'p','Từ khóa trùng: '+(data.matchedTerms?.join(', ')||'Liên kết nội dung'),'meta');
    if(data.effectiveFrom) append(node,'p','Hiệu lực ghi nhận: '+new Date(data.effectiveFrom).toLocaleDateString('vi-VN'),'meta');
    const refs=append(node,'div',undefined,'refs');
    append(refs,'strong','Nguồn ('+(data.sources?.length||0)+')');
    if(!data.sources?.length) { append(refs,'p','Chưa có nguồn được xác minh/ghi nhận.');return; }
    const list=append(refs,'ul');
    for(const s of data.sources) {
      const row=append(list,'li');
      if (typeof s.url==='string' && /^https:\/\//i.test(s.url)) {
        const a=append(row,'a',s.title+' ↗');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';
      } else append(row,'span',s.title);
      append(row,'span',' · '+(s.status==='accepted'?'Đã chấp nhận':'Chờ kiểm chứng'));
    }
  }
  let active=0;
  async function lookup() {
    const current=++active;
    const q=$('question').value.trim(),mode=$('mode').value,domain=$('domain').value;
    if(q.length<2 || q.length>240){$('status').textContent='Vui lòng nhập câu hỏi từ 2 đến 240 ký tự.';return;}
    $('search-btn').disabled=true;
    $('status').className='';$('status').textContent='Đang truy xuất dữ liệu...';
    ['analysis','results','related'].forEach(id=>show(id,false));
    try {
      const path=mode==='staff'?'/api/admin/search':'/api/search';
      const url=path+'?'+new URLSearchParams({q,domain,limit:'8'});
      const res=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(res.status===401?'Cần đăng nhập trước khi xem bản nháp (login.html).':res.status===403?'Tài khoản chưa có vai trò nội bộ.':data.message||('HTTP '+res.status));
      if(current!==active) return;
      $('status').textContent=`${mode==='staff'?'NỘI BỘ':'CÔNG KHAI'} · ${data.results.length} kết quả chính · ${data.related.length} nội dung liên quan. ${data.warning}`;
      show('analysis',true);
      $('intent').textContent=intentLabels[data.intent]||intentLabels.GENERAL;
      show('safety',Boolean(data.urgentSafety));
      const missing=$('missing');missing.replaceChildren();
      if(data.missingInformation?.length){append(missing,'strong','Thông tin nên xác minh / hỏi thêm:');const ul=append(missing,'ul');data.missingInformation.forEach(s=>append(ul,'li',s));}
      show('results',true);$('matches').replaceChildren();
      if(!data.results?.length){
        append($('matches'),'p',mode==='staff'?'Không tìm thấy bản ghi nội bộ phù hợp.':'Chưa có nội dung đã kiểm duyệt, được công bố và khớp truy vấn. Các bản nháp và RSS đang chờ duyệt không xuất hiện tại đây.');
        if(mode==='public'){
          const official=append($('matches'),'p');
          const a=append(official,'a','Tra cứu tại Cơ sở dữ liệu văn bản pháp luật ↗');
          a.href='https://vbpl.vn/';a.target='_blank';a.rel='noopener noreferrer';
        }
      }
      (data.results||[]).forEach(d=>card($('matches'),d));
      show('related',Boolean(data.related?.length || data.links?.length));
      $('links').replaceChildren();$('related-items').replaceChildren();
      for(const link of (data.links||[])) {const n=append($('links'),'div',undefined,'edge');append(n,'strong',link.fromCode+' → '+link.toCode);append(n,'p',link.note);}
      (data.related||[]).forEach(d=>card($('related-items'),d));
    } catch(e) { if(current===active){$('status').className='error';$('status').textContent=e.message||String(e);} }
    finally { if(current===active)$('search-btn').disabled=false; }
  }
  // Navigation from the staff MVP page selects preview mode; API still enforces the cookie/role guard.
  if(new URLSearchParams(location.search).get('preview')==='1') $('mode').value='staff';
  $('search-form').addEventListener('submit',e=>{e.preventDefault();void lookup();});
  document.querySelectorAll('[data-example]').forEach(button=>button.addEventListener('click',()=>{
    $('question').value=cases[button.dataset.example]||'';$('domain').value='ALL';void lookup();
  }));
})();
