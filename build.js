#!/usr/bin/env node
/* ============================================================================
   NEXUS OS — build
   ----------------------------------------------------------------------------
   Concatenates the modular sources in src/ into the single self-contained
   file  nexus-os.html  that the product ships as (double-click in Chrome).

   No dependencies. No network. Deterministic output.

       node build.js          build
       node build.js --check  build and verify the result parses as JS
   ========================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const manifest = require('./tools/lib/manifest');
const { kernelNames, CTX_FILE: BOOT_FILE, INJECT_MARK, INJECT_IDS_MARK } =
  require('./tools/lib/kernel-names');
const { ctxCoreReads } = require('./tools/lib/isolation');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'nexus-os.html');

const readDir = (dir, ext) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => f.endsWith(ext)).sort()
    : [];

/* `label` is the path shown in the banner, relative to src/, so that it reads
   `src/js/01-core.js` no matter which directory the file actually came from. */
function banner(label) {
  const name = label.split(path.sep).pop();
  const title = name.replace(/^\d+-/, '').replace(/\.[^.]+$/, '');
  const rule = '='.repeat(66);
  return (
    '\n/* ' + rule + '\n' +
    '   ' + title.toUpperCase() + '\n' +
    '   src/' + label.split(path.sep).join('/') + '\n' +
    '   ' + rule + ' */'
  );
}

function concat(items) {
  return items
    .map(({ abs, label }) => {
      const body = fs.readFileSync(abs, 'utf8').replace(/\s*$/, '');
      if (abs.endsWith('.js')) assertBalanced(abs, body);
      return banner(label) + '\n\n' + body;
    })
    .join('\n\n');
}

const concatDir = (dir, ext) =>
  concat(
    readDir(dir, ext).map(f => ({
      abs: path.join(dir, f),
      label: path.join(path.basename(dir), f),
    }))
  );

/* Guard: a module must not end in the middle of a column-0 block comment, and
   must not leave a dangling `/*`. Banner comments always start at column 0 and
   close with `* /` on their own line, so tracking only those is enough and
   avoids false positives from literals such as accept="audio/*,video/*". */
const OPEN = /^\/\*[^*]*$/, CLOSE = /^[^*]*\*\/\s*$/;
function assertBalanced(file, body) {
  let open = 0;
  for (const l of body.split('\n')) {
    if (OPEN.test(l)) open++;
    else if (CLOSE.test(l) && open > 0) open--;
  }
  if (open !== 0) {
    throw new Error(
      `${file}: ${open} block comment(s) left open — a split cut through a banner. ` +
      `Run: node tools/fix-boundaries.js`
    );
  }
}

/* ---- module wrapping ----------------------------------------------------
   Every module named in the manifest becomes one IIFE that hands its own body a
   `register` to call. The author never writes this wrapper, and never writes
   __deps either: it is read off the manifest entry, so a module cannot widen
   its own declared dependencies.

   Modules are grouped by id, not by file. A module is a folder with an ordered
   `files` list, and those files share one scope and one register(). */

function groupModules(files, order) {
  const deps = new Map();
  for (const e of order) deps.set(e.id, e.deps);
  deps.set('kernel', deps.get('kernel') || []);

  const out = [];
  const byId = new Map();
  for (const f of files) {
    if (!byId.has(f.id)) {
      const mod = { id: f.id, dir: f.dir, deps: deps.get(f.id) || [], files: [] };
      byId.set(f.id, mod);
      out.push(mod);
    }
    byId.get(f.id).files.push(f);
  }
  return out;
}

/* A module must declare the register the wrapper calls. Without this check a
   folder that forgets it ships as a ReferenceError at boot, in whichever module
   happens to load first, which is the hardest kind of bug to trace back to the
   folder that caused it.

   DECLARATIONS ONLY. An earlier version also accepted a bare `register(ctx)`,
   which matches a CALL as readily as a declaration - so a module that invoked
   register without defining it passed this check and then failed at boot as a
   ReferenceError, the exact outcome the check exists to prevent. The third
   alternative below is a method shorthand, `register(ctx) {`, and the required
   `{` is what separates it from a call: a call is `register(ctx);`.

   Checked in checkJs(), not while emitting: `node build.js` without --check must
   still write a bundle, so that the failure is something you can inspect rather
   than a file that was never produced. */
const HAS_REGISTER =
  /(?:^|[^\w.$])(?:function\s+register\b|(?:const|let|var)\s+register\s*=|register\s*\(\s*ctx\s*\)\s*\{)/m;

/* What an error about a module should call it: the id, and enough of its files
   to find it, since "kernel has no register" does not help anyone. Capped: the
   kernel is 33 files, and printing all of them is what made this unreadable. */
function moduleLabel(mod) {
  const CAP = 6;
  const files = mod.files;
  const shown = files.slice(0, CAP).map(f => f.file).join(', ');
  const more = files.length > CAP ? ', +' + (files.length - CAP) + ' more' : '';
  return 'module "' + mod.id + '" (' + mod.dir + ': ' + shown + more + ')';
}

function wrapModule(mod, body) {
  return (
    '/* MODULE: ' + mod.id + '  dir: ' + mod.dir + ' */\n' +
    '(function () {\n' +
    "  'use strict';\n" +
    '  KERNEL_CTX.__deps = ' + JSON.stringify(mod.deps) + ';\n' +
    '  var __exports = {};\n\n' +
    body + '\n\n' +
    // finally, not a plain reset: a register() that throws unwinds straight
    // through here, and leaving __deps pointing at the dead module's
    // dependencies would hand the next module a widened __deps.
    '  try {\n' +
    '    __exports = register(KERNEL_CTX);\n' +
    '  } finally {\n' +
    '    KERNEL_CTX.__deps = [];\n' +
    '  }\n' +
    '  KERNEL_CTX.registry[' + JSON.stringify(mod.id) + '] = __exports || {};\n' +
    '})();\n'
  );
}

/* The builder tells the bootstrap when the kernel is done, and the bootstrap
   uses that to assemble and freeze ctx.core. It cannot be inlined above: the
   core is assembled from what the kernel's register() RETURNED, and the wrapper
   only stores that after the call. */
const KERNEL_DONE = '/* KERNEL PHASE COMPLETE - ctx.core opens here, and not before. */\n' +
  'KERNEL_CTX.__kernelDone();\n';

/* The kernel-name list is computed here and nowhere else, then injected into
   00-kernel-ctx.js as literals. The bundle never recomputes either, so this
   script and the shipped ctx.core cannot drift apart.

   Replacer FUNCTIONS, not strings: in a string replacement `$$` means a literal
   `$`, which would silently rewrite the `$$` query helper to `$` and ship a core
   missing one of its two. */
function injectKernelNames(text, names, kernelIds) {
  for (const mark of [INJECT_MARK, INJECT_IDS_MARK]) {
    if (!text.includes(mark)) {
      throw new Error(
        BOOT_FILE + ' no longer contains ' + mark + ' - the literal has nowhere ' +
        'to go and ctx.core would be empty'
      );
    }
  }
  return text
    .replace(INJECT_MARK, () => JSON.stringify(names))
    .replace(INJECT_IDS_MARK, () => JSON.stringify(kernelIds));
}

function build() {
  const shell = fs.readFileSync(path.join(SRC, 'shell.html'), 'utf8');
  const css = concatDir(path.join(SRC, 'css'), '.css');

  // JS comes from the manifest: kernel files in filename order, then every
  // package and app file in dependency order. The manifest is validated against
  // the disk inside collect(), so a typo fails here rather than shipping less.
  const jsFiles = manifest.collect(ROOT);
  const loaded = manifest.load(ROOT);
  const modules = groupModules(jsFiles, loaded.order);
  const names = kernelNames(ROOT);

  // Which collected ids belong to the kernel, derived from the manifest's own
  // kernel.dir rather than hardcoded, so it follows the tree when it moves.
  const kernelDir = loaded.kernel.dir;
  const kernelIds = modules.filter(m => m.dir === kernelDir).map(m => m.id);

  // The bootstrap is emitted first and OUTSIDE any wrapper. It defines
  // KERNEL_CTX in the shared script scope, which is the only scope every
  // generated wrapper can reach; a wrapped KERNEL_CTX would be invisible to the
  // wrappers that call it.
  const boot = modules.find(m => m.files.some(f => f.file === BOOT_FILE));
  if (!boot) {
    throw new Error(
      'no ' + BOOT_FILE + ' in the kernel directory - KERNEL_CTX would never ' +
      'be defined and every generated wrapper would fail on it'
    );
  }
  const bootFile = boot.files.find(f => f.file === BOOT_FILE);
  const bootBody = banner(path.relative(SRC, bootFile.abs)) + '\n\n' +
    injectKernelNames(
      fs.readFileSync(bootFile.abs, 'utf8').replace(/\s*$/, ''),
      names,
      kernelIds
    );

  // ctx.core opens the moment the kernel phase ends, not before: it is assembled
  // from what the kernel module's register() returned, and the wrapper stores
  // that only after the call. The marker goes after the LAST kernel wrapper and
  // before the first package/app, so every app sees a core that is already
  // frozen and already checked against the injected KERNEL_NAMES.
  const lastKernel = modules.reduce(
    (last, m, i) => (kernelIds.indexOf(m.id) === -1 ? last : i),
    -1
  );
  if (lastKernel === -1) {
    throw new Error(
      'no kernel module collected from ' + kernelDir + ' - KERNEL_CTX would never ' +
      'be closed and every ctx.core read would throw at boot'
    );
  }
  const bodies = modules.map(m => {
    // The bootstrap file is emitted above, unwrapped; keep it out of the body.
    const body = concat(
      m.files
        .filter(f => f.file !== BOOT_FILE || m !== boot)
        .map(f => ({ abs: f.abs, label: path.relative(SRC, f.abs) }))
    );
    return { mod: m, body };
  });

  const parts = [bootBody].concat(bodies.map(b => wrapModule(b.mod, b.body)));
  parts.splice(lastKernel + 2, 0, KERNEL_DONE);   // +1 to step past bootBody
  const js = parts.join('\n\n');

  const stamp =
    '<!-- Built by build.js from src/ — edit the sources, not this file. -->\n';

  let out = shell.replace('{{CSS}}', () => css).replace('{{JS}}', () => js);
  out = out.replace('<style>', () => '<style>\n' + stamp);
  out = out.replace('<script>', () => '<script>\n' + stamp);
  if (!out.endsWith('\n')) out += '\n';

  // Every collected source file must actually be included, or a manifest entry
  // could name a file and silently drop it from the bundle.
  for (const f of jsFiles) {
    const marker = 'src/' + path.relative(SRC, f.abs).split(path.sep).join('/');
    if (!out.includes(marker)) throw new Error(`${marker} is not referenced by the build`);
  }
  for (const f of readDir(path.join(SRC, 'css'), '.css')) {
    const marker = 'src/css/' + f;
    if (!out.includes(marker)) throw new Error(`${marker} is not referenced by the build`);
  }

  fs.writeFileSync(OUT, out, 'utf8');
  return {
    out,
    modules: bodies,
    kernelIds,
    cssFiles: readDir(path.join(SRC, 'css'), '.css').length,
    jsFiles: jsFiles.length,
  };
}

/* ---- sanity check: does the bundled JS parse, and does every module have
   the register its wrapper calls? ----------------------------------------- */
function checkJs(html, modules, kernelIds) {
  // The contract check runs first and names the module, which is the actionable
  // part of the failure. A missing register also breaks the parse below in a way
  // that reads as a bundle bug rather than a module bug.
  for (const { mod, body } of modules || []) {
    if (!HAS_REGISTER.test(body)) {
      throw new Error(
        moduleLabel(mod) + ' has no register() declaration - every module must ' +
        'define register(ctx) for the generated wrapper to call'
      );
    }
  }

  // I3: the kernel is ONE module with ONE register(), sharing one lexical scope,
  // and ctx.core is not open until that module has registered. A kernel file that
  // reaches for ctx.core therefore reads a core that does not exist yet - it
  // throws at boot - and if it ever did not throw it would be reading a core
  // assembled from the module still in the middle of registering itself. Either
  // way the fix is wrong: intra-kernel access stays lexical, and only packages
  // and apps destructure ctx.core. Enforced here so the rule cannot rot.
  //
  // Scanned per file, not against the concatenated module body: the kernel is 33
  // files and "line 900 of the kernel" names nothing. The bootstrap is exempt,
  // and does not even need to be - it is emitted outside any wrapper (see
  // bootBody above) so it is never in a module body. The scan itself lives in
  // tools/lib/isolation.js next to the rest of the scanning, so a test can
  // reach the code this runs.
  for (const { mod } of modules || []) {
    if (kernelIds.indexOf(mod.id) === -1) continue;
    for (const f of mod.files) {
      if (f.file === BOOT_FILE) continue;
      const hit = ctxCoreReads(fs.readFileSync(f.abs, 'utf8'))[0];
      if (!hit) continue;
      throw new Error(
        mod.id + '/' + f.file + ':' + hit.line + ' reads ctx.core (' + hit.text +
        ') - the kernel is ONE module sharing ONE scope, so it reaches its own ' +
        'names lexically, and build.js does not open ctx.core until the whole ' +
        'kernel has registered. Only packages and apps destructure ctx.core.'
      );
    }
  }

  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no <script> block found in output');
  const body = m[1];

  // Real parse: vm.Script compiles without executing.
  try {
    new vm.Script(body, { filename: 'nexus-os.html' });
  } catch (e) {
    throw new Error('bundled JS does not parse: ' + e.message);
  }

  const css = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!css) throw new Error('no <style> block found in output');
  const ob = css[1].split('{').length - 1;
  const cb = css[1].split('}').length - 1;
  if (ob !== cb) throw new Error(`unbalanced CSS braces (delta ${ob - cb})`);

  if (/\{\{CSS\}\}|\{\{JS\}\}/.test(html)) throw new Error('unreplaced template placeholder');
  if (!/^<!DOCTYPE html>/.test(html)) throw new Error('output is not a full HTML document');
  if (!/<\/html>\s*$/.test(html)) throw new Error('output is not closed');

  return { js: body.split('\n').length, css: css[1].split('\n').length };
}

const t0 = Date.now();
const { out, modules, kernelIds, cssFiles, jsFiles } = build();
const lineCount = out.split('\n').length;

if (process.argv.includes('--check')) {
  const r = checkJs(out, modules, kernelIds);
  console.log(`check ok — JS ${r.js} lines, CSS ${r.css} lines, both parse`);
}

console.log(
  `built nexus-os.html  ${(out.length / 1024).toFixed(1)} KB  ${lineCount} lines` +
  `  (${cssFiles} css + ${jsFiles} js modules, ${Date.now() - t0} ms)`
);
