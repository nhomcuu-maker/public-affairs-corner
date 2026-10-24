'use strict';
// Source readiness: read-only HTTP diagnostics for public evidence readiness.
// Does not sign in, upload files, mutate data, or use an AI API key.
const base = (process.env.GDS_BASE_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
const questions = [
  {name: 'BENEFIT + ADMIN', text: 'Toi vua nghi viec co duoc huong tro cap that nghiep khong?', domains: ['LEGAL','ADMIN']},
  {name: 'SCAM + BHXH', text: 'Co nguoi gia danh BHXH doi chuyen tien va ma OTP, toi phai lam gi?', domains: ['SCAM']},
];
let hardErrors = 0;
let pending = 0;
function note(level, name, detail) { console.log(`${level} ${name}: ${detail}`); }
async function request(route, body) {
  const res = await fetch(base + route, { method: body ? 'POST' : 'GET',
    headers: {Accept: 'application/json', ...(body ? {'Content-Type':'application/json'} : {})},
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(12000) });
  const data = await res.json().catch(() => null);
  return {status: res.status, data};
}
async function main() {
  const health = await request('/api/health');
  if (health.status !== 200) throw new Error('Backend health HTTP ' + health.status);
  note('PASS', 'Backend', 'HTTP 200');
  for (const item of questions) {
    const r = await request('/api/assistant/ask', {question:item.text});
    if (r.status !== 200 || !r.data || !Array.isArray(r.data.evidence) || !r.data.answer) {
      note('ERROR', item.name, 'Assistant response missing or HTTP ' + r.status);
      hardErrors++; continue;
    }
    const x = r.data;
    const evidence = x.evidence;
    const domains = [...new Set(evidence.map(e => e.domain))];
    const expected = item.domains.every(d => domains.includes(d));
    const valid = evidence.every(e => e.editorialStatus === 'published' && e.sourceStatus === 'accepted' &&
      typeof e.sourceUrl === 'string' && e.sourceUrl.startsWith('https://'));
    const citationIds = Array.isArray(x.answer.citationIds) ? x.answer.citationIds : [];
    const knownIds = new Set(evidence.map(e => e.id));
    const citationsValid = citationIds.every(id => knownIds.has(id));
    const warnings = Array.isArray(x.answer.warnings) ? x.answer.warnings.join(' ') : '';
    const safety = !item.name.startsWith('SCAM') || (/otp/i.test(warnings) && /chuy.n ti.n/i.test(warnings));
    note('INFO', item.name, `status=${x.status}; evidence=${evidence.length}; domains=${domains.join(',') || 'none'}; citations=${citationIds.length}; AI=${x.modelActive === true}`);
    if (!valid || !citationsValid || !safety) {
      note('ERROR', item.name, `evidenceValid=${valid}; citationsValid=${citationsValid}; safetyWarning=${safety}`);
      hardErrors++; continue;
    }
    if (!evidence.length || !expected || !citationIds.length) {
      note('PENDING', item.name, 'Missing published, accepted evidence for all required domains');
      pending++;
    } else note('PASS', item.name, 'Published evidence and citations ready for human content review');
  }
  for (const d of ['LEGAL','ADMIN','SCAM']) {
    const r = await request('/api/search?q=' + encodeURIComponent(d === 'SCAM' ? 'gia danh BHXH' : 'tro cap that nghiep') + '&domain=' + d);
    if (r.status !== 200 || !r.data || !Array.isArray(r.data.results) || !Array.isArray(r.data.related)) {
      note('ERROR', 'Search ' + d, 'HTTP ' + r.status); hardErrors++; continue;
    }
    const result = r.data.results;
    const clean = result.every(x => x.domain === d && x.editorialStatus === 'published');
    note(clean ? 'PASS' : 'ERROR', 'Search ' + d, `publicResults=${result.length}; publishedOnly=${clean}`);
    if (!clean) hardErrors++;
  }
  console.log(`\nSOURCE READINESS: ${hardErrors} ERROR, ${pending} PENDING scenario(s).`);
  console.log(hardErrors ? 'ACTION: fix safety/visibility/API error before demo.' :
    pending ? 'ACTION: inspect SQL report, verify source snapshots and follow review/publish workflow.' :
    'ACTION: manually verify legal correctness, dates, and locale before claiming demo is ready.');
  if (hardErrors) process.exitCode = 1;
}
main().catch(err => { console.error('ERROR source readiness connectivity:',err.message); process.exitCode = 1; });
