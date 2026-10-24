// Offline, read-only static checks. Does not access SQL Server or the network.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const controller = read('src/admin/official-feed.controller.ts');
const service = read('src/admin/official-feed.service.ts');
const adminModule = read('src/admin/admin.module.ts');
const html = read('public/nguon-cong-bao-noi-bo.html');
const js = read('public/js/gds-official-feed-admin.js');
for (const [name, source] of [['controller', controller], ['service', service]]) {
  const output = ts.transpileModule(source, {
    fileName: name + '.ts', compilerOptions: { module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021, experimentalDecorators: true }, reportDiagnostics: true
  });
  assert.equal((output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
}
new Function(js);
assert(controller.includes('@UseGuards(AdminGuard)'), 'Routes must require server authentication');
assert(controller.includes("@Controller('api/admin/official-feed')"));
assert(controller.includes("'Cache-Control', 'no-store'"));
assert(adminModule.includes('OfficialFeedController') && adminModule.includes('OfficialFeedService'));
assert(service.includes('dbo.official_feed_entry') && service.includes('dbo.official_feed_snapshot'));
assert(service.includes('.input(\'needle\'') && service.includes('LIKE @needle'));
assert(service.includes('.input(\'id\'') && service.includes('WHERE id=@id'));
assert(/review_status/.test(service));
assert(!/\b(INSERT|UPDATE|DELETE|MERGE|EXEC)\s+/i.test(service.replace(/\bexecption\b/gi,'')), 'Admin RSS is read only');
assert(!/innerHTML|outerHTML|insertAdjacentHTML/.test(js), 'Never insert RSS text as HTML');
assert(js.includes("uri.hostname === 'congbao.chinhphu.vn'"));
assert(js.includes("a.rel = 'noopener noreferrer'"));
assert(html.includes('gds-official-feed-admin.js') && html.includes('gds-official-feed.css'));
assert(!/approve|publish/i.test(html), 'No approval or publication UI');
console.log('PASS RSS ADMIN: read-only SQL, guarded API, safe text DOM, verified source URL, static page');
