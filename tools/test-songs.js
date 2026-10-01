#!/usr/bin/env node
/* Authoring guard for the built-in track library.
 *
 * A malformed note name does not throw — the parser returns null and the step
 * silently becomes a rest, so a typo in a hand-written pattern is invisible
 * until someone listens to a track with a hole in it. This checks the data:
 * every token must parse, every part must name a real instrument, notes must
 * have positive length, and a track must actually contain notes.
 *
 * Usage: node tools/test-songs.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src', 'js');
const files = ['28-synth.js', '29-songs.js'];

const sandbox = { Audio2: { on: () => true, bus: null, ctx: null }, console, Math, Object, Array };
vm.createContext(sandbox);
for (const f of files) {
  const code = fs.readFileSync(path.join(SRC, f), 'utf8');
  try { vm.runInContext(code, sandbox, { filename: f }); }
  catch (e) { console.error(`FAIL  ${f} does not parse: ${e.message}`); process.exit(1); }
}
// `const` in a vm context does not attach to the global object, so pull the
// three names we need across explicitly.
const { Synth, TRACKS, INSTRUMENTS } = vm.runInContext(
  '({Synth, TRACKS, INSTRUMENTS})', sandbox);

const problems = [];

if (!Array.isArray(TRACKS) || !TRACKS.length) {
  console.error('FAIL  no TRACKS exported'); process.exit(1);
}

const ids = new Set();
for (const song of TRACKS) {
  const at = song.title || song.id || '?';
  if (ids.has(song.id)) problems.push(`${at}: duplicate id "${song.id}"`);
  ids.add(song.id);
  if (!song.bpm || song.bpm < 40 || song.bpm > 240) problems.push(`${at}: implausible bpm ${song.bpm}`);

  // every token must be a real note, a rest, a hold, or a bar marker
  for (const part in song.parts) {
    const spec = song.parts[part];
    const inst = spec.i || part;
    if (!INSTRUMENTS[inst]) {
      problems.push(`${at}/${part}: instrument "${inst}" is not in INSTRUMENTS`);
      continue;
    }
    const text = new Array((spec.r || 1) + 1).join(spec.s);
    // tokenize() is the same classifier compile() uses, so this guard cannot
    // drift from the compiler's idea of a valid token.
    for (const t of Synth.tokenize(text)) {
      if (t.k === 'bad') problems.push(`${at}/${part}: "${t.t}" is not a note name — it would play as a rest`);
    }
  }

  const ev = Synth.compile(song);
  const dur = Synth.span(ev);
  if (!ev.length) problems.push(`${at}: compiles to zero notes`);
  if (dur < 10) problems.push(`${at}: only ${dur.toFixed(1)}s long`);
  for (const e of ev) {
    if (!(e.d > 0)) problems.push(`${at}: note at ${e.t.toFixed(2)}s has length ${e.d}`);
    if (e.m < 12 || e.m > 108) problems.push(`${at}: midi ${e.m} out of range`);
  }
  song._dur = dur;
}

// a library with one giant track and five stubs is worse than none
const durs = TRACKS.map(s => s._dur);
if (Math.max(...durs) / Math.max(1, Math.min(...durs)) > 6) {
  problems.push(`track lengths are wildly uneven: ${durs.map(d => d.toFixed(0) + 's').join(', ')}`);
}

if (problems.length) {
  console.error('track library guard: FAIL\n');
  problems.forEach(p => console.error('  - ' + p));
  console.error(`\n${problems.length} problem(s)`);
  process.exit(1);
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`track library guard: ok — ${TRACKS.length} tracks, ${Object.keys(INSTRUMENTS).length} instruments\n`);
console.log('  ' + pad('title', 22) + pad('bpm', 6) + pad('len', 8) + 'notes');
for (const s of TRACKS) {
  console.log('  ' + pad(s.title, 22) + pad(s.bpm, 6) + pad(s._dur.toFixed(1) + 's', 8)
    + Synth.compile(s).length);
}
