// Verifies that build.js refuses to produce a bundle when a module boundary
// cuts through a block comment. Run:  node tools/test-build-guard.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const manifest = require('./lib/manifest');

const ROOT = path.resolve(__dirname, '..');
// Resolved through the manifest so the move from src/js to src/kernel does not
// quietly turn "clean build succeeds" into "the target no longer exists" — a
// writeFileSync to a missing path would throw here instead of testing anything.
const target = path.join(ROOT, manifest.load(ROOT).kernel.dir, '14-calculator.js');
if (!fs.existsSync(target)) {
  console.error('FAIL  no such module: ' + target);
  process.exit(1);
}
const original = fs.readFileSync(target, 'utf8');

function tryBuild() {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { stdio: 'pipe' });
    return { ok: true };
  } catch (e) {
    return { ok: false, err: String(e.stderr) };
  }
}

// 1. clean build must succeed
let r = tryBuild();
console.log(r.ok ? 'PASS  clean build succeeds' : 'FAIL  clean build: ' + r.err);

// 2. deliberately unterminated comment must be rejected
fs.writeFileSync(target, '/* ============================\n' + original);
r = tryBuild();
const caught = !r.ok && /block comment/.test(r.err);
console.log(caught ? 'PASS  guard rejects an unterminated module comment'
                   : 'FAIL  guard did not catch it');

// 3. restore + confirm we are back to a good build
fs.writeFileSync(target, original);
r = tryBuild();
console.log(r.ok ? 'PASS  restores cleanly' : 'FAIL  restore: ' + r.err);
if (!r.ok) process.exitCode = 1;
