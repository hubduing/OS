# NEXUS OS

A desktop environment that runs in a browser tab. One self-contained HTML file,
no frameworks, no backend, no build step for the *user* — double-click
`nexus-os.html` and it boots.

The sources are modular. `nexus-os.html` is **generated** — never edit it
directly; edit `src/` and run the build.

## Layout

```
nexus-os.html          ← the deliverable (generated, do not edit)
build.js               ← concatenates src/ into nexus-os.html
src/
  shell.html           ← doctype, <head>, body skeleton, {{CSS}} / {{JS}}
  css/01-base.css      ← variables, reset, typography
  css/02-boot-wall.css ← boot screen, wallpaper layer
  …
  js/01-core.js        ← icons, helpers ($ el clamp fmtBytes …)
  js/02-storage.js     ← localStorage wrapper, settings
  js/03-audio.js       ← Web Audio engine
  js/04-vfs.js         ← virtual filesystem
  js/05-ui-services.js ← event bus, toasts, dialogs, notifications
  js/06-achievements.js
  js/07-wallpaper.js   ← 12 animated wallpapers
  js/08-window-manager.js ← drag, resize, snap, z-order, Alt+Tab
  js/09-desktop.js     ← desktop icons, clipboard, pinned
  js/10-taskbar-start.js ← tray, clock, start menu, lock screen
  js/11-files.js  js/12-terminal.js  js/13-editor.js
  js/14-calculator.js  js/15-browser.js  js/16-paint.js  js/17-media.js
  js/18-settings.js  js/19-computer.js  js/20-achievements-ui.js
  js/21-diagnostics.js  js/22-arcade.js
  js/23-game-snake.js  js/24-game-racer.js
  js/25-nexus.js  js/26-eggs.js  js/27-api-boot.js
tools/                 ← dev utilities (see below)
```

Files are concatenated in **filename order**, so the numeric prefix *is* the
load order. Every JS module must stand alone at top level: no `import`,
no `export` — the bundle is one shared scope.

## Commands

| command | what it does |
| --- | --- |
| `node build.js` | build `nexus-os.html` |
| `node build.js --check` | build, then verify the bundle parses as JS and CSS braces balance |
| `npm test` | run every guard below (build guard + audio mute + track library) |
| `node tools/serve.js` | static server on `http://127.0.0.1:8899/nexus-os.html` |
| `node tools/test-build-guard.js` | proves the build refuses a module cut through a comment |
| `node tools/test-audio-mute.js [dir]` | every sound is categorised and routed through the Audio2 bus |
| `node tools/test-songs.js` | every token in a hand-written music pattern parses as a real note |
| `node tools/audit-el-args.js` | finds `el(tag, cls, handler)` — the slot takes a *parent*, not a handler |
| `node tools/audit-rewards.js` | reports achievements / easter eggs with no trigger site |
| `node tools/extract.js` | recover `src/js` + `src/css` from the last good build |
| `node tools/sizes.js` | line count per module |
| `node tools/peek.js <file> [from] [to]` | print numbered lines |
| `node tools/split.js <file> <name:lines> …` | split a module into smaller ones (names are explicit, never auto-renumbered) |

## Rules when editing `src/`

1. **Edit the source, rebuild, reload.** `node build.js` then refresh.
2. **A module must not end inside a block comment.** The build enforces this and
   fails loudly; `node tools/fix-boundaries.js` repairs a broken split.
3. **Keep global names unique.** One flat scope: `Wall`, `WM`, `VFS`, `APPS`,
   `Diag`, `API`, … are all shared. Prefix new globals clearly.
4. **No build-time magic.** No bundler features, no minification, no env vars.
   If `node build.js` produces it, a browser can run it as-is.
5. `node build.js --check` must stay green before you consider a change done.
6. Adding an achievement or an easter egg? Give it a trigger and run
   `node tools/audit-rewards.js` — it fails if the reward is unreachable.
7. **Audio has exactly one bus.** Play through `Audio2.tone()` / `Audio2.noise()`
   and name the category as the last argument (`'ui'`, `'game'` or `'media'`).
   Never connect a node straight to `ctx.destination` — that bypasses the master
   gain, which is how the volume slider ends up appearing to do nothing.
   `npm run test:audio` enforces both.

## Sound

Four controls, one bus, three categories:

| control | scope |
| --- | --- |
| Master volume | `Audio2.master.gain`, 0–100 |
| Interface sounds | category `'ui'` — chrome, apps, terminal, assistant |
| Game sounds | category `'game'` — the arcade |
| Media sounds | category `'media'` — music and video, including the synthesiser |

One `AudioContext` serves the whole system:

```
synth voices / <audio> / <video> / engine drone
        -> Audio2.bus -> Audio2.analyser -> Audio2.master -> destination
```

Everything connects to `bus`, never to the destination. A sound plays only if
its category is enabled *and* the volume is above zero, so a muted category
never even builds an oscillator — that gate is `Audio2.on(cat)`, the single
predicate. The analyser sits on the bus so a visualiser can read the real mix
without tapping a private node.

Music needed a category of its own. Folding it into `'ui'` or `'game'` would
have re-created the 2026-09-30 mute bug on day one: with two toggles and three
kinds of sound, one of them is always going to be a lie.

## Music and video

`Synth` (`28-synth.js`) is a look-ahead note scheduler, not a rendered buffer. A
scheduler wakes every 25 ms and queues any event in the next 140 ms onto the
`AudioContext` clock — the only sample-accurate clock available, since
`setInterval` drifts audibly within a couple of bars. Seeking is a binary search
over the compiled event list, so jumping into the middle of a track is instant.

Tracks are data. Each part is a string of 16th-note steps:

| token | meaning |
| --- | --- |
| `.` | rest |
| `C4` | trigger that note |
| `=` | hold the previous note |
| `\|` | ignored — present so the source reads like sheet music |

`r` on a part repeats the pattern, which is what keeps a 50-second track from
having to be written out bar by bar. Percussion uses the same language: the
pitch class picks the drum and the octave is ignored, so `C3` is a kick and
`D3` a snare.

`tools/test-songs.js` exists because a malformed note name does not throw — the
parser returns null and the step silently becomes a rest, so a typo is invisible
until someone listens to a track with a hole in it.

Video plays real files from the local disk or the virtual filesystem. Because a
`<video>` element cannot be fed a synthetic source, `Reel` (`31-reel.js`) draws
a generated reference reel to a canvas instead, so seek, speed, chapters and
subtitles all have something real to act on. It obeys one rule:

> `render(ctx, t)` must be a pure function of `t`.

Nothing accumulates between frames and nothing calls `Math.random()` in the draw
path; all randomness comes from a hash of an integer index. Otherwise dragging
the scrubber reshuffles the starfield and the reel stops being a video.

`Subs.parse()` serves both `.srt` files and the reel's baked-in subtitle track,
because two parsers means two places for a timestamp off-by-one to hide.

## DOM helpers

`el(tag, cls, parent)` **appends to `parent`** and returns the element; the label
and handler are assigned afterwards:

```js
const b = el('button', 'btn', sidebar);
b.textContent = 'Open';
b.onclick = () => open();
```

The third argument is a parent, never a callback. Writing `el('button','btn',fn)`
builds a button that is never inserted, so the control is dead and usually
unlabelled. `node tools/audit-el-args.js` finds these.

## Layout inside a module

Modules are grouped in layers and the numbering follows them:

- `01–06` kernel: helpers, storage, audio, VFS, UI services, achievements
- `07–10` shell: wallpaper, window manager, desktop, taskbar and start menu
- `11–24` applications, one module per app
- `25–27` assistant, easter eggs, boot sequence and global API

Apps register themselves on the shared `APPS` object with a
`{title, icon, desc, w, h, build(win, opts)}` contract, so adding an app means
adding one module and one `APPS` entry.
