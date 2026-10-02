// Exercises the real module bootstrap - src/kernel/00-kernel-ctx.js, the shipped
// file, not a paraphrase of it - inside a vm sandbox, the way the bundle runs.
//
// The bootstrap is where the module contract lives, and two of its guarantees
// are only observable at runtime: ctx.core must not hand out a half-built
// object, and `use` must survive being destructured. Both used to fail
// silently, so both are pinned here.
//
//   ctx.core used to memoise on first read with no invalidation, while the
//   wrapper fills KERNEL_CTX.registry only AFTER register() returns. A single
//   `const { VFS } = ctx.core` inside a module's own register() therefore
//   assembled a core out of an empty registry, froze {}, and every later module
//   inherited it. Nothing threw anywhere.
//
//   use() read `this.__deps`, so the natural `const { use } = ctx` - the exact
//   shape this whole refactor teaches - died with "Cannot read properties of
//   undefined" instead of the specified error.
//
// Run:  node tools/test-kernel-ctx.js
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const manifest = require('./lib/manifest');
const { kernelNames, CTX_FILE, INJECT_MARK, INJECT_IDS_MARK } = require('./lib/kernel-names');

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

/* Load the shipped bootstrap with both literals injected, exactly as build.js
   does, and hand back its KERNEL_CTX.

   The injection uses replacer FUNCTIONS, like the builder: in a string
   replacement `$$` means a literal `$`, which would quietly rename the `$$`
   query helper in the fixture below.

   The bootstrap declares its plumbing with top-level `const`, so a vm context
   does NOT carry it out on the context object - that is the same fact the
   builder refuses to paper over by reading globalThis. The appended line
   publishes it instead, which also proves the file still works as a plain
   script. */
function bootstrap(names, ids) {
  const dir = manifest.load(ROOT).kernel.dir;
  const src = fs.readFileSync(path.join(ROOT, dir, CTX_FILE), 'utf8');
  assert(src.includes(INJECT_MARK), CTX_FILE + ' lost ' + INJECT_MARK);
  assert(src.includes(INJECT_IDS_MARK), CTX_FILE + ' lost ' + INJECT_IDS_MARK);

  const injected = src
    .replace(INJECT_MARK, () => JSON.stringify(names))
    .replace(INJECT_IDS_MARK, () => JSON.stringify(ids));

  const box = {};
  vm.createContext(box);
  vm.runInContext(injected + '\n;globalThis.__KERNEL_CTX = KERNEL_CTX;\n', box, {
    filename: CTX_FILE,
  });
  return box.__KERNEL_CTX;
}

const NAMES = ['VFS', 'LS', 'Audio2'];
const IDS = ['kernel'];

function fullKernel(ctx) {
  ctx.registry.kernel = { VFS: { node() {} }, LS: { read() {} }, Audio2: {} };
  ctx.__kernelDone();
}

/* -- 1. C1: a read before the kernel is complete must not yield {} ---------- */
check(1, 'reading ctx.core before the kernel finished registering throws', () => {
  const ctx = bootstrap(NAMES, IDS);

  // The old shape memoised here and froze {}. The whole point: an incomplete
  // core has to be an error, not a value that looks fine.
  const e = assertThrows(
    () => ctx.core,
    /before the kernel finished registering/,
    'premature ctx.core read'
  );
  // The message has to say WHY, or the next person to hit it greps for a typo.
  assert(/register/.test(e.message), 'message does not mention registration: ' + e.message);
});

/* -- 2. I1/C1: a kernel that exports less than KERNEL_NAMES fails loudly ---- */
check(2, 'a kernel missing a KERNEL_NAME fails at __kernelDone, naming the gap', () => {
  const ctx = bootstrap(NAMES, IDS);
  ctx.registry.kernel = { VFS: {}, LS: {} };   // Audio2 never exported

  const e = assertThrows(
    () => ctx.__kernelDone(),
    /Audio2/,
    'incomplete kernel'
  );
  assert(/ctx\.core/.test(e.message), 'message does not name ctx.core: ' + e.message);
  assert(/never exported|missing/.test(e.message), 'message is not actionable: ' + e.message);

  // And a failed __kernelDone must NOT have published a core.
  assertThrows(() => ctx.core, /before the kernel finished registering/,
    'core readable after a failed __kernelDone');
});

/* -- 3. the happy path still works, and the core is frozen ------------------ */
check(3, 'after __kernelDone the core covers KERNEL_NAMES and is frozen', () => {
  const ctx = bootstrap(NAMES, IDS);
  fullKernel(ctx);

  const core = ctx.core;
  assert(core.VFS && core.LS && core.Audio2,
    'core is incomplete: got ' + Object.keys(core).join(', '));
  assert(Object.isFrozen(core), 'core is not frozen - a module could swap a service out');

  // Frozen: a write is either a no-op or a throw, depending on how strict the
  // caller is. Only the observable outcome matters here.
  try { core.LS = null; } catch (e) { /* a strict caller throws */ }
  assert(ctx.core.LS !== null, 'a frozen core accepted a write');

  assert(ctx.core === core, 'core is re-assembled on every read instead of memoised');
});

/* -- 4. I4: use survives destructuring -------------------------------------- */
check(4, 'use works as ctx.use(x) and as a destructured const { use } = ctx', () => {
  const ctx = bootstrap(NAMES, IDS);
  fullKernel(ctx);
  ctx.registry.notes = { id: 'notes' };
  ctx.__deps = ['notes'];

  assert(ctx.use('notes') === ctx.registry.notes, 'ctx.use did not return the module');

  // The pattern the whole task teaches. It used to throw "Cannot read
  // properties of undefined" because use read `this.__deps`.
  const { use } = ctx;
  assert(use('notes') === ctx.registry.notes, 'destructured use did not return the module');

  const { use: alsoUse } = ctx;
  assert(alsoUse('notes') === ctx.registry.notes, 'aliased use did not return the module');
});

/* -- 5. the two dependency errors are still the specified ones -------------- */
check(5, 'use refuses undeclared and declared-but-unregistered dependencies', () => {
  const ctx = bootstrap(NAMES, IDS);
  fullKernel(ctx);
  ctx.registry.notes = {};
  ctx.__deps = ['notes', 'ghost'];   // ghost is declared but never registers

  assertThrows(() => ctx.use('other'), /^undeclared dependency: other$/, 'undeclared');
  assertThrows(() => ctx.use('ghost'), /unknown dependency: ghost/, 'unregistered');

  const { use } = ctx;
  assertThrows(() => use('other'), /^undeclared dependency: other$/,
    'undeclared, destructured');
});

/* -- 6. against the real tree ----------------------------------------------- */
check(6, 'the real injected KERNEL_NAMES is enforced, not just a fixture', () => {
  const names = kernelNames(ROOT);
  const loaded = manifest.load(ROOT);
  const files = manifest.collect(ROOT);
  const kernelIds = [...new Set(
    files.filter(f => f.dir === loaded.kernel.dir).map(f => f.id)
  )];
  assert(names.length > 0, 'kernel-names returned nothing');
  assert(kernelIds.length > 0, 'no kernel module was collected');

  const ctx = bootstrap(names, kernelIds);

  // This case exercises the BOOTSTRAP, not the kernel: only CTX_FILE is
  // evaluated here, so the registry is empty and __kernelDone must refuse to
  // publish a core. That is still the right thing to assert - it proves the
  // injected literal is load-bearing against the REAL name list rather than a
  // fixture. The message is capped, so what is checked is that the COUNT is the
  // real one and that every name it does show is a real kernel name - a
  // fixture-driven count would pass case 2 just as happily.
  //
  // It says nothing about whether the kernel actually returns those names. That
  // half is covered at BUILD time instead: build.js --check reads the
  // hand-written return list off the last kernel file and refuses to emit when
  // it and this list disagree, so a name added above and forgotten below fails
  // `node build.js --check` by name rather than the browser.
  const e = assertThrows(() => ctx.__kernelDone(), /ctx\.core/, 'the unconverted tree');
  assert(e.message.includes('missing ' + names.length + ' of the ' + names.length),
    'the count is not the real kernel list: ' + e.message);
  const shown = e.message.split('injected: ')[1].split('. A kernel')[0].split(', ');
  const truncated = shown.pop();
  assert(shown.length + parseInt(truncated.replace(/^\+/, ''), 10) === names.length,
    'the listed names do not add up: ' + e.message);
  for (const n of shown) {
    assert(names.includes(n), 'listed a name that is not in the real kernel list: ' + n);
  }
  console.log('      kernel names enforced: ' + names.length +
    ' - the bootstrap refuses an empty core; the kernel supplies them at boot');
});

if (failures) {
  console.log('\n' + failures + ' case(s) failed');
  process.exitCode = 1;
} else {
  console.log('\n6/6 bootstrap cases pass');
}
