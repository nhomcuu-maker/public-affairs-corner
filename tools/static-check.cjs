const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const p = read('src/procedures/procedures.queries.ts');
const service = read('src/procedures/procedures.service.ts');
const preview = read('src/procedures/dev-preview.guard.ts');
for (const filter of [
  "editorial_status = N'published'", 'published_at IS NOT NULL',
  'withdrawn_at IS NULL', 'effective_from IS NOT NULL',
  'effective_to IS NULL', 'approved_by IS NOT NULL',
  'verification.decision IS NULL', "verification.decision <> N'accepted'",
]) assert.ok(p.includes(filter), `Missing public visibility predicate: ${filter}`);
assert.match(p, /WHERE ki\.business_code = @businessCode/);
assert.match(service, /input\('businessCode', sql\.NVarChar\(100\), businessCode\)/);
assert.match(preview, /NODE_ENV !== 'development'/);
assert.match(preview, /timingSafeEqual/);
assert.doesNotMatch(service, /INSERT INTO|UPDATE dbo|DELETE FROM/i);
console.log('PASS: public publish policy, parameterized detail lookup, protected local preview, read-only service');
