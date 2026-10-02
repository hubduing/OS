// Asserts the manifest loader's load order and its refusals. Uses throwaway
// trees under os.tmpdir() so nothing here depends on the real src/ layout.
// Run:  node tools/test-manifest.js
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const lib = require('./lib/manifest');

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
function throws(re, fn, label) {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  assert(err, label + ': expected a throw, got none');
  assert(re.test(String(err.message)), label + ': message was ' + JSON.stringify(err.message));
  return err;
}

/* -- fixture: a throwaway repo root with a manifest and some dirs ---------- */
function fixture(manifest, layout) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-manifest-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'src', 'manifest.js'),
    'module.exports = ' + JSON.stringify(manifest, null, 2) + ';\n',
    'utf8'
  );
  for (const rel of Object.keys(layout || {})) {
    const abs = path.join(root, rel);
    fs.mkdirSync(abs, { recursive: true });
    for (const f of layout[rel]) fs.writeFileSync(path.join(abs, f), '// ' + f + '\n', 'utf8');
  }
  return root;
}
const KERNEL = (files) => ({ 'src/js': files });

/* 1. a diamond resolves to a dependency order that is stable ---------------- */
check(1, 'diamond a->{b,c}->d orders a,b,c,d', () => {
  const root = fixture(
    {
      kernel: { dir: 'src/js', css: null, js: '*.js' },
      cssLate: [],
      packages: [
        { id: 'b', dir: 'packages/b', deps: ['a'], files: ['entry.js'] },
        { id: 'a', dir: 'packages/a', deps: [], files: ['entry.js'] },
      ],
      apps: [
        { id: 'd', dir: 'apps/d', deps: ['b', 'c'], files: ['entry.js'] },
        { id: 'c', dir: 'apps/c', deps: ['a'], files: ['entry.js'] },
      ],
    },
    Object.assign(KERNEL(['01-core.js']), {
      'packages/a': ['entry.js'],
      'packages/b': ['entry.js'],
      'apps/c': ['entry.js'],
      'apps/d': ['entry.js'],
    })
  );
  const m = lib.load(root);
  assert(
    m.order.map(e => e.id).join(',') === 'a,b,c,d',
    'order was ' + m.order.map(e => e.id).join(',')
  );
  assert(m.kernel.dir === 'src/js', 'kernel.dir was ' + m.kernel.dir);
});

/* 2. a cycle is refused, and the chain is named ---------------------------- */
check(2, 'dependency cycle a->b->a throws /cycle/i', () => {
  const root = fixture(
    {
      kernel: { dir: 'src/js', css: null, js: '*.js' },
      cssLate: [],
      packages: [
        { id: 'a', dir: 'packages/a', deps: ['b'], files: ['entry.js'] },
        { id: 'b', dir: 'packages/b', deps: ['a'], files: ['entry.js'] },
      ],
      apps: [],
    },
    Object.assign(KERNEL(['01-core.js']), {
      'packages/a': ['entry.js'],
      'packages/b': ['entry.js'],
    })
  );
  const e = throws(/cycle/i, () => lib.load(root), 'cycle');
  assert(/a -> b -> a/.test(e.message), 'chain was ' + e.message);
});

/* 3. an undeclared dependency is refused ----------------------------------- */
check(3, "deps:['nope'] throws /unknown dep/i", () => {
  const root = fixture(
    {
      kernel: { dir: 'src/js', css: null, js: '*.js' },
      cssLate: [],
      packages: [],
      apps: [{ id: 'a', dir: 'apps/a', deps: ['nope'], files: ['entry.js'] }],
    },
    Object.assign(KERNEL(['01-core.js']), { 'apps/a': ['entry.js'] })
  );
  throws(/unknown dep/i, () => lib.load(root), 'unknown dep');
});

/* 4. a directory on disk that the manifest never mentions is refused ------- */
check(4, 'a dir on disk absent from the manifest throws /not listed/i', () => {
  const root = fixture(
    {
      kernel: { dir: 'src/js', css: null, js: '*.js' },
      cssLate: [],
      packages: [],
      apps: [],
    },
    Object.assign(KERNEL(['01-core.js']), { 'src/apps/rogue': ['entry.js'] })
  );
  throws(/not listed/i, () => lib.load(root), 'unlisted dir');
});

/* 5. a listed file that is not on disk is refused -------------------------- */
check(5, "files:['ghost.js'] with no file on disk throws /missing file/i", () => {
  const root = fixture(
    {
      kernel: { dir: 'src/js', css: null, js: '*.js' },
      cssLate: [],
      packages: [],
      apps: [{ id: 'a', dir: 'apps/a', deps: [], files: ['ghost.js'] }],
    },
    Object.assign(KERNEL(['01-core.js']), { 'apps/a': ['entry.js'] })
  );
  throws(/missing file/i, () => lib.load(root), 'missing file');
});

/* 6. a dir whose real contents do not match `files` is refused, both ways -- */
check(6, 'collect() rejects an unclaimed file and a doubly-claimed one', () => {
  const orphan = fixture(
    {
      kernel: { dir: 'src/js', css: null, js: '*.js' },
      cssLate: [],
      packages: [],
      apps: [{ id: 'a', dir: 'apps/a', deps: [], files: ['entry.js'] }],
    },
    Object.assign(KERNEL(['01-core.js']), { 'apps/a': ['entry.js', 'stowaway.js'] })
  );
  throws(/stowaway\.js/, () => lib.collect(orphan), 'unclaimed file');

  const dup = fixture(
    {
      kernel: { dir: 'src/js', css: null, js: '*.js' },
      cssLate: [],
      packages: [{ id: 'x', dir: 'apps/shared', deps: [], files: ['entry.js'] }],
      apps: [{ id: 'y', dir: 'apps/shared', deps: [], files: ['entry.js'] }],
    },
    Object.assign(KERNEL(['01-core.js']), { 'apps/shared': ['entry.js'] })
  );
  throws(/twice|duplicate/i, () => lib.collect(dup), 'doubly claimed file');
});

/* 7. the real manifest: it loads, and every file it claims exists ---------- */
check(7, 'the real src/manifest.js loads and every listed file exists', () => {
  const m = lib.load(ROOT);
  const files = lib.collect(ROOT);
  // Only the kernel module's files come from a directory listing. Packages and
  // apps are named by an explicit `files` list, which collect() validates
  // against the disk itself (existence here, strays and duplicates in load()),
  // so comparing the whole collection against the kernel directory would fail
  // the moment the tree has a single module outside it.
  const fsList = fs
    .readdirSync(path.join(ROOT, m.kernel.dir))
    .filter(f => f.endsWith('.js'))
    .sort();
  const kernelFiles = files.filter(f => f.dir === m.kernel.dir).map(f => f.file);
  assert(kernelFiles.length === fsList.length,
    'collect() returned ' + kernelFiles.length + ' kernel files, ' +
      m.kernel.dir + ' holds ' + fsList.length);
  assert(
    kernelFiles.join(',') === fsList.join(','),
    'collect() order was ' + kernelFiles.join(',')
  );
  for (const e of files) assert(fs.existsSync(e.abs), e.abs + ' does not exist');
  assert(m.order.length === m.packages.length + m.apps.length, 'order length mismatch');
  assert(Array.isArray(m.cssLate), 'cssLate is not an array');
});

/* 8. intermediate containers are not orphans ------------------------------- */
check(8, 'a declared src/apps/calculator does not make src/apps an orphan', () => {
  const good = fixture(
    {
      kernel: { dir: 'src/js', css: null, js: '*.js' },
      cssLate: [],
      packages: [{ id: 'synth', dir: 'src/packages/synth', deps: [], files: ['entry.js'] }],
      apps: [{ id: 'calculator', dir: 'src/apps/calculator', deps: [], files: ['entry.js'] }],
    },
    Object.assign(KERNEL(['01-core.js']), {
      'src/packages/synth': ['entry.js'],
      'src/apps/calculator': ['entry.js'],
    })
  );
  // src/apps and src/packages hold no JS of their own; they are containers, and
  // the scan must see through them rather than flag them as unlisted.
  const files = lib.collect(good);
  assert(files.length === 3, 'collect() returned ' + files.length + ' files, expected 3');

  // A genuine orphan one level down is still caught: seeing through containers
  // must not become a loophole that lets anything undeclared through.
  const rogue = fixture(
    {
      kernel: { dir: 'src/js', css: null, js: '*.js' },
      cssLate: [],
      packages: [{ id: 'synth', dir: 'src/packages/synth', deps: [], files: ['entry.js'] }],
      apps: [{ id: 'calculator', dir: 'src/apps/calculator', deps: [], files: ['entry.js'] }],
    },
    Object.assign(KERNEL(['01-core.js']), {
      'src/packages/synth': ['entry.js'],
      'src/apps/calculator': ['entry.js'],
      'src/apps/rogue': ['entry.js'],
    })
  );
  const e = throws(/not listed/i, () => lib.collect(rogue), 'nested orphan');
  assert(/rogue/.test(e.message), 'message was ' + e.message);
});

/* 9. the real layout: the kernel has moved, and the containers exist -------- */
check(9, 'the kernel is src/kernel, src/js is gone, and the containers exist', () => {
  const m = lib.load(ROOT);
  assert(m.kernel.dir === 'src/kernel',
    'kernel.dir is ' + m.kernel.dir + ' - expected src/kernel');
  assert(!fs.existsSync(path.join(ROOT, 'src', 'js')),
    'src/js still exists - the tree move is half done');
  assert(fs.existsSync(path.join(ROOT, 'src', 'kernel')) &&
    fs.statSync(path.join(ROOT, 'src', 'kernel')).isDirectory(),
    'src/kernel does not exist');

  // Every apps/ and packages/ directory on disk is named by the manifest, in
  // both directions: load() refuses an unlisted one, and the explicit `files`
  // lists plus the existence check below refuse a listed one that is not there.
  const declared = new Set([m.kernel.dir].concat(m.order.map(e => e.dir)));
  for (const e of m.order) {
    assert(declared.has(e.dir), e.id + ' dir ' + e.dir + ' is not declared');
    assert(e.files.length > 0, e.id + ' lists no files');
    for (const f of e.files) {
      assert(fs.existsSync(path.join(ROOT, e.dir, f)),
        e.id + ' names ' + e.dir + '/' + f + ', which does not exist');
    }
  }
  // And every module the manifest declares must actually be reachable, or a
  // module id exists that nothing loads.
  assert(m.order.length > 0,
    'no packages or apps are declared - the refactor has moved nothing yet');
  for (const c of ['packages', 'apps']) {
    const dir = path.join(ROOT, 'src', c);
    assert(fs.existsSync(dir) && fs.statSync(dir).isDirectory(), 'src/' + c + ' does not exist');
    assert(lib.collect(ROOT).length > 0, 'collect() returned no modules');
  }

  // cssLate must name a file that exists, and it must resolve against the same
  // root `dir` does - otherwise the last stylesheet silently stops shipping.
  for (const rel of m.cssLate) {
    assert(fs.existsSync(path.join(ROOT, rel)), 'cssLate entry ' + rel + ' does not exist');
  }
});

if (failures) {
  console.log('\n' + failures + ' case(s) failed');
  process.exitCode = 1;
} else {
  console.log('\n9/9 manifest cases pass');
}