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

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'nexus-os.html');

const readDir = (dir, ext) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => f.endsWith(ext)).sort()
    : [];

function banner(file) {
  const name = file.split(path.sep).pop();
  const title = name.replace(/^\d+-/, '').replace(/\.[^.]+$/, '');
  const rule = '='.repeat(66);
  return (
    '\n/* ' + rule + '\n' +
    '   ' + title.toUpperCase() + '\n' +
    '   src/' + file.split(path.sep).join('/') + '\n' +
    '   ' + rule + ' */'
  );
}

function concat(dir, ext) {
  return readDir(dir, ext)
    .map(f => {
      const p = path.join(dir, f);
      const body = fs.readFileSync(p, 'utf8').replace(/\s*$/, '');
      if (ext === '.js') assertBalanced(p, body);
      return banner(path.join(path.basename(dir), f)) + '\n\n' + body;
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

function build() {
  const shell = fs.readFileSync(path.join(SRC, 'shell.html'), 'utf8');
  const css = concat(path.join(SRC, 'css'), '.css');
  const js = concat(path.join(SRC, 'js'), '.js');

  const stamp =
    '<!-- Built by build.js from src/ — edit the sources, not this file. -->\n';

  let out = shell.replace('{{CSS}}', () => css).replace('{{JS}}', () => js);
  out = out.replace('<style>', () => '<style>\n' + stamp);
  out = out.replace('<script>', () => '<script>\n' + stamp);
  if (!out.endsWith('\n')) out += '\n';

  // Every src/ file must actually be included, or a typo silently drops code.
  for (const sub of ['css', 'js']) {
    for (const f of readDir(path.join(SRC, sub), '.' + sub)) {
      const marker = 'src/' + sub + '/' + f;
      if (!out.includes(marker)) throw new Error(`${marker} is not referenced by the build`);
    }
  }

  fs.writeFileSync(OUT, out, 'utf8');
  return { out, cssFiles: readDir(path.join(SRC, 'css'), '.css').length, jsFiles: readDir(path.join(SRC, 'js'), '.js').length };
}

/* ---- optional sanity check: does the bundled JS actually parse? --------- */
function checkJs(html) {
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
const { out, cssFiles, jsFiles } = build();
const lineCount = out.split('\n').length;

if (process.argv.includes('--check')) {
  const r = checkJs(out);
  console.log(`check ok — JS ${r.js} lines, CSS ${r.css} lines, both parse`);
}

console.log(
  `built nexus-os.html  ${(out.length / 1024).toFixed(1)} KB  ${lineCount} lines` +
  `  (${cssFiles} css + ${jsFiles} js modules, ${Date.now() - t0} ms)`
);
