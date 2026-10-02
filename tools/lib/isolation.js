/* ============================================================================
   isolation — find a module reaching a kernel name it was not handed.
   ----------------------------------------------------------------------------
   A module may only reach the kernel through `const { X } = ctx.core`. Because
   the whole bundle is one shared scope, writing `VFS.node(...)` instead of
   `ctx.core.VFS.node(...)` still works at runtime, so nothing but this scan
   would ever notice. That is the whole point of the file: the kernel scope is
   a real global scope, and the contract is otherwise self-enforcing only by
   habit.

   Kept separate from the test so the throwaway fixtures in
   tools/test-isolation.js and the real tree are checked by one implementation.
   ========================================================================= */
'use strict';

const ID = '[A-Za-z_$][\\w$]*';

/* The destructuring line, however it is written:
     const { VFS, LS } = ctx.core;
     const { VFS: v } = ctx.core;      aliased: the module now holds `v`
   Returns the local names the module was actually given. */
const DESTRUCTURE_G = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*ctx\.core/g;
const DESTRUCTURE_1 = /(?:const|let|var)\s*\{[^}]*\}\s*=\s*ctx\.core/;
/* The same shape, deliberately NOT /g — see destructures(). */
const DESTRUCTURE_TEST = /(?:const|let|var)\s*\{[^}]*\}\s*=\s*ctx\.core/;

function declaredFrom(body) {
  const given = new Set();
  for (const m of body.matchAll(DESTRUCTURE_G)) {
    for (const part of m[1].split(',')) {
      // { VFS: v } hands over `v`; { VFS } hands over `VFS`.
      const raw = part.includes(':') ? part.slice(part.indexOf(':') + 1) : part;
      const clean = raw.trim();
      if (new RegExp('^' + ID + '$').test(clean)) given.add(clean);
    }
  }
  // The module's own register is not a kernel service, but the scan has no way
  // to know that: `function register(ctx) {` would otherwise be reported as an
  // undeclared use of a kernel name. Not anchored to column 0, because a
  // converted file is indented inside its wrapper.
  if (/(?:^|[^\w.$])(?:async\s+)?function\s+register\s*\(/.test(body)) given.add('register');
  return given;
}

/* A name preceded by `.` is a property access (ctx.core.VFS), and one followed
   by a word character is a different identifier (VFSx). The lookbehind is what
   stops the declared form from counting as an undeclared reference.

   The name is ESCAPED, and that is not optional: `$` and `$$` are kernel
   services, and unescaped `$` is the end-of-string anchor, so it matched every
   line in the file and reported 128 phantom findings in a file that mentions
   neither. */
function referenceRe(name) {
  return new RegExp('(?<![\\w.$])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w$])');
}

/* String literals that legitimately mention a kernel name — a storage key like
   `nexus.calcHist`, a CSS selector, a label. Blanked before matching so a name
   inside quotes is not read as a reference.

   Quotes inside a string must not start a new literal, or `["a","b"]` would be
   blanked in a way that corrupts the rest of the line. That mattered once a
   regex literal in a real file ran past an apostrophe in a neighbouring string;
   doing it in one pass, left to right, is what keeps `$` inside a quoted
   selector from being reported as a reference to the `$` helper. */
function stripStrings(line) {
  let out = '';
  let i = 0;
  const OPEN = { '"': '"', "'": "'", '`': '`' };
  while (i < line.length) {
    const c = line[i];
    const close = OPEN[c];
    if (close) {
      const end = line.indexOf(close, i + 1);
      if (end === -1) { out += ' '; break; }        // unterminated: drop the tail
      out += close === '`' ? '``' : close + close;
      i = end + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/* Is this line inside a block comment? The banner at the top of every file is
   `/* ===...` on one line and its close on another, and the prose between them
   starts at column 0 - so a per-line "does it start with /* or *" test misses
   them and every line of the banner gets scanned as code. State across the file. */
function commentMask(lines) {
  const mask = new Array(lines.length).fill(false);
  let open = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (open) {
      // A line reached while a comment is open is comment text even if it also
      // contains the closing `*/`: the banner's last prose line ends in one, and
      // testing "is there code before the close" wrongly un-masked all of it.
      // The cost is that code sharing a line with the close is skipped too,
      // which no file here does.
      const end = l.indexOf('*/');
      if (end === -1) mask[i] = true;
      else { open = false; mask[i] = true; }
      continue;
    }
    // Comments are stripped one at a time, left to right, so a `/*` or `*/`
    // inside a STRING is not mistaken for one. Scanning for `*/` before knowing
    // whether a `/*` was real misfired on prose ending in `milliseconds. */`
    // preceded by a quoted `.`, which left the rest of the banner scanned.
    let rest = l;
    let cut = false;
    while (!open) {
      const quote = rest.search(/["'`]/);
      const slash = rest.indexOf('/*');
      if (slash === -1) break;
      if (quote !== -1 && quote < slash) {
        const q = rest[quote];
        const endq = rest.indexOf(q, quote + 1);
        if (endq === -1) { rest = ''; break; }
        rest = rest.slice(endq + 1);
        continue;
      }
      const end = rest.indexOf('*/', slash + 2);
      if (end === -1) {
        open = true;
        if (rest.slice(0, slash).trim() === '') { mask[i] = true; cut = true; }
        break;
      }
      if (rest.slice(0, end).trim() === '') { mask[i] = true; cut = true; }
      rest = rest.slice(end + 2);
    }
    if (!open && cut) mask[i] = true;
  }
  return mask;
}

/* Every undeclared reference to a kernel name in one module body.
   `given` is what the module destructured, `names` is ctx.core's surface.
   Returns {name, line, text} for each hit. */
function violations(body, names, given) {
  const compiled = names
    .filter(n => !given.has(n))
    .map(n => ({ name: n, re: referenceRe(n) }));

  const out = [];
  const lines = codeLines(body);

  lines.forEach(({ raw, code }, i) => {
    if (code === '') return;                            // comment-only line
    if (DESTRUCTURE_1.test(code)) return;               // not a reference
    for (const { name, re } of compiled) {
      if (re.test(code)) out.push({ name, line: i + 1, text: raw.trim() });
    }
  });
  return out;
}

/* Does this body actually HANDS ITSELF kernel names, by destructuring ctx.core?

   declaredFrom() answers a different question - "which names does this body
   legitimately reach" - and it also counts a `function register(`, which is not
   a hand-over at all. A guard that decides "is this module converted?" from
   declaredFrom() therefore reads the kernel as converted, and then holds it to a
   contract the kernel must never meet: the kernel is ONE module sharing ONE
   scope, so it reaches its own names lexically, and ctx.core is not even open
   until it has registered. build.js fails the build on that (the I3 scan), and
   this function exists so the isolation guard does not demand the opposite of
   it.

   Kept beside DESTRUCTURE_G so the definition of "destructures ctx.core" is
   written down once.

   NOT DESTRUCTURE_G.test(): that regex is /g, and .test() on a global regex
   carries lastIndex between calls, so the same body alternates true and false
   and the guard silently skips whichever module it happens to call it on next.
   A non-global twin, which has no state to carry. matchAll() above is the
   state-free way to read DESTRUCTURE_G, and there is no matchAll equivalent of
   .test() that does not allocate. */
function destructures(body) {
  return DESTRUCTURE_TEST.test(body);
}

/* A `/* ... *\/` that opens and closes on ONE line. commentMask only knows the
   column-0 banner style, so an inline block comment was still read as code -
   which meant a kernel file documenting the "a kernel never reads ctx.core" rule
   in a one-line comment would be reported as breaking it. Blanked in place, so
   code sharing the line survives. Run BEFORE stripStrings, so an apostrophe in a
   comment cannot open a phantom string literal. */
function stripInlineComments(line) {
  return line.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length));
}

/* `${` blanked in place, for the same reason: it is a template interpolation
   opener, not the `$` query helper.
   Only reachable from a template literal that SPANS LINES. On the opening line
   stripStrings blanks the whole literal, but on a continuation line the backtick
   is not on that line, so the scanner has no idea it is still inside a string
   and reads `${` as a reference to `$`. That is why nothing caught it until the
   first converted module with a multi-line innerHTML template: the kernel is
   exempt from this contract, so no kernel file was ever scanned for it.

   The blanking is two characters wide on purpose. Everything else inside the
   interpolation stays visible, because that IS real code and this guard exists
   to check it — `ICONS.prev` on a continuation line must still be reported when
   the module did not destructure ICONS. */
function stripInterpolation(line) {
  return line.replace(/\$\{/g, '  ');
}

/* Regex literals blanked in place, same reason: `/[^./]+$/` ends in an anchor
   that is not the `$` query helper, and `.replace(/\.[^./]+$/,'')` is how the
   Video app strips a file extension.

   Only the CLOSING `/` is recognised, and only where a `/` cannot be division:
   the previous significant character must be one that cannot end an operand, so
   `= /re/` is a literal while `a / b` and `)/` are not touched. When the shape
   is ambiguous the text is left EXACTLY as it was - a false positive here is a
   loud, fixable failure, while blanking a division would silently stop checking
   whatever followed it, which is the failure this whole file exists to prevent.

   Order matters: this runs BEFORE stripStrings, because a `/` inside a quoted
   selector (`url("/a/b")`) must not be mistaken for the start of a literal. */
const REGEX_OPENER = /[({[,;:=!&|?+\-*%^~<>]/;
function stripRegex(line) {
  let out = '';
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === '"' || c === "'" || c === '`') break;   // stripStrings owns strings
    if (c === '/' && line[i + 1] !== '/' && line[i + 1] !== '*' &&
        (out === '' || REGEX_OPENER.test(lastSignificant(out)))) {
      const end = regexEnd(line, i);
      if (end !== -1) {
        let k = end + 1;
        while (k < line.length && /[a-z]/i.test(line[k])) k++;   // flags
        out += ' '.repeat(k - i);
        i = k;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}
function lastSignificant(s) {
  for (let i = s.length - 1; i >= 0; i--) if (!/\s/.test(s[i])) return s[i];
  return '';
}
/* Index of the `/` that closes a literal opening at `from`, honouring backslash
   escapes and a `[...]` character class, or -1 when there is none on this line. */
function regexEnd(line, from) {
  let cls = false;
  for (let i = from + 1; i < line.length; i++) {
    const d = line[i];
    if (d === '\\') { i++; continue; }
    if (d === '[') cls = true;
    else if (d === ']') cls = false;
    else if (d === '/' && !cls) return i;
  }
  return -1;
}

/* The body split into {raw, code} per line, with comments blanked to '' and the
   contents of string literals and trailing // comments removed.

   Shared with the builder's I3 guard, so "a read of ctx.core" means the same
   thing in tools/test-isolation.js and in `node build.js --check`: a mention in
   prose or inside a quoted selector is not a read. */
function codeLines(body) {
  const lines = body.split('\n');
  const inComment = commentMask(lines);
  return lines.map((raw, i) => ({
    raw,
    code: inComment[i]
      ? ''
      : stripInterpolation(stripStrings(stripRegex(stripInlineComments(raw)))).replace(/\/\/.*$/, ''),
  }));
}

/* Names in `names` that do not appear anywhere in the kernel tree. The list is
   injected into the bundle as a literal, so a stale entry ships as a permanently
   undefined property of ctx.core that only fails at the call site. */
function staleNames(names, kernelText) {
  return names.filter(n => !referenceRe(n).test(kernelText));
}

/* Reads of `ctx.core`, as {line, text}. The builder runs this over every kernel
   file, because the kernel is ONE module with ONE register(): it reaches its own
   names lexically, and ctx.core is not even open until the whole kernel has
   registered. A kernel file that reads it is a bug either way, so this lives
   here next to the rest of the scanning rather than in build.js, where a test
   could not reach it.

   Comments and string literals are blanked first, so a module explaining the
   rule in a banner is not a violation of it. */
const CTX_CORE_READ = /(?:^|[^\w.$])ctx\s*\.\s*core\b/;

function ctxCoreReads(body) {
  const out = [];
  codeLines(body).forEach(({ raw, code }, i) => {
    if (code !== '' && CTX_CORE_READ.test(code)) out.push({ line: i + 1, text: raw.trim() });
  });
  return out;
}

module.exports = {
  declaredFrom, destructures, violations, staleNames,
  stripStrings, referenceRe, codeLines, ctxCoreReads,
};
