// Unit cases for the kernel return-list parity check — the one build.js --check
// runs on every build and that `npm test` could not reach.
//
// Two lists state the same fact and both are written by hand: the injected
// KERNEL_NAMES scan in tools/lib/kernel-names.js, and the `return { ... }`
// literal at the bottom of the last kernel file, which IS ctx.core. Until these
// cases existed the only place the two were compared was the builder, which
// means the one check that has to catch a silent ctx.core regression had no
// test of its own and would rot the first time it was edited.
//
// Both directions are failures and both need a case:
//   - declared at column 0, absent from the return list -> ctx.core is missing
//     a service, and the browser finds out when an app calls it;
//   - present in the return list, declared nowhere -> a typo that ships as a
//     permanently undefined ctx.core property, or throws inside register().
//
// Run:  node tools/test-kernel-names.js
'use strict';

const fs = require('fs');
const path = require('path');

const manifest = require('./lib/manifest');
const { kernelNames, returnedNames, returnParity, describeParity, CTX_FILE } = require('./lib/kernel-names');

const ROOT = path.resolve(__dirname, '..');

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
function assertThrows(fn, re, what) {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  assert(err, what + ': nothing was thrown');
  assert(re.test(err.message), what + ': message was ' + JSON.stringify(err.message));
  return err;
}

/* The kernel module's concatenated source, minus the bootstrap — the same
   string build.js hands to returnedNames(). */
function kernelBody() {
  const loaded = manifest.load(ROOT);
  return manifest.collect(ROOT)
    .filter(f => f.dir === loaded.kernel.dir && f.file !== CTX_FILE)
    .map(f => fs.readFileSync(f.abs, 'utf8').replace(/\s*$/, ''))
    .join('\n\n');
}

/* -- 1. the real tree agrees, and neither list is empty ---------------------- */
check(1, 'the real kernel return list and the real KERNEL_NAMES scan agree', () => {
  const names = kernelNames(ROOT);
  const returned = returnedNames(kernelBody());
  assert(names.length > 0, 'kernel-names returned nothing — this case would be vacuous');
  assert(returned.length > 0, 'returnedNames returned nothing — this case would be vacuous');

  const p = returnParity(names, returned);
  assert(p.missing.length === 0 && p.extra.length === 0,
    describeParity(names, p));

  // Set equality, not just "no findings": a duplicate key would pass the above.
  assert(new Set(returned).size === returned.length,
    'the return list repeats a name: ' + returned.length + ' entries, ' +
      new Set(returned).size + ' distinct');
});

/* -- 2. direction 1: declared and not returned ------------------------------ */
check(2, 'a name the kernel declares but does not return is a failure', () => {
  const names = ['Alpha', 'Beta', 'Gamma'];
  const returned = ['Alpha', 'Gamma'];

  const p = returnParity(names, returned);
  assert(p.missing.length === 1 && p.missing[0] === 'Beta',
    'missing was ' + JSON.stringify(p.missing));
  assert(p.extra.length === 0, 'extra was ' + JSON.stringify(p.extra));

  const msg = describeParity(names, p);
  assert(/Beta/.test(msg), 'the message does not name the gap: ' + msg);
  assert(/ABSENT/.test(msg), 'the message does not say which direction failed: ' + msg);
});

/* -- 3. direction 2: returned and not declared ------------------------------ */
check(3, 'a name the kernel returns but never declares is a failure', () => {
  const names = ['Alpha', 'Beta', 'Gamma'];
  const returned = ['Alpha', 'Beta', 'Gamma', 'NotAThing'];

  const p = returnParity(names, returned);
  assert(p.extra.length === 1 && p.extra[0] === 'NotAThing',
    'extra was ' + JSON.stringify(p.extra));
  assert(p.missing.length === 0, 'missing was ' + JSON.stringify(p.missing));

  const msg = describeParity(names, p);
  assert(/NotAThing/.test(msg), 'the message does not name the typo: ' + msg);
  assert(/declared nowhere/.test(msg), 'the message does not say which direction failed: ' + msg);
});

/* -- 4. the check refuses to guess ----------------------------------------- */
check(4, 'an unreadable return list throws instead of comparing equal to nothing', () => {
  // No `return {` at all: an empty result would compare equal to an empty
  // KERNEL_NAMES and the check would pass on a kernel that exports nothing.
  assertThrows(() => returnedNames('const VFS={};'),
    /no `return \{`/, 'no return literal');

  // A return that is never closed: the same silence, differently shaped.
  assertThrows(() => returnedNames('function register(){ return { Alpha,'),
    /never closed/, 'unclosed return literal');

  // An entry it cannot read a name from — a spread or a computed key. This list
  // must be a plain list of identifiers, so it is a build error.
  assertThrows(() => returnedNames('function register(){ return { Alpha, ...rest }; }'),
    /cannot read a name/, 'spread entry');

  // …while the two shapes that ARE legal both parse.
  assert(returnedNames('function register(){ return { Alpha }; }')[0] === 'Alpha',
    'a bare NAME shorthand did not parse');
  assert(returnedNames('function register(){ return { Alpha: 1, Beta: 2 }; }').join(',') === 'Alpha,Beta',
    '`NAME: expr` did not parse');
  // A trailing comma is legal JS and this list is hand-written across 20 lines.
  assert(returnedNames('function register(){ return { Alpha, Beta, }; }').join(',') === 'Alpha,Beta',
    'a trailing comma was not tolerated');
  // A brace inside a string is not a brace: this is the one that decides whether
  // the literal can be split on top-level commas at all.
  assert(returnedNames('function register(){ return { Alpha, Beta: "}, {" }; }').join(',') === 'Alpha,Beta',
    'a brace inside a string literal broke the split');
});

if (failures) {
  console.log('\n' + failures + ' case(s) failed');
  process.exitCode = 1;
} else {
  console.log('\n4/4 kernel-names cases pass');
}
