#!/usr/bin/env node
/* Prints the size of every source module so regressions in file size are
   visible at a glance.  Usage:  node tools/sizes.js  [--watch]              */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push({ p, bytes: st.size });
  }
  return out;
}

function report() {
  const rows = [];
  for (const sub of ['src/css', 'src/js']) {
    const dir = path.join(ROOT, sub);
    if (!fs.existsSync(dir)) continue;
    let subTotal = 0;
    for (const f of walk(dir)) {
      const lines = fs.readFileSync(f.p, 'utf8').split('\n').length;
      subTotal += lines;
      rows.push({ name: sub + '/' + path.relative(dir, f.p).split(path.sep).join('/'), lines });
    }
    rows.push({ name: '— ' + sub + ' total', lines: subTotal });
  }
  const shell = path.join(ROOT, 'src/shell.html');
  if (fs.existsSync(shell)) {
    rows.push({ name: 'src/shell.html', lines: fs.readFileSync(shell, 'utf8').split('\n').length });
  }
  const out = path.join(ROOT, 'nexus-os.html');
  if (fs.existsSync(out)) {
    const t = fs.readFileSync(out, 'utf8');
    rows.push({ name: 'nexus-os.html (built)', lines: t.split('\n').length });
    rows.push({ name: '  size', lines: (t.length / 1024).toFixed(1) + ' KB' });
  }

  const w = Math.max(...rows.map(r => r.name.length));
  console.log('module'.padEnd(w) + '   lines');
  console.log('-'.repeat(w + 8));
  for (const r of rows) console.log(r.name.padEnd(w) + '   ' + r.lines);
}

report();
if (process.argv.includes('--watch')) {
  setInterval(report, 1500);
  console.log('\n(watching for changes…)');
}
