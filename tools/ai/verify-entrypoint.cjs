'use strict';
// Non-mutating build-output preflight. Run after `npm run build`.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf8'));
const opts = cfg.compilerOptions || {};
if (opts.rootDir !== './src') throw Error('rootDir must be ./src');
if (opts.outDir !== './dist') throw Error('outDir must be ./dist');
if (opts.incremental !== true) throw Error('incremental must be true');
if (opts.tsBuildInfoFile !== './dist/tsconfig.tsbuildinfo') {
  throw Error('tsBuildInfoFile must be placed inside dist (not project root)');
}
const mainFile = path.join(root, 'dist', 'main.js');
if (!fs.existsSync(mainFile) || fs.statSync(mainFile).size === 0)
  throw Error('Missing dist/main.js; NestJS cannot start. Clean build required.');
console.log('BUILD ENTRYPOINT: PASS (dist/main.js, incremental cache in dist)');
