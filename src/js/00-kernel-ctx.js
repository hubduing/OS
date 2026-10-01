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
   every module against exactly this list.
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

   KERNEL_NAMES stays the authority on WHICH names belong to the kernel;
   this only says where their values come from. A name listed but never
   registered is absent from ctx.core and reads as undefined at the call site,
   which is the failure mode tools/test-isolation.js case 3 exists to prevent. */
let __core = null;
function readCore() {
  const out = {};
  for (const id of KERNEL_IDS) {
    const mod = KERNEL_CTX.registry[id];
    if (!mod) continue;
    for (const n of Object.keys(mod)) out[n] = mod[n];
  }
  return out;
}

/* Frozen, so a module cannot swap a kernel service out from under the others.
   KERNEL_CTX itself is NOT frozen: the generated wrapper assigns __deps per
   module, and a frozen property assignment fails silently outside strict mode
   - the wrapper runs with 'use strict', but freezing ctx buys nothing here and
   costs a failure mode that is invisible when it happens. registry stays
   mutable because filling it is the whole point. */
const KERNEL_CTX = {
  get core() {
    // Assembled on first read, not inline above: the kernel modules have not
    // registered yet when this file runs, so an eager read would see an empty
    // registry. Every module reads ctx.core exactly once, so the laziness is not
    // observable.
    if (__core === null) __core = Object.freeze(readCore());
    return __core;
  },

  /* module id -> the object that module's register() returned. */
  registry: {},

  /* Internal. The generated wrapper sets this to the current module's declared
     deps immediately before register(KERNEL_CTX) and clears it after, so a
     module can only reach what its manifest entry declared. A module never
     reads this slot itself; the name is prefixed to make that obvious. */
  __deps: [],

  use(id) {
    if (this.__deps.indexOf(id) === -1) {
      throw new Error('undeclared dependency: ' + id);
    }
    const mod = this.registry[id];
    if (!mod) throw new Error('unknown dependency: ' + id + ' (declared but not registered)');
    return mod;
  },
};
