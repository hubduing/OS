# Modular Application Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganise NEXUS OS sources so every application is a self-contained folder with declared, enforced dependencies, while observable behaviour stays identical.

**Architecture:** A new `src/manifest.js` is the single source of truth for what loads and in what order. The builder topologically sorts it, wraps each module folder in a generated IIFE, and calls its `register(ctx)`. Modules reach the kernel through `ctx.core` and each other only through `ctx.use(id)`, which throws on an undeclared id. The kernel stays flat and out of scope.

**Tech Stack:** vanilla HTML/CSS/JS, Node 18+ build and test scripts, no dependencies, no framework, no ES modules.

**Spec:** `docs/superpowers/specs/2026-10-01-modular-apps-design.md`

## Global Constraints

- The deliverable stays one self-contained `nexus-os.html` that boots from `file://` by double-click. No build step may add a runtime dependency, transform code, minify, or `eval`.
- No `import`/`export`. No bundler features. The manifest is read as plain data.
- Modules may not read `localStorage` directly; storage goes through `LS` from `ctx.core`.
- No node may connect to `ctx.destination` outside the kernel audio module. All audio goes through `Audio2` with an explicit category: `'ui'`, `'game'`, or `'media'`.
- `el(tag, cls, parent)` takes a **parent** as its third argument, never a handler.
- Observable behaviour is held constant. The emitted HTML differs byte-for-byte; only behaviour is a success criterion.
- **No line-count gate.** Decomposition is driven by cohesion. Do not split a file to reach a number, and do not merge files to avoid a number.
- Commit and push after every task. `main` tracks `origin/main`.

## Review Focus

Each line names an input or condition the spec implies but no task's test exercises, most likely to bite first. The owning task pins it.

1. **A dependency forgotten in `deps`.** Someone calls `ctx.use('reel')` from `apps/video` without declaring it, or declares it and never calls it. Expect a loud throw at boot, not a silent `undefined`.
2. **A module reaching a kernel global directly** (`VFS` instead of `ctx.core.VFS`), which silently works because the kernel is a real global scope and only `test-isolation` would catch it. Expect the guard to fail.
3. **CSS specificity inversion.** App CSS loading after `13-responsive.css` overrides the responsive layout on a narrow window. Expect the layout to hold at 1024px.
4. **A file existing in a folder but not in the manifest `files` list.** Expect the build to fail rather than silently shipping the old bundle.
5. **An IIFE wrapper that hides a name the test suite needs** — `test-songs` needs `Synth`, `TRACKS`, `INSTRUMENTS`, which the wrapper now keeps private. Expect the track guard to reach zero modules and report green.

---

# Phase 0 — Infrastructure

Nothing in `apps/` or `packages/` moves yet. The tree keeps working, the build stays green, and the existing tests still pass. This phase delivers the machine that later phases use.

### Task 1: Manifest loader and topological sort

**Files:**
- Create: `src/manifest.js`
- Create: `tools/lib/manifest.js`
- Create: `tools/test-manifest.js`
- Modify: `build.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `src/manifest.js` — `module.exports = { kernel: {dir, css, js}, cssLate: string[], packages: Entry[], apps: Entry[] }` where `Entry = {id, dir, deps: string[], files: string[], css?: string}`.
  - `tools/lib/manifest.js` — `load(root?) => {kernel, cssLate, packages, apps, order}`, where `order` is `packages` and `apps` concatenated in dependency order. Throws on a cycle, an unknown `deps` id, a directory not listed, a listed directory that does not exist, or a `files` entry naming a missing file.
  - `tools/lib/manifest.js` — `collect(root?) => Array<{id, dir, file, abs, css}>`, one entry per JS file in load order with its owning module. Throws if any `.js` under a module's `dir` is absent from that module's `files`.

- [ ] **Step 1: Write the failing test**

```js
// tools/test-manifest.js
// Asserts, using a temporary manifest written into os.tmpdir():
//  1. a diamond (a->[b,c], d->[b,c]) resolves to a,b,c,d order
//  2. a cycle a->b->a throws /cycle/i
//  3. deps:['nope'] throws /unknown dep/i
//  4. a dir on disk absent from the manifest throws /not listed/i
//  5. files:['ghost.js'] with no file on disk throws /missing file/i
//  6. collect() throws when a .js exists in dir but not in files
//  7. the real src/manifest.js loads and every listed file exists
```

Each case prints `PASS <n> <what>` or `FAIL <n> <what>`; exit non-zero if any FAIL.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tools/test-manifest.js`
Expected: FAIL — `Cannot find module './lib/manifest'`.

- [ ] **Step 3: Implement `tools/lib/manifest.js`**

Export `load(root)` and `collect(root)`.

`load` resolves `src/manifest.js` via `require`, walks `kernel`, `packages` then `apps`, and topologically sorts `packages` and `apps` together with a visiting/visited pair; on re-entry into a `visiting` node throw `Error('dependency cycle: ' + chain.join(' -> '))`. Sort by id within a dependency level so output is deterministic.

`collect(root)` returns the kernel's files first (filename order), then one entry per package/app file in dependency order. Each entry is `{id, dir, file, abs, css}`. For the coverage check, group entries by `dir` and assert the union of their `files` covers every `.js` in that directory exactly once — a file claimed twice is a duplicate and fails, a file claimed by nobody is an orphan and fails. This grouping is what lets several manifest entries share one directory in Phase 0.

- [ ] **Step 4: Write `src/manifest.js` describing the current tree**

Phase 0 must describe reality, not the target. The tree is still flat, so the manifest collapses everything into the single `kernel` entry and leaves `packages`/`apps` empty. The graph is flat and the order matches today's filename order:

```js
kernel: { dir: 'src/js', css: null, js: '*.js' },
packages: [],
apps: [],
};
```

Kernel JS still concatenates in filename order, exactly as `build.js` does today,
so the emitted bundle is unchanged. `apps`/`packages` start empty and are
populated by Phase 1.

**This flat shape is why `collect()`'s stray-file check must tolerate a shared
directory.** With one `dir` for the whole kernel, every file is legitimately
covered by that single entry, and a naive per-entry `readdirSync` cross-check
would flag 31 files as stray for all of them. Instead: group entries by `dir`,
and assert that the union of their `files` covers every `.js` in the directory
exactly once. A file claimed by two entries is a duplicate and must fail; a file
claimed by none is an orphan and must fail.

- [ ] **Step 5: Wire `build.js` to the manifest**

Replace the `readDir(SRC/'js')` concat with `collect()` for JS while leaving the CSS path unchanged, so output stays byte-identical to the baseline. Keep the existing `assertBalanced` comment check and the "every source file is referenced" check, now driven by `collect()`.

- [ ] **Step 6: Verify byte-identical output**

Run: `node build.js` then `git diff --stat nexus-os.html`
Expected: empty diff. The manifest must not have changed the bundle yet.

- [ ] **Step 7: Verify the whole suite**

Run: `node build.js --check && npm test`
Expected: both green; the three existing guards still pass because the tree is unchanged.

- [ ] **Step 8: Commit and push**

```bash
git add src/manifest.js tools/lib/manifest.js tools/test-manifest.js build.js package.json
git commit -m "build: manifest-driven load order with dependency checking"
git push origin main
```

---

### Task 2: The `ctx` surface

**Files:**
- Create: `src/00-kernel-ctx.js`
- Create: `tools/test-isolation.js`
- Modify: `build.js`, `package.json`

**Interfaces:**
- Consumes: `collect()` from `tools/lib/manifest.js` (Task 1).
- Produces:
  - `src/00-kernel-ctx.js` — defines `const KERNEL_CTX = Object.freeze({ $, $$…, core, use, registry })`. `core` is a frozen object holding every kernel global; `use(id)` throws `Error('undeclared dependency: ' + id)` unless `id` is in the current module's `deps`; `registry` is the map of module id to exported object, filled as modules register.
  - `tools/lib/kernel-names.js` — `kernelNames(root?) => string[]`, the authoritative list of names on `ctx.core`.
  - `tools/test-isolation.js` — exits non-zero when a module references a kernel name it did not destructure from `ctx.core`.

- [ ] **Step 1: Write the failing test**

```js
// tools/test-isolation.js
// Case 1: a module that calls VFS.node( but never destructures VFS from ctx.core
//         -> FAIL listing the file and line.
// Case 2: the same module after `const { VFS } = ctx.core;` -> PASS.
// Case 3: a name in kernel-names.js that does not exist anywhere in the kernel
//         tree -> FAIL (keeps the list honest).
// Case 4: every current module is checked, and the count is printed, so a
//         refactor that makes the checker find zero modules is visible.
```

Detection: for each kernel name, regex `(?<![\w.$])NAME(?![\w$])` per line; skip lines that are the destructuring line itself, comments, and string literals containing `nexus.` or `.nexus`.

- [ ] **Step 2: Run it to verify it fails**

Run: `node tools/test-isolation.js`
Expected: FAIL — cannot find `tools/lib/kernel-names.js`.

- [ ] **Step 3: Write `tools/lib/kernel-names.js`**

Derive the list by scanning the kernel directory named in the manifest (`manifest.kernel.dir`) for top-level `const|let|var NAME =`, `function NAME(` and `NAME =` declarations, excluding `APPS` members and names declared inside an IIFE. Returned sorted and unique. Never hardcode `src/kernel` or `src/js` — Task 2 runs before the tree moves, and a hardcoded path would make this task depend on Task 4.

- [ ] **Step 4: Create `src/00-kernel-ctx.js`**

Must be concatenated **first**, before `01-core.js`, so `ctx.core` can be frozen over a fully populated global set. Because the kernel is a real shared scope, build it by reading the names off the scope at that point:

```js
/* KERNEL_NAMES is a literal injected by build.js at emit time — the builder
   computes it with tools/lib/kernel-names.js. */
const core = {};
for (const n of KERNEL_NAMES) { if (n in globalThis) core[n] = globalThis[n]; }
const KERNEL_CTX = {
  core: Object.freeze(core),
  registry: {},
  __deps: [],                       // internal; modules never read this
  use(id) { /* throw unless __deps includes id */ },
};
```

`KERNEL_CTX` itself is **not** frozen — freezing would make the per-module
`use` binding unassignable, and the assignment would fail silently outside
strict mode. `ctx.core` is frozen, so a module cannot replace a service; that is
the guarantee worth having. `registry` stays mutable because modules fill it.

- [ ] **Step 5: Make `build.js` emit the IIFE wrapper**

For each module in `collect()` order, emit:

```js
/* MODULE: <id>  dir: <dir> */
(function () {
  'use strict';
  KERNEL_CTX.__deps = ['a','b'];
  var __exports = {};
  /* …concatenated files, verbatim… */
  __exports = register(KERNEL_CTX);
  KERNEL_CTX.__deps = [];
  KERNEL_CTX.registry[<id>] = __exports || {};
})();
```

`register` must be declared in the module's concatenated body. Emit a build error naming the module if the concatenated text lacks a `register` declaration, so a folder that forgets it fails at build time.

Also inject the literal `KERNEL_NAMES = [...]` array at the top of `00-kernel-ctx.js`, computed by `build.js` via `tools/lib/kernel-names.js`. The builder is the single source of truth for that list; the script and the bundle must not compute it independently.

- [ ] **Step 6: Run `node build.js --check`**

Expected: FAIL — the current files are bare statements with no `register`. This is expected and correct: Task 3 converts them.

- [ ] **Step 7: Commit and push**

```bash
git add src/00-kernel-ctx.js tools/lib/kernel-names.js tools/test-isolation.js build.js package.json
git commit -m "build: generate an IIFE wrapper per module, expose ctx.core and ctx.use"
git push origin main
```

---

### Task 3: Convert the kernel into `register(ctx)` modules

The current 22 kernel files (`01-core.js` … `27-api-boot.js`) each become a module whose top level is one `register(ctx)` call. This is the mechanical step that makes Task 4's move possible.

**Files:**
- Modify: all of `src/js/01-core.js` … `src/js/27-api-boot.js` and `src/js/28-synth.js` … `src/js/32-subtitles.js`
- Modify: `src/manifest.js`
- Modify: `tools/lib/manifest.js`

**Interfaces:**
- Consumes: `ctx.core` and `register` from Task 2.
- Produces: 32 modules that each run `register(ctx)` and export what they define. Modules that define no package export return `{}`.

- [ ] **Step 1: Write the failing test**

Run the existing guard first to capture the baseline it must keep satisfying:

Run: `npm test`
Expected: green before any edit. This is the regression baseline for Task 3.

- [ ] **Step 2: Convert one file by hand and prove the pattern: `src/js/32-subtitles.js`**

It is the smallest and defines only `Subs`. Change the body to:

```js
register(ctx) {
  const Subs = { /* …unchanged body… */ };
  return { Subs };
}
```

and set its manifest entry to `deps: []`, `files: ['32-subtitles.js']`.

- [ ] **Step 3: Prove the pattern works end to end**

Run: `node build.js --check && node tools/serve.js` is a background process — instead open `http://127.0.0.1:8899/nexus-os.html`, wait ~6.8s for boot, click the `.pri` button in `#mdlFoot`, and evaluate `typeof Subs`.
Expected: `"object"`. Boot completes with 0 console errors, and all 14 apps still open.

- [ ] **Step 4: Convert the remaining 31 files with a script, not by hand**

Write a temporary `tools/_wrap.js` that, for each listed file, indents the existing body by two spaces, prepends `register(ctx) {` and appends `return { /* names it declared */ };`, and skips files already converted. Detect declared names with the same regex `tools/lib/kernel-names.js` uses. Do not touch `src/00-kernel-ctx.js`.

- [ ] **Step 5: Add explicit destructuring at the top of each converted `register`**

For each module, insert `const { … } = ctx.core;` listing exactly the kernel names that module references. Derive the list with the `tools/_deps.js` scan from the design phase — each module's reference set is already known. Delete `tools/_deps.js` afterwards.

- [ ] **Step 6: Run `node tools/test-isolation.js`**

Expected: green. Any FAIL here is a module still reaching for a kernel global it did not declare — fix by adding it to that module's destructuring line.

- [ ] **Step 7: Run the full suite and the browser check**

Run: `node build.js --check && npm test`
Expected: green. Browser: 14 apps open, 0 console errors, subtitle rendering unchanged in the video player.

- [ ] **Step 8: Commit and push**

```bash
git add -A
git commit -m "refactor: wrap every module in register(ctx) with explicit kernel destructuring"
git push origin main
```

---

### Task 4: The kernel moves to `src/kernel/`, and three globals change owner

**Files:**
- Create: `src/kernel/` (moved from `src/js/`)
- Create: `src/kernel/13-responsive.css` (moved from `src/css/`)
- Modify: `src/manifest.js`, `build.js`, `tools/lib/kernel-names.js`, `tools/test-audio-mute.js`

**Interfaces:**
- Consumes: the converted modules from Task 3.
- Produces: a `kernel` entry in the manifest that the builder concatenates in filename order and loads before every package and app. `APPS`, `formatLap` and `applySettings` become kernel-owned.

- [ ] **Step 1: Write the failing test**

Add a case to `tools/test-manifest.js`: `src/js/` no longer exists, `src/kernel/` does, and every `apps/` and `packages/` dir is listed. Run it and confirm FAIL before moving.

- [ ] **Step 2: Move the tree with `git mv`**

Move `src/js/*.js` → `src/kernel/`, `src/css/*.css` → `src/kernel/`. Then add `src/packages/` and `src/apps/` as empty directories with a `.gitkeep`, so the manifest's tree check has something real to point at in Phase 0.

- [ ] **Step 3: Move `APPS` into the kernel**

It is currently declared at line 4 of `11-files.js`. Move `const APPS = {};` into `src/kernel/00-registry.js`, which sorts before `11-files.js`, and rename the old file to `11-files-app.js` only if a collision with the numeric prefix forces it. Update the manifest `kernel.js` list accordingly.

- [ ] **Step 4: Move `formatLap` into the kernel**

It is declared in `15-browser.js` and used by `22-arcade.js` and `24-game-racer.js`. Move it verbatim into `src/kernel/00-registry.js` next to `APPS`. Remove the declaration from the browser module. `test-isolation` will now confirm no module reaches it directly — they must destructure it from `ctx.core`.

- [ ] **Step 5: Move `applySettings` into the kernel**

Called by both `18-settings.js` and the boot sequence in `27-api-boot.js`. Move it into `src/kernel/00-registry.js`. It dispatches only to kernel services (`Wall`, `WM`, `Diag`, tray and desktop renderers), so kernel ownership is correct and the settings app becomes a consumer rather than the provider.

- [ ] **Step 6: Update `build.js` for the two-tier CSS order**

Emit CSS as: all `src/kernel/*.css` except `cssLate`, then the `css` of each package and app in load order, then each `cssLate` entry. Set `cssLate: ['kernel/13-responsive.css']`.

- [ ] **Step 7: Point `tools/lib/kernel-names.js` and the guards at the new path**

`test-audio-mute.js` hardcodes `03-audio.js`, `-game-`, `-synth.js` and the `(?:^|\d+-)(music|video|reel)\.js` pattern, and reads `src/js`. Replace its `SRC` with the manifest-driven file list and its name predicates with `id`-based checks: `isGame` = `id` in `{game-snake, game-racer, arcade}`, `isMedia` = `id` in `{music, video}`, `isSynth` = `id === 'synth'`. **Keep the `AUDIO_MODULE` check keyed to the manifest id `kernel-audio`,** and add the "unaccounted for file" failure the spec requires: if `collect()` returns zero modules, or any `.js` under a module dir is missing from `files`, the guard must fail loudly.

- [ ] **Step 8: Verify: build green, suite green, behaviour identical**

Run: `node build.js --check && npm test`
Expected: green. Browser: 14 apps open, 0 console errors. Resize to 1024px and confirm the responsive layout still wins — this is the `cssLate` check.

- [ ] **Step 9: Commit and push**

```bash
git add -A
git commit -m "refactor: kernel to src/kernel; APPS, formatLap and applySettings become kernel-owned"
git push origin main
```

---

# Phase 1 — Pilot

Two applications, chosen to be opposites: `calculator` is small with no dependencies; `music` is large and depends on two packages. If the contract is wrong, it is wrong in a way visible from both.

### Task 5: Move the consumers out of the kernel first

**This task was rewritten after it failed. Do not skip to the package extraction.**

The original Task 5 extracted `synth`, `songs` and `subtitles` into packages. It
cannot land, for two reasons found by attempting it:

**The dependency edge runs the other way.** `INSTRUMENTS` is *declared* in
`29-songs.js:17` and *consumed* in `28-synth.js:161`. The plan and the spec both
recorded it as `songs -> synth`; the source says `synth -> songs`. Following the
plan verbatim would have made `songs` ask for a name `synth` never exports, and
`Synth.voice` would have thrown on the first note.

**The kernel cannot consume a package.** `17-music.js` uses `Synth` and
`TRACKS`, `30-video.js` uses `Subs`, `31-reel.js` uses `Subs.parse`. Those three
files stay in the kernel until Tasks 7 and 8 move them. The kernel is barred
from reading `ctx.core` (build.js fails the build on it) and packages register
*after* the kernel, so there is no legal way for kernel code to reach a package.
Wrapping the providers first therefore strands three kernel files on names that
have left their scope — `ReferenceError: Synth is not defined` at boot.

The fix is ordering, not architecture: **consumers move out before providers
leave.** An app may read `ctx.core`, so a consumer that moves while its provider
is still kernel-owned is fine.

- [ ] **Step 1: Move `17-music.js` to `src/apps/music/`**

It becomes an app module with `register(ctx)` that registers into `APPS.music`
and reads `Synth` and `TRACKS` from `ctx.core` — both are still kernel names at
this point. Do not declare `deps` yet; there is nothing to depend on.
Move its CSS out of `14-music-video.css` and `09-paint-media.css` into
`src/apps/music/music.css`, keeping `.mdStage{flex:1;height:auto;min-height:180px}`
with the rules it corrects.

- [ ] **Step 2: Move `30-video.js` to `src/apps/video/` and `31-reel.js` to `src/packages/reel/`**

Same treatment. `reel` becomes a package exporting `{ Reel }`; `apps/video`
reads `Reel` and `Subs` from `ctx.core` for now. Move the `.vd*`, fullscreen and
music/video CSS into the respective folders.

- [ ] **Step 3: Verify the kernel no longer references any name it is losing**

Run `node build.js --check`. The return-list parity check is the instrument for
this: it fails if a name left the kernel but is still returned, or vice versa.
Then confirm the kernel's core name count dropped by exactly the moved names and
that nothing undefined remains.

- [ ] **Step 4: Browser check**

Boot to "NEXUS OS ready", open Music and Video, confirm the track library loads
and the reel renders, console clean. `test-isolation` must report a non-zero
converted-module count.

- [ ] **Step 5: Commit and push**

```bash
git add -A && git commit -m "refactor: music, video and reel leave the kernel" && git push origin main
```

---

### Task 5b: `packages/synth`, `packages/songs`, `packages/subtitles`

Only possible after Task 5. Now that no kernel file references `Synth`,
`TRACKS`, `INSTRUMENTS`, `Reel` or `Subs`, those names may leave the kernel.

**Files:**
- Create: `src/packages/synth/entry.js` (from `src/kernel/28-synth.js`)
- Create: `src/packages/songs/data.js` (from `src/kernel/29-songs.js`)
- Create: `src/packages/subtitles/entry.js` (from `src/kernel/32-subtitles.js`)
- Modify: `src/manifest.js`; `src/apps/music/entry.js`; `src/apps/video/entry.js`; delete the three kernel files

**Interfaces:**
- Consumes: `ctx.core`; `ctx.use` for the declared edge.
- Produces: `synth` exporting `{ Synth }` with `deps: ['songs']`; `songs` exporting `{ TRACKS, INSTRUMENTS }`; `subtitles` exporting `{ Subs }`. `apps/music` and `apps/video` switch their reads from `ctx.core` to `ctx.use('synth')` / `ctx.use('songs')` / `ctx.use('reel')` / `ctx.use('subtitles')`.

- [ ] **Step 1: Declare the edge the way the code actually has it**

`INSTRUMENTS` lives in `songs` and is used by `synth`, so the manifest reads:

```js
packages: [
  { id:'songs',     dir:'packages/songs',     deps:[],        files:['data.js'] },
  { id:'synth',     dir:'packages/synth',     deps:['songs'], files:['entry.js'] },
  { id:'subtitles', dir:'packages/subtitles', deps:[],        files:['entry.js'] },
],
```

`synth` reads `const { INSTRUMENTS } = ctx.use('songs')`. Note the shape for the
record: the engine depends on the content, not the other way round. That is what
the source says. If the synth is ever reused with different content, `INSTRUMENTS`
should split into its own package at that point — not now.

- [ ] **Step 2: Point the consumers at `ctx.use`**

`apps/music` declares `deps: ['synth','songs']`; `apps/video` declares
`deps: ['reel','subtitles']`. Both stop reading those five names from `ctx.core`.

- [ ] **Step 3: Prove the contract**

Show `ctx.use('songs')` resolving inside `synth`, and show an undeclared id
throwing `undeclared dependency`. The kernel core count must fall by the five
moved names with the return-list parity still green.

- [ ] **Step 4: Run `npm test` and a browser check**

All guards green. Boot, open Music and Video, confirm the track library plays and
the reel renders with chapters and subtitles, console clean.

- [ ] **Step 5: Commit and push**

```bash
git add -A && git commit -m "refactor: synth, songs and subtitles become packages" && git push origin main
```

---

### Task 6: The track guard reads the real bundle

`tools/test-songs.js` runs raw files through `vm.runInContext` and pulls `Synth, TRACKS, INSTRUMENTS` off the vm global. Task 2's IIFE makes those names private, so the guard would find nothing and report green — Review Focus item 5. Task 5 must run first: these packages have to exist before the guard can read them.

**Files:**
- Modify: `build.js`, `tools/test-songs.js`
- Create: `tools/lib/bundle.js`

**Interfaces:**
- Consumes: `collect()` (Task 1), the emitted wrapper (Task 2), the `synth`/`songs` packages (Task 5).
- Produces:
  - `build.js --emit-test-bundle <dir>` — writes one JS file per module, each already wrapped, plus an `index.js` that registers them all and assigns `globalThis.__exports = KERNEL_CTX.registry`.
  - `tools/lib/bundle.js` — `loadExports(root?) => {Synth, TRACKS, INSTRUMENTS, …}`, invoking the above and returning the registry.

- [ ] **Step 1: Write the failing test**

Add to `tools/test-songs.js` a first case: `loadExports()` must return a registry containing `synth`, `songs` and `subtitles` keys. Run and confirm FAIL before implementing — the guard must prove it is actually checking something.

- [ ] **Step 2: Implement `--emit-test-bundle` in `build.js`**

Reuse the exact wrapper emitter from Task 2 rather than writing a second one; the point of this task is that the guard exercises the real emitted shape. Stub `Audio2` in the sandbox with `{on: () => true, bus: null, ctx: null}` as today.

- [ ] **Step 3: Rewrite `test-songs.js` to use `loadExports()`**

Replace the `vm.runInContext` export pull with `const { synth, songs } = loadExports()` then `const { Synth } = synth, { TRACKS, INSTRUMENTS } = songs`. Keep every existing assertion unchanged — the track library rules are not part of this refactor.

- [ ] **Step 4: Verify the guard still catches a bad pattern**

Temporarily insert a `Z9` token into a `TRACKS` part, run `node tools/test-songs.js`.
Expected: FAIL naming the token.
Then revert and confirm green. A guard that cannot fail is the exact defect this task exists to remove.

- [ ] **Step 5: Commit and push**

```bash
git add build.js tools/lib/bundle.js tools/test-songs.js
git commit -m "test: track guard loads the real wrapped bundle instead of raw files"
git push origin main
```

---

### Task 7: `packages/reel`

**Files:**
- Create: `src/packages/reel/chapters.js` (chapter table), `src/packages/reel/render.js` (`Reel.render`)
- Modify: `src/manifest.js`; delete `src/kernel/31-reel.js`

**Interfaces:**
- Consumes: `ctx.use('subtitles')` for the baked-in subtitle track.
- Produces: registry entry `reel` exporting `{ Reel }` with `Reel.duration`, `Reel.chapters`, `Reel.render(ctx2d, t)`, `Reel.subtitles()`.

- [ ] **Step 1: Split by role**

`chapters.js` holds the five chapter definitions and the duration total. `render.js` holds the drawing. This split is by role, not by size: the chapter table is data, the renderer is a pure function of `t`.

- [ ] **Step 2: Preserve the purity rule**

`render.js` must contain no `Math.random()` and no module-level mutable accumulator. Add a static check to `tools/test-isolation.js` (or a sibling assertion in it): scanning `src/packages/reel/render.js` for `Math.random` fails the build. Scrubbing the scrubber would reshuffle the starfield.

- [ ] **Step 3: Commit and push**

```bash
git add -A && git commit -m "refactor: reel becomes a package split into chapters and a pure renderer" && git push origin main
```

---

### Task 8: `apps/music`

**Files:**
- Create: `src/apps/music/entry.js`, `src/apps/music/view.js`, `src/apps/music/tracklist.js`, `src/apps/music/music.css`
- Modify: `src/manifest.js`; delete `src/kernel/17-music.js`; move the music rules out of `src/kernel/09-paint-media.css` and `src/kernel/14-music-video.css`

**Interfaces:**
- Consumes: `ctx.use('synth')` → `Synth`; `ctx.use('songs')` → `TRACKS`; `ctx.core` → `{ $, el, clamp, fmtBytes, fmtDur, esc, ICONS, LS, Audio2, toast, Achievements, APPS }`.
- Produces: `APPS.music`, registered as before, so `API.open('music')`, the desktop icon, the pinned list and the NEXUS alias all keep working with no changes to them.

- [ ] **Step 1: Write the browser check first**

Note the four entry points that must still work: `API.open('music')`, the desktop icon, the Start menu entry, and the NEXUS phrase. All four resolve `APPS.music` by id, so they need no edit — this step exists so a regression in any of them is caught.

- [ ] **Step 2: Split by role**

`tracklist.js` — the six-track library view and the unified playlist including local files. `view.js` — transport bar, spectrum visualizer, shuffle/repeat, seek, volume. `entry.js` — metadata and `APPS.music = {title, icon, desc, w, h, build(win, opts)}`.

- [ ] **Step 3: Move the CSS into the folder**

`.muNow` and `.muArt` out of `14-music-video.css`; the media-selector rules out of `09-paint-media.css`. Keep `.mdStage{flex:1;height:auto;min-height:180px}` — it overrides an inherited `height:34%` that squeezed the visualizer to 182px of 562. The override must travel with the rule it corrects.

- [ ] **Step 4: Verify in the browser**

Run `node build.js --check && npm test`, then in the browser: open music, confirm the visualiser stage is a usable height (not ~180px in a tall window), play a track, scrub, toggle shuffle and repeat, and confirm `Media sounds` off silences it while the transport keeps advancing.

- [ ] **Step 5: Commit and push**

```bash
git add -A && git commit -m "refactor: music becomes an app folder with its own stylesheet" && git push origin main
```

---

### Task 9: `apps/calculator`

**Files:**
- Create: `src/apps/calculator/entry.js`, `model.js`, `view.js`, `calculator.css`
- Modify: `src/manifest.js`; delete `src/kernel/14-calculator.js`; move its rules out of `src/kernel/07-editor-calc.css`

**Interfaces:**
- Consumes: `ctx.core` → `{ $, el, esc, ICONS, LS, Audio2, APPS }`.
- Produces: `APPS.calculator`. It sets `API.lastCalc = {e, r}` on `=`, which the NEXUS assistant reads — that must keep working.

- [ ] **Step 1: Split by role, and take `model.js` seriously**

`model.js` holds the state machine (`cur`, `prev`, `op`, `fresh`, `expr`), `compute`, `fmt`, and the history array — the pure logic. `view.js` holds the display, the keypad construction, and the click wiring. `entry.js` holds metadata and the keydown handler.

This is the app that proves the role vocabulary: `model` is genuinely separable here, so the split is real rather than a rename.

- [ ] **Step 2: Verify the history behaviour**

Open calculator, run `12 × 7 =`, confirm the result and that the history row appears; click the history row to recall it; right-click to delete it; reload and confirm it persisted under `nexus.calcHist`.

- [ ] **Step 3: Commit and push**

```bash
git add -A && git commit -m "refactor: calculator becomes an app folder, model separated from view" && git push origin main
```

---

# Phases 2–5 — The remaining applications

Each phase moves the listed apps, following the contract proven in Phase 1. Before writing each phase's tasks, run `tools/_deps.js` over the current tree to get each app's exact kernel reference list and its real dependencies, and fold any newly-exposed coupling into the phase rather than leaving it implicit. **If a phase reveals a dependency the spec did not anticipate, stop and record it in the spec before continuing.**

### Phase 2 — `files`, `terminal`, `editor`
Largest cluster. `files` depends on nothing; `terminal` reads `resolveApp` (see Phase 3) and `achievements`; `editor` writes through `VFS` and `Bus`.
Known work: `12-terminal.js` is the biggest kernel file and has command dispatch, a `NEXUS_PAGES`-style table, and rendering. Split by role — `data.js` for command tables, `commands.js` for dispatch, `view.js` for the terminal surface — without splitting for size alone.

### Phase 3 — `browser`, `paint`, and the assistant engine
Two things here beyond a plain move:
- `packages/assistant` — `NEXUS`, `resolveApp`, the jokes/fortunes/help tables move out of the app into a package, because `files`, `terminal`, `settings`, `browser`, `computer`, `diagnostics` and `arcade` all call `NEXUS` or `resolveApp`. `apps/nexus` becomes just the window. This is the one place where an app splits into a package plus a window.
- `browser` loses `formatLap`, which Phase 0's kernel move gave the kernel.

### Phase 4 — `settings`, `computer`, `diagnostics`, `achievements`
`settings` loses `applySettings`, which Phase 0's kernel move gave the kernel; `achievements` (17 lines) stays a single `entry.js` with no `model.js`, which is the point of the role vocabulary — no empty file.

### Phase 5 — `video`, `arcade`, and the two games
- `packages/game-snake` and `packages/game-racer` return `{ buildSnake }` and `{ buildRacer }`; `apps/arcade` declares both in `deps` and reads them via `ctx.use`. The `GAMES` table becomes `apps/arcade/data.js`, since only the arcade indexes it.
- `apps/video` declares `deps: ['reel', 'subtitles']`.

### Final — documentation and full sweep
- Rewrite the README's Layout, Commands and "Layout inside a module" sections for the new tree; delete the "keep global names unique" rule and point at `test-isolation` instead.
- `tools/sizes.js` reads the manifest.
- `package.json` scripts list all six guards.
- Full OSTest.md sweep: 14 apps, 0 console errors, every NEXUS phrase resolving, mute toggles honoured, the reel scrubbable, both games playable.

---

## Verification Commands

Run at the end of every task:

```
node build.js --check
npm test
git status --short          # must be clean after the commit
```

Browser, per phase: `node tools/serve.js` then open `http://127.0.0.1:8899/nexus-os.html`, wait ~6.8s for boot, click `.pri` in `#mdlFoot`, open every moved app, and read the console.

Canvas apps need the rAF patch applied **before** opening, because rAF is suspended in hidden tabs. The patch must always feed frames via `setTimeout` and must never fall through to the real rAF. Count replay by frames, not wall clock. Reload the page to clear a stale patch.
