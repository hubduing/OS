"use strict";
/* ============================================================
   MODULE BOOTSTRAP - the one channel out of a module.
   ============================================================
   Concatenated first, before 01-core.js, because it has to define the
   one object every generated wrapper refers to.

   KERNEL_NAMES is a literal injected by build.js at emit time, computed
   by tools/lib/kernel-names.js. The builder is the single source of
   truth for that list, so this file and tools/test-isolation.js cannot
   disagree about what ctx.core holds. tools/test-isolation.js checks
   every module against exactly this list, and __kernelDone() below
   enforces it at boot.
   ------------------------------------------------------------ */
const KERNEL_NAMES = /* __KERNEL_NAMES__ */ [];

/* KERNEL_IDS is the ids of the modules the builder treats as kernel, injected
   the same way. Their exports are what ctx.core is assembled from. */
const KERNEL_IDS = /* __KERNEL_IDS__ */ [];

/* Assemble ctx.core from what the kernel modules returned.

   Deliberately NOT read off globalThis, though the kernel is one shared scope.
   A top-level `var` or `function` becomes a property of globalThis, but a
   top-level `const`, `let` or `class` lives in the global lexical environment
   and never does - verified, not assumed:

       const VFS = {};  'VFS' in globalThis   // false
       var VFS = {};    'VFS' in globalThis   // true

   This kernel is almost entirely `const`, so a `n in globalThis` loop yields an
   empty ctx.core, and the failure surfaces much later as one undefined service
   in one app rather than at boot. Reading the names would need eval or a
   with-block, both ruled out.

   Going through the registry is also the only approach that survives the
   wrapper: once a module body is inside the generated IIFE, nothing in it is
   reachable from outside by name at all.

   The assembly happens in __kernelDone(), which build.js emits immediately
   after the last kernel module - not on first read. A lazy build was the bug
   this replaced: the wrapper stores a module's exports in the registry only
   AFTER register() returns, so a module whose own register() read ctx.core
   would assemble a core out of an empty registry, freeze {}, and every later
   module would inherit it with no error anywhere. */
function assembleCore() {
  const out = {};
  for (const id of KERNEL_IDS) {
    const mod = KERNEL_CTX.registry[id];
    if (!mod) continue;
    for (const n of Object.keys(mod)) out[n] = mod[n];
  }
  return out;
}

/* The frozen core, or null until the kernel has finished registering. A core
   is never published half-built: see assembleCore(). */
let __core = null;

/* Names listed in the injected literal that the kernel did not actually hand
   back. Reported by name, because "ctx.core is wrong" is not actionable and
   "ctx.core has no Audio2" is. */
function missingKernelNames(core) {
  return KERNEL_NAMES.filter(n => !Object.prototype.hasOwnProperty.call(core, n));
}

const PREMATURE =
  'ctx.core was read before the kernel finished registering. build.js emits ' +
  'KERNEL_CTX.__kernelDone() right after the last kernel module, and ctx.core ' +
  'stays closed until then. The usual cause is a register() that destructures ' +
  'ctx.core: the kernel is ONE module sharing ONE scope and reaches its own ' +
  'names lexically, so only packages and apps destructure ctx.core.';

/* KERNEL_CTX itself is NOT frozen: the generated wrapper assigns __deps per
   module, and a frozen property assignment fails silently outside strict mode
   - the wrapper runs with 'use strict', but freezing ctx buys nothing here and
   costs a failure mode that is invisible when it happens. registry stays
   mutable because filling it is the whole point, and __kernelDone stays
   callable because the builder is what calls it. */
const KERNEL_CTX = {
  get core() {
    if (__core === null) throw new Error(PREMATURE);
    return __core;
  },

  /* module id -> the object that module's register() returned. */
  registry: {},

  /* Internal. The generated wrapper sets this to the current module's declared
     deps immediately before register(KERNEL_CTX) and clears it in a finally
     after, so a module can only reach what its manifest entry declared. A
     module never reads this slot itself; the name is prefixed to make that
     obvious. */
  __deps: [],

  /* Internal. Called by the builder once the last kernel module has
     registered. This is the only place ctx.core is built, and it refuses to
     publish one that does not cover KERNEL_NAMES - the injected literal is
     what turns "a kernel register() returned {}" from a boot that limps along
     with every service undefined into an error naming the gaps. */
  __kernelDone() {
    const core = assembleCore();
    const missing = missingKernelNames(core);
    if (missing.length) {
      const CAP = 12;
      const shown = missing.slice(0, CAP).join(', ');
      const more = missing.length > CAP ? ', +' + (missing.length - CAP) + ' more' : '';
      throw new Error(
        'ctx.core is missing ' + missing.length + ' of the ' + KERNEL_NAMES.length +
        ' kernel name(s) build.js injected: ' + shown + more +
        '. A kernel register() has to return every name it declares - the list ' +
        'is derived from the kernel files, so a name that is declared there and ' +
        'not exported here is a gap, not a spare.'
      );
    }
    __core = Object.freeze(core);
    return __core;
  },

  /* use CLOSES OVER KERNEL_CTX rather than reading `this`. `const { use } = ctx`
     is the pattern the whole modular refactor teaches, and it hands `use` a
     plain function whose `this` is undefined; reading this.__deps there died
     with "Cannot read properties of undefined" in strict mode, which is both
     the wrong error and the least useful one. */
  use(id) {
    if (KERNEL_CTX.__deps.indexOf(id) === -1) {
      throw new Error('undeclared dependency: ' + id);
    }
    const mod = KERNEL_CTX.registry[id];
    if (!mod) throw new Error('unknown dependency: ' + id + ' (declared but not registered)');
    return mod;
  },
};
