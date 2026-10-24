(()=>{
  'use strict';
  const byId=id=>document.getElementById(id);
  const make=(root,tag,value,css)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=String(value);if(css)el.className=css;root.append(el);return el;};
  const examples={benefit:'Tôi vừa nghỉ việc, có được hưởng trợ cấp thất nghiệp không?',scam:'Có người tự xưng BHXH yêu cầu tôi chuyển tiền, có phải lừa đảo không?'};
  const reasons={incorrect:'Nội dung sai / không phù hợp',outdated:'Thông tin có thể đã cũ',missing_source:'Thiếu nguồn hoặc nguồn không rõ',unclear:'Giải thích khó hiểu',unsafe:'Hướng dẫn có thể không an toàn',other:'Vấn đề khác'};
  let requestId=0;
  let feedbackPanel=null;
  const validExternal=url=>{try{const x=new URL(url);return x.protocol==='https:'&&!x.username&&!x.password?x:null;}catch{return null;}};
  const formatDate=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const [y,m,d]=value.split('-');return `${d}/${m}/${y}`;};
  function simpleSection(id,heading,values,klass=''){
    const target=byId(id);target.replaceChildren();target.className='answer-section '+klass;
    if(!Array.isArray(values)||!values.length)return;
    make(target,'h3',heading);const list=make(target,'ul');for(const v of values)make(list,'li',v);
  }
  function checklist(values){
    const target=byId('gds-next');target.replaceChildren();target.className='answer-section gds-checklist';
    if(!Array.isArray(values)||!values.length)return;
    make(target,'h3','Checklist – những việc bạn có thể thực hiện');
    make(target,'p','Danh sách gợi ý để tự đối chiếu, không phải kết luận hay thủ tục đã được xác nhận.','sub');
    const list=make(target,'ul');
    for(const [i,v] of values.entries()){
      const li=make(list,'li');const label=make(li,'label');
      const input=make(label,'input');input.type='checkbox';input.setAttribute('aria-label','Đánh dấu bước '+(i+1));
      make(label,'span',v);
      input.addEventListener('change',()=>li.classList.toggle('gds-done',input.checked));
    }
  }
  function sources(items,citations){
    const panel=byId('gds-evidence');panel.replaceChildren();
    if(!Array.isArray(items)||!items.length){make(panel,'p','Không có nguồn đủ điều kiện hiển thị.','empty');return;}
    const referenced=new Set(Array.isArray(citations)?citations:[]);
    for(const s of items){
      const item=make(panel,'article',undefined,'source gds-source');item.id='gds-source-'+String(s.id).replace(/[^a-zA-Z0-9-]/g,'');
      make(item,'strong',(referenced.has(s.id)?'★ ':'')+s.id+' · '+s.title);
      make(item,'p',s.domain+' · '+s.businessCode,'sub');
      const verified=s.sourceStatus==='accepted' && s.editorialStatus==='published';
      make(item,'p',verified?'Nguồn đã được chấp nhận trong hệ thống':'CHƯA KIỂM CHỨNG / BẢN NHÁP NỘI BỘ',verified?'gds-verified':'gds-unverified');
      if(s.summary)make(item,'p',s.summary,'sub');
      if(formatDate(s.effectiveFrom))make(item,'p','Ngày bắt đầu hiệu lực (theo dữ liệu): '+formatDate(s.effectiveFrom),'sub');
      if(formatDate(s.effectiveTo))make(item,'p','Ngày kết thúc hiệu lực (theo dữ liệu): '+formatDate(s.effectiveTo),'sub');
      if(formatDate(s.publishedAt))make(item,'p','Ngày nội dung được công bố: '+formatDate(s.publishedAt),'sub');
      if(formatDate(s.sourceVerifiedAt))make(item,'p','Nguồn được kiểm chứng ngày: '+formatDate(s.sourceVerifiedAt),'sub');
      if(formatDate(s.sourceValidUntil))make(item,'p','Kết quả kiểm chứng nguồn có hạn đến: '+formatDate(s.sourceValidUntil),'sub');
      const url=validExternal(s.sourceUrl);
      if(url){const a=make(item,'a',s.sourceTitle+' ↗');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';}
      else make(item,'span',s.sourceTitle||'Chưa có đường dẫn nguồn hợp lệ','sub');
    }
  }
  function citationLinks(citations){
    const host=byId('gds-answer');const prev=host.querySelector('.gds-inline-citations');if(prev)prev.remove();
    if(!Array.isArray(citations)||!citations.length)return;
    const wrapper=make(host,'div',undefined,'gds-inline-citations');make(wrapper,'strong','Căn cứ được sử dụng: ');
    for(const id of citations){
      const target=document.getElementById('gds-source-'+String(id).replace(/[^a-zA-Z0-9-]/g,''));
      if(!target)continue;
      const a=make(wrapper,'a','['+id+']');a.href='#'+target.id;a.setAttribute('aria-label','Xem nguồn '+id);
    }
  }
  function feedback(receipt,mode){
    if(feedbackPanel)feedbackPanel.remove();
    const wrapper=make(byId('gds-result'),'section',undefined,'panel gds-feedback');feedbackPanel=wrapper;
    const header=make(wrapper,'h2','Đánh giá câu trả lời');
    make(wrapper,'p','Bạn thấy nội dung hữu ích không? Phản hồi chỉ lưu loại đánh giá, không lưu câu hỏi, câu trả lời, IP hay thông tin cá nhân.','sub');
    const row=make(wrapper,'div',undefined,'gds-feedback-options');
    const yes=make(row,'button','Hữu ích');yes.type='button';
    const no=make(row,'button','Chưa hữu ích');no.type='button';no.classList.add('gds-neutral');
    const detail=make(wrapper,'div',undefined,'gds-feedback-detail');detail.hidden=true;
    const lbl=make(detail,'label','Lý do cần cải thiện');const select=make(detail,'select');
    select.setAttribute('aria-label','Lý do đánh giá');
    for(const [value,name] of Object.entries(reasons)){const opt=make(select,'option',name);opt.value=value;}
    const send=make(detail,'button','Gửi đánh giá');send.type='button';
    const notice=make(wrapper,'p',undefined,'gds-feedback-state');notice.setAttribute('role','status');
    let submitting=false,completed=false;
    async function submit(vote,reason){
      if(submitting||completed)return;
      submitting=true;yes.disabled=true;no.disabled=true;send.disabled=true;notice.textContent='Đang gửi phản hồi...';
      try{
        const response=await fetch('/api/assistant/feedback',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({receipt,vote,reason})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw Error(Array.isArray(data.message)?data.message.join('; '):data.message||'HTTP '+response.status);
        completed=true;notice.textContent=data.message||'Đã tiếp nhận phản hồi.';detail.hidden=true;
      }catch(err){notice.textContent=(err.message||String(err))+' Bạn có thể thử lại.';yes.disabled=false;no.disabled=false;send.disabled=false;}
      finally{submitting=false;}
    }
    yes.addEventListener('click',()=>void submit('helpful','none'));
    no.addEventListener('click',()=>{if(completed)return;detail.hidden=false;select.focus();});
    send.addEventListener('click',()=>void submit('not_helpful',select.value));
  }
  async function ask(){
    const ticket=++requestId;
    const question=byId('gds-question').value.trim(),domain=byId('gds-domain').value,staff=byId('gds-mode').value==='staff';
    if(question.length<5||question.length>240){byId('gds-status').textContent='Câu hỏi cần từ 5 đến 240 ký tự.';return;}
    byId('gds-ask').disabled=true;byId('gds-status').className='';byId('gds-status').textContent='Đang tìm dữ liệu và gọi AI (nếu đã cấu hình)...';byId('gds-result').hidden=true;
    if(feedbackPanel){feedbackPanel.remove();feedbackPanel=null;}
    try{
      const api=staff?'/api/admin/assistant/ask':'/api/assistant/ask';
      const res=await fetch(api,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({question,domain})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(res.status===401?'Cần đăng nhập để xem bản nháp.':res.status===403?'Không có quyền hoặc yêu cầu bị chặn.':Array.isArray(data.message)?data.message.join('; '):data.message||'HTTP '+res.status);
      if(ticket!==requestId)return;
      byId('gds-result').hidden=false;
      const statuses={AI_GENERATED:'AI tổng hợp có dẫn nguồn',RETRIEVAL_ONLY:'Chỉ truy xuất, chưa có AI',PROVIDER_UNAVAILABLE:'AI không phản hồi, dùng kết quả tra cứu',INSUFFICIENT_EVIDENCE:'Chưa đủ căn cứ'};
      byId('gds-status').textContent=data.notice||`Truy xuất: ${data.retrieval}. Tìm thấy ${data.evidence?.length||0} nguồn.`;
      const label=byId('gds-label');label.textContent=statuses[data.status]||data.status;label.className='tag '+(staff?'draft':data.status==='AI_GENERATED'?'ai':'low');
      byId('gds-disclaimer').textContent=data.disclaimer||'';
      byId('gds-summary').textContent=data.answer?.summary||'Chưa có câu trả lời.';
      simpleSection('gds-conditions','Thông tin cần kiểm tra',data.answer?.conditions);
      checklist(data.answer?.nextSteps);
      simpleSection('gds-warnings','Lưu ý về rủi ro và giới hạn',data.answer?.warnings,'warnings');
      sources(data.evidence,data.answer?.citationIds);
      citationLinks(data.answer?.citationIds);
      const links=byId('gds-links');links.replaceChildren();
      if(!data.links?.length)make(links,'p','Chưa có liên kết chéo phù hợp.','empty');
      else for(const x of data.links.slice(0,12))make(links,'p',x.fromCode+' → '+x.toCode+' · '+(x.relationType||''),'sub');
      if(data.feedbackReceipt)feedback(data.feedbackReceipt,staff?'staff':'public');
    }catch(e){if(ticket===requestId){byId('gds-status').className='error';byId('gds-status').textContent=e.message||String(e);}}
    finally{if(ticket===requestId)byId('gds-ask').disabled=false;}
  }
  byId('assistant-form').addEventListener('submit',e=>{e.preventDefault();void ask();});
  document.querySelectorAll('[data-example]').forEach(btn=>btn.addEventListener('click',()=>{
    // Keep the visitor's selected mode: examples must work publicly without staff permissions.
    byId('gds-question').value=examples[btn.dataset.example]||'';void ask();
  }));
  const url=new URLSearchParams(location.search);if(url.get('preview')==='1')byId('gds-mode').value='staff';
  try{const saved=sessionStorage.getItem('gds_ai_next_question');if(saved){byId('gds-question').value=saved;sessionStorage.removeItem('gds_ai_next_question');}}catch{}
})();
