/* ============================================================================
   kernel-names — what the kernel exposes on ctx.core.
   ----------------------------------------------------------------------------
   The bundle is one shared global scope, so "the kernel surface" is literally
   "the names the kernel files declare at top level". This module derives that
   list from the directory the MANIFEST names (`kernel.dir`), never from a
   hardcoded path: the tree has now moved from src/js to src/kernel, and a path
   baked in here would have made this file wrong the moment it did.

   build.js injects the result into the kernel bootstrap (src/kernel/00-kernel-ctx.js
   as of this tree; the path follows manifest.kernel.dir, not this comment) as a
   literal array, so the builder is the single source of truth. Nothing here
   defines a runtime global and nothing in the bundle recomputes the list — the
   script and the bundle cannot disagree because only one of them derives it.
   The injected literal is not decoration either: the bootstrap refuses to open
   ctx.core until the assembled core covers every name in it, so a kernel
   register() that forgets to return something fails at boot by name.

   Scope of the scan, deliberately narrow:
     - top level only: a declaration must start at column 0. Every file in this
       tree indents the body of a function, an object literal or an IIFE, so
       column 0 means module scope and nothing else.
     - a column-0 IIFE is stepped over, because a name declared inside one is
       not reachable from anywhere else.
     - `APPS.music = {...}` is an assignment to a member, not a declaration, and
       is not picked up: the name pattern requires `NAME =` with nothing but
       whitespace before the `=`.
      - `register` is dropped (ENTRY, below): it is the entry point, not a
        service.

   The kernel is ONE module with ONE register(), whose opening brace is at the top
   of 01-core.js and whose closing brace and `return` are at the bottom of
   32-subtitles.js. The files in between are NOT indented, and must not be:
   this scan is column-0 anchored, so indenting them would make the list EMPTY
   rather than wrong — the one failure this file cannot detect on its own. One
   brace pair spanning the concatenation is what keeps that shared scope.

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

/* `register` is the module's own entry point, not a service it provides: the
   generated wrapper calls it and keeps what it RETURNS, so a name it declares
   at column 0 describes the plumbing rather than the kernel's surface.
   tools/lib/isolation.js already treats it this way when it exempts a module's
   own register from the undeclared-reference scan; this is the same decision on
   the other side of the contract, and the two have to agree — a `register` in
   KERNEL_NAMES with no matching entry in the kernel's return would fail at boot
   naming a name nobody can supply. */
const ENTRY = 'register';

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
    for (const n of declaredNames(fs.readFileSync(path.join(abs, f), 'utf8'))) {
      if (n !== ENTRY) names.push(n);
    }
  }
  return [...new Set(names)].sort();
}

/* -- the return list ------------------------------------------------------- */

/* The names the kernel's register() RETURNS, read off the object literal at the
   bottom of the last kernel file.

   This is the other half of the kernel contract, and until now only the boot
   enforced it: `const Foo = {}` added to the kernel makes kernelNames() grow,
   the injected KERNEL_NAMES literal grow with it, `--check` stays green, and
   the failure arrives in the browser as "ctx.core is missing 1 of 109 kernel
   name(s): Foo". build.js calls this and compares the two lists, so the gap is
   a build error naming Foo instead.

   It PARSES the literal rather than evaluating it: the returned names are
   identifiers only in scope inside register(), so evaluating it here would mean
   fabricating a scope, and a fabricated scope is a place for the check to
   quietly disagree with the browser. The parse is exact - brace-matched to the
   literal's own closing brace, split on top-level commas only, so a nested
   object or an array cannot be mistaken for a key - and it refuses to guess
   when the literal is not where it expects: an unparseable return is a failure,
   never an empty list that would compare equal to nothing.

   `body` is the kernel module's concatenated source, minus the bootstrap file
   (which is emitted outside the wrapper and has no return). */
function returnedNames(body) {
  const OPEN = /\breturn\s*\{/g;
  let at = -1, m;
  while ((m = OPEN.exec(body)) !== null) at = m.index + m[0].length - 1;

  if (at === -1) {
    throw new Error(
      'the kernel body has no `return {` - register() must return the object ' +
      'literal that IS ctx.core, or the kernel exports nothing at all'
    );
  }

  // Brace-match from the opening brace, quote- and comment-aware: an unbalanced
  // count inside a string or a regex literal is not a brace.
  let depth = 0, quote = '', lineComment = false;
  for (let i = at; i < body.length; i++) {
    const c = body[i];
    if (lineComment) { if (c === '\n') lineComment = false; continue; }
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '/' && body[i + 1] === '/') { lineComment = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        const inner = body.slice(at + 1, i);
        const names = [];
        for (const part of splitDeclarators(inner)) {
          // A trailing comma yields an empty final segment. Legal JS, and the
          // list is hand-written across 20 lines, so it is skipped rather than
          // treated as an unreadable entry - but ONLY when blank. `...spread`
          // or a computed key still fails, because it is not blank.
          if (!part.trim()) continue;
          // `NAME` shorthand and `NAME: expr` both name NAME; anything else is
          // a computed or spread key, which this list must not contain.
          const k = /^\s*('?[A-Za-z_$][\w$]*'?)\s*(?::|$)/.exec(part);
          if (!k) {
            throw new Error(
              'the kernel return list has an entry build.js cannot read a name ' +
              'from: ' + JSON.stringify(part.trim()) + '. Write it as a bare ' +
              '`Name` or `Name: expr`'
            );
          }
          names.push(k[1].replace(/'/g, ''));
        }
        return [...new Set(names)];
      }
    }
  }
  throw new Error('the kernel return literal is never closed - build.js cannot read it');
}

/* The two lists, compared as SETS. Both directions are failures: a name
   declared and not returned is a gap in ctx.core, and a name returned that
   nothing declares is a typo that ships as a permanently undefined property -
   or, worse, as a ReferenceError in the return itself that only the browser
   finds. Capped in the message, because the kernel has 108 names and printing
   all of them helps nobody. */
function returnParity(names, returned) {
  const have = new Set(returned);
  const want = new Set(names);
  const missing = names.filter(n => !have.has(n));
  const extra = returned.filter(n => !want.has(n));
  return { missing, extra };
}

function describeParity(names, p) {
  const CAP = 12;
  const fmt = (list) => {
    const shown = list.slice(0, CAP).join(', ');
    return list.length > CAP ? shown + ', +' + (list.length - CAP) + ' more' : shown;
  };
  const parts = [];
  if (p.missing.length) {
    parts.push(
      'declared at column 0 in the kernel but ABSENT from the return list at the ' +
      'bottom of the last kernel file: ' + fmt(p.missing)
    );
  }
  if (p.extra.length) {
    parts.push(
      'in the return list but declared nowhere in the kernel: ' + fmt(p.extra) +
      ' (a typo ships as a permanently undefined ctx.core property, or throws ' +
      'inside register())'
    );
  }
  return (
    'the kernel return list and the generated KERNEL_NAMES scan disagree (' +
    names.length + ' scanned). ' + parts.join('. ') + '. The return list IS ' +
    'ctx.core, and it has to cover every name the kernel declares exactly once.'
  );
}

module.exports = {
  kernelNames, declaredNames, splitDeclarators,
  returnedNames, returnParity, describeParity,
  CTX_FILE, ENTRY, INJECT_MARK, INJECT_IDS_MARK,
};
