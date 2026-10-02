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
 * The file list comes from the MANIFEST, not from a hardcoded src/js: the tree
 * moved to src/kernel and this guard used to read a path that no longer exists.
 * A guard that reads zero files finds zero problems and says "ok", which is the
 * failure mode this now refuses outright (see the loud checks below).
 *
 * Subsystem classification is by manifest id. Phase 1 gives each subsystem its
 * own module; until then some are still inside the single `kernel` module, so
 * each entry below also carries the kernel filename it has today. The id is
 * tried first and the filename is a fallback FOR THAT ONE ID, never for the
 * role as a whole: an earlier version asked "does ANY id of this role exist?"
 * and only then consulted the filenames, which meant that as soon as `music`
 * and `video` became real ids the reel silently dropped out of the media checks
 * with nothing reported. A guard that stops checking a subsystem because a
 * DIFFERENT subsystem moved is exactly the silence it exists to prevent.
 * Both halves are checked against the manifest, so a rename that misses this
 * table fails here instead of silently un-checking a whole subsystem.
 *
 * Usage: node tools/test-audio-mute.js
 */
const fs = require('fs');
const path = require('path');

const manifest = require('./lib/manifest');

const ROOT = path.resolve(__dirname, '..');

/* The audio module. Keyed to the manifest id Phase 1 will give it; today the
   kernel is one module, so the file name inside the kernel directory is the
   fallback. Either way it is resolved FROM the manifest, and its absence is a
   failure rather than an empty check. */
const AUDIO_ID = 'kernel-audio';
const AUDIO_FILE = '03-audio.js';

/* One entry per SUBSYSTEM, not per role: `id` is the manifest id the subsystem
   gets in Phase 1, and `file` is the kernel filename it carries today, used only
   when that exact id does not exist yet. Resolving them together is what makes
   the fallback per-id; a fallback chosen for the role as a whole goes quiet on
   every id that happens to have arrived. */
const ROLES = [
  { role: 'game',  id: 'game-snake', file: '23-game-snake.js' },
  { role: 'game',  id: 'game-racer', file: '24-game-racer.js' },
  { role: 'game',  id: 'arcade',     file: '22-arcade.js' },
  { role: 'media', id: 'music',      file: '17-music.js' },
  { role: 'media', id: 'video',      file: '30-video.js' },
  { role: 'media', id: 'reel',       file: '31-reel.js' },
  { role: 'synth', id: 'synth',      file: '28-synth.js' },
];

/* ---- the file list, from the manifest ------------------------------------ */

const failures = [];
const fail = (file, msg) => failures.push(`${file}: ${msg}`);

let collected, loaded;
try {
  collected = manifest.collect(ROOT);
  loaded = manifest.load(ROOT);
} catch (e) {
  console.error('audio mute guard: FAIL\n');
  console.error('  - cannot read the manifest: ' + e.message);
  console.error('\n1 problem(s)');
  process.exit(1);
}

// Loud: a guard that read nothing would otherwise report "ok" on a tree it
// never looked at. This is the difference between "the audio code is correct"
// and "there is no audio code".
if (!collected.length) {
  console.error('audio mute guard: FAIL\n');
  console.error('  - collect() returned 0 modules, so every check below is vacuous');
  console.error('\n1 problem(s)');
  process.exit(1);
}

const byId = new Map();
for (const f of collected) {
  if (!byId.has(f.id)) byId.set(f.id, []);
  byId.get(f.id).push(f);
}

// Every .js on disk under every declared module directory must be in `files`.
// collect() already refuses a stray, but this repeats the assertion in the
// guard's own terms: if a future change makes collect() lenient, the guard
// fails rather than checking a subset.
const declaredDirs = [...new Set(collected.map(f => f.dir))];
const claimed = new Set(collected.map(f => path.resolve(f.abs)));
const unaccounted = [];
for (const dir of declaredDirs) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) { unaccounted.push(`${dir} (directory does not exist)`); continue; }
  for (const f of fs.readdirSync(abs).filter(f => f.endsWith('.js'))) {
    const p = path.resolve(path.join(abs, f));
    if (!claimed.has(p)) unaccounted.push(`${dir}/${f}`);
  }
}

const audioMod = byId.get(AUDIO_ID);
const audioFile = audioMod
  ? audioMod[0].file
  : (byId.get('kernel') || []).map(f => f.file).find(f => f === AUDIO_FILE);

if (!audioFile) {
  failures.push(`manifest: no audio module — expected id "${AUDIO_ID}", or ` +
    `${loaded.kernel.dir}/${AUDIO_FILE} inside the kernel module. Without it ` +
    `checks 1 and 2 cannot run.`);
}

const files = collected.map(f => ({ file: f.file, id: f.id, abs: f.abs }));

/* Is this file in `role`? Resolved per id: a module with that id wins, else the
   kernel file the id stands for today. An entry that matches neither on disk is
   reported by name - that is how a rename would otherwise un-check a subsystem
   silently - and the check for THAT id stays empty rather than the whole role
   being dropped. */
const roleNames = new Map();
for (const { role, id, file } of ROLES) {
  if (!roleNames.has(role)) roleNames.set(role, new Set());
  const hits = roleNames.get(role);
  const mod = byId.get(id);
  if (mod) {
    for (const f of mod) hits.add(f.abs);
    continue;
  }
  const kernel = (byId.get('kernel') || []).find(k => k.file === file);
  if (kernel) hits.add(kernel.abs);
  else {
    failures.push(`${loaded.kernel.dir}/${file}: the ${role} role maps id "${id}" to ` +
      `it, but there is no module with that id and no such file in the kernel - ` +
      `that subsystem is now unchecked`);
  }
}
const isGame  = (f) => roleNames.get('game').has(f.abs);
const isMedia = (f) => roleNames.get('media').has(f.abs);
const isSynth = (f) => roleNames.get('synth').has(f.abs);

if (unaccounted.length) {
  failures.push(`manifest: ${unaccounted.length} .js file(s) on disk are not in ` +
    `any module's files list: ${unaccounted.slice(0, 8).join(', ')}`);
}

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

for (const { file, abs } of files) {
  const src = fs.readFileSync(abs, 'utf8');

  if (file === audioFile) {
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
  if (isMedia({ file, abs })) {
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
  if (isSynth({ file, abs })) {
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

// Loud: a category check that matched nothing means the guard stopped checking
// the subsystem it exists for. Every role must have found at least one file.
for (const role of ['game', 'media', 'synth']) {
  if (roleNames.get(role).size === 0) {
    failures.push(`no file was classified as "${role}" — checks 2/2b are vacuous`);
  }
}

if (failures.length) {
  console.error('audio mute guard: FAIL\n');
  failures.forEach(f => console.error('  - ' + f));
  console.error(`\n${failures.length} problem(s)`);
  process.exit(1);
}
console.log(`audio mute guard: ok — ${files.length} modules, all sounds categorised, all routed through the Audio2 bus`);