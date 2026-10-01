/* ============================================================================
   manifest — the single source of truth for what ships, and in what order.
   ----------------------------------------------------------------------------
   src/manifest.js is plain data. This module is the only thing that reads it:
   it resolves the dependency order, then checks the manifest against the disk
   so that a typo fails the build instead of silently shipping a smaller bundle.

   Manifest shape:
     kernel:   { dir, css, js }     css/js are a glob or null
     cssLate:  string[]             CSS forced to load last
     packages: Entry[]              Entry = { id, dir, deps, files, css? }
     apps:     Entry[]

   `dir` is a path relative to the repository root. `files` is an explicit,
   ordered list — never a glob — so that adding a file to a folder cannot change
   what ships without also changing the manifest.

   No dependencies, no bundler features. The manifest is read, not transformed.
   ========================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = path.resolve(__dirname, '..', '..');

/* -- small helpers -------------------------------------------------------- */

const isDir = (p) => {
  try { return fs.statSync(p).isDirectory(); } catch (e) { return false; }
};

const readJsonList = (dir) =>
  isDir(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort() : [];

const posix = (p) => p.split(path.sep).join('/');

/* A "*.ext" pattern means every file with that extension, in filename order.
   Anything else is taken as an explicit list of names. */
function expand(dir, pattern, ext) {
  if (pattern === null || pattern === undefined) return [];
  const list = Array.isArray(pattern) ? pattern : [pattern];
  const out = [];
  for (const p of list) {
    if (p === '*' + ext || p === '*') out.push(...readJsonList(dir));
    else if (String(p).includes('*')) throw new Error(`unsupported pattern ${p} in ${dir}`);
    else out.push(p);
  }
  return out;
}

/* -- validation ----------------------------------------------------------- */

function readManifest(root) {
  const file = path.join(root, 'src', 'manifest.js');
  if (!fs.existsSync(file)) throw new Error(`no manifest at src/manifest.js (looked in ${root})`);
  delete require.cache[require.resolve(file)];  // re-read: fixtures reuse paths
  return require(file);
}

function entry(e, kind) {
  if (!e || typeof e.id !== 'string' || !e.id) throw new Error(kind + ' entry has no id');
  if (typeof e.dir !== 'string' || !e.dir) throw new Error(`${e.id} has no dir`);
  return {
    id: e.id,
    dir: posix(e.dir),
    deps: Array.isArray(e.deps) ? e.deps.slice() : [],
    files: Array.isArray(e.files) ? e.files.slice() : [],
    css: e.css || null,
  };
}

/* -- dependency order -----------------------------------------------------
   Breadth-first by level, id-sorted inside each level, so the emitted order is
   deterministic and does not depend on how the manifest was written. The cycle
   chain is recovered separately, because a level sort cannot name it. */

function order(packages, apps) {
  const nodes = packages.concat(apps);
  const byId = new Map();
  for (const n of nodes) {
    if (byId.has(n.id)) throw new Error(`duplicate manifest id: ${n.id}`);
    byId.set(n.id, n);
  }
  for (const n of nodes) {
    for (const d of n.deps) {
      if (!byId.has(d)) throw new Error(`${n.id} declares unknown dep '${d}'`);
    }
  }

  const byIdSorted = () => nodes.slice().sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  const out = [];
  const done = new Set();
  while (out.length < nodes.length) {
    const level = byIdSorted().filter(n => !done.has(n.id) && n.deps.every(d => done.has(d)));
    if (!level.length) throw new Error('dependency cycle: ' + chain(nodes, byId).join(' -> '));
    for (const n of level) { done.add(n.id); out.push(n); }
  }
  return out;
}

/* Walk for the first back-edge, so the error can name the loop. */
function chain(nodes, byId) {
  const state = new Map();   // id -> 'visiting' | 'done'
  const stack = [];
  let found = null;
  const visit = (id) => {
    if (found) return;
    state.set(id, 'visiting');
    stack.push(id);
    for (const d of byId.get(id).deps) {
      if (state.get(d) === 'visiting') {
        found = stack.slice(stack.indexOf(d)).concat(d);
        return;
      }
      if (!state.has(d)) visit(d);
      if (found) return;
    }
    stack.pop();
    state.set(id, 'done');
  };
  for (const n of nodes) if (!state.has(n.id)) visit(n.id);
  return found || nodes.map(n => n.id).concat('?');
}

/* -- load ----------------------------------------------------------------- */

function load(root) {
  root = root || DEFAULT_ROOT;
  const m = readManifest(root);
  const kernel = m.kernel || {};
  const cssLate = Array.isArray(m.cssLate) ? m.cssLate.slice() : [];
  const packages = (m.packages || []).map(e => entry(e, 'package'));
  const apps = (m.apps || []).map(e => entry(e, 'app'));

  const order_ = order(packages, apps);

  // Every declared directory must exist. An entry pointing at nothing is a typo.
  const dirs = [kernel.dir].concat(order_.map(e => e.dir)).filter(Boolean);
  for (const d of dirs) {
    if (!isDir(path.join(root, d))) throw new Error(`directory does not exist: ${d}`);
  }

  // Every declared file must exist. The kernel's globs are expanded from disk,
  // so only the explicit `files` lists can name something that is not there.
  for (const e of order_) {
    for (const f of e.files) {
      if (!fs.existsSync(path.join(root, e.dir, f))) {
        throw new Error(`${e.id}: missing file ${e.dir}/${f}`);
      }
    }
  }

  // Every directory under src/ that carries JS must be reachable from the
  // manifest, or its code would silently not ship.
  for (const d of orphanDirs(root, dirs)) {
    throw new Error(`directory not listed in the manifest: ${d}`);
  }

  return { kernel, cssLate, packages, apps, order: order_ };
}

/* Directories on disk that hold JS but that no manifest entry points at.
   A directory counts as an orphan when it, or anything nested under it, holds
   a .js file — an empty placeholder directory is harmless.

   Walks the whole tree under src/ instead of looking only at the immediate
   children of a few containers. The previous version looked inside src/ and the
   parent of each declared directory, so it reported src/apps as an unlisted
   directory the moment src/apps/calculator was declared: the parent of a
   declared dir was never itself in `known`. That passed only while every module
   sat directly in src/, which is the flat Phase 0 shape. */
function orphanDirs(root, declared) {
  const known = new Set(declared.map(d => path.resolve(root, d)));
  const srcDir = path.resolve(path.join(root, 'src'));

  // The deepest directory holding a .js file that no manifest entry accounts
  // for, or null. Recursion does NOT descend into accounted-for directories: a
  // container like src/apps looks like it "carries JS" purely because its
  // declared children do, and reporting that is the false positive this
  // function is being fixed for.
  function findUnaccounted(dir) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (isDir(p)) {
        if (accountedFor(p)) continue;
        const deeper = findUnaccounted(p);
        if (deeper) return deeper;
      } else if (f.endsWith('.js')) {
        return dir;
      }
    }
    return null;
  }

  // Accounted for when the directory is declared, when an ANCESTOR is declared,
  // or when it only holds directories that are themselves accounted for. That
  // last clause is what makes `src/apps` a container rather than an orphan once
  // its children are listed.
  function accountedFor(dir) {
    for (let p = path.resolve(dir); ; p = path.dirname(p)) {
      if (known.has(p)) return true;
      if (p === srcDir) return false;
    }
  }

  const orphans = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, name);
      if (!isDir(p) || accountedFor(p)) continue;
      // Reported at the deepest directory that actually holds the unaccounted
      // JS, not at the container above it: "src/apps" would send you looking in
      // a folder that is entirely declared, while "src/apps/rogue" names the
      // thing that is not in the manifest.
      const found = findUnaccounted(p);
      if (found) orphans.push(posix(path.relative(root, found)));
      else walk(p);                          // a pure container: look inside
    }
  };
  if (isDir(srcDir)) walk(srcDir);
  return orphans;
}

/* -- collect -------------------------------------------------------------- */

function collect(root) {
  root = root || DEFAULT_ROOT;
  const m = load(root);
  const out = [];

  const push = (id, dir, file) => {
    out.push({ id, dir, file, abs: path.join(root, dir, file), css: null });
  };

  // The kernel loads first, in filename order.
  const kernelFiles = expand(path.join(root, m.kernel.dir), m.kernel.js, '.js');
  for (const f of kernelFiles) push('kernel', m.kernel.dir, f);

  // Then every package and app file, in dependency order.
  const claims = new Map();   // abs dir -> Map(file -> [ids])
  for (const e of m.order) {
    for (const f of e.files) {
      const dir = path.join(root, e.dir);
      if (!claims.has(dir)) claims.set(dir, new Map());
      const files = claims.get(dir);
      if (!files.has(f)) files.set(f, []);
      files.get(f).push(e.id);
      push(e.id, e.dir, f);
    }
  }

  // Coverage is checked per directory, not per entry: several entries may
  // legitimately share one directory, so it is the union of their `files` that
  // must cover the directory exactly once.
  for (const [dir, files] of claims) {
    const rel = posix(path.relative(root, dir));
    for (const [f, ids] of files) {
      if (ids.length > 1) {
        throw new Error(`duplicate file ${rel}/${f}: claimed by ${ids.join(' and ')}`);
      }
    }
    for (const f of readJsonList(dir)) {
      if (!files.has(f)) {
        throw new Error(`stray file ${rel}/${f}: not in any module's files list`);
      }
    }
  }

  return out;
}

module.exports = { load, collect, DEFAULT_ROOT };