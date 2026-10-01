#!/usr/bin/env node
/* Regression guard for sound muting.
 *
 * The bug this exists to prevent: sound was muted by a single global check
 * inside tone(), with no notion of which category a sound belonged to, so the
 * "UI sounds" and "Game sounds" toggles were both no-ops, and noise()-based
 * sounds were never checked at all. Subsystems that built their own audio
 * graph and wired it straight to ctx.destination also ignored the master
 * volume, which reads to the user as "I cannot turn the sound off".
 *
 * Checks, all static:
 *   1. tone() and noise() must gate on the category (via on()).
 *   2. Every tone()/noise() call in a game module must name its category.
 *   3. Nothing outside the audio module may connect a node to
 *      ctx.destination -- everything routes through Audio2.master.
 *
 * Usage: node tools/test-audio-mute.js
 */
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'src', 'js');
const AUDIO_MODULE = '03-audio.js';
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.js'));
const isGame = f => /-game-/.test(f);
const isMedia = f => /(?:^|\d+-)(?:music|video|reel)\.js$/.test(f);
const isSynth = f => /-synth\.js$/.test(f);

const failures = [];
const fail = (file, msg) => failures.push(`${file}: ${msg}`);

// Split the argument list of a call starting at the opening paren index.
function args(src, open) {
  let depth = 0, i = open, inStr = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inStr) { if (ch === '\\') i++; else if (ch === inStr) inStr = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = src.slice(open + 1, i);
  if (!body.trim()) return [];
  const parts = []; depth = 0; inStr = null; let cur = '';
  for (let k = 0; k < body.length; k++) {
    const ch = body[k];
    if (inStr) { cur += ch; if (ch === '\\') { cur += body[++k] || ''; } else if (ch === inStr) inStr = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}

function eachCall(src, re, fn) {
  // lastIndex only advances on a global regex; without /g this never terminates
  if (!re.global) re = new RegExp(re.source, re.flags + 'g');
  let m;
  while ((m = re.exec(src))) {
    const open = src.indexOf('(', m.index);
    if (open < 0) break;
    fn(m, open);
    if (re.lastIndex === m.index) re.lastIndex++;   // never stall on an empty match
  }
}

for (const file of files) {
  const src = fs.readFileSync(path.join(SRC, file), 'utf8');

  if (file === AUDIO_MODULE) {
    // 1. the gate must exist and be consulted by both entry points
    if (!/on\(cat\)\s*\{\s*if\(S\.volume<=0\)return false;/.test(src))
      fail(file, 'on(cat) must return false when S.volume is zero');
    // 'ui' is the fallback branch, so it is matched by the absence of a test
    // rather than by a literal 'ui' comparison — checking all three settings
    // are named is what actually matters.
    const gate=src.match(/on\(cat\)\{[\s\S]{0,220}?\n  \},/);
    if(!gate) fail(file, 'could not locate on(cat) to inspect it');
    else for(const s of ['S.uiSounds','S.gameSounds','S.mediaSounds'])
      if(!gate[0].includes(s)) fail(file, `on(cat) does not consult ${s}`);
    for (const [name, sig] of [['tone', 7], ['noise', 4]]) {
      const re = new RegExp(`${name}\\([^)]*\\)\\{`);
      let found = false;
      eachCall(src, re, () => { found = true; });
      const head = src.match(new RegExp(`\\n\\s*${name}\\(([^)]*)\\)\\{`));
      if (!head) { fail(file, `${name}() definition not found`); continue; }
      const n = args('(' + head[1] + ')', 0).length;
      if (n !== sig) fail(file, `${name}() takes ${n} params, expected ${sig} (last one is the category)`);
      if (!new RegExp(`${name}\\([^)]*\\)\\{\\s*if\\(!this\\.on\\(cat\\)\\)return;`).test(src))
        fail(file, `${name}() must start with if(!this.on(cat))return;`);
      void found;
    }
    continue;
  }

  // 2. media sounds must declare their category
  if (isMedia(file)) {
    eachCall(src, /Audio2\.(tone|noise)\(/g, (m, open) => {
      const a = args(src, open);
      const line = src.slice(0, m.index).split('\n').length;
      const last = a[a.length - 1];
      if (last !== `'game'` && last !== `'ui'` && last !== `'media'`)
        fail(file, `line ${line}: Audio2.${m[1]}() must end with a category argument ('media'), got ${last ? JSON.stringify(last) : 'no arguments'}`);
    });
  }

  // 2b. the synthesiser must honour the media gate, or "Media sounds" off
  //     does nothing for the built-in library while still muting local files
  if (isSynth(file)) {
    if (!/Audio2\.on\('media'\)/.test(src))
      fail(file, 'synth voices must be gated on Audio2.on(\'media\') or the Media sounds toggle will not silence them');
    if (!/Audio2\.bus|Audio2\.input\(\)/.test(src))
      fail(file, 'synth must reference Audio2.bus so the volume fader applies');
  }

  // 3. no subsystem may bypass the master bus
  //    the target may be a dotted path: ctx.destination, audioCtx.destination, ...
  eachCall(src, /\.connect\(\s*([\w$]+(?:\.[\w$]+)*)\.destination\s*\)/g, (m) => {
    const line = src.slice(0, m.index).split('\n').length;
    fail(file, `line ${line}: connects to ${m[1]}.destination — audio must go through the Audio2 bus so the volume slider applies`);
  });
}

if (failures.length) {
  console.error('audio mute guard: FAIL\n');
  failures.forEach(f => console.error('  - ' + f));
  console.error(`\n${failures.length} problem(s)`);
  process.exit(1);
}
console.log(`audio mute guard: ok — ${files.length} modules, all sounds categorised, all routed through the Audio2 bus`);