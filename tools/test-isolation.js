// Asserts that a module cannot reach a kernel name it did not destructure from
// ctx.core. The bundle is one shared global scope, so `VFS.node(...)` written
// instead of `ctx.core.VFS.node(...)` works at runtime and nothing else in the
// repo would notice; this guard is what makes the contract real.
//
// Cases 1-3 run against throwaway module bodies, so they are unaffected by the
// state of src/js. Case 4 scans the real tree and prints how many modules it
// checked, so a refactor that quietly reduces that to zero is visible.
//
// Run:  node tools/test-isolation.js
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const manifestLib = require('./lib/manifest');
const { kernelNames, CTX_FILE: BOOT_FILE } = require('./lib/kernel-names');
const { declaredFrom, violations, staleNames } = require('./lib/isolation');

let failures = 0;
function check(n, what, fn) {
  try {
    fn();
    console.log('PASS ' + n + ' ' + what);
  } catch (e) {
    failures++;
    console.log('FAIL ' + n + ' ' + what + '\n      ' + (e && e.message ? e.message : e));
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const KERNEL = ['Audio2', 'VFS', 'LS', 'Wall'];

/* -- 1. a module reaching a kernel name directly is caught ----------------- */
check(1, 'VFS.node( without destructuring VFS is reported with file and line', () => {
  const body = [
    'function register(ctx) {',
    '  const { LS } = ctx.core;',
    '  const dir = VFS.node("/", "Desktop");',
    '  return { dir };',
    '}',
  ].join('\n');

  const found = violations(body, KERNEL, declaredFrom(body));
  const hits = found.filter(v => v.name === 'VFS');
  assert(hits.length === 1,
    'expected exactly one VFS hit, got ' + JSON.stringify(found));
  assert(hits[0].line === 3, 'hit was on line ' + hits[0].line + ', expected 3');
  assert(/VFS\.node/.test(hits[0].text), 'hit text was ' + hits[0].text);
});

/* -- 2. the same module, once it destructures VFS --------------------------- */
check(2, 'the same module passes after `const { VFS } = ctx.core`', () => {
  const body = [
    'function register(ctx) {',
    '  const { LS, VFS } = ctx.core;',
    '  const dir = VFS.node("/", "Desktop");',
    '  return { dir };',
    '}',
  ].join('\n');

  const found = violations(body, KERNEL, declaredFrom(body));
  assert(found.length === 0, 'expected no violations, got ' + JSON.stringify(found));
});

/* -- 3. the injected list must not contain a name that does not exist ------ */
check(3, 'a kernel name that exists nowhere in the tree is reported as stale', () => {
  const kernelText = 'const VFS={node(){}};\nconst LS={};\n';
  const stale = staleNames(['VFS', 'Nonexistent'], kernelText);
  assert(stale.length === 1 && stale[0] === 'Nonexistent',
    'stale was ' + JSON.stringify(stale));

  const clean = staleNames(['VFS', 'LS'], kernelText);
  assert(clean.length === 0, 'stale was ' + JSON.stringify(clean));
});

/* -- 4. the real tree ------------------------------------------------------ */
check(4, 'every collected module is checked against the real kernel list', () => {
  const names = kernelNames(ROOT);
  assert(names.length > 0, 'kernel-names returned nothing — the checker would pass vacuously');
  assert(names.includes('VFS') && names.includes('Audio2'),
    'expected real services in the list, got ' + names.length + ' names');

  const files = manifestLib.collect(ROOT);
  assert(files.length > 0, 'collect() returned no modules');

  // Group files by owning module id, the way the builder wraps them.
  const modules = new Map();
  for (const f of files) {
    if (!modules.has(f.id)) modules.set(f.id, []);
    modules.get(f.id).push(f);
  }

  // Every kernel name must actually appear in the kernel tree, or ctx.core
  // ships a permanently undefined property.
  const kernelText = files
    .filter(f => f.id === 'kernel' && !f.file.endsWith('00-kernel-ctx.js'))
    .map(f => fs.readFileSync(f.abs, 'utf8'))
    .join('\n');
  const stale = staleNames(names, kernelText);
  assert(stale.length === 0,
    'ctx.core would carry undefined names: ' + stale.join(', '));

  // Scan each module. Until Task 3 the kernel files are bare statements with no
  // ctx.core destructuring, so they legitimately reach every kernel name; there
  // is nothing for this to catch yet, and saying so plainly beats a green that
  // implies the tree was checked against a contract it does not have yet.
  let checked = 0;
  const undeclared = [];
  for (const [id, group] of modules) {
    const body = group.map(f => fs.readFileSync(f.abs, 'utf8')).join('\n');
    const given = declaredFrom(body);
    const found = violations(body, names, given);
    checked++;

    // A module that destructures is held to the contract. One that destructures
    // nothing is pre-conversion, and its references are expected.
    if (given.size === 0) continue;

    // Scanned per file, so a finding names the file it is in rather than an
    // offset into a concatenation of several.
    //
    // Only files that THEMSELVES destructure ctx.core are enforced. Until Task 3
    // the 33 kernel files are one shared scope that reaches each other's names
    // by design, and 02-storage legitimately calls VFS which 04-vfs defines.
    // Enforcing across the whole kernel module would report that pre-existing
    // coupling instead of the one thing this guard is for: a CONVERTED module
    // reaching a name its own destructuring line did not list. Task 3 gives each
    // kernel file its own register(), at which point every file is converted
    // and this filter stops hiding anything.
    for (const f of group) {
      if (f.file === BOOT_FILE) continue;
      const text = fs.readFileSync(f.abs, 'utf8');
      const ownGiven = declaredFrom(text);
      if (ownGiven.size === 0) continue;
      // The file's own destructuring PLUS the module's: a converted file may
      // destructure in one file of its folder and use in another, since they
      // share one scope. `register` is exempt per file, not per module.
      for (const v of violations(text, names, new Set([...given, ...ownGiven]))) {
        undeclared.push(f.id + '/' + f.file + ':' + v.line + ' -> ' + v.name);
      }
    }
  }
  assert(checked === modules.size, 'checked ' + checked + ' of ' + modules.size + ' modules');
  assert(undeclared.length === 0,
    'module reached a kernel name it did not destructure:\n        ' +
    undeclared.slice(0, 20).join('\n        '));

  const converted = [...modules.values()].filter(g =>
    declaredFrom(g.map(f => fs.readFileSync(f.abs, 'utf8')).join('\n')).size > 0).length;
  console.log('      modules checked: ' + checked + '/' + modules.size +
    '  kernel names: ' + names.length +
    '  converted: ' + converted +
    (converted === 0 ? ' (none destructure ctx.core yet, so nothing to enforce)' : ''));
});

if (failures) {
  console.log('\n' + failures + ' case(s) failed');
  process.exitCode = 1;
} else {
  console.log('\n4/4 isolation cases pass');
}
