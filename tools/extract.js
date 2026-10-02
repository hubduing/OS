#!/usr/bin/env node
/* Recovers the JS + CSS from the last successful build.
   Use when a split goes wrong: the built single file is the source of truth.

   Usage:  node tools/extract.js                                               */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'nexus-os.html'), 'utf8');

// Any src/ sub-path, not just css/js: build.js prints the path relative to src/
// for whatever directory a file actually came from, and both now live in
// src/kernel. Hardcoding the two old names made the banner regex stop matching,
// so recovery silently kept the banners in the recovered files.
const BANNER = /\n\/\* ={60,}\n   [A-Z0-9 -]+\n   src\/[^ \n]+\n   ={60,} \*\/\n\n/g;
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
