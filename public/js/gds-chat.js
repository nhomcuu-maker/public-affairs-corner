(()=>{
  'use strict';
  // One same-origin chat UI for the public site; never redirects or stores raw questions.
  const root=document.getElementById('gds-chat-host') || document.body;
  const full=Boolean(document.getElementById('gds-chat-host'));
  // Search all domains so the assistant can answer questions beyond the current page.
  const domain='ALL';
  const el=(tag,cls,text,parent)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);if(parent)parent.appendChild(n);return n;};
  const wrap=el('section',full?'gds-chat gds-chat-full':'gds-chat gds-chat-popup',undefined,root);
  wrap.setAttribute('aria-label','Trợ lý Dân Sinh');
  if(!full){wrap.id='gds-chat-panel';wrap.hidden=true;}
  const header=el('header','gds-chat-header',undefined,wrap);
  const title=el('div','gds-chat-title',undefined,header);
  el('span','gds-chat-symbol','✦',title);el('span','', 'Trợ lý Dân Sinh',title);
  const actions=el('div','gds-chat-actions',undefined,header);
  const clear=el('button','gds-chat-clear','Cuộc trò chuyện mới',actions);clear.type='button';clear.title='Xóa nội dung chat khỏi trang hiện tại';
  let toggle;
  if(!full){
    const close=el('button','gds-chat-close','×',actions);close.type='button';close.setAttribute('aria-label','Đóng trò chuyện');
    close.addEventListener('click',()=>setOpen(false));
    toggle=el('button','gds-chat-launch','✦ Hỏi trợ lý',document.body);toggle.type='button';toggle.setAttribute('aria-controls','gds-chat-panel');toggle.setAttribute('aria-expanded','false');
    toggle.addEventListener('click',()=>setOpen(wrap.hidden));
  }
  const feed=el('div','gds-chat-messages',undefined,wrap);
  feed.setAttribute('role','log');feed.setAttribute('aria-live','polite');feed.setAttribute('aria-relevant','additions');feed.setAttribute('aria-label','Nội dung trò chuyện');
  const foot=el('div','gds-chat-bottom',undefined,wrap);
  el('p','gds-chat-hint','Không gửi OTP, mật khẩu hoặc thông tin cá nhân. Câu trả lời chỉ để tham khảo.',foot);
  let staff=false;
  if(full){
    const detail=el('details','gds-chat-staff',undefined,foot);
    el('summary','', 'Tùy chọn thử nghiệm nội bộ',detail);
    const label=el('label','',undefined,detail);
    const check=el('input','',undefined,label);check.type='checkbox';check.id='gds-chat-drafts';
    el('span','', 'Dùng bản nháp (yêu cầu đăng nhập và phân quyền)',label);
    check.addEventListener('change',()=>{staff=check.checked;clearChat();});
  }
  const form=el('form','gds-chat-form',undefined,foot);
  const input=el('textarea','gds-chat-input',undefined,form);input.rows=1;input.maxLength=240;input.required=true;input.setAttribute('aria-label','Nhập câu hỏi');input.placeholder='Nhập câu hỏi của bạn...';
  const submit=el('button','gds-chat-submit','Gửi',form);submit.type='submit';
  const notice=el('p','gds-chat-notice',undefined,foot);notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  let waiting=false; let aborter=null; let sequence=0;
  let recentQuestions=[]; // short, in-memory conversation context; cleared on new chat
  function scroll(){feed.scrollTop=feed.scrollHeight;}
  function welcome(){const block=el('div','gds-chat-bubble gds-chat-bot',undefined,feed);el('p','', 'Xin chào! Bạn cần tìm hiểu về quyền lợi, thủ tục hành chính hay nhận diện lừa đảo?',block);scroll();}
  function clearChat(){recentQuestions=[];sequence++;if(aborter){aborter.abort();aborter=null;}waiting=false;submit.disabled=false;input.disabled=false;input.value='';notice.textContent='';feed.replaceChildren();welcome();}
  clear.addEventListener('click',clearChat);welcome();
  function setOpen(state){wrap.hidden=!state;toggle?.setAttribute('aria-expanded',String(state));if(state){input.focus();scroll();}else toggle?.focus();}
  if(!full)document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!wrap.hidden)setOpen(false);});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}});
  function userBubble(text){const b=el('div','gds-chat-bubble gds-chat-user',undefined,feed);el('p','',text,b);scroll();}
  function safeLink(url){try{const x=new URL(url);return x.protocol==='https:'&&!x.username&&!x.password?x.href:null;}catch{return null;}}
  function uniqueStrings(values,max){if(!Array.isArray(values))return [];const seen=new Set();return values.filter(v=>{
    if(typeof v!=='string'||!v.trim())return false;
    const key=v.trim().toLocaleLowerCase('vi');if(seen.has(key))return false;seen.add(key);return true;
  }).slice(0,max).map(v=>v.trim());}
  function listSection(target,name,values,limit){const list=uniqueStrings(values,limit);if(!list.length)return;
    const section=el('section','gds-chat-section',undefined,target);el('strong','',name,section);const ul=el('ul','',undefined,section);for(const s of list)el('li','',s,ul);
  }
  function renderAnswer(target,d){
    target.replaceChildren();target.classList.remove('gds-chat-pending');
    const answer=d&&typeof d.answer==='object'?d.answer:{};
    const summary=typeof answer.summary==='string'&&answer.summary.trim()?answer.summary.trim():'Chưa có câu trả lời phù hợp.';
    el('p','gds-chat-summary',summary,target);
    if(d.status==='INSUFFICIENT_EVIDENCE')el('p','gds-chat-subtle','Chưa tìm thấy dữ liệu có thể sử dụng để kết luận. Bạn có thể mô tả rõ tình huống hơn.',target);
    // API conditions represent missing details, not legally established eligibility criteria.
    // For urgent scam cases, safety guidance appears first.
    if(domain==='SCAM'||d.urgentSafety){
      listSection(target,'Lưu ý quan trọng',answer.warnings,3);
      listSection(target,'Bạn có thể làm ngay',answer.nextSteps,4);
    } else {
      listSection(target,'Bạn có thể làm gì',answer.nextSteps,4);
      listSection(target,'Lưu ý quan trọng',answer.warnings,3);
    }
    listSection(target,d.status==='NEEDS_CLARIFICATION'?'Mình cần hỏi thêm':'Thông tin cần làm rõ',answer.conditions,3);
    const evidence=Array.isArray(d.evidence)?d.evidence:[];
    const cited=Array.isArray(answer.citationIds)&&answer.citationIds.length?new Set(answer.citationIds):null;
    const seen=new Set();const sources=[];
    for(const s of evidence){
      if(!s||typeof s!=='object'||(cited&&!cited.has(s.id)))continue;
      const url=safeLink(s.sourceUrl);if(!url||seen.has(url))continue;
      seen.add(url);sources.push({url,title:String(s.sourceTitle||s.title||'Tài liệu tham khảo').slice(0,150)});
      if(sources.length===3)break;
    }
    if(sources.length){const box=el('div','gds-chat-sources',undefined,target);el('strong','', 'Nguồn tham khảo',box);
      for(const s of sources){const a=el('a','',s.title+' ↗',box);a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';}
    }
    if(staff)el('p','gds-chat-draft','ĐANG XEM BẢN NHÁP NỘI BỘ – nội dung chưa xác minh, không dùng làm hướng dẫn chính thức.',target);
    else if(d.status==='PROVIDER_UNAVAILABLE'||d.status==='RETRIEVAL_ONLY')el('p','gds-chat-subtle','Đây là kết quả tra cứu từ dữ liệu hiện có; AI chưa tạo được câu trả lời đầy đủ.',target);
    else if(d.status==='AI_GENERATED' && !sources.length)el('p','gds-chat-subtle','AI hướng dẫn chung; chưa có nguồn đã kiểm chứng cho câu hỏi này. Với quy định cụ thể, cần đối chiếu cơ quan có thẩm quyền.',target);
    scroll();
  }
  function fail(target,message){target.replaceChildren();target.classList.remove('gds-chat-pending');el('p','',message,target);scroll();}
  async function ask(question){
    if(waiting)return;
    const q=String(question||'').trim();
    if(q.length<5||q.length>240){notice.textContent='Hãy nhập câu hỏi từ 5 đến 240 ký tự.';input.focus();return;}
    notice.textContent='';userBubble(q);input.value='';
    const history=recentQuestions.slice(-3);
    recentQuestions=[...recentQuestions.slice(-2),q];
    const pending=el('div','gds-chat-bubble gds-chat-bot gds-chat-pending','Đang tìm thông tin và soạn câu trả lời…',feed);scroll();
    waiting=true;input.disabled=true;submit.disabled=true;
    const ticket=++sequence;aborter=new AbortController();
    try{
      const r=await fetch(staff?'/api/admin/assistant/ask':'/api/assistant/ask',{
        method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({question:q,domain,history}),signal:aborter.signal
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok){const msg=r.status===401?'Vui lòng đăng nhập bằng tài khoản nội bộ để sử dụng bản nháp.':r.status===403?'Bạn không có quyền truy cập nội dung này.':r.status===429?'Bạn hỏi quá nhanh. Vui lòng thử lại sau.':(Array.isArray(d.message)?d.message.join('; '):d.message)||'Không kết nối được máy chủ.';throw Error(msg);}
      if(ticket!==sequence)return;
      renderAnswer(pending,d);
    }catch(e){if(ticket!==sequence||e.name==='AbortError')return;fail(pending,'Không thể trả lời lúc này. '+(e.message||'Vui lòng thử lại.'));}
    finally{if(ticket===sequence){waiting=false;input.disabled=false;submit.disabled=false;aborter=null;input.focus();}}
  }
  form.addEventListener('submit',e=>{e.preventDefault();void ask(input.value);});
  window.GDSChat={open:(question)=>{if(!full)setOpen(true);if(question){input.value=String(question).slice(0,240);input.focus();}},ask:(question)=>{if(!full)setOpen(true);return ask(question);}};
})();
