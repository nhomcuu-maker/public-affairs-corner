'use strict';
// Read-only connectivity check for local Ollama. It does not send citizen questions or credentials.
const base='http://127.0.0.1:11434';
(async()=>{
 const model=process.env.AI_MODEL||'llama3.2:3b';
 try{
  const r=await fetch(base+'/api/tags',{signal:AbortSignal.timeout(9000)});
  if(!r.ok)throw Error('HTTP '+r.status);
  const j=await r.json(),names=(j.models||[]).map(x=>x.name);
  console.log('Ollama: CONNECTED');console.log('Model can kiem tra: '+model);
  console.log('Danh sach model: '+names.join(', '));
  if(!names.includes(model)){
    console.error('MODEL CHUA CO. Tren may cua ban hay chay: ollama pull '+model);
    process.exitCode=1;
  }else console.log('MODEL FOUND: PASS');
 }catch(e){console.error('Khong ket noi duoc Ollama tai '+base+': '+e.message);process.exitCode=1;}
})();
