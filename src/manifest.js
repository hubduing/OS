/* ============================================================================
   src/manifest.js — what ships, and in what order.
   ----------------------------------------------------------------------------
   This file is data. build.js reads it through tools/lib/manifest.js, which
   topologically sorts packages and apps and then checks the manifest against
   the disk: an unlisted directory, a missing file, a stray file or a dependency
   cycle fails the build instead of silently shipping a smaller bundle.

   Phase 0 — the kernel is still one flat list of numbered files, so packages
   and apps are empty. Kernel JS concatenates in filename order, exactly as
   before, which is why the emitted bundle is byte-identical. Phase 1 populates
   packages and apps.

   `dir` is REPO-ROOT RELATIVE, everywhere in this file, and so is every
   `cssLate` entry. The spec's example shows `dir: 'kernel'` and
   `cssLate: ['kernel/13-responsive.css']`, which would mean src-relative; the
   loader has always resolved `path.join(root, dir)` from the repository root
   (see tools/lib/manifest.js) and every consumer here reads it the same way,
   so changing the base now would silently move every future entry with it.
   `src/kernel` is what the root-relative convention spells, and the mixed
   `packages/synth` + `kernel/` pair in the spec example could never have been
   consistent under either base. */
'use strict';

module.exports = {
  kernel: {
    dir: 'src/kernel',
    css: '*.css',  // every .css in the kernel folder, filename order
    js: '*.js',    // every .js in the kernel folder, filename order
  },

  // CSS that must win over everything else, emitted after kernel CSS and after
  // every package and app stylesheet. 13-responsive.css used to win by filename
  // accident - it was the last file in src/css - and that accident ends the
  // moment app CSS starts loading after the kernel. Named here instead, and the
  // test asserts the entry resolves to a file that exists.
  cssLate: ['src/kernel/13-responsive.css'],

  // Reusable modules, topologically sorted; what they export others consume.
  packages: [],

  // Applications, topologically sorted; each registers into APPS.
  apps: [],
};