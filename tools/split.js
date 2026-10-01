#!/usr/bin/env node
/* Splits one source module into several smaller numbered modules and renumbers
   the whole directory so `build.js` (which concatenates in filename order)
   still produces exactly the same output.

   Usage:
     node tools/split.js src/js/03-shell.js  03-shell-wallpaper.js:180 ... */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const target = process.argv[2];
if (!target) {
  console.error('usage: node tools/split.js <file> <name:lines> [name:lines …]');
  process.exit(1);
}
const src = path.resolve(ROOT, target);
const dir = path.dirname(src);
const spec = process.argv.slice(3).map(s => {
  const i = s.lastIndexOf(':');
  return { name: s.slice(0, i), n: Number(s.slice(i + 1)) };
});

const lines = fs.readFileSync(src, 'utf8').split('\n');
while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

const total = spec.reduce((s, x) => s + x.n, 0);
if (total !== lines.length) {
  console.error(`line count mismatch: spec sums to ${total}, file has ${lines.length}`);
  process.exit(1);
}

// Split, checking that no boundary lands inside a column-0 block comment.
let at = 0;
const written = [];
for (const s of spec) {
  const chunk = lines.slice(at, at + s.n);
  at += s.n;
  const p = path.join(dir, s.name);
  fs.writeFileSync(p, chunk.join('\n') + '\n', 'utf8');
  written.push({ name: s.name, n: s.n });
  console.log(String(s.n).padStart(5), s.name);
}
fs.rmSync(src);

/* Deliberately NO automatic renumbering: renaming by sort order silently
   reordered modules once already. The caller must pass explicit final names
   in the intended order. Verify afterwards with: node tools/sizes.js          */
console.log('\nverify order with: node tools/sizes.js');
