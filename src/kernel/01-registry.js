/* ============================================================
   KERNEL REGISTRY — the three names every module may reach for
   ============================================================
   APPS is the app table the whole desktop is built from. It lived at the
   top of 11-files.js, which made it look like the Files app owned it —
   it did not: fourteen modules fill it and nothing reads it there. The
   application registry is kernel infrastructure, so it is declared here,
   at the top of the shared scope, where the file name says what it is.

   formatLap renders a lap time. It is a kernel service for the same
   reason: two game modules format laps with it, so it is a shared name
   rather than one app's private helper.

   applySettings pushes S into every service that renders from it. It was
   declared by the settings app and CALLED BY THE BOOT SEQUENCE, which
   meant the boot path depended on a name an app happened to declare.
   It dispatches only to kernel services, so the ownership is the
   kernel's and the settings app is one consumer among others.

   Ordering is load-bearing. This file sorts AFTER 01-core.js, which is
   where `function register(ctx) {` opens, and BEFORE every file that
   uses these names. A `00-` prefix would put it before that brace and
   leave it in the wrapper's own scope, where it cannot reach Wall, WM,
   Diag, Audio2 or applyTheme — they are declared inside register()'s
   body, so applySettings would throw ReferenceError the first time
   settings were applied. The prefix is 01 for that reason and no other.
   ============================================================ */
const APPS={};

/* Elapsed millis as M:SS.mmm — the lap-time readout for both games. Pure,
   so it belongs to the kernel rather than to whichever game calls it. */
function formatLap(ms){const s=ms/1000;return Math.floor(s/60)+':'+(s%60).toFixed(3).padStart(6,'0')}

/* Push the settings object S into every service that renders from it:
   CSS custom properties, the taskbar, the window manager, audio volume
   and the clock. Called by the settings app on every change AND by the
   boot sequence before the first frame. */
function applySettings(){
  const r=document.documentElement.style;
  r.setProperty('--accent',S.accent);
  r.setProperty('--accent2',S.accent2);
  r.setProperty('--opacity',(S.transparency/100).toFixed(2));
  r.setProperty('--blur',Math.round(10+(S.transparency/100)*14));
  r.setProperty('--icon-size',({small:'64px',medium:'88px',large:'112px'}[S.iconSize]||'88px'));
  r.setProperty('--taskbar-pos',S.taskbarPos);
  const tb=$('#taskbar');
  const moved=S.taskbarPos==='top';
  if(moved){tb.style.top='0px';tb.style.bottom='auto';tb.style.flexDirection='row-reverse'}
  else{tb.style.top='auto';tb.style.bottom='0px';tb.style.flexDirection='row'}
  if(document.body.dataset.tbpos!==S.taskbarPos){document.body.dataset.tbpos=S.taskbarPos;WM.reflow()}
  document.body.classList.toggle('no-anim',!S.animations);
  Audio2.setVol(S.volume);
  startClock();
  if(document.body.dataset.theme!==S.theme){document.body.dataset.theme=S.theme;applyTheme(S.theme)}
}