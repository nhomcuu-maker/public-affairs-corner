(()=>{
'use strict';
// Replace old hard-coded responses on SCAM and optional reporting form.
const sendAIMessage=async()=>{
  const input=document.getElementById('aiInput'),root=document.getElementById('chatBody');
  if(!input||!root)return;
  const question=input.value.trim();if(question.length<5)return;
  const add=(type,text)=>{const node=document.createElement('div');node.className='chat-msg '+type;node.textContent=text;root.append(node);root.scrollTop=root.scrollHeight;return node;};
  add('user',question);input.value='';const pending=add('bot','Đang tìm tài liệu đã xác minh...');
  try{
    const r=await fetch('/api/assistant/ask',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,domain:'SCAM'})});
    const d=await r.json();if(!r.ok)throw new Error(d.message||('HTTP '+r.status));
    pending.textContent=(d.answer?.summary||'Chưa có câu trả lời.')+'\n'+(d.answer?.warnings||[]).join(' ')+'\n'+(d.status==='AI_GENERATED'?'AI tổng hợp':'Chỉ truy xuất; chưa có nguồn hoặc chưa cấu hình AI.');
    if(d.evidence?.length){const note=add('bot','Nguồn: '+d.evidence.map(x=>x.sourceTitle+' ('+x.sourceStatus+')').join('; '));note.style.whiteSpace='pre-line';}
  }catch(e){pending.textContent='Chưa tra cứu được: '+(e.message||'Lỗi kết nối');}
};
// The SCAM search box belongs to gds-live.js. Do not redirect it to the assistant.
function install(){window.sendAIMessage=sendAIMessage;}
install();document.addEventListener('DOMContentLoaded',install);
})();
