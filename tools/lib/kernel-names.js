/* ============================================================================
   kernel-names — what the kernel exposes on ctx.core.
   ----------------------------------------------------------------------------
   The bundle is one shared global scope, so "the kernel surface" is literally
   "the names the kernel files declare at top level". This module derives that
   list from the directory the MANIFEST names (`kernel.dir`), never from a
   hardcoded path: the tree moves from src/js to src/kernel later, and a path
   baked in here would make this file wrong the moment it did.

   build.js injects the result into src/00-kernel-ctx.js as a literal array, so
   the builder is the single source of truth. Nothing here defines a runtime
   global and nothing in the bundle recomputes the list — the script and the
   bundle cannot disagree because only one of them derives it.

   Scope of the scan, deliberately narrow:
     - top level only: a declaration must start at column 0. Every file in this
       tree indents the body of a function, an object literal or an IIFE, so
       column 0 means module scope and nothing else.
     - a column-0 IIFE is stepped over, because a name declared inside one is
       not reachable from anywhere else.
     - `APPS.music = {...}` is an assignment to a member, not a declaration, and
       is not picked up: the name pattern requires `NAME =` with nothing but
       whitespace before the `=`.

   The scan is regex-based on purpose. It has no dependencies and no parser, and
   it errs toward naming too few names rather than inventing ones: a name it
   misses simply is not on ctx.core, and the isolation guard then fails loudly
   on the module that needed it.
   ========================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const manifest = require('./manifest');

/* The bootstrap file lives inside the kernel folder and declares the plumbing,
   not a service. Left in the list it would ask ctx.core for itself. */
const CTX_FILE = '00-kernel-ctx.js';

/* The two literals build.js replaces in CTX_FILE. If either drifts from the
   file, the build fails rather than shipping an empty ctx.core. */
const INJECT_MARK = '/* __KERNEL_NAMES__ */ []';
const INJECT_IDS_MARK = '/* __KERNEL_IDS__ */ []';

const ID = '[A-Za-z_$][\\w$]*';

/* -- line classification ---------------------------------------------------
   Only column-0 lines are considered, so a declaration has to look like one of
   these. `/* ... *\/` banner and body comments are skipped by the caller. */

const DECL_KW = new RegExp('^(?:const|let|var)\\s+', '');
const DECL_FN = new RegExp('^(?:async\\s+)?function\\s+(' + ID + ')\\s*\\(');
const DECL_ASSIGN = new RegExp('^(' + ID + ')\\s*=(?!=)');
const FIRST_NAME = new RegExp('^\\s*(' + ID + ')\\s*=');

const IIFE_OPEN = /^\(\s*(?:function\b|\(|[A-Za-z_$][\w$]*\s*=>)/;
const IIFE_CLOSE = /^\}/;

const COMMENT = /^\s*(?:\/\*|\*|\*\/|\/\/)/;

/* -- declaration splitting ------------------------------------------------- */

/* Split a declaration list on its top-level commas, so `const a=1, b=2` yields
   both names. A comma inside a call, an object literal, a bracket or a string
   is part of the initialiser, not a separator. */
function splitDeclarators(s) {
  const out = [];
  let depth = 0, quote = '', cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      cur += c;
      if (c === '\\') cur += s[++i] || '';
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; cur += c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

/* -- the scan ------------------------------------------------------------- */

/* Names declared at column 0 of `text`, in source order. Throws if a column-0
   IIFE is opened and never closed: the scan would silently drop every name
   after it, and a dropped name is worse than a failed build. */
function declaredNames(text) {
  const names = [];
  let inIife = false;
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    if (COMMENT.test(line)) return;
    if (inIife) {
      if (IIFE_CLOSE.test(line)) inIife = false;
      return;
    }
    if (IIFE_OPEN.test(line)) { inIife = true; return; }

    let rest = line;
    if (DECL_KW.test(line)) {
      rest = line.slice(DECL_KW.exec(line)[0].length);
      for (const part of splitDeclarators(rest)) {
        const m = FIRST_NAME.exec(part);
        if (m) names.push(m[1]);
      }
      return;
    }
    const m = DECL_FN.exec(line) || DECL_ASSIGN.exec(line);
    if (m) names.push(m[1]);
  });

  if (inIife) {
    throw new Error('column-0 IIFE is never closed — kernel-names cannot trust this file');
  }
  return names;
}

/* Every kernel name, sorted and unique. */
function kernelNames(root) {
  root = root || manifest.DEFAULT_ROOT;
  const dir = manifest.load(root).kernel.dir;
  const abs = path.join(root, dir);

  const names = [];
  for (const f of fs.readdirSync(abs).filter(f => f.endsWith('.js')).sort()) {
    if (f === CTX_FILE) continue;
    names.push(...declaredNames(fs.readFileSync(path.join(abs, f), 'utf8')));
  }
  return [...new Set(names)].sort();
}

module.exports = {
  kernelNames, declaredNames, splitDeclarators,
  CTX_FILE, INJECT_MARK, INJECT_IDS_MARK,
};
