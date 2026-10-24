'use strict';
// Offline guard for the local public launch. No network or SQL writes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'public/bat-dau.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public/js/gds-start.js'), 'utf8');
const search = fs.readFileSync(path.join(root, 'public/js/gds-search.js'), 'utf8');
const province = fs.readFileSync(path.join(root, 'public/js/gds-locations.js'), 'utf8');
const home = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const ai = fs.readFileSync(path.join(root, 'public/js/gds-assistant.js'), 'utf8');
assert.match(home, /href="bat-dau\.html"/);
assert.match(page, /id="quickSearch"/);
assert.match(page, /id="province"/);
assert.match(page, /id="publicStatus"/);
assert.match(page, /dichvucong\.gov\.vn/);
assert.match(page, /vbpl\.vn/);
assert.match(page, /congbao\.chinhphu\.vn/);
assert.match(page, /baohiemxahoi\.gov\.vn/);
assert.doesNotMatch(js, /\/api\/admin\//);
assert.match(js, /\/api\/content\?domain=/);
assert.match(js, /\/api\/search\?/);
assert.match(js, /\/api\/locations\/provinces/);
assert.match(js, /\/api\/procedures\//);
assert.match(js, /credentials: 'omit'/);
assert.match(js, /textContent/);
assert.doesNotMatch(js, /\.innerHTML\s*=/);
assert.doesNotMatch(search, /\$\('mode'\)\.value='staff';\$\('domain'\)/);
assert.match(search, /mode==='public'/);
assert.match(province, /https:\/\/dichvucong\.gov\.vn\//);
assert.match(ai, /Keep the visitor's selected mode/);
for(const file of ['gds-start.js','gds-search.js','gds-locations.js']) {
  const code=fs.readFileSync(path.join(root,'public/js',file),'utf8');
  new vm.Script(code, {filename:file});
}
for(const asset of ['public/css/gds-start.css','public/js/gds-start.js','public/bat-dau.html'])
  assert.ok(fs.statSync(path.join(root,asset)).size > 50, asset);
console.log('PASS PUBLIC START: verified-only public APIs, province choice, official fallback links, public-mode examples, safe DOM, original homepage linked');
