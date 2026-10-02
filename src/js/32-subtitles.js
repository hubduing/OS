/* ============================================================
   SUBTITLES
   ============================================================
   One parser serves both sources: .srt files the user opens, and the subtitle
   track baked into the generated demo reel. Two parsers would be two places
   for an off-by-one in the timestamp handling to hide.

   Accepted input is the ordinary SubRip shape:

       1
       00:00:01,000 --> 00:00:04,000
       First line
       second line

   Parsing is tolerant on purpose — a real .srt exported by a phone or a
   download often has a BOM, CRLF line endings, a missing blank line before
   the first cue, or "." instead of "," for milliseconds. */
const Subs={
  parse(text){
    const cues=[];
    const clean=String(text||'').replace(/^\uFEFF/,'').replace(/\r/g,'');
    const stamp=/(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/;
    const blocks=clean.split(/\n{2,}/);
    for(const block of blocks){
      const lines=block.split('\n').filter(l=>l.trim()!=='');
      if(!lines.length)continue;
      let ti=0;
      /* the index line is optional, so find the line with the arrow */
      while(ti<lines.length&&!lines[ti].includes('-->'))ti++;
      if(ti>=lines.length)continue;
      const m=stamp.exec(lines[ti]);
      if(!m)continue;
      const start=+m[1]*3600+ +m[2]*60+ +m[3]+ +m[4].padEnd(3,'0')/1000;
      const endRaw=lines[ti].split('-->')[1]||'';
      const m2=stamp.exec(endRaw);
      const end=m2
        ? +m2[1]*3600+ +m2[2]*60+ +m2[3]+ +m2[4].padEnd(3,'0')/1000
        : start+2;
      const body=lines.slice(ti+1).join('\n').trim();
      if(!body)continue;
      if(!(end>start))continue;
      cues.push({start,end,text:body});
    }
    cues.sort((a,b)=>a.start-b.start);
    return cues;
  },
  /* The cue covering `t`, or null. Linear scan is fine: a track is tens of
     cues, and this runs a few times a second. */
  active(cues,t){
    if(!cues)return null;
    for(let i=0;i<cues.length;i++){
      if(t>=cues[i].start&&t<cues[i].end)return cues[i];
      if(cues[i].start>t)break;
    }
    return null;
  },
  /* Render into a host element, sized in `size` px. Returns the cue text so
     the caller can skip work when nothing changed. */
  paint(host,cues,t,size){
    const cue=this.active(cues,t);
    const text=cue?cue.text:'';
    if(host._last===text)return text;
    host._last=text;
    host.textContent=text;
    host.style.display=text?'':'none';
    if(text)host.style.fontSize=size+'px';
    return text;
  },
  /* Shift every cue, for a reel whose scenes are assembled at runtime. */
  offset(cues,delta){
    return cues.map(c=>({start:c.start+delta,end:c.end+delta,text:c.text}));
  },
  /* Build a cue list from (seconds, text) pairs, one per line. */
  fromPairs(pairs){
    const out=[];
    for(let i=0;i<pairs.length;i++){
      const start=pairs[i][0];
      const end=i+1<pairs.length?pairs[i+1][0]:start+3;
      out.push({start,end,text:String(pairs[i][1])});
    }
    return out;
  }
};

/* ============================================================
   WHAT THE KERNEL EXPORTS - and the end of its register().
   ============================================================
   The closing brace of the `function register(ctx) {` opened at the top of
   01-core.js. Everything between the two is the 32 kernel files, sharing one
   lexical scope, exactly as when they were bare top-level statements.

   This return is what ctx.core IS. build.js injects a KERNEL_NAMES literal
   derived from the same column-0 scan that produced this list, and
   KERNEL_CTX.__kernelDone() refuses to open ctx.core until the assembled core
   covers every one of them. A name declared above but absent here fails at
   boot, by name, not later as one undefined service in one app.

   That is why the list is written out in full rather than assembled: it is the
   checklist for the conversion, and it is the only place a kernel name is
   declared to the outside world. Keep it in sync - the boot-time error names
   whatever is missing. */
  return {
    $, $$, ACCENTS, ACH_LIST, API, APPS,
    Achievements, Audio2, BOOT_LINES, Bus, Clipboard, DAYS,
    DEFAULT_SETTINGS, DESKTOP_APPS, Diag, EXT_ICON, Eggs, GAMES,
    HL, ICONS, IDEAS_TEXT, INSTRUMENTS, KONAMI, LS,
    MONTHS, NEXUS, NEXUS_FORTUNES, NEXUS_HELP, NEXUS_JOKES, NEXUS_PAGES,
    Notify, Pinned, Reel, S, SECRET_TEXT, SETTING_CHOICES,
    SYNTH_STEP, Subs, Synth, THEMES, TRACKS, VFS,
    WALLPAPERS, WELCOME_TEXT, WM, Wall, ago, applySettings,
    applyTheme, boot, buildRacer, buildSnake, cascade, clamp,
    clockTimer, closeCtx, closeDialog, confirmBox, ctxMenu, ctxOutside,
    dialog, dismiss, el, esc, extOf, filePicker,
    finishBoot, firstRunIntro, fmtBytes, fmtDateShort, fmtDay, fmtDayLong,
    fmtDur, fmtHM, fmtHMS, fmtStamp, formatLap, glitch,
    hexA, iconForNode, init, isImageNode, kIdx, konami,
    launchLine, lockScreen, modalResolve, openCtx, pad, prompt2,
    random, renderDesktop, renderDesktopFiles, renderStart, renderTray, resolveApp,
    screenshot, setSetting, showProps, shutdown, startClock, startOpen,
    storageBytes, tile, toast, toggleStart, trackStorage, typeName,
  };
}
