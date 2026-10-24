'use strict';
// Static regression test for SQL Msg 130 and the localhost HTTP diagnostic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const sql = fs.readFileSync(path.join(root, 'sql', '13_ChanDoan_HTTP500_TrangCongKhai_READ_ONLY.sql'), 'utf8');
const api = fs.readFileSync(path.join(root, 'tools', 'diagnostics', 'check-public-api.cjs'), 'utf8');
assert.match(sql, /INTO\s+#gds_version_audit/i);
assert.match(sql, /SUM\(a\.eligible_published\)/i);
assert.doesNotMatch(sql, /SUM\s*\(\s*CASE\s+WHEN[\s\S]*?\bEXISTS\s*\(/i);
assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|ALTER)\s+(?:dbo\.|\[dbo\])/i);
assert.match(sql, /ERROR_MESSAGE\(\)/i);
assert.match(api, /BACKEND UNREACHABLE/);
assert.match(api, /GDS_DIAG_PORT/);
assert.match(api, /library-catalog\.json/);
console.log('PASS DIAGNOSTIC PATCH: separated SQL evaluation/aggregation, no persistent SQL writes, explicit local network diagnostics');
