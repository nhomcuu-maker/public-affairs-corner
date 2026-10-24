'use strict';
const fs=require('node:fs'), path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
// Skip third-party environments and generated build folders, which may
// legitimately contain package names such as `step3p7`.
const ignores=new Set([
  'node_modules','dist','.git','build','coverage','.next','.turbo',
  '__pycache__','.pytest_cache','.mypy_cache','.ruff_cache','.cache',
  '.tox','.nox','.idea','.vscode',
]);
const virtualEnvName = name => /^(?:\.venv|venv|env)(?:[-_.].*)?$/i.test(name);
let inspected=0,refs=0;
function scan(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  if(ent.isSymbolicLink())continue; // avoid scanning paths outside this project
  if(ent.isDirectory() && (ignores.has(ent.name) || virtualEnvName(ent.name)))continue;
  const p=path.join(dir,ent.name),rel=path.relative(root,p).split(path.sep).join('/');
  assert(!/(?:buoc|bước|step\d+)/i.test(ent.name),'Outdated file name: '+rel);
  if(ent.isDirectory())scan(p);else inspected++;
}}
scan(root);
for(const file of fs.readdirSync(path.join(root,'public')).filter(x=>x.endsWith('.html'))){
  const markup=fs.readFileSync(path.join(root,'public',file),'utf8');
  for(const m of markup.matchAll(/(?:src|href)=["']\/(css|js)\/([^"'?\s]+)["']/gi)){
   assert(fs.existsSync(path.join(root,'public',m[1],m[2])),'Broken asset on '+file+': '+m[0]);refs++;
  }
}
// A user's local .env is expected after setup; verify only the public tree excludes it.
assert(!fs.existsSync(path.join(root,'public','.env')),'Never publicly expose .env');
console.log('PASS: '+inspected+' source/data files have functional names; '+refs+' frontend assets resolve; no secrets under public/');
