// Asserts that a module cannot reach a kernel name it did not destructure from
// ctx.core. The bundle is one shared global scope, so `VFS.node(...)` written
// instead of `ctx.core.VFS.node(...)` works at runtime and nothing else in the
// repo would notice; this guard is what makes the contract real.
//
// Cases 1-3 and 5 run against throwaway module bodies, so they are unaffected by
// the state of the kernel tree. Case 4 scans the real tree and prints how many
// modules it checked and how many are converted, so a refactor that quietly
// reduces that to zero is visible.
//
// The kernel is exempt from this contract, and case 4 says so in its own
// comments rather than leaving it to be inferred: the kernel is ONE module with
// ONE register() sharing ONE lexical scope, so it reaches its own names lexically
// and is forbidden from reading ctx.core at all. `node build.js --check` is what
// enforces that side. This guard is for packages and apps, which are the modules
// that DO hand themselves names by destructuring.
//
// Run:  node tools/test-isolation.js
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const manifestLib = require('./lib/manifest');
const { kernelNames, CTX_FILE: BOOT_FILE } = require('./lib/kernel-names');
const { declaredFrom, destructures, violations, staleNames, ctxCoreReads } = require('./lib/isolation');

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

  // Scan each module. A module that hands itself kernel names by destructuring
  // ctx.core is held to the contract: it must not reach a name its own
  // destructuring line did not list. A module that destructures nothing is
  // pre-conversion, and its references are expected.
  let checked = 0;
  const undeclared = [];
  for (const [id, group] of modules) {
    const body = group.map(f => fs.readFileSync(f.abs, 'utf8')).join('\n');
    const given = declaredFrom(body);
    checked++;

    if (!destructures(body)) continue;

    // Scanned per file, so a finding names the file it is in rather than an
    // offset into a concatenation of several.
    //
    // Only files that THEMSELVES destructure ctx.core are enforced. The kernel
    // files are ONE module with ONE register() sharing one lexical scope, so
    // they reach each other's names by design and none of them destructures
    // ctx.core at all - build.js --check FAILS the build if a kernel file reads
    // it. Enforcing them here would report exactly the coupling that ruling
    // preserves. So the kernel is exempt from this guard, and the exemption is
    // stated rather than implied by a filter: the kernel's contract is "no
    // ctx.core read, and return every name you declare", and both halves are
    // enforced in build.js --check — the first by the ctx-core-read scan, the
    // second by returnedNames() comparing the hand-written return list against
    // this very KERNEL_NAMES list.
    for (const f of group) {
      if (f.file === BOOT_FILE) continue;
      const text = fs.readFileSync(f.abs, 'utf8');
      if (!destructures(text)) continue;
      // The file's own destructuring PLUS the module's: a converted file may
      // destructure in one file of its folder and use in another, since they
      // share one scope. `register` is exempt per file, not per module.
      const ownGiven = declaredFrom(text);
      for (const v of violations(text, names, new Set([...given, ...ownGiven]))) {
        undeclared.push(f.id + '/' + f.file + ':' + v.line + ' -> ' + v.name);
      }
    }
  }
  assert(checked === modules.size, 'checked ' + checked + ' of ' + modules.size + ' modules');
  assert(undeclared.length === 0,
    'module reached a kernel name it did not destructure:\n        ' +
    undeclared.slice(0, 20).join('\n        '));

  // A module counts as converted once it declares a register(), which is what
  // the builder's wrapper requires. The kernel is one module and counts once
  // however many files it spans.
  const converted = [...modules.values()].filter(g =>
    /(?:^|[^\w.$])(?:function\s+register\b|(?:const|let|var)\s+register\s*=|register\s*\(\s*ctx\s*\)\s*\{)/m
      .test(g.map(f => fs.readFileSync(f.abs, 'utf8')).join('\n'))).length;
  console.log('      modules checked: ' + checked + '/' + modules.size +
    '  kernel names: ' + names.length +
    '  converted: ' + converted +
    (converted === 0 ? ' (no module declares a register yet)' : ''));
});

/* -- 5. I3: a kernel file must not read ctx.core ----------------------------- */
check(5, 'a ctx.core read is located in a kernel body, and prose is not a read', () => {
  // The kernel is ONE module with ONE register() sharing ONE scope, and ctx.core
  // is not open until the whole kernel has registered, so a kernel file that
  // destructures it either throws at boot or reads a half-built core. build.js
  // runs this over every kernel file.
  const bad = [
    'function register(ctx) {',
    '  // the kernel must never read ctx.core, even to check',
    '  const { VFS } = ctx.core;',
    '  return { VFS };',
    '}',
  ].join('\n');

  const found = ctxCoreReads(bad);
  assert(found.length === 1,
    'expected exactly one read, got ' + JSON.stringify(found));
  assert(found[0].line === 3, 'read was on line ' + found[0].line + ', expected 3');
  assert(/const \{ VFS \} = ctx\.core/.test(found[0].text),
    'read text was ' + found[0].text);

  // A file that only MENTIONS ctx.core in a banner, or in a quoted selector, is
  // not a violation - otherwise the rule could not be written down anywhere.
  const clean = [
    '/* ctx.core is assembled from the kernel exports. */',
    'const SEL = "div.ctx.core-marker";   // literal, not a read',
    'const w = VFS.node("/", "Desktop");',
  ].join('\n');
  assert(ctxCoreReads(clean).length === 0,
    'prose was reported as a read: ' + JSON.stringify(ctxCoreReads(clean)));
});

if (failures) {
  console.log('\n' + failures + ' case(s) failed');
  process.exitCode = 1;
} else {
  console.log('\n5/5 isolation cases pass');
}
