(()=>{
'use strict';
function openAI(text){
  try{if(text)sessionStorage.setItem('gds_ai_next_question',String(text).slice(0,240));}catch{}
  location.assign('/tro-ly-ai.html');
}
// Replaces old inline mock alert without changing any of the user's visual layout.
const launchSearch=()=>{
  const input=document.getElementById('searchInput');
  const question=input?.value.trim()||'';
  if(question.length<5){input?.focus();alert('Hãy nhập câu hỏi từ 5 ký tự.');return;}
  openAI(question);
};
function install(){window.handleSearch=launchSearch;}
install();document.addEventListener('DOMContentLoaded',install);
document.addEventListener('click',e=>{
  const node=e.target?.closest?.('.ai-btn');
  if(!node)return;
  e.preventDefault();e.stopImmediatePropagation();openAI('');
},true);
const home=document.getElementById('searchInput');
if(home)home.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();window.handleSearch();}});
})();
