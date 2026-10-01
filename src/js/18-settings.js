/* ============================================================
   PART 6 — SETTINGS, COMPUTER, ACHIEVEMENTS, DIAGNOSTICS
   ============================================================ */
/* Enumerated settings: an unknown value is a bug, not a preference. Silently
   accepting one leaves the UI showing a state nothing actually applied. */
const SETTING_CHOICES={
  theme:()=>Object.keys(THEMES),
  iconSize:()=>['small','medium','large'],
  taskbarPos:()=>['top','bottom'],
  wallpaper:()=>WALLPAPERS.map(w=>w.id),
};
function setSetting(k,v){
  const ok=SETTING_CHOICES[k];
  if(ok&&!ok().includes(v)){
    console.warn('[settings] ignoring invalid value for',k,'=',JSON.stringify(v),'— expected one of',ok().join(', '));
    return false;
  }
  S[k]=v;LS.set('settings',S);
  applySettings();
  return true;
}
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
const THEMES={
  nexus:{label:'Nexus (dark)',bg:'#05070d',win:'rgba(14,18,30,.78)',text:'#e8f1ff',muted:'#8ea0bd',sidebar:'rgba(0,0,0,.16)',bar:'rgba(8,12,22,.62)'},
  midnight:{label:'Midnight Blue',bg:'#030610',win:'rgba(12,22,44,.80)',text:'#dce9ff',muted:'#7f96bd',sidebar:'rgba(0,4,14,.2)',bar:'rgba(6,12,28,.66)'},
  carbon:{label:'Carbon',bg:'#0a0a0a',win:'rgba(20,20,20,.86)',text:'#e6e6e6',muted:'#8a8a8a',sidebar:'rgba(0,0,0,.24)',bar:'rgba(14,14,14,.7)'},
  vapor:{label:'Vaporwave',bg:'#160522',win:'rgba(38,12,60,.8)',text:'#ffe9fb',muted:'#c39ad6',sidebar:'rgba(20,4,36,.24)',bar:'rgba(30,8,50,.66)'},
  forest:{label:'Deep Forest',bg:'#04120c',win:'rgba(10,30,22,.8)',text:'#dff5e8',muted:'#7fae95',sidebar:'rgba(0,14,8,.2)',bar:'rgba(6,22,16,.64)'},
  paper:{label:'Paper (light)',bg:'#e8ecf3',win:'rgba(255,255,255,.9)',text:'#16203a',muted:'#5d6b85',sidebar:'rgba(0,0,0,.04)',bar:'rgba(255,255,255,.7)'}
};
function applyTheme(name){
  const t=THEMES[name]||THEMES.nexus;
  const r=document.documentElement.style;
  r.setProperty('--win-bg',t.win);
  r.setProperty('--win-bg-solid',t.win);
  r.setProperty('--text',t.text);
  r.setProperty('--muted',t.muted);
  r.setProperty('--sidebar',t.sidebar);
  document.body.style.background=t.bg;
  $('#taskbar').style.background=t.bar;
  document.body.classList.toggle('light-theme',name==='paper');
  if(name==='paper'){
    r.setProperty('--win-border','rgba(0,0,0,.14)');
    r.setProperty('--win-shadow','0 24px 60px rgba(20,30,60,.22)');
    r.setProperty('--muted','#5d6b85');
  }else{
    r.setProperty('--win-border','rgba(255,255,255,.14)');
    r.setProperty('--win-shadow','0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.05) inset');
  }
}
APPS.settings={
  title:'Settings',icon:ICONS.settings,desc:'System preferences',w:900,h:620,
  build(w,opts){
    const TABS=[['appearance','Appearance',ICONS.img],['personalize','Personalization',ICONS.grid],
      ['sound','Sound',ICONS.media],['system','System',ICONS.cpu],['about','About',ICONS.info]];
    w.body.innerHTML=`<div class="st">
      <div class="stSide"></div>
      <div class="stMain"></div>
    </div>`;
    const side=w.body.querySelector('.stSide'),main=w.body.querySelector('.stMain');
    let tab=(opts.tab&&TABS.find(t=>t[0]===opts.tab))?opts.tab:'appearance';
    TABS.forEach(([id,nm,ic])=>{
      const b=el('button','sideIco',side);
      b.innerHTML=`<span class="ic">${ic}</span><span>${nm}</span>`;
      b.dataset.tab=id;b.onclick=()=>{tab=id;render()};
    });
    const row=(title,desc,ctrl)=>{
      const r=el('div','row');
      r.appendChild(Object.assign(el('div','tx'),{innerHTML:`<b>${esc(title)}</b><span>${desc}</span>`}));
      r.appendChild(ctrl);return r;
    };
    const slider=(val,min,max,cb,fmtFn)=>{
      const s=el('input');s.type='range';s.min=min;s.max=max;s.value=val;s.style.width='150px';
      s.oninput=()=>{cb(+s.value);if(fmtFn)fmtFn(+s.value)};
      return s;
    };
    /* el(tag, cls, parent) appends to a parent; the label and the handler are
       assigned afterwards, which is the pattern every other app in NEXUS uses.
       Passing a handler in the parent slot silently builds a button that is
       never inserted, so the control simply does nothing when clicked. */
    const btn=(mod,label,fn)=>{
      const b=el('button','btn'+(mod?' '+mod:''));
      b.textContent=label;b.onclick=fn;return b;
    };
    const toggle=(on,cb)=>{
      const t=el('div','sw2'+(on?' on':''));
      t.setAttribute('role','switch');t.tabIndex=0;
      t.setAttribute('aria-checked',on?'true':'false');
      t.setAttribute('aria-label','Toggle setting');
      const fire=()=>{const v=!t.classList.contains('on');t.classList.toggle('on',v);
        t.setAttribute('aria-checked',v?'true':'false');cb(v);Audio2.click()};
      t.onclick=fire;
      t.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fire()}};
      return t;
    };
    const sel=(val,opts,cb)=>{
      const s=el('select','inp');
      opts.forEach(([v,l])=>{const o=el('option','',s);o.value=v;o.textContent=l});
      s.value=val;s.onchange=()=>{cb(s.value);Audio2.click()};
      return s;
    };
    function render(){
      $$('.sideIco',side).forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
      main.innerHTML='';
      const t=el('div','',main);
      const heads={appearance:['Appearance','Wallpaper, theme, accent and interface effects.'],
        personalize:['Personalization','Icon size, taskbar placement and clock format.'],
        sound:['Sound','Master volume and per-category audio.'],
        system:['System','Maintenance, storage and reset actions.'],
        about:['About','Version, hardware model and credits.']};
      t.innerHTML=`<h2>${heads[tab][0]}</h2><div class="dsc">${heads[tab][1]}</div>`;
      main.appendChild(t);
      if(tab==='appearance'){
        const lbl=el('div','',t);lbl.textContent='Wallpaper';
        lbl.style.cssText='font-size:12px;margin:16px 0 4px;color:#c8d6ee';
        const grid=el('div','wpgrid',t);
        WALLPAPERS.filter(wp=>!wp.secret||Eggs.found['wp-zero']).forEach(wp=>{
          const c=el('div','wpc'+(S.wallpaper===wp.id?' on':''),grid);
          const box=el('div','css',c);
          box.style.background=wpGradient(wp);
          const sp=el('span','',c);sp.textContent=wp.name;
          c.title=wp.anim?'Animated wallpaper':'Static wallpaper';
          c.onclick=()=>{Wall.apply(wp.id);LS.set('settings',S);$$('.wpc',grid).forEach(x=>x.classList.toggle('on',x===c));
            toast('Wallpaper: '+wp.name)};
          c.oncontextmenu=e=>{e.preventDefault();ctxMenu(e.clientX,e.clientY,[
            {label:'Set as wallpaper',icon:ICONS.ok,act:()=>{Wall.apply(wp.id);LS.set('settings',S)}},
            {label:'Random wallpaper',icon:ICONS.reload,act:()=>{
              const o=Wall.shufflable().filter(x=>x.id!==S.wallpaper);
              const n=o[(Math.random()*o.length)|0];Wall.apply(n.id);LS.set('settings',S);render()}}
          ],wp.name)};
        });
        const rnd=el('button','btn',t);rnd.style.marginTop='14px';
        rnd.innerHTML=ICONS.reload+' Shuffle wallpaper';
        rnd.onclick=()=>{const o=Wall.shufflable().filter(x=>x.id!==S.wallpaper);
          const n=o[(Math.random()*o.length)|0];Wall.apply(n.id);LS.set('settings',S);render();toast('Wallpaper: '+n.name)};
        t.appendChild(row('Interface theme','Changes every application surface at once.',
          sel(S.theme,Object.entries(THEMES).map(([k,v])=>[k,v.label]),v=>{setSetting('theme',v);toast('Theme: '+THEMES[v].label)})));
        const accWrap=el('div','',t);
        const al=el('div','',accWrap);al.textContent='Accent color';
        al.style.cssText='font-size:12px;margin:16px 0 6px;color:#c8d6ee';
        const ag=el('div','accents',accWrap);
        ACCENTS.forEach((a,i)=>{
          const b=el('button','acc'+(S.accent===a?' on':''),ag);
          b.style.background=a;b.title=a;
          b.onclick=()=>{setSetting('accent',a);$$('.acc',ag).forEach(x=>x.classList.toggle('on',x===b));
            Audio2.tone(600,.09,'sine',.07,900)};
        });
        const rl=el('div','',t);rl.textContent='Secondary accent (gradients, highlights)';
        rl.style.cssText='font-size:12px;margin:16px 0 6px;color:#c8d6ee';
        const ag2=el('div','accents',t);
        ACCENTS.forEach(a=>{
          const b=el('button','acc'+(S.accent2===a?' on':''),ag2);
          b.style.background=a;b.title=a;
          b.onclick=()=>{setSetting('accent2',a);$$('.acc',ag2).forEach(x=>x.classList.toggle('on',x===b))};
        });
        const lab=el('div','',t);lab.id='trLabel';
        lab.style.cssText='font-size:12px;color:#c8d6ee;margin-top:12px';
        t.appendChild(row('Transparency','Lower values make windows more opaque.',slider(S.transparency,40,100,v=>{
          setSetting('transparency',v);$('#trLabel').textContent='Current: '+v+'%'},v=>$('#trLabel').textContent='Current: '+v+'%')));
        t.appendChild(row('Animations','Wallpaper animation, window transitions and interface motion.',
          toggle(S.animations,v=>{setSetting('animations',v);toast(v?'Animations on':'Animations off')})));
        t.appendChild(row('Show hidden files','Display dot-files in Files, Terminal and NEXUS.',
          toggle(S.showHidden,v=>{setSetting('showHidden',v);Bus.emit('fs')})));
      }
      else if(tab==='personalize'){
        t.appendChild(row('Desktop icon size','Applies to every desktop icon immediately.',
          sel(S.iconSize,[['small','Small'],['medium','Medium'],['large','Large']],v=>{setSetting('iconSize',v)})));
        t.appendChild(row('Taskbar position','Move the taskbar to the top of the screen.',
          toggle(S.taskbarPos==='top',v=>{setSetting('taskbarPos',v?'top':'bottom');toast('Taskbar moved')})));
        t.appendChild(row('24-hour clock','Switch between 24-hour and 12-hour time.',
          toggle(S.clock24,v=>{setSetting('clock24',v);startClock()})));
        t.appendChild(row('Show seconds','Display seconds in the system clock.',
          toggle(S.showSeconds,v=>{setSetting('showSeconds',v);startClock()})));
        t.appendChild(row('Window transparency','Live preview of the current transparency value.',el('div','')));
        const pv=el('div','',t);
        pv.style.cssText='height:60px;border-radius:12px;border:1px solid rgba(255,255,255,.14);margin-top:10px;display:grid;place-items:center;font-size:12px;background:repeating-linear-gradient(45deg,rgba(255,255,255,.05) 0 10px,transparent 10px 20px)';
        pv.textContent='Preview';
        const back=el('div','',pv);
        back.style.cssText=`position:absolute;border-radius:11px;background:var(--win-bg);backdrop-filter:blur(12px);
          border:1px solid var(--win-border);width:70%;height:38px;top:11px;left:15%;display:grid;place-items:center;font-size:11px`;
        back.textContent='Window';
        t.appendChild(row('Tile windows','Arrange all open windows in a grid.',
          btn('', 'Tile', ()=>{tile();toast('Windows tiled')})));
        t.appendChild(row('Cascade windows','Stack all open windows diagonally.',
          btn('', 'Cascade', ()=>{cascade()})));
      }
      else if(tab==='sound'){
        const vl=el('div','',t);vl.id='volLabel';vl.style.cssText='font-size:12px;color:#c8d6ee';
        t.appendChild(row('Master volume','Applies to interface, games and media together.',
          slider(S.volume,0,100,v=>{setSetting('volume',v);renderTray()},v=>$('#volLabel').textContent='Current: '+v+'%')));
        t.appendChild(row('Interface sounds','Clicks, window motion, notifications and terminal feedback.',
          toggle(S.uiSounds,v=>{setSetting('uiSounds',v);if(v)Audio2.click()})));
        t.appendChild(row('Game sounds','Arcade effects and engine synthesis.',
          toggle(S.gameSounds,v=>{setSetting('gameSounds',v);if(v)Audio2.eat()})));
        t.appendChild(row('Media sounds','Music and video playback, including the synthesiser.',
          toggle(S.mediaSounds,v=>{setSetting('mediaSounds',v);
            if(v)Audio2.tone(659,.18,'triangle',.09,undefined,undefined,'media')})));
        t.appendChild(row('Test sound','Play a short synthesised tone.',
          btn('', 'Play', ()=>{[523,659,784,1046].forEach((f,i)=>Audio2.tone(f,.15,'triangle',.09,undefined,i*.08,'ui'))})));
        t.appendChild(row('Mute everything','Silence all audio output.',
          btn('dgr', 'Mute', ()=>{setSetting('volume',0);render();toast('Muted')})));
      }
      else if(tab==='system'){
        const st=VFS.stats();
        t.innerHTML+=`<h3 style="font-size:14px;margin:20px 0 6px">Storage</h3>`;
        t.appendChild(row('Filesystem contents',`${st.files} files in ${st.dirs} folders · ${fmtBytes(st.bytes)}`,
          el('div','')));
        t.appendChild(row('Browser storage','localStorage used by NEXUS OS',
          btn('', fmtBytes(storageBytes), ()=>{toast(fmtBytes(storageBytes)+' used')})));
        t.appendChild(row('Export filesystem','Download the whole virtual filesystem as JSON.',
          btn('', 'Export', ()=>exportFS())));
        t.appendChild(row('Import filesystem','Restore a previously exported filesystem.',
          btn('', 'Import', ()=>importFS())));
        t.innerHTML+=`<h3 style="font-size:14px;margin:24px 0 6px">Maintenance</h3>`;
        t.appendChild(row('Clear notifications','Remove all stored notifications.',
          btn('', 'Clear', ()=>{Notify.clear();Notify.render();toast('Notifications cleared')})));
        t.appendChild(row('Reset achievements','Lock all achievements again.',
          btn('dgr', 'Reset', async()=>{if(await confirmBox('Reset achievements?','All achievement progress will be lost.',true)){
            LS.del('ach');Achievements.got={};Achievements.render();toast('Achievements reset')}})));
        t.appendChild(row('Reset game scores','Clear Snake and Racer records.',
          btn('dgr', 'Reset', ()=>{LS.del('snakeBest');LS.del('racerBest');LS.del('snakeDiff');
            toast('Scores cleared')})));
        t.appendChild(row('Reset settings','Restore every preference to its default value.',
          btn('dgr', 'Reset', async()=>{if(await confirmBox('Reset settings?','Appearance, sound and personalization will be restored.',true)){
            S=Object.assign({},DEFAULT_SETTINGS);LS.set('settings',S);applySettings();Wall.apply(S.wallpaper);
            render();toast('Settings reset')}})));
        t.appendChild(row('Reset filesystem','Erase all files and restore the factory tree.',
          btn('dgr', 'Reset', async()=>{if(await confirmBox('Reset filesystem?','Every file you created will be permanently deleted.',true)){
            VFS.tree=VFS.default();VFS.save();Bus.emit('fs');renderDesktopFiles();render();toast('Filesystem reset')}})));
        t.appendChild(row('Factory reset','Wipe settings, files, scores and achievements, then reboot NEXUS.',
          btn('dgr', 'Erase', async()=>{if(await confirmBox('Factory reset NEXUS?','This erases everything stored in this browser and restarts the system.',true)){
            Object.keys(localStorage).filter(k=>k.startsWith('nexus.')).forEach(k=>localStorage.removeItem(k));
            setTimeout(()=>location.reload(),600)}})));
      }
      else{
        t.innerHTML+=`
          <div style="display:flex;gap:16px;align-items:center;margin:18px 0;padding:16px;border-radius:14px;background:rgba(55,224,255,.08);border:1px solid rgba(55,224,255,.22)">
            <div style="width:64px;height:64px;flex:0 0 auto">${ICONS.nexus}</div>
            <div><b style="font-size:16px;display:block">NEXUS OS</b>
            <span style="font-size:12px;color:#8ea0bd">Version 4.2.1 · build nexus-2026.09 · single-file distribution</span></div>
          </div>
          <h3 style="font-size:14px;margin:20px 0 6px">System</h3>
          <table class="tbl" style="font-size:12.5px;width:100%;border-collapse:collapse">
            ${[['Kernel','nexus-kernel 4.2.1'],['Window manager','NexusWM'],
               ['Shell','NexusShell 1.0.0'],['Filesystem','VFS (localStorage-backed)'],
               ['Renderer','Canvas 2D + SVG'],['Audio',Audio2.ctx?Audio2.ctx.sampleRate+' Hz · active':'Web Audio (on demand)'],
               ['Uptime',Diag.uptimeStr()],['Display',`${innerWidth}×${innerHeight} @${devicePixelRatio}×`],
               ['User agent',navigator.userAgent.slice(0,58)+'…']]
              .map(r=>`<tr><td style="padding:7px 0;color:#8ea0bd;width:150px">${r[0]}</td>
                       <td style="padding:7px 0">${esc(r[1])}</td></tr>`).join('')}
          </table>
          <h3 style="font-size:14px;margin:22px 0 6px">Rendering backend</h3>
          <p style="font-size:12.5px;color:#8ea0bd;line-height:1.8">
            ${(()=>{try{const g=document.createElement('canvas').getContext('webgl');
              const d=g&&g.getExtension('WEBGL_debug_renderer_info');
              return d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):'WebGL not available';}catch(e){return 'Canvas 2D'}})()}
          </p>
          <h3 style="font-size:14px;margin:22px 0 6px">Achievements</h3>
          <p style="font-size:12.5px;color:#8ea0bd">${Achievements.total()} of ${ACH_LIST.length} unlocked.</p>`;
        const b=el('button','btn',t);b.style.marginTop='10px';
        b.innerHTML=ICONS.star+' Open achievement viewer';
        b.onclick=()=>API.open('achievements');
      }
    }
    function wpGradient(wp){
      const m={
        city:'linear-gradient(160deg,#0b1226 0%,#3a1040 45%,#ff6bb0 100%)',
        space:'radial-gradient(circle at 70% 30%,#2a3a8a,#01020a 70%)',
        aurora:'linear-gradient(170deg,#01030c,#063a4d 50%,#0a5c3a)',
        matrix:'linear-gradient(160deg,#001a08,#003d16)',
        sunset:'linear-gradient(180deg,#1a0733,#6b1a5e 45%,#ffb26b)',
        minimal:'linear-gradient(150deg,#08090d,#181c26)',
        nebula:'radial-gradient(circle at 30% 30%,#6a2aa0,#04030f 70%)',
        vortex:'conic-gradient(from 0deg,#01020a,#0a2a4a,#01020a,#4a0a3a,#01020a)',
        plasma:'conic-gradient(from 45deg,#12003a,#003a4a,#3a003a,#12003a)',
        wireframe:'linear-gradient(160deg,#04060e,#0a1830)',
        void:'radial-gradient(circle at 50% 50%,#0a1a2a,#000 70%)',
        zero:'linear-gradient(160deg,#000,#220011)'
      };
      return m[wp.kind]||'#111';
    }
    function exportFS(){
      try{
        const data=JSON.stringify(VFS.tree,null,1);
        const b=new Blob([data],{type:'application/json'});
        const a=document.createElement('a');
        a.href=URL.createObjectURL(b);
        a.download='nexus-filesystem.json';
        a.click();
        setTimeout(()=>URL.revokeObjectURL(a.href),2000);
        toast('Filesystem exported');
        Notify.send('Export complete','nexus-filesystem.json downloaded',{icon:ICONS.save});
      }catch(e){toast('Export failed','<span style="color:#ff5c72">!</span>')}
    }
    function importFS(){
      const i=document.createElement('input');
      i.type='file';i.accept='application/json,.json';
      i.onchange=()=>{
        const f=i.files[0];if(!f)return;
        const r=new FileReader();
        r.onload=()=>{
          try{
            const tree=JSON.parse(r.result);
            if(!tree||tree.type!=='dir')throw new Error('not a filesystem');
            VFS.tree=VFS.rehydrate(tree);VFS.save();Bus.emit('fs');renderDesktopFiles();
            toast('Filesystem imported');
          }catch(e){toast('Invalid filesystem file','<span style="color:#ff5c72">!</span>')}
        };
        r.readAsText(f);
      };
      i.click();
    }
    render();
    return {onResize(){}};
  }
};
/* ---------- COMPUTER (system overview + device manager) ---------- */
