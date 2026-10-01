#!/usr/bin/env node
/* Recovers src/js + src/css from the last successful build.
   Use when a split goes wrong: the built single file is the source of truth.

   Usage:  node tools/extract.js                                               */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'nexus-os.html'), 'utf8');

const BANNER = /\n\/\* ={60,}\n   [A-Z0-9 -]+\n   src\/(css|js)\/[^ \n]+\n   ={60,} \*\/\n\n/g;
const STAMP = /<!-- Built by build\.js[^>]*-->\n/g;

function extract(re, label) {
  const m = html.match(re);
  if (!m) throw new Error(`no <${label}> block found`);
  return m[1].replace(BANNER, '\n\n').replace(STAMP, '');
}

const js = extract(/<script>([\s\S]*?)<\/script>/, 'script');
const css = extract(/<style>([\s\S]*?)<\/style>/, 'style');

const clean = t => {
  const L = t.split('\n');
  while (L.length && !L[L.length - 1].trim()) L.pop();
  return L;
};

fs.writeFileSync(path.join(ROOT, 'tools', '.recovered-js.txt'), clean(js).join('\n'), 'utf8');
fs.writeFileSync(path.join(ROOT, 'tools', '.recovered-css.txt'), clean(css).join('\n'), 'utf8');
console.log('recovered js', clean(js).length, 'lines; css', clean(css).length, 'lines');
