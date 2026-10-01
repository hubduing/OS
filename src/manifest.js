/* ============================================================================
   src/manifest.js — what ships, and in what order.
   ----------------------------------------------------------------------------
   This file is data. build.js reads it through tools/lib/manifest.js, which
   topologically sorts packages and apps and then checks the manifest against
   the disk: an unlisted directory, a missing file, a stray file or a dependency
   cycle fails the build instead of silently shipping a smaller bundle.

   Phase 0 — the source tree is still one flat list of numbered files, so the
   whole kernel is described by a single entry and packages/apps are empty.
   Kernel JS concatenates in filename order, exactly as before, which is why the
   emitted bundle is byte-identical. Phase 1 populates packages and apps.
   ========================================================================= */
'use strict';

module.exports = {
  kernel: {
    dir: 'src/js',
    css: null,   // Phase 0: src/css is still concatenated by directory, as before
    js: '*.js',  // every .js in the folder, filename order
  },

  // CSS that must win over everything else. Empty until Phase 1, when app CSS
  // starts loading after the kernel and 13-responsive.css has to be named here
  // rather than left to a filename accident.
  cssLate: [],

  // Reusable modules, topologically sorted; what they export others consume.
  packages: [],

  // Applications, topologically sorted; each registers into APPS.
  apps: [],
};