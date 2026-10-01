You are an elite frontend engineer, game developer, interaction designer, and operating-system UI designer.

Build a spectacular **browser-based operating system** called **NEXUS OS**.

The goal is not to create a website that looks like an operating system.

The goal is to create a **fully interactive fake operating system that feels like a real desktop computer running inside the browser**.

The result should be the kind of project people immediately want to share because it looks impressive, contains real interactions, games, applications, animations, hidden features, and unexpected details.

---

# CORE CONSTRAINT

Create the entire operating system as a **single self-contained HTML file**.

Use:

* HTML
* CSS
* Vanilla JavaScript
* Canvas
* SVG
* Web Audio API
* localStorage / IndexedDB when useful

Do not use React, Vue, Angular, Electron, or a backend.

The final HTML must run locally by opening it in a modern desktop browser.

No build step.

No server required.

No placeholder screens.

No "coming soon".

No fake buttons.

Every major visible feature must actually work.

---

# THE EXPERIENCE

When the page loads, show a short boot sequence.

Example:

NEXUS BIOS

Initializing kernel...

Loading virtual filesystem...

Mounting user space...

Starting desktop...

Then smoothly transition into the desktop.

The first impression should feel like booting into a futuristic computer.

---

# 1. DESKTOP

Create a full-screen desktop environment.

The desktop must contain:

* animated wallpaper
* desktop icons
* bottom taskbar
* application launcher
* system tray
* clock
* network indicator
* battery indicator
* volume indicator
* notification center
* searchable app launcher

Desktop icons:

* Computer
* Files
* Terminal
* Notes
* Games
* Browser
* Settings
* Paint
* Media

Double-click opens the associated application.

Right-clicking the desktop opens a context menu:

* New Folder
* New File
* Refresh
* Change Wallpaper
* Open Terminal
* Settings
* Personalize

---

# 2. WINDOW SYSTEM

Implement a real window manager.

Every application runs inside a window.

Windows must support:

* drag
* resize
* minimize
* maximize
* restore
* close
* focus
* z-index
* snapping
* taskbar integration

Features:

* double-click titlebar = maximize
* clicking window = bring to front
* Alt+Tab = switch windows
* Escape = close menus
* taskbar click = focus/minimize application
* multiple applications can be open simultaneously

Windows should have polished animations.

Never allow windows to become permanently inaccessible.

---

# 3. VISUAL STYLE

Make the interface look extremely polished.

Design direction:

**futuristic + premium + slightly nostalgic + hacker aesthetic**

Use:

* glassmorphism
* translucent panels
* subtle blur
* glowing accents
* soft shadows
* gradients
* depth
* smooth transitions
* tasteful micro-interactions
* modern typography
* animated background elements

The desktop should feel atmospheric rather than empty.

Use subtle animated particles, light effects, stars, waves, or another dynamic background system.

Do not overdo the animation.

Performance must remain smooth.

---

# 4. VIRTUAL FILESYSTEM

Implement a real virtual filesystem in JavaScript.

Initial filesystem:

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

* folders
* files
* create
* delete
* rename
* move
* copy
* paste
* open
* save
* search

Persist the filesystem using localStorage or IndexedDB.

The filesystem must be shared by:

* File Manager
* Terminal
* Text Editor

Changing a file in one application must immediately affect the others.

---

# 5. FILE MANAGER

Create a polished file manager inspired by modern desktop operating systems.

Features:

* sidebar
* folder tree
* breadcrumbs
* grid/list view
* file icons
* folders
* search
* sorting
* rename
* delete
* new folder
* new file
* copy/paste
* drag and drop

Double-clicking a text file opens it in the text editor.

Show file size, type, and modified date.

---

# 6. TERMINAL

Create a highly convincing terminal.

Style:

dark terminal
monospace font
blinking cursor
command history
colored output
scrollback
autocomplete

Support commands:

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

Commands must interact with the actual virtual filesystem.

Example:

mkdir Projects

cd Projects

touch test.txt

echo "Hello" > test.txt

cat test.txt

ls

The output of `ls` must match what appears in File Manager.

Add command history with ArrowUp / ArrowDown.

Add autocomplete with Tab.

Implement at least one visually impressive terminal Easter egg.

Example:

matrix

---

# 7. TEXT EDITOR

Create a functional code/text editor.

Features:

* tabs
* new file
* open
* save
* save as
* autosave indicator
* line numbers
* syntax highlighting
* word count
* character count
* keyboard shortcuts
* modified-file indicator

Support common shortcuts:

Ctrl+S
Ctrl+O
Ctrl+N

Saving must modify the virtual filesystem.

---

# 8. CALCULATOR

Build a polished calculator application.

Support:

* arithmetic
* decimals
* negative numbers
* percentage
* square root
* keyboard input
* calculation history

Make it look like a native desktop calculator.

---

# 9. BROWSER

Build a mini web browser.

UI:

* tabs
* address bar
* back
* forward
* reload
* home
* bookmarks

Create several internal pages that work offline:

nexus://home
nexus://about
nexus://games
nexus://system
nexus://terminal

The internal pages should feel like real websites.

---

# 10. PAINT

Create a working drawing application using Canvas.

Tools:

* pencil
* brush
* eraser
* color picker
* shapes
* line
* rectangle
* circle
* fill
* undo
* redo
* clear
* save as PNG

Allow the user to save drawings to the virtual Pictures directory.

---

# 11. MEDIA PLAYER

Create a media player.

Support local user-selected audio/video files.

Features:

* play
* pause
* seek
* volume
* playlist
* progress bar
* file metadata when available

Add a visualizer using Canvas or Web Audio API.

---

# 12. GAMES HUB

Create a dedicated **NEXUS ARCADE** application.

It must contain at least **two fully playable games**.

Do not create fake game menus.

The games must contain real gameplay.

---

## GAME 1 — NEON SNAKE

Create a polished neon version of Snake.

Features:

* keyboard controls
* increasing speed
* food
* score
* high score
* game over
* pause
* restart
* difficulty
* sound effects

Save the best score in localStorage.

Add screen shake or another subtle effect when eating food.

---

## GAME 2 — CYBER RACER

Create a playable racing game using Canvas.

Perspective can be top-down or pseudo-3D.

Features:

* player car
* AI opponents
* road
* acceleration
* braking
* steering
* collisions
* checkpoints
* laps
* timer
* score
* start countdown
* game over
* restart

Add a neon cyberpunk visual style.

Include engine sound using Web Audio API.

Save best lap time.

---

# 13. SETTINGS

Create a real Settings application.

Categories:

### Appearance

* wallpaper
* accent color
* theme
* transparency
* animations

### Personalization

* desktop icon size
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

Every setting must actually affect the system.

---

# 14. MULTIPLE WALLPAPERS

Include at least 6 built-in wallpapers.

Examples:

1. Cyber City
2. Deep Space
3. Aurora
4. Matrix
5. Sunset Grid
6. Minimal Dark

Some wallpapers should be animated.

Changing the wallpaper must immediately update the desktop.

Save the selection.

---

# 15. NOTIFICATION CENTER

Create a notification center.

Applications should be able to send notifications.

Examples:

"File saved."

"New high score!"

"Download completed."

"System scan finished."

Notifications should stack nicely.

Clicking a notification can open the related application.

---

# 16. UNIQUE VIRAL FEATURE

Create ONE major feature that makes NEXUS OS memorable.

Do not make it a simple animation.

Implement a fully interactive **AI-like SYSTEM CORE** called:

**NEXUS**

The user can open it from the taskbar.

NEXUS should behave like an in-universe computer assistant.

It can understand commands such as:

"open terminal"

"open games"

"show my files"

"change wallpaper"

"launch snake"

"what is the system status?"

"run diagnostics"

"make a new folder called Projects"

These commands should actually trigger actions inside the OS.

The assistant does not need a real AI API.

Implement a local command/intent parser in JavaScript.

Give NEXUS personality through short system-style responses.

Example:

USER:
open games

NEXUS:
Launching NEXUS ARCADE...

Then open the Games application.

---

# 17. SYSTEM DIAGNOSTICS

Add a hidden system diagnostic mode.

It should display:

* fake CPU usage
* fake RAM usage
* active processes
* uptime
* filesystem statistics
* window count
* FPS
* storage usage

Make the values dynamically change.

Include a visual system monitor.

---

# 18. EASTER EGGS

Hide at least 5 Easter eggs.

Examples:

* secret terminal commands
* secret keyboard shortcut
* hidden game
* secret wallpaper
* Konami-style sequence
* developer mode
* mysterious hidden file
* secret animation

Do not explain all Easter eggs in the UI.

Allow users to discover them.

---

# 19. ACHIEVEMENT SYSTEM

Implement achievements.

Examples:

FIRST_BOOT
FIRST_FILE
TERMINAL_MASTER
HIGH_SCORE
PAINTER
EXPLORER
SECRET_FOUND

Display achievement notifications.

Persist achievements.

Create an Achievement Viewer application.

---

# 20. SOUND DESIGN

Use Web Audio API.

Add subtle sounds for:

* boot
* clicks
* window opening
* window closing
* notification
* terminal
* game events
* achievements

Users must be able to disable sounds.

---

# 21. PERFORMANCE

The OS must remain smooth.

Use:

requestAnimationFrame

event delegation

efficient DOM updates

Canvas for games

lazy initialization where appropriate

Avoid unnecessary intervals.

Do not continuously redraw unchanged UI.

Target a smooth desktop experience.

---

# 22. RESPONSIVE FALLBACK

The primary experience is desktop.

However, when the browser viewport is too small, gracefully adapt:

* windows remain usable
* taskbar becomes compact
* launcher becomes responsive
* applications remain accessible

Do not simply scale the entire desktop down until the UI becomes unusable.

---

# 23. IMPORTANT CONSISTENCY RULE

This is extremely important:

Everything must feel like one coherent operating system.

Examples:

Creating a file in Terminal → file appears in File Manager.

Editing a file → saved contents persist.

Changing wallpaper → desktop changes.

Changing theme → applications update.

Opening a game → it appears as a normal application window.

Achievements → persist across sessions.

Scores → persist.

Notifications → come from actual actions.

Settings → actually change behavior.

Do not implement isolated demos pretending to be an OS.

---

# 24. POLISH

Add small details that make the experience feel real:

* animated boot cursor
* hover effects
* context menus
* tooltips
* keyboard shortcuts
* loading animations
* subtle system sounds
* realistic empty states
* smooth window transitions
* app icons
* clock updates every second
* fake startup process
* shutdown animation

Use small details aggressively.

The goal is:

**"Wait... this is running entirely in a browser?"**

---

# 25. FINAL REQUIREMENT

Return the complete working implementation as ONE HTML FILE.

Do not give an explanation first.

Do not omit features.

Do not use placeholders.

Do not write pseudocode.

Do not tell me how to implement it.

Actually implement it.

The final result should be something I can save as:

nexus-os.html

and open directly in Chrome.

Prioritize:

1. functionality
2. internal consistency
3. visual polish
4. game quality
5. interaction design
6. performance
7. Easter eggs

Make it impressive enough to demonstrate publicly as an example of what modern AI coding can build.
