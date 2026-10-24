// Public read-only HTTP diagnostics. Does not connect directly to SQL Server.
'use strict';

const port = process.env.GDS_DIAG_PORT || process.env.PORT || '3001';
if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error('INVALID PORT: set GDS_DIAG_PORT to a number between 1 and 65535.');
  process.exit(2);
}
const base = `http://127.0.0.1:${Number(port)}`;
const checks = [
  '/library-catalog.json',             // Static file; no SQL read required.
  '/api/health',                   // NestJS + live SQL query.
  '/api/content?domain=ADMIN',
  '/api/procedures',
  '/api/content?domain=LEGAL',
  '/api/content?domain=ADMIN&q=' + encodeURIComponent('học tập'),
  '/api/content?domain=LEGAL&q=' + encodeURIComponent('bảo hiểm'),
];

async function check(endpoint) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(base + endpoint, { signal: controller.signal });
    const body = (await response.text()).slice(0, 350).replace(/\s+/g, ' ');
    console.log(`${response.status} ${endpoint} | ${body}`);
    return response.ok;
  } catch (error) {
    const code = error?.cause?.code || error?.code || (controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR');
    console.log(`NO HTTP RESPONSE ${endpoint} | ${code} | ${error.message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

(async () => {
  console.log(`PUBLIC API DIAGNOSTIC TARGET: ${base}`);
  const staticOk = await check(checks[0]);
  if (staticOk === null) {
    console.error('BACKEND UNREACHABLE: no HTTP response from localhost.');
    console.error('Open another PowerShell window in the project folder and run: npm run dev');
    console.error('Wait for "Website: http://127.0.0.1:<port>/" before rerunning this diagnostic.');
    console.error('If your server uses a different port, set GDS_DIAG_PORT accordingly.');
    process.exitCode = 1;
    return;
  }
  let failed = staticOk ? 0 : 1;
  for (const endpoint of checks.slice(1)) {
    const ok = await check(endpoint);
    if (ok !== true) failed++;
  }
  if (failed) {
    console.error(`PUBLIC API DIAGNOSTIC: ${failed} endpoint(s) failed.`);
    console.error('If static file is 200 but /api/health fails, inspect the NestJS terminal and SQL configuration.');
    console.error('If health is 200 but /api/content or filtered queries return 500, capture the NestJS SQL error (no passwords).');
    process.exitCode = 1;
  } else {
    console.log(`PUBLIC API DIAGNOSTIC: all ${checks.length} endpoints OK.`);
  }
})().catch(error => {
  console.error('DIAGNOSTIC ERROR:', error.message);
  process.exitCode = 1;
});
