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
const {
  kernelNames, returnedNames, returnParity, describeParity,
  CTX_FILE: BOOT_FILE, INJECT_MARK, INJECT_IDS_MARK,
} = require('./tools/lib/kernel-names');
const { ctxCoreReads } = require('./tools/lib/isolation');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'nexus-os.html');

const readDir = (dir, ext) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => f.endsWith(ext)).sort()
    : [];

/* `label` is the path shown in the banner, relative to src/, so that it reads
   `src/kernel/01-core.js` no matter which directory the file actually came
   from. */
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
   kernel is many files, and printing all of them is what made this unreadable. */
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

  // JS comes from the manifest: kernel files in filename order, then every
  // package and app file in dependency order. The manifest is validated against
  // the disk inside collect(), so a typo fails here rather than shipping less.
  const jsFiles = manifest.collect(ROOT);
  const loaded = manifest.load(ROOT);
  const modules = groupModules(jsFiles, loaded.order);
  const names = kernelNames(ROOT);
  const css = collectCss(ROOT, loaded);

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

  let out = shell.replace('{{CSS}}', () => css.text).replace('{{JS}}', () => js);
  out = out.replace('<style>', () => '<style>\n' + stamp);
  out = out.replace('<script>', () => '<script>\n' + stamp);
  if (!out.endsWith('\n')) out += '\n';

  // Every collected source file must actually be included, or a manifest entry
  // could name a file and silently drop it from the bundle.
  for (const f of jsFiles) {
    const marker = 'src/' + path.relative(SRC, f.abs).split(path.sep).join('/');
    if (!out.includes(marker)) throw new Error(`${marker} is not referenced by the build`);
  }
  for (const f of css.files) {
    if (!out.includes('src/' + f)) throw new Error(`src/${f} is not referenced by the build`);
  }

  fs.writeFileSync(OUT, out, 'utf8');
  return {
    out,
    modules: bodies,
    kernelIds,
    cssFiles: css.files.length,
    jsFiles: jsFiles.length,
    cssOrder: css.order,
  };
}

/* ---- CSS order -----------------------------------------------------------
   Three tiers, and the order is a correctness requirement rather than taste:

     1. kernel CSS, in the kernel's own filename order, minus whatever cssLate
        claims;
     2. the `css` of each package and app, in the same dependency order the JS
        loads in - so a stylesheet always follows the code it styles;
     3. every cssLate entry, last.

   13-responsive.css used to win by accident: it was the last file in the one
   CSS directory, and nothing loaded after it. App CSS loading after the kernel
   ends that accident the moment Phase 1 lands, and a window that no longer
   collapses on a narrow screen is a broken product rather than a cosmetic
   regression. The manifest names it instead, and every entry is checked for
   existence so a stale cssLate cannot silently stop shipping.
   ------------------------------------------------------------------------ */
function collectCss(root, loaded) {
  const kernelDir = loaded.kernel.dir;
  const kernelAbs = path.join(root, kernelDir);
  const late = loaded.cssLate;

  // Resolve a cssLate entry the same way `dir` resolves - repo-root relative -
  // and fail by name when it names nothing. A typo here is the one failure that
  // would otherwise ship silently, because the file it meant to promote is
  // already being emitted, just in the wrong tier.
  const lateAbs = late.map(rel => {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      throw new Error(
        `cssLate names ${rel}, which does not exist (looked in ${abs}). Entries are ` +
        `repo-root relative, like kernel.dir`
      );
    }
    return abs;
  });
  const lateSet = new Set(lateAbs.map(a => path.resolve(a)));

  const kernelCss = (loaded.kernel.css === null || loaded.kernel.css === undefined)
    ? []
    : expandCss(kernelAbs, loaded.kernel.css);

  const rel = (abs) => path.relative(SRC, abs).split(path.sep).join('/');

  // Tier 1. A kernel stylesheet named in cssLate is held back, not emitted
  // twice: the same rules at the front and the back is not "late", it is a
  // duplicate that wins on the later copy by accident.
  const out = [];
  for (const abs of kernelCss) {
    if (lateSet.has(path.resolve(abs))) continue;
    out.push({ abs, rel: rel(abs) });
  }

  // Tier 2, in load order. `css` is a list on a manifest entry, same as files.
  for (const e of loaded.order) {
    if (!e.css) continue;
    const abs = path.join(root, e.dir, e.css);
    if (!fs.existsSync(abs)) throw new Error(`${e.id}: missing stylesheet ${e.dir}/${e.css}`);
    if (lateSet.has(path.resolve(abs))) {
      throw new Error(`${e.id} lists ${e.css} in css as well as in cssLate - it would ship twice`);
    }
    out.push({ abs, rel: rel(abs) });
  }

  // Tier 3.
  for (const abs of lateAbs) out.push({ abs, rel: rel(abs) });

  // Every .css under every declared directory must land in exactly one tier, or
  // it is silently not shipping. collect() already covers this for .js; this is
  // the same check for stylesheets, which no glob covers until Phase 1 does.
  const claimed = new Set(out.map(c => path.resolve(c.abs)));
  for (const dir of [kernelDir].concat(loaded.order.map(e => e.dir))) {
    for (const f of readDir(path.join(root, dir), '.css')) {
      const abs = path.resolve(path.join(root, dir, f));
      if (claimed.has(abs)) continue;
      throw new Error(
        `unclaimed stylesheet ${dir}/${f}: name it in kernel.css, an entry's css, or cssLate`
      );
    }
  }

  return {
    text: concat(out.map(c => ({ abs: c.abs, label: c.rel }))),
    files: out.map(c => c.rel),
    order: out.map(c => c.rel),
  };
}

/* kernel.css is a glob or an explicit list of names, expanded against the
   kernel directory. Mirrors expand() in tools/lib/manifest.js, which does the
   same for kernel.js - kept separate rather than imported because that one
   hardcodes .js and is about which files a module owns. */
function expandCss(dir, pattern) {
  const list = Array.isArray(pattern) ? pattern : [pattern];
  const out = [];
  for (const p of list) {
    if (p === '*.css' || p === '*') out.push(...readDir(dir, '.css'));
    else if (String(p).includes('*')) throw new Error(`unsupported pattern ${p} in ${dir}`);
    else {
      if (!fs.existsSync(path.join(dir, p))) throw new Error(`missing stylesheet ${dir}/${p}`);
      out.push(p);
    }
  }
  return out.map(f => path.join(dir, f));
}

/* ---- sanity check: does the bundled JS parse, and does every module have
   the register its wrapper calls? ----------------------------------------- */
function checkJs(html, modules, kernelIds, names) {
  let returnCount = 0;
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
  // Scanned per file, not against the concatenated module body: the kernel is
  // many files and "line 900 of the kernel" names nothing. The bootstrap is exempt,
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

  // The hand-written return list at the bottom of the last kernel file and the
  // generated KERNEL_NAMES scan are two statements of the same fact, written by
  // hand. Only the second was checked, and only at boot: add `const Foo = {}` to
  // a kernel file and the scan grows, --check stays green, and the failure
  // arrives in the browser as "ctx.core is missing 1 of 109 kernel names: Foo".
  // Reading the literal here makes the gap a build error, by name, before
  // anyone opens the file.
  //
  // Scanned over the concatenated kernel body rather than per file, because the
  // return is a single statement in the last file and the scan needs the whole
  // literal - which is exactly one `return {`, brace-matched to its own close.
  for (const { mod, body } of modules || []) {
    if (kernelIds.indexOf(mod.id) === -1) continue;
    const returned = returnedNames(body);
    const parity = returnParity(names, returned);
    if (parity.missing.length || parity.extra.length) {
      throw new Error(mod.id + ': ' + describeParity(names, parity));
    }
    returnCount = returned.length;
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

  return {
    js: body.split('\n').length,
    css: css[1].split('\n').length,
    returned: returnCount,
  };
}

const t0 = Date.now();
const { out, modules, kernelIds, cssFiles, jsFiles, cssOrder } = build();
const lineCount = out.split('\n').length;

if (process.argv.includes('--check')) {
  const r = checkJs(out, modules, kernelIds, kernelNames(ROOT));
  console.log(`check ok — JS ${r.js} lines, CSS ${r.css} lines, both parse`);
  console.log(
    `check ok — kernel return list covers all ${r.returned} KERNEL_NAMES; ` +
    `CSS tiers: ${cssOrder.join(', ')}`
  );
}

console.log(
  `built nexus-os.html  ${(out.length / 1024).toFixed(1)} KB  ${lineCount} lines` +
  `  (${cssFiles} css + ${jsFiles} js modules, ${Date.now() - t0} ms)`
);
