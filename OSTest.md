You are an autonomous senior software engineer, frontend architect, game developer, UI/UX designer, QA engineer, and browser-runtime engineer.

Your task is to build a spectacular browser-based operating system named **NEXUS OS**.

This is an **agentic coding task**.

Do not treat this as a one-shot code-generation request.

You are expected to:

1. inspect the existing project
2. understand its structure
3. create an implementation plan
4. implement the system in phases
5. run the application
6. test the implemented functionality
7. identify failures
8. fix those failures
9. retest
10. polish the result
11. perform a final QA pass

Do not stop after producing code that merely looks correct.

The project is successful only when the major interactions actually work together.

---

# PRIMARY OBJECTIVE

Create a **convincing fake operating system running in the browser**.

It must feel like a real desktop computer rather than a website.

The user should be able to:

* boot the system
* open applications
* move and resize windows
* manage files
* use a terminal
* edit files
* play games
* change the desktop
* use settings
* receive notifications
* discover Easter eggs
* interact with the built-in system assistant
* close and reopen applications without breaking state

The final experience should create the reaction:

> "Wait, this is actually an operating system running in the browser?"

---

# IMPORTANT AGENT RULES

## RULE 1 — DO NOT BUILD EVERYTHING AT ONCE

Do not attempt to write the entire project in one pass.

Implement the system in clearly separated phases.

After each phase:

* run the application
* inspect the UI
* test the relevant functionality
* fix obvious errors
* only then proceed

---

## RULE 2 — VERIFY, DON'T ASSUME

Never assume that a feature works because the implementation appears logically correct.

Whenever possible:

* launch the application
* interact with it
* inspect console/runtime errors
* test important interactions
* verify state changes
* verify persistence

If a feature is broken, fix it before moving on.

---

## RULE 3 — SHARED STATE IS CRITICAL

The applications must not behave like isolated demos.

Create a central application state / OS state architecture.

At minimum maintain shared state for:

* filesystem
* open windows
* settings
* theme
* wallpaper
* notifications
* achievements
* game scores
* user preferences
* system status

All applications must consume the same state.

Example:

If Terminal creates:

/Documents/test.txt

then File Manager must immediately see it.

If Text Editor changes test.txt, Terminal `cat test.txt` must show the new contents.

If Settings changes the wallpaper, the desktop must update.

If a game creates a high score, the Achievement system can detect it.

---

# RULE 4 — KEEP ARCHITECTURE CLEAN

Even if the final deployment is a browser application, do not write one giant tangled script.

Use a clean internal architecture.

Separate responsibilities such as:

* OS kernel/state
* window manager
* filesystem
* application registry
* desktop
* taskbar
* notifications
* settings
* terminal
* games
* persistence
* audio
* UI utilities

Prefer reusable components and utilities.

Avoid duplicated logic.

---

# RULE 5 — PRESERVE WORKING FEATURES

Before changing existing code:

Understand what already works.

Do not rewrite large functioning subsystems unnecessarily.

When adding a feature:

* integrate with existing state
* preserve existing behavior
* run regression tests

Never fix one application by silently breaking another.

---

# RULE 6 — NO PLACEHOLDERS

Do not create:

* fake buttons
* fake menus
* static mock applications
* "coming soon"
* empty windows
* pretend terminal commands
* non-functional games
* decorative controls that do nothing

If a visible control exists, it should do something meaningful.

---

# PROJECT STRUCTURE

Use a maintainable structure.

A suggested architecture:

src/
core/
osState
persistence
eventBus
appRegistry

desktop/
desktop
taskbar
launcher
notifications

window/
windowManager
window
resize
drag

filesystem/
filesystem
fileModel
pathUtils

apps/
fileManager
terminal
editor
calculator
browser
paint
media
settings
arcade
diagnostics
nexus

games/
snake
cyberRacer

audio/
themes/
utils/

Adapt this structure to the actual project.

Do not blindly follow it if a better architecture is appropriate.

---

# PHASE 0 — PROJECT INSPECTION

Before changing anything:

Inspect the existing repository.

Determine:

* framework
* build system
* entry points
* routing
* styling strategy
* asset structure
* available dependencies
* existing components
* current runtime behavior

Do not duplicate functionality that already exists.

If the repository is empty, initialize the simplest architecture appropriate for the task.

---

# PHASE 1 — OS SHELL

Build the operating system foundation first.

Implement:

* full-screen desktop
* desktop wallpaper
* desktop icons
* taskbar
* system tray
* live clock
* application launcher
* context menu
* notification foundation

Create the visual identity for NEXUS OS.

Design direction:

**futuristic + premium + hacker aesthetic + subtle nostalgia**

Use:

* translucent surfaces
* blur
* soft shadows
* smooth motion
* atmospheric backgrounds
* restrained glow
* high-quality typography

Do not make the UI look like a generic admin dashboard.

---

# PHASE 2 — WINDOW MANAGER

Implement a real window manager.

Every application must run inside a window.

Required:

* draggable
* resizable
* focus
* z-index management
* minimize
* maximize
* restore
* close
* taskbar integration

Interactions:

* double-click titlebar → maximize
* click window → bring to front
* taskbar button → focus/minimize
* Alt+Tab → cycle windows
* multiple windows can coexist

Prevent windows from becoming inaccessible offscreen.

Test:

* 3+ windows
* rapid focus switching
* minimizing/restoring
* resize from edges
* resize from corners
* maximizing and restoring

---

# PHASE 3 — PERSISTENT VIRTUAL FILESYSTEM

Implement a real virtual filesystem.

Initial structure:

/
├── Desktop
├── Documents
│   ├── Welcome.txt
│   └── Ideas.txt
├── Downloads
├── Pictures
├── Music
├── Videos
├── Games
└── Home
├── Projects
└── Notes

Support:

* create file
* create folder
* delete
* rename
* move
* copy
* read
* write
* search
* directory traversal

Persist using localStorage or IndexedDB.

Create a proper path abstraction.

All applications must use the same filesystem service.

---

# PHASE 4 — FILE MANAGER

Create a functional file manager.

Features:

* sidebar
* folder navigation
* breadcrumbs
* grid/list view
* search
* sorting
* file metadata
* new file
* new folder
* rename
* delete
* copy
* paste
* drag and drop

Double-clicking a supported text file opens it in the Text Editor.

Test filesystem consistency after every mutation.

---

# PHASE 5 — TERMINAL

Create a convincing terminal.

Visual requirements:

* monospace typography
* blinking cursor
* scrolling
* prompt
* colored output
* command history
* autocomplete

Commands:

help
clear
pwd
ls
cd
mkdir
touch
cat
echo
rm
cp
mv
tree
find
date
whoami
history
neofetch
calc
open
sysinfo
matrix

Commands must operate on the actual shared filesystem.

Examples:

mkdir Projects
cd Projects
touch test.txt
echo "hello" > test.txt
cat test.txt
ls

Terminal output must match File Manager state.

Implement:

* ArrowUp/ArrowDown history
* Tab autocomplete
* command errors
* current directory
* scrollback

---

# PHASE 6 — TEXT EDITOR

Build a usable text editor.

Support:

* multiple documents/tabs
* open
* save
* save as
* new
* line numbers
* basic syntax highlighting
* word count
* character count
* dirty state
* keyboard shortcuts

Important:

Saving must write to the shared filesystem.

Regression test:

Terminal creates file → Editor opens file → Editor edits file → Terminal reads new content.

---

# PHASE 7 — CORE APPS

Implement these applications:

1. Calculator
2. Browser
3. Paint
4. Media Player
5. Settings
6. System Diagnostics
7. Achievement Viewer

Each must run as a normal OS window.

Do not optimize only for appearance.

Every application needs actual interaction.

---

# CALCULATOR

Support:

* arithmetic
* decimals
* negative values
* percentage
* square root
* keyboard input
* history

Test edge cases:

* division by zero
* repeated operators
* decimal input
* long expressions

---

# BROWSER

Create a mini browser.

UI:

* tabs
* address bar
* back
* forward
* reload
* home
* bookmarks

Create useful offline internal pages:

nexus://home
nexus://about
nexus://games
nexus://system
nexus://terminal

Make the pages visually consistent with the OS.

---

# PAINT

Implement Canvas drawing.

Tools:

* pencil
* brush
* eraser
* color picker
* line
* rectangle
* circle
* fill
* undo
* redo
* clear
* save PNG

If practical, allow saved drawings to be referenced by the virtual filesystem.

---

# MEDIA PLAYER

Support user-selected local media.

Implement:

* play
* pause
* seek
* volume
* playlist
* progress
* metadata

Add a Canvas or Web Audio visualizer.

---

# PHASE 8 — SETTINGS + THEMING

Create a real settings system.

Sections:

### Appearance

* wallpaper
* theme
* accent
* transparency
* animation intensity

### Personalization

* icon size
* taskbar position
* clock format

### Sound

* master volume
* UI sounds
* game sounds

### System

* reset settings
* reset filesystem
* clear notifications

All changes must affect the running OS immediately.

Persist them.

---

# PHASE 9 — WALLPAPERS

Implement at least 6 wallpapers.

Examples:

* Cyber City
* Deep Space
* Aurora
* Matrix
* Sunset Grid
* Minimal Dark

At least 2 should be animated.

Do not destroy performance.

Wallpaper changes must be instant.

---

# PHASE 10 — NEXUS ARCADE

Create a dedicated game hub.

Minimum:

## GAME 1 — NEON SNAKE

Must include:

* movement
* food
* scoring
* increasing speed
* pause
* restart
* game over
* difficulty
* best score
* sound effects

Persist high score.

---

## GAME 2 — CYBER RACER

Canvas-based racing game.

Required:

* player movement
* acceleration
* braking
* steering
* AI opponents
* collisions
* checkpoints
* laps
* timer
* score
* countdown
* restart
* game over

Use a strong cyberpunk visual identity.

Persist best time.

Do not create a static demo.

Actually make it playable.

---

# PHASE 11 — AUDIO SYSTEM

Create a central audio service.

Support:

* master volume
* UI sound volume
* game sound volume
* mute

Generate subtle sounds with Web Audio API where appropriate.

Avoid annoying constant audio.

---

# PHASE 12 — NOTIFICATIONS

Build a reusable notification system.

Applications can emit notifications.

Examples:

"File saved."

"New high score!"

"Achievement unlocked."

"Download complete."

Allow clicking notifications to perform an action where appropriate.

---

# PHASE 13 — ACHIEVEMENTS

Create an achievement engine.

Examples:

FIRST_BOOT
FIRST_FILE
TERMINAL_MASTER
HIGH_SCORE
PAINTER
EXPLORER
SECRET_FOUND

Persist achievements.

Trigger them from real events.

Create Achievement Viewer.

Do not unlock achievements artificially.

---

# PHASE 14 — SYSTEM DIAGNOSTICS

Create a system-monitor application.

Show dynamically changing values such as:

* CPU usage
* RAM usage
* storage usage
* uptime
* active processes
* window count
* FPS
* filesystem statistics

These values should behave plausibly.

Do not claim they are actual browser/system metrics unless they really are.

Label simulated metrics as simulated when necessary.

---

# PHASE 15 — UNIQUE FEATURE: NEXUS

Create a local AI-like OS assistant named:

**NEXUS**

It should look like an intelligent system console.

Do not require an external AI API.

Implement a local intent/command parser.

Examples:

"open terminal"
"open games"
"show my files"
"change wallpaper"
"launch snake"
"system status"
"run diagnostics"
"create a folder called Projects"

NEXUS must actually perform the corresponding actions.

Example:

User:
open games

NEXUS:
Launching NEXUS ARCADE...

Then actually open NEXUS ARCADE.

Give NEXUS short contextual responses.

Avoid making it merely decorative.

---

# PHASE 16 — EASTER EGGS

Add at least five discoverable Easter eggs.

Possible examples:

* secret terminal command
* hidden game
* keyboard sequence
* secret wallpaper
* mysterious file
* developer mode
* special animation

Do not explain every secret.

They should feel discovered.

---

# PHASE 17 — BOOT / SHUTDOWN EXPERIENCE

Implement a polished boot sequence.

Example stages:

NEXUS BIOS
Initializing kernel...
Loading filesystem...
Starting services...
Mounting user space...
Launching desktop...

Use subtle sound and animation.

Also implement a shutdown animation.

---

# PHASE 18 — REGRESSION TESTING

After the core system is built, test the entire OS as an integrated product.

At minimum test:

### FILESYSTEM

* create file
* rename file
* delete file
* create folder
* move file
* persist/reload

### TERMINAL

* ls
* cd
* mkdir
* touch
* cat
* echo
* rm

### EDITOR

* open file
* edit
* save
* reopen

### WINDOWS

* open
* drag
* resize
* minimize
* maximize
* restore
* close
* focus

### SETTINGS

* wallpaper
* theme
* sound
* taskbar
* persistence

### GAMES

* launch
* play
* pause/restart
* scoring
* high score persistence

### NEXUS

* open applications
* create folders/files
* change wallpaper
* launch games
* report status

---

# PHASE 19 — BUG HUNT

Now intentionally try to break the application.

Look for:

* null references
* race conditions
* stale UI
* broken event listeners
* z-index bugs
* window overflow
* filesystem inconsistencies
* unsaved state
* duplicate notifications
* keyboard conflicts
* game crashes
* missing cleanup
* memory leaks
* persistence failures

Fix discovered issues.

Do not stop at the first successful launch.

---

# PHASE 20 — UX POLISH

After functionality is stable, perform a visual polish pass.

Improve:

* spacing
* typography
* animations
* hover states
* button feedback
* empty states
* tooltips
* icons
* transitions
* notifications
* loading states

Remove visual inconsistencies.

The system should feel like one product.

---

# PERFORMANCE REQUIREMENTS

Maintain smooth interaction.

Prefer:

* requestAnimationFrame for animation
* event delegation
* efficient state updates
* Canvas for games
* lazy initialization
* cleanup of listeners
* minimal DOM churn

Do not introduce unnecessary polling loops.

Avoid expensive full-tree rerenders.

---

# RESPONSIVE BEHAVIOR

Desktop is the primary target.

When viewport width becomes small:

* keep windows usable
* compact the taskbar
* make launcher adaptive
* avoid destroying layout
* preserve accessibility of controls

Do not simply scale the entire OS down.

---

# ACCESSIBILITY

Support where practical:

* keyboard navigation
* visible focus
* readable contrast
* aria labels for important controls
* sensible button semantics

Do not sacrifice usability for visual effects.

---

# FINAL QA CHECKLIST

Before declaring the task complete, verify all of the following:

[ ] Boot works
[ ] Desktop works
[ ] Taskbar works
[ ] Launcher works
[ ] Windows can move
[ ] Windows can resize
[ ] Windows can minimize/maximize/close
[ ] Multiple windows work
[ ] Filesystem persists
[ ] File Manager works
[ ] Terminal works
[ ] Terminal and filesystem stay synchronized
[ ] Text Editor works
[ ] Calculator works
[ ] Browser works
[ ] Paint works
[ ] Media Player works
[ ] Settings work
[ ] Wallpapers work
[ ] Notifications work
[ ] Achievements work
[ ] Diagnostics work
[ ] Snake works
[ ] Cyber Racer works
[ ] NEXUS works
[ ] Easter eggs work
[ ] Sound settings work
[ ] No major console errors
[ ] No obvious broken controls
[ ] No major visual glitches

---

# QUALITY BAR

Do not optimize for:

"all features exist."

Optimize for:

"all features feel integrated."

A smaller number of polished working features is preferable to a large number of broken fake features.

The strongest requirement is:

**COHERENCE.**

NEXUS OS must feel like one believable operating system.

---

# DELIVERY

When the implementation is complete:

1. run the final build
2. launch the application
3. perform the regression checklist
4. fix remaining issues
5. only then report completion

In the final response, provide:

* what was implemented
* major architecture decisions
* tests performed
* known limitations, if any
* how to run the project

Do not claim a feature works unless you actually verified it.

Do not hide known bugs.

Do not declare success prematurely.

Build it, run it, test it, fix it, and polish it.
