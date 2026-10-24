(()=>{
'use strict';
const domain=location.pathname.includes('phap-luat')?'LEGAL':'ADMIN';
const inputId=domain==='LEGAL'?'legalSearch':'procedureSearch';
function navigate(question){
 try{sessionStorage.setItem('gds_ai_next_question',question.slice(0,240));}catch{}
 location.assign('/tro-ly-ai.html');
}
const redirect=()=>{
 const text=document.getElementById(inputId)?.value.trim()||'';
 if(text.length<5){document.getElementById(inputId)?.focus();alert('Nhập câu hỏi từ 5 ký tự.');return;}
 navigate(text);
};
const sendMsg=async()=>{
 const input=document.getElementById('chatInput'),root=document.getElementById('chatBody');if(!input||!root)return;
 const question=input.value.trim();if(question.length<5)return;
 const add=(text,cls)=>{const node=document.createElement('div');node.className='msg '+cls;node.textContent=text;root.append(node);root.scrollTop=root.scrollHeight;return node;};
 const user=add(question,'');user.style.cssText='background:#3b82f6;color:white;align-self:flex-end;';input.value='';
 const pending=add('Đang đối chiếu nguồn...','msg-ai');
 try {
   const res=await fetch('/api/assistant/ask',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,domain})});
   const d=await res.json();if(!res.ok)throw new Error(d.message||('HTTP '+res.status));
   const state=d.status==='AI_GENERATED'?'AI tổng hợp có dẫn nguồn':d.status==='INSUFFICIENT_EVIDENCE'?'CHƯA ĐỦ CĂN CỨ':'CHỈ TRA CỨU (chưa có AI)';
   pending.textContent=state+'\n'+(d.answer?.summary||'Không tìm thấy câu trả lời')+'\n'+(d.answer?.warnings||[]).join(' ');
   pending.style.whiteSpace='pre-line';
   if(d.evidence?.length) add('Nguồn: '+d.evidence.map(x=>x.sourceTitle+' ['+x.sourceStatus+']').join('; '),'msg-ai');
 } catch (e){pending.textContent='Chưa xử lý được: '+(e.message||'Lỗi kết nối');}
};
function install(){window.handleLegalSearch=redirect;if(!window.gdsSearchProcedures)window.handleProcedureSearch=redirect;window.sendMsg=sendMsg;}
install();document.addEventListener('DOMContentLoaded',install);
})();
