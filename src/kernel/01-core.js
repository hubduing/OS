



/* ============================================================
   THE KERNEL IS ONE MODULE WITH ONE register().
   ============================================================
   This opening brace and the closing one at the bottom of 32-subtitles.js
   bracket every kernel file into a single function body. They share one
   lexical scope, exactly as they did as bare top-level statements, because
   they still are: the files are concatenated in filename order inside one
   generated wrapper, and this is one brace pair across that concatenation.

   Why not one register() per file: they reference each other across file
   boundaries. 02-storage.js calls VFS, which 04-vfs.js declares. 10-taskbar-
   start.js calls WM and Diag, declared in 08 and 21. 27-api-boot.js calls
   most of the rest. Splitting per file would force every early file to reach
   a name declared in a LATER file, which is the one thing a per-file register
   cannot do.

   Why this register does NOT read the ctx it is handed: ctx.core is assembled
   from what THIS register returns, and the builder only stores that after the
   call returns. A read here would either throw, or - worse - see a core
   assembled from a registry that is still empty. build.js --check fails the
   build if any kernel file reads it, so the rule cannot rot. The kernel
   reaches its own names lexically; only packages and apps destructure.

   The return at the bottom of 32-subtitles.js is the checklist: ctx.core is
   validated at boot against the KERNEL_NAMES literal build.js injects, and a
   name declared here but not returned there fails by name. */
function register(ctx) {
"use strict";
/* ============================================================
   NEXUS OS
   ============================================================ */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const el=(t,c,p)=>{const e=document.createElement(t); if(c)e.className=c; if(p)p.appendChild(e); return e;};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const fmtBytes=b=>{if(b===0)return'0 B';const u=['B','KB','MB','GB','TB'];const i=Math.floor(Math.log(b)/Math.log(1024));
  return (b/Math.pow(1024,i)).toFixed(i?1:0)+' '+u[i];};
const pad=n=>String(n).padStart(2,'0');
/* Dates are formatted by hand on purpose: toLocaleDateString follows the
   browser's locale, which would render an English OS in the user's language
   (and glue the weekday to the time in some locales). */
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fmtDay=d=>`${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
const fmtDayLong=d=>`${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const fmtHM=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtHMS=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const fmtStamp=ms=>{const d=new Date(ms);return `${fmtDay(d)} ${fmtHMS(d)}`};
const fmtDateShort=ms=>{const d=new Date(ms);return `${pad(d.getDate())} ${MONTHS[d.getMonth()]}`};
/* Elapsed seconds, not a Date. Rolls up to hours so a two minute reel does
   not render as "2:00" next to a 45 second track with no indication which is
   longer. Distinct from fmtHMS, which takes a Date. */
const fmtDur=sec=>{
  const s=Math.max(0,Math.floor(+sec||0));
  const h=(s/3600)|0,m=((s%3600)/60)|0;
  return h?`${h}:${pad(m)}:${pad(s%60)}`:`${m}:${pad(s%60)}`;
};
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* ---------- ICONS (SVG sprite strings) ---------- */
const ICONS={
 computer:`<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" fill="#1a2740" stroke="#37e0ff" stroke-width="1.4"/><rect x="4" y="5" width="16" height="10" rx="1" fill="#0d1a2e"/><path d="M8 21h8M12 17v4" stroke="#37e0ff" stroke-width="1.6" stroke-linecap="round"/><path d="M6 13l3-3 2 2 3-4 4 5" stroke="#3ddc84" stroke-width="1.2" fill="none"/></svg>`,
 files:`<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#ffc857" opacity=".25"/><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="#ffc857" stroke-width="1.5"/><path d="M2 19c4-1 8 1 11-1s6 0 9-2" stroke="#ffc857" stroke-width="1.2" fill="none" opacity=".6"/></svg>`,
 terminal:`<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" fill="#04120a" stroke="#3ddc84" stroke-width="1.4"/><path d="M6 9l3 3-3 3" stroke="#3ddc84" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15h6" stroke="#3ddc84" stroke-width="1.6" stroke-linecap="round"/></svg>`,
 notes:`<svg viewBox="0 0 24 24"><path d="M6 3h9l5 5v13H6z" fill="#ffc857" opacity=".22"/><path d="M6 3h9l5 5v13H6z" fill="none" stroke="#ffc857" stroke-width="1.5"/><path d="M15 3v5h5" fill="none" stroke="#ffc857" stroke-width="1.4"/><path d="M9 13h7M9 17h5" stroke="#ffc857" stroke-width="1.3"/></svg>`,
 games:`<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="11" rx="5" fill="#ff4d9d" opacity=".25" stroke="#ff4d9d" stroke-width="1.5"/><path d="M7 11v4M5 13h4" stroke="#ff4d9d" stroke-width="1.6" stroke-linecap="round"/><circle cx="16" cy="11.6" r="1.2" fill="#37e0ff"/><circle cx="18.4" cy="14" r="1.2" fill="#37e0ff"/><path d="M6 7V5M18 7V5" stroke="#ff4d9d" stroke-width="1.5" stroke-linecap="round"/></svg>`,
 browser:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#37e0ff" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="4" ry="9" fill="none" stroke="#37e0ff" stroke-width="1.2" opacity=".7"/><path d="M3.5 9h17M3.5 15h17" stroke="#37e0ff" stroke-width="1.2" opacity=".7"/></svg>`,
 settings:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="none" stroke="#b06bff" stroke-width="1.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" stroke="#b06bff" stroke-width="1.5" stroke-linecap="round"/></svg>`,
 paint:`<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.6-1.4-1.6-1.4-3 0-1 .9-1.8 2-1.8h2A4.4 4.4 0 0 0 21 9.8C21 6 16.8 3 12 3z" fill="#37e0ff" opacity=".22" stroke="#37e0ff" stroke-width="1.5"/><circle cx="8" cy="10" r="1.2" fill="#ff4d9d"/><circle cx="12" cy="7.5" r="1.2" fill="#ffc857"/><circle cx="16" cy="10" r="1.2" fill="#3ddc84"/></svg>`,
 media:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#ff4d9d" stroke-width="1.5"/><circle cx="12" cy="12" r="2.6" fill="#ff4d9d"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9" stroke="#ff4d9d" stroke-width="1.3" fill="none" opacity=".7"/></svg>`,
 nexus:`<svg viewBox="0 0 24 24"><defs><radialGradient id="nxa" cx="50%" cy="45%"><stop offset="0" stop-color="#b06bff"/><stop offset=".55" stop-color="#37e0ff"/><stop offset="1" stop-color="#37e0ff" stop-opacity="0"/></radialGradient></defs><circle cx="12" cy="12" r="10" fill="url(#nxa)"/><circle cx="12" cy="12" r="6" fill="none" stroke="#fff" stroke-width="1" opacity=".85"/><circle cx="12" cy="12" r="2.4" fill="#fff"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="#37e0ff" stroke-width="1" opacity=".6"/></svg>`,
 calc:`<svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2.5" fill="#0e1a2e" stroke="#37e0ff" stroke-width="1.4"/><rect x="6.5" y="4.5" width="11" height="4" rx="1" fill="#37e0ff" opacity=".35"/><circle cx="8" cy="12" r="1.3" fill="#8ea0bd"/><circle cx="12" cy="12" r="1.3" fill="#8ea0bd"/><circle cx="16" cy="12" r="1.3" fill="#8ea0bd"/><circle cx="8" cy="16" r="1.3" fill="#8ea0bd"/><circle cx="12" cy="16" r="1.3" fill="#ffc857"/><circle cx="16" cy="16" r="1.3" fill="#8ea0bd"/></svg>`,
 achv:`<svg viewBox="0 0 24 24"><path d="M7 4h10v3a5 5 0 0 1-10 0z" fill="#ffc857" opacity=".3" stroke="#ffc857" stroke-width="1.4"/><path d="M7 5H4v2a3.4 3.4 0 0 0 3.4 3.4M17 5h3v2a3.4 3.4 0 0 1-3.4 3.4" fill="none" stroke="#ffc857" stroke-width="1.4"/><path d="M12 12v4M9 20h6M10 16h4v4h-4z" stroke="#ffc857" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`,
 mon:`<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="15" rx="2" fill="none" stroke="#3ddc84" stroke-width="1.4"/><path d="M6 14l3-4 2.5 3 3-5 3.5 6" fill="none" stroke="#3ddc84" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 21h8" stroke="#3ddc84" stroke-width="1.5" stroke-linecap="round"/></svg>`,
 folder:`<svg viewBox="0 0 24 24"><path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="#4d9fff" opacity=".3"/><path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="none" stroke="#6fb0ff" stroke-width="1.5"/></svg>`,
 file:`<svg viewBox="0 0 24 24"><path d="M6 2h8l5 5v15H6z" fill="#c8d6ee" opacity=".16"/><path d="M6 2h8l5 5v15H6z" fill="none" stroke="#c8d6ee" stroke-width="1.4"/><path d="M14 2v5h5" fill="none" stroke="#c8d6ee" stroke-width="1.2"/></svg>`,
 txt:`<svg viewBox="0 0 24 24"><path d="M6 2h8l5 5v15H6z" fill="#8ea0bd" opacity=".2"/><path d="M6 2h8l5 5v15H6z" fill="none" stroke="#c8d6ee" stroke-width="1.4"/><path d="M14 2v5h5M9 12h7M9 16h5" fill="none" stroke="#c8d6ee" stroke-width="1.2"/></svg>`,
 img:`<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" fill="#ff4d9d" opacity=".2" stroke="#ff4d9d" stroke-width="1.4"/><circle cx="8.5" cy="9.5" r="1.8" fill="#ffc857"/><path d="M4 18l5-5 4 4 3-3 4 4" fill="none" stroke="#ff4d9d" stroke-width="1.4"/></svg>`,
 vid:`<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" fill="#b06bff" opacity=".2" stroke="#b06bff" stroke-width="1.4"/><path d="M10 9.5l5 2.5-5 2.5z" fill="#b06bff"/></svg>`,
 aud:`<svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12" fill="none" stroke="#37e0ff" stroke-width="1.5"/><circle cx="6.5" cy="18" r="2.6" fill="#37e0ff"/><circle cx="16.5" cy="16" r="2.6" fill="#37e0ff"/></svg>`,
  pip:`<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="12" y="12" width="8" height="6" rx="1" fill="currentColor"/></svg>`,
  full:`<svg viewBox="0 0 24 24"><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 code:`<svg viewBox="0 0 24 24"><path d="M6 2h8l5 5v15H6z" fill="#3ddc84" opacity=".16" stroke="#3ddc84" stroke-width="1.4"/><path d="M10 10l-2 2 2 2M14 10l2 2-2 2" fill="none" stroke="#3ddc84" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 zoom:`<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="#8ea0bd" stroke-width="1.5"/><path d="M8 11h6M11 8v6M20 20l-4-4" stroke="#8ea0bd" stroke-width="1.5" stroke-linecap="round"/></svg>`,
 back:`<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 fwd:`<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 reload:`<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 3v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 home:`<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
 star:`<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.2L12 17.3 6.4 20.2l1.2-6.2L3 9.6l6.3-.8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
 trash:`<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" fill="none" stroke="#ff5c72" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 copy:`<svg viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`,
 cut:`<svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 16L18 3M16 16L6 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
 paste:`<svg viewBox="0 0 24 24"><path d="M9 3h6v3H9z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M15 5h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3v3h6z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
 plus:`<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
 pencil:`<svg viewBox="0 0 24 24"><path d="M4 20l1-4 11-11 3 3L8 19z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M14 7l3 3" stroke="currentColor" stroke-width="1.5"/></svg>`,
 brush:`<svg viewBox="0 0 24 24"><path d="M9 15c-3 0-4 2-4 4 1 1 2 1 3 1s3-.6 3-2.6c0-1.4-1-2.4-2-2.4z" fill="currentColor"/><path d="M11 14 20 5l-1.5-1.5L9.5 12.5z" fill="currentColor"/></svg>`,
 eraser:`<svg viewBox="0 0 24 24"><path d="M8 20H4l-1-1L14 8l5 5-7 7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 15l5 5" stroke="currentColor" stroke-width="1.4"/></svg>`,
 line:`<svg viewBox="0 0 24 24"><path d="M5 19L19 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
 rect:`<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`,
 circ:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`,
 fill:`<svg viewBox="0 0 24 24"><path d="M5 12l7-7 7 7-7 7z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M19 16c0 1.5 1 2.5 1 2.5S21 17.5 21 16a1 1 0 0 0-2 0z" fill="currentColor"/></svg>`,
 dropper:`<svg viewBox="0 0 24 24"><path d="M17 3a2.8 2.8 0 0 1 4 4l-3 3-4-4z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M14 6l-9 9v4h4l9-9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
 undo:`<svg viewBox="0 0 24 24"><path d="M4 10h9a5 5 0 0 1 0 10h-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 6l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 redo:`<svg viewBox="0 0 24 24"><path d="M20 10h-9a5 5 0 0 0 0 10h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16 6l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 play:`<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>`,
 pause:`<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/></svg>`,
 prev:`<svg viewBox="0 0 24 24"><path d="M18 4L8 12l10 8z" fill="currentColor"/><rect x="5" y="4" width="2.5" height="16" fill="currentColor"/></svg>`,
 next:`<svg viewBox="0 0 24 24"><path d="M6 4l10 8-10 8z" fill="currentColor"/><rect x="16.5" y="4" width="2.5" height="16" fill="currentColor"/></svg>`,
 vol:`<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
 mute:`<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
 wifi:`<svg viewBox="0 0 24 24"><path d="M2 8.5a15 15 0 0 1 20 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5.5 12.5a10 10 0 0 1 13 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9 16.4a5 5 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="19.5" r="1.4" fill="currentColor"/></svg>`,
 bat:`<svg viewBox="0 0 24 24"><rect x="2" y="7" width="17" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M21 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect id="batFill" x="4" y="9" width="11" height="6" rx="1" fill="currentColor"/></svg>`,
 bell:`<svg viewBox="0 0 24 24"><path d="M18 15V10a6 6 0 0 0-12 0v5l-2 3h16z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 21h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
 power:`<svg viewBox="0 0 24 24"><path d="M12 3v9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
 win:`<svg viewBox="0 0 12 12"><rect x="1" y="1" width="4.4" height="4.4" fill="currentColor"/><rect x="6.6" y="1" width="4.4" height="4.4" fill="currentColor"/><rect x="1" y="6.6" width="4.4" height="4.4" fill="currentColor"/><rect x="6.6" y="6.6" width="4.4" height="4.4" fill="currentColor"/></svg>`,
 ok:`<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 warn:`<svg viewBox="0 0 24 24"><path d="M12 3l10 18H2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.1" fill="currentColor"/></svg>`,
 info:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="7.6" r="1.1" fill="currentColor"/></svg>`,
 x:`<svg viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
 min:`<svg viewBox="0 0 12 12"><path d="M2 6h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
 max:`<svg viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
 save:`<svg viewBox="0 0 24 24"><path d="M4 4h12l4 4v12H4z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v5h7V4M8 20v-6h8v6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
 open:`<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2H5v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
 grid:`<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="13" y="3" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="13" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="13" y="13" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
 list:`<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="4" cy="6" r="1.3" fill="currentColor"/><circle cx="4" cy="12" r="1.3" fill="currentColor"/><circle cx="4" cy="18" r="1.3" fill="currentColor"/></svg>`,
 cpu:`<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 2v4M14 2v4M10 18v4M14 18v4M2 10h4M2 14h4M18 10h4M18 14h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
 eye:`<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`,
 dnd:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 18L18 6" stroke="currentColor" stroke-width="1.5"/></svg>`,
 bolt:`<svg viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor"/></svg>`,
 brain:`<svg viewBox="0 0 24 24"><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1 5 3 3 0 0 0 4 3V4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-1 5 3 3 0 0 1-4 3V4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
};
const EXT_ICON={txt:'txt',md:'txt',js:'code',json:'code',html:'code',css:'code',py:'code',ts:'code',sh:'code',
  png:'img',jpg:'img',jpeg:'img',gif:'img',webp:'img',svg:'img',
  mp3:'aud',wav:'aud',ogg:'aud',m4a:'aud',flac:'aud',
  mp4:'vid',webm:'vid',mkv:'vid',mov:'vid',avi:'vid'};
const extOf=n=>{const i=n.lastIndexOf('.');return i>0?n.slice(i+1).toLowerCase():''};
const iconForNode=(n,isDir)=>isDir?ICONS.folder:(EXT_ICON[extOf(n.name)]||ICONS.file);
const typeName=n=>{const e=extOf(n.name);return n.type==='dir'?'Folder':(e?e.toUpperCase()+' File':'Text File')};
