#!/usr/bin/env node
/* Find calls to the el() helper whose third argument is a function.
 *
 * el(t, c, p) appends to a parent element: `el=(t,c,p)=>{...if(p)p.appendChild(e)}`.
 * Passing an onClick handler in that slot is a type error at runtime
 * ("p.appendChild is not a function"), and it fires only when the code path runs,
 * so these hide until someone clicks the control.
 */
const fs = require('fs');
const path = require('path');
const manifest = require('./lib/manifest');

// Manifest-driven, like every other reader of the kernel tree: it moved from
// src/js to src/kernel, and a literal path here meant readdirSync on a path
// that no longer existed.
const SRC = path.join(__dirname, '..', manifest.load().kernel.dir);
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.js'));

if (!files.length) {
  console.error('audit-el-args: nothing to audit - ' + SRC + ' holds no .js');
  process.exit(1);
}

function args(src, open) {
  let depth = 0, i = open, inStr = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inStr) { if (ch === '\\') i++; else if (ch === inStr) inStr = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') { depth--; if (depth === 0) break; }
  }
  const body = src.slice(open + 1, i);
  if (!body.trim()) return [];
  const parts = []; depth = 0; inStr = null; let cur = '';
  for (let k = 0; k < body.length; k++) {
    const ch = body[k];
    if (inStr) { cur += ch; if (ch === '\\') cur += body[++k] || ''; else if (ch === inStr) inStr = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}

const bad = [];
for (const file of files) {
  const src = fs.readFileSync(path.join(SRC, file), 'utf8');
  const re = /(?<![.\w$])el\(/g;
  let m;
  while ((m = re.exec(src))) {
    // skip declarations and member calls like qs.el(
    const before = src.slice(Math.max(0, m.index - 2), m.index);
    if (before.endsWith('.') || /[A-Za-z0-9_$]$/.test(before)) continue;
    const open = m.index + 2;
    const a = args(src, open);
    const third = a[2];
    if (!third) continue;
    const looksFn = /^(\(|function\b|async\b|[A-Za-z_$][\w$]*\s*=>)/.test(third);
    if (!looksFn) continue;
    const line = src.slice(0, m.index).split('\n').length;
    bad.push({ file, line, call: 'el(' + a[0] + ',' + a[1] + ',' + third.slice(0, 42).replace(/\s+/g, ' ') + (third.length > 42 ? '…' : '') + ')' });
  }
}
if (bad.length) {
  console.log(`${bad.length} call(s) pass a function where el() expects a parent element:\n`);
  bad.forEach(b => console.log(`  ${b.file}:${b.line}  ${b.call}`));
} else {
  console.log('el() argument audit: ok — no handler passed in the parent slot');
}