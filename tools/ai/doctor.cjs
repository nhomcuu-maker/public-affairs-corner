'use strict';
// Read-only checks; secrets and user questions are never printed.
const api = process.argv.includes('--api');
const modelTest = process.argv.includes('--model-test');
const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
const model = process.env.AI_MODEL || '';
const base = process.env.AI_BASE_URL || (provider === 'ollama' ? 'http://127.0.0.1:11434/v1' : 'https://api.openai.com/v1');
const key = provider === 'ollama' ? 'ollama' : process.env.AI_API_KEY;
const fail = message => { console.error('AI DOCTOR FAIL: ' + message); process.exitCode = 1; };
function errorText(error) {
  const name = error && typeof error.name === 'string' ? error.name : 'Error';
  const detail = error && typeof error.message === 'string' ? error.message : String(error);
  const cause = error && error.cause;
  const code = cause && typeof cause.code === 'string' ? cause.code : '';
  const causeMessage = cause && typeof cause.message === 'string' ? cause.message : '';
  return [name + ': ' + detail, code, causeMessage].filter(Boolean).join(' | ').slice(0, 320);
}
async function safeFetch(label, url, options) {
  try { return await fetch(url, options); }
  catch (e) { throw Error(label + ' ' + errorText(e)); }
}
async function healthDiagnostics(prefix, origin) {
  for (const [label, address] of [['NestJS', prefix + '/api/health'], ...(provider === 'ollama' ? [['Ollama', origin + '/api/tags']] : [])]) {
    try {
      const response = await safeFetch(label, address, {signal:AbortSignal.timeout(5000)});
      console.log('AI DIAG ' + label + ': HTTP ' + response.status);
    } catch (e) { console.error('AI DIAG ' + label + ': ' + errorText(e)); }
  }
}
async function probeModel(origin) {
  if (provider !== 'ollama') return console.log('AI MODEL PROBE: Skipped for remote provider');
  console.log('OLLAMA LIVE MODEL: testing short inference (first load may take time)...');
  const response = await safeFetch('Ollama inference', origin + '/api/generate', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({model, prompt:'Return the word OK.', stream:false, options:{num_predict:24,temperature:0}}),
    signal: AbortSignal.timeout(120000)
  });
  if (!response.ok) throw Error('Ollama inference HTTP ' + response.status + '. Check Ollama logs and available RAM.');
  const payload = await response.json();
  if (!payload || typeof payload.response !== 'string' || !payload.response.trim())
    throw Error('Ollama inference returned no generated text.');
  console.log('OLLAMA LIVE MODEL: PASS (generated text present; content not evaluated)');
}
async function main(){
  if (!model || !key) return fail('AI model/key chua duoc cau hinh. Chay tools/ai/start-gds.ps1.');
  const url = new URL(base.replace(/\/+$/, '') + '/chat/completions');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1','localhost','::1'].includes(url.hostname)))
    return fail('AI_BASE_URL must be HTTPS, or localhost for Ollama.');
  console.log('AI PROVIDER: ' + provider + '; model=' + model + '; address=' + url.origin + ' (secret not displayed)');
  if (provider === 'ollama') {
    const response = await safeFetch('Ollama tags', url.origin + '/api/tags', {signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw Error('Ollama /api/tags HTTP ' + response.status);
    const body = await response.json();
    const found = (body.models || []).some(item => item.name === model || item.model === model);
    if (!found) return fail('Model ' + model + ' not installed. Run: ollama pull ' + model);
    console.log('AI LOCAL MODEL: INSTALLED');
  }
  if (modelTest) { await probeModel(url.origin); if (!api) return; }
  if (!api) return console.log('AI CONFIG: PASS. Use --model-test to verify model generation; --api for website E2E.');
  const prefix = (process.env.GDS_BASE_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
  try {
    const health = await safeFetch('NestJS health', prefix + '/api/health', {signal:AbortSignal.timeout(8000)});
    if (!health.ok) throw Error('/api/health HTTP ' + health.status);
    const status = await safeFetch('NestJS AI status', prefix + '/api/assistant/status', {signal:AbortSignal.timeout(8000)});
    if (!status.ok) throw Error('/api/assistant/status HTTP ' + status.status);
    const config = await status.json();
    console.log('BACKEND AI STATUS: ' + JSON.stringify(config));
    if (!config.configured) throw Error('Backend process has not inherited AI environment variables; restart using start-gds.ps1.');
    const started = Date.now();
    console.log('AI END TO END: sending a real question to backend; Ollama on CPU may take up to 3 minutes...');
    const response = await safeFetch('NestJS assistant POST', prefix + '/api/assistant/ask', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({question:'Toi nghi viec, can hoi o dau de kiem tra ho so va quyen loi that nghiep?',domain:'ALL'}),
      signal:AbortSignal.timeout(210000)
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw Error('/api/assistant/ask HTTP ' + response.status + ' ' + String(data.message || ''));
    console.log('AI END TO END: status=' + data.status + ', modelActive=' + data.modelActive + ', evidence=' + (Array.isArray(data.evidence) ? data.evidence.length : 0) + ', elapsed=' + Math.round((Date.now()-started)/1000) + 's');
    if (data.status !== 'AI_GENERATED' || data.modelActive !== true) {
      fail('Provider did not generate a grounded answer. ' + String(data.notice || '').slice(0, 180));
      if (provider === 'ollama') console.error('Next: node tools/ai/doctor.cjs --model-test (with AI_PROVIDER and AI_MODEL set). Inspect the NestJS CMD log.');
      return;
    }
    if (!data.answer || typeof data.answer.summary !== 'string' || !data.answer.summary.trim())
      return fail('Model returned no usable answer.');
    if (Array.isArray(data.evidence) && data.evidence.length > 0 && !(data.answer.citationIds || []).length)
      return fail('Model used evidence but did not cite it.');
    const refusalResponse = await safeFetch('Out-of-scope routing', prefix + '/api/assistant/ask', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({question:'Cach nau bun ca ngon nhat la gi?',domain:'ALL'}),
      signal:AbortSignal.timeout(15000)
    });
    const refusal = await refusalResponse.json();
    if (!refusalResponse.ok || refusal.status !== 'OUT_OF_SCOPE')
      return fail('Domain filter test failed; an out-of-scope question was not rejected.');
    console.log('AI DOMAIN GATE: PASS (outside questions rejected)');
    console.log('AI END TO END: PASS (real inference returned; accuracy not verified).');
  } catch (error) {
    fail(errorText(error));
    await healthDiagnostics(prefix, url.origin);
    console.error('If NestJS health fails, inspect CMD log for a crash/restart. If Ollama health fails, check Ollama. If both work, inspect backend timeout and response parsing.');
  }
}
main().catch(error => fail(errorText(error)));
