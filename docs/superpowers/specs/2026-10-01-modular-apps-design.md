# Modular application architecture — design spec

Date: 2026-10-01
Status: approved by partner
Baseline commit: `1187b4d`

## Intent

NEXUS OS ships as one self-contained `nexus-os.html`, but its sources are a flat
list of 32 numbered JS files in a single global scope. Numbering is the only
thing expressing load order, dependencies between modules are invisible, and
three concrete bugs of that arrangement are already visible in the tree.

The goal is a source layout in which **every application lives in its own
folder, decomposed by role, and registers through an explicit contract**, so
that adding an app means creating a folder and adding one manifest line. The
bundle stays one file and nothing about how NEXUS runs changes.

Success criteria:

- Each app is a folder. Its code and its CSS sit together in that folder.
- Each app's dependencies are declared and enforced, not implied by filename order.
- Three classes of latent defect become build failures instead of runtime bugs.
- Behaviour is unchanged: all 14 apps open, zero console errors, all existing
  guards pass.

Explicitly **not** in scope: changing what any app does, adding features,
bundling, minification, ES modules, or any build-time transformation. The
emitted `nexus-os.html` will differ byte-for-byte from the baseline; only
observable behaviour is held constant.

## Evidence from the current tree

Cross-module global usage was measured across all 32 modules rather than
guessed. Three findings drive this design:

| finding | where | why it matters |
| --- | --- | --- |
| `formatLap` declared in `15-browser.js`, used by `22-arcade.js` and `24-game-racer.js` | app→app, undeclared | a shared formatter owned by an unrelated app |
| `const APPS = {}` declared in `11-files.js` | app owns the app registry | the registry is core infrastructure |
| `GAMES`, `buildSnake`, `buildRacer` connect arcade to its games | undeclared globals | a dependency that exists only in load order |

These are not hypothetical. They are the failure mode this refactor removes:
a dependency that no artifact records and no check verifies. Splitting files
into folders without adding declared, enforced dependencies would leave all
three intact.

## Target layout

```
src/
  shell.html
  manifest.js              ← single source of truth for what loads, and in what order
  kernel/                  ← service singletons, one flat scope, filename order
    01-core.js … 10-taskbar-start.js
    11-eggs.js
    12-api-boot.js
    *.css
  packages/                ← reusable code, knows nothing about APPS
    synth/  songs/  reel/  subtitles/  game-snake/  game-racer/
  apps/
    calculator/  files/  terminal/  editor/  browser/  paint/  music/
    video/  settings/  computer/  achievements/  diagnostics/  arcade/  nexus/
```

`APPS` and `formatLap` move into the kernel, where the app registry and shared
formatters belong. `Eggs` and the boot/API module stay in the kernel: they hang
global handlers and never open a window, which makes them services rather than
applications. The two games become packages, because the arcade depends on them
and they do not depend on the arcade.

## Module contract

Every folder in `packages/` and `apps/` is one unit. Its JS files are
concatenated in manifest order and wrapped by the builder in an IIFE that calls
`register`. The author never writes the wrapper.

```js
/* emitted by build.js around apps/calculator/{entry,model,view}.js */
(function () {
  'use strict';
  var __ctx = { use: __use, core: __core, id: 'calculator', deps: [] };
  function register(ctx) {
    const { Synth } = ctx.use('synth');      // only what this module declared
    const { $, el, esc, ICONS, LS, Audio2 } = ctx.core;   // kernel services
    APPS.calculator = { title, icon, w, h, build(win, opts) { … } };
  }
  register(__ctx);
})();
```

Two halves of `ctx`, deliberately separate:

- **`ctx.core`** — the kernel surface. Assembled once after the kernel loads and
  frozen. This is what replaces the old flat global scope, and `test-isolation`
  checks against this list.
- **`ctx.use(id)`** — the export of another package in this module's declared
  `deps`. It **throws** if `id` is not declared.

Because the IIFE is generated, a module's top-level names are private by
construction. `formatLap` leaking out of the browser app stops being possible
rather than merely discouraged, which is why it is not enough to add a README
rule.

`ctx` is the only channel through which a module reaches anything outside its
folder.

`packages/` modules export by returning an object from `register`; applications
register themselves into `APPS` and return nothing.

```js
/* packages/songs/data.js — the content */
register(ctx) {
  const INSTRUMENTS = { /* … */ };
  const TRACKS = [ /* … */ ];
  return { INSTRUMENTS, TRACKS };
}
```

```js
/* packages/synth/entry.js — the engine */
register(ctx) {
  const { INSTRUMENTS } = ctx.use('songs');
  const Synth = { /* … */ };
  return { Synth };
}
```

```js
/* apps/music/entry.js */
register(ctx) {
  const { Synth } = ctx.use('synth');
  const { TRACKS } = ctx.use('songs');
  APPS.music = { /* … */ };
}
```

Note the shape, because it is the opposite of what intuition suggests: the engine
depends on the content, not the other way round. `INSTRUMENTS` is declared with
the tracks and consumed by the synthesiser. If the synth is ever reused with
different content, `INSTRUMENTS` should split into its own package at that point.

### Ordering: consumers leave the kernel before providers do

The kernel is barred from reading `ctx.core`, and packages register *after* the
kernel, so **kernel code can never reach a package.** A provider therefore
cannot leave the kernel while any kernel file still uses it — that strands the
consumer on a name that has left its scope.

So the migration order is: move the consumers out first (an app may read
`ctx.core`, so a consumer moving while its provider is still kernel-owned is
fine), then extract the providers. A guard against this in reverse: the
build-time return-list parity check fails if a name left the kernel but is still
returned, or is still returned but has left.

`GAMES`, `buildSnake` and `buildRacer` are the concrete case of this rule. Today
`22-arcade.js` reaches into globals that `23-game-snake.js` and
`24-game-racer.js` happen to have defined by load order. Afterwards each game
package returns `{ buildSnake }` / `{ buildRacer }`, and `apps/arcade` declares
both in its `deps` and reads them with `ctx.use`. The shared `GAMES` table
becomes the arcade's own `data.js`, since only the arcade indexes it.

## manifest.js

```js
/* src/manifest.js — illustrative shape; the real file lists every module */
module.exports = {
  // Kernel CSS and kernel JS. Kernel JS keeps filename order.
  kernel: {
    dir: 'kernel',
    css:  '*.css',                 // every .css in the folder, filename order
    js:   '*.js',                  // every .js  in the folder, filename order
  },
  // Loaded after these, so that app CSS can override kernel chrome…
  cssLate: ['kernel/13-responsive.css'],   // …and still be overridden by nothing.
  // Reusable modules. Topologically sorted; exports are what others consume.
  packages: [
    { id: 'synth',      dir: 'packages/synth',      deps: [],            files: ['entry.js'] },
    { id: 'songs',      dir: 'packages/songs',      deps: ['synth'],     files: ['data.js'] },
    { id: 'subtitles',  dir: 'packages/subtitles',  deps: [],            files: ['entry.js'] },
    { id: 'reel',       dir: 'packages/reel',       deps: ['subtitles'], files: ['chapters.js','render.js'] },
  ],
  // Applications. Also topologically sorted; each registers into APPS.
  apps: [
    { id: 'calculator', dir: 'apps/calculator', deps: [], css: 'calculator.css',
      files: ['entry.js','model.js','view.js'] },
    { id: 'music',      dir: 'apps/music',      deps: ['synth','songs'], css: 'music.css',
      files: ['entry.js','view.js'] },
  ],
};
```

The builder reads it, builds the dependency graph over `packages` and `apps`
together, topologically sorts, and fails on: a cycle, a directory not listed in
the manifest, a manifest entry with no directory, a `deps` entry naming an
unknown id, and a folder that never calls `register`.

`css` is optional per entry; `files` is mandatory and ordered. Both are explicit
lists rather than globs inside a module, so that adding a file to a folder
cannot silently change what ships — the alternative is a folder whose contents
affect the build without appearing anywhere.

Numeric filename prefixes disappear from the reorganised tree — the manifest
defines order. The kernel keeps its prefixes, because it is concatenated in
filename order and is explicitly out of scope.

### CSS ordering risk

`13-responsive.css` currently loads last and overrides earlier rules. Once app
CSS loads after the kernel, responsive rules would be overridden by app CSS and
break on small screens. `manifest.cssLate` makes this explicit: kernel CSS, then
package and app CSS, then `13-responsive.css` last. This is stated in the
manifest rather than left to filename accident.

## Decomposition by role

A shared vocabulary; each folder takes only the roles that are genuinely
present, and never gets an empty file.

| role | contents |
| --- | --- |
| `entry.js` | metadata and registration — always present |
| `model.js` | state and pure logic |
| `view.js` | DOM construction |
| `input.js` | keyboard and pointer handling |
| `render.js` | canvas drawing |
| `data.js` | constant tables |
| `<app>.css` | the app's styles, in the same folder |

An app with no logic (`achievements`, 17 lines) stays a single `entry.js`.
Canvas games get `model.js` + `render.js` because their logic and drawing are
not separable, and that is correct rather than a compromise.

`24-game-racer.js` (521 lines, already over the 459 ceiling before this work)
is decomposed during this refactor. The debt closes here instead of in a
separate pass.

## Guards

`npm test` gains three tests.

| test | what it fails on |
| --- | --- |
| `test-manifest` | cycles, orphan directories, missing `deps`, a folder without `register` |
| `test-isolation` | a module referencing a core global it was not handed |
| `test-size` | a file over 459 lines |

`test-isolation` is the one that pays for itself: it replaces the hand-written
README rule "keep global names unique" with a machine check.

`test-size` deserves a note. The 459-line ceiling is a **convention that has
never been enforced anywhere in the repo** — not in `tools/sizes.js`, not in a
test. It existed only as an agreement in conversation. This refactor makes it
executable, which is the only reason to claim it at all: a limit no tool checks
is a preference, and a preference that silently drifts is how a 521-line file
comes to exist. `test-size` is the artefact that stops that from recurring.

The limit applies to `src/**/*.js` including kernel files. Two current files
are close enough to matter: `12-terminal.js` at 449 and `30-video.js` at 401.

Three existing tests (`test-build-guard`, `test-audio-mute`, `test-songs`) hardcode
`src/js/` paths and must be taught to read the manifest. They must **fail loudly
when any source file is unaccounted for** — otherwise a guard silently checks
zero files and reports green.

## Execution order

| phase | work | verification |
| --- | --- | --- |
| 0 | `manifest.js`, `ctx`, builder checks, `APPS`/`formatLap`/`Eggs`/boot into kernel | apps untouched, build green, existing tests green |
| 1 | pilot: `calculator` (small, no deps) and `music` (large, deps synth+songs) | OSTest.md pass, browser clean |
| 2 | `files`, `terminal`, `editor` | same |
| 3 | `browser`, `paint`, `nexus` | same |
| 4 | `settings`, `computer`, `diagnostics`, `achievements` | same |
| 5 | `video`, `arcade`, `game-snake`, `game-racer` | same |
| final | README rewrite, `tools/sizes.js` against the manifest, full OSTest.md sweep | `npm test` green, 14 apps, 0 errors |

Phase 1 is where a wrong contract gets caught, on two files, while the cost of
changing it is two files.

Commit and push after every successful phase. The repository is the rollback
mechanism, so no separate backup copy is made.

## Testing strategy

Per phase: `node build.js --check`, `npm test`, then the OSTest.md loop in a real
browser — open the moved apps, exercise them, read the console. The rAF note
from the media work applies: rAF is suspended in hidden tabs, so canvas apps
need the frame patch before opening, and replay must be counted by frames
rather than wall clock.

Behaviour is compared against the baseline, not judged from a screenshot.

## Risks

| risk | mitigation |
| --- | --- |
| app CSS overriding responsive rules | `manifest.cssLate`; verified in phase 1 with a narrow window |
| a guard silently checking nothing after the path change | guards fail when any file is unaccounted for |
| `ctx` leaking the kernel back into a global convenience | `test-isolation` |
| bundler creep creeping into `build.js` | manifest is read as data; no transformation, no eval |
| phase N breaks phase N−3 | push per phase; `git revert` is the rollback |
