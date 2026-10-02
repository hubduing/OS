const API={
  lastCalc:null,
  sendCalc(e,r){this.lastCalc={e,r};if(this.onCalc)this.onCalc(e,r)},
  open(id,opts){
    opts=opts||{};
    if(id==='notes')id='editor';
    if(!APPS[id]){
      const r=resolveApp(id);
      if(r)id=r;else{toast('Unknown application: '+id,'<span style="color:#ff5c72">!</span>');return null}
    }
    return WM.open({id,title:APPS[id].title,icon:APPS[id].icon},opts);
  },
  openFile(path){
    const n=VFS.node(path);
    if(!n)return toast('File not found: '+path,'<span style="color:#ff5c72">!</span>');
    if(n.type==='dir')return API.open('files',{path:VFS.norm(path)});
    const e=EXT_ICON[extOf(n.name)];
    if(e==='vid')return API.open('video',{path:VFS.norm(path)});
    if(e==='aud')return API.open('music',{file:VFS.norm(path)});
    if(e==='img'&&(n.dataUrl||n.blobUrl)){
      const b=el('div','');
      b.innerHTML=`<img src="${n.dataUrl||n.blobUrl}" style="max-width:100%;border-radius:10px;display:block;margin:8px auto">`;
      dialog({title:n.name,text:VFS.norm(path),icon:ICONS.img,body:b,
        buttons:[{label:'Open in Paint',value:'p'},{label:'Close',value:1,pri:true}]})
        .then(v=>{if(v==='p')API.open('paint',{single:false})});
      return;
    }
    return API.open('editor',{path:VFS.norm(path)});
  },
  refreshTaskbar(){WM.renderTaskbar()}
};

/* ---------- SHUTDOWN ---------- */
function shutdown(restart){
  const s=$('#shutdownScreen');
  s.classList.add('on');
  $('#sdMsg').textContent='Flushing filesystem to localStorage';
  Audio2.tone(300,.5,'sine',.08,120);
  setTimeout(()=>{$('#sdMsg').textContent='Terminating user processes'},700);
  setTimeout(()=>{$('#sdMsg').textContent='Unmounting virtual filesystem'},1400);
  setTimeout(()=>{
    WM.wins.forEach(x=>{if(x.api&&x.api.destroy){try{x.api.destroy()}catch(e){}}});
    VFS.save();LS.set('settings',S);trackStorage();
  },1900);
  setTimeout(()=>{
    s.innerHTML=restart
      ?'<div>RESTARTING NEXUS…</div><div id="sdMsg" style="opacity:.6">Cold boot</div>'
      :'<div>SYSTEM HALTED</div><div id="sdMsg" style="opacity:.6">It is safe to close this tab</div>';
  },2300);
  if(restart)setTimeout(()=>location.reload(),2900);
  else setTimeout(()=>{
    s.innerHTML=`<div style="text-align:center;line-height:2">
      <div>SYSTEM HALTED</div>
      <div style="opacity:.5;font-size:11px">Your filesystem and settings are saved in this browser.</div>
      <button id="rebootBtn" style="margin-top:18px;padding:10px 24px;border:1px solid #37e0ff;background:transparent;
        color:#37e0ff;border-radius:9px;cursor:pointer;font-family:monospace;letter-spacing:.2em">POWER ON</button></div>`;
    $('#rebootBtn').onclick=()=>location.reload();
  },2900);
}

/* ---------- GLOBAL KEYBOARD ---------- */
document.addEventListener('keydown',e=>{
  // Alt+Tab
  if(e.altKey&&e.key==='Tab'){e.preventDefault();WM.cycle();return}
  // Escape
  if(e.key==='Escape'){
    if(Diag.full){Diag.toggleFull();return}
    if(openCtx){closeCtx();return}
    if(startOpen){toggleStart(false);return}
    if($('#ncPanel').classList.contains('on')){$('#ncPanel').classList.remove('on');return}
    if($('#modalWrap').classList.contains('on')){closeDialog();return}
  }
  // F12
  if(e.key==='F12'){e.preventDefault();Diag.toggleFull();return}
  // F5 -> desktop refresh (prevent browser reload only inside OS? keep default)
  // Win / Ctrl+Esc
  const winKey=e.key==='Meta'||e.key==='OS';
  if(winKey&&!e.repeat){toggleStart(!startOpen);e.preventDefault();return}
  if(e.ctrlKey&&e.key==='Escape'){e.preventDefault();toggleStart(!startOpen);return}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();toggleStart(true);$('#startSearch').focus();return}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d'){e.preventDefault();WM.minimizeAll();return}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='e'){e.preventDefault();API.open('files');return}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='t'){e.preventDefault();API.open('terminal');return}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='l'){e.preventDefault();API.open('nexus',{single:false});return}
  // typing guard: don't hijack keys inside inputs
  const tag=(e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea'||e.target.isContentEditable)return;
  if(e.key===' '){e.preventDefault();Audio2.key()}
});
/* taskbar right-click prevented by contextmenu handler; suppress browser menu on desktop */
document.addEventListener('contextmenu',e=>{
  if(!e.target.closest('input,textarea,.brView'))e.preventDefault();
});

/* ---------- BOOT SEQUENCE ---------- */
const BOOT_LINES=[
  ['NEXUS BIOS 4.2.1 — 64K POST',''],
  ['Initializing kernel ..................... ','ok','OK'],
  ['Loading virtual filesystem ............. ','ok','OK'],
  ['  mounting /dev/localStorage[ro] ......... ','ok','OK'],
  ['  checking node integrity ............... ','ok','2048 nodes'],
  ['Starting services ...................... ','ok','OK'],
  ['  nexuswm .............. ','dim','loaded'],
  ['  compositor ........... ','dim','loaded'],
  ['  audio.service ........ ','dim','44100 Hz'],
  ['  intent.parser ......... ','dim','online'],
  ['Mounting user space .................... ','ok','OK'],
  ['Applying saved preferences ............. ','ok','applied'],
  ['Restoring session state ................. ','ok',(WM?0:0)+' windows'],
  ['Starting desktop ........................ ','ok','OK'],
  ['',''],
  ['NEXUS OS ready.','']
];
function boot(){
  const logEl=$('#bootLog'),barEl=$('#bootBar'),pctEl=$('#bootPct');
  let i=0;
  const type=()=>{
    if(i>=BOOT_LINES.length){finishBoot();return}
    const [txt,cls,val]=BOOT_LINES[i];
    const d=el('div','',logEl);
    d.textContent=txt;
    if(cls==='ok'&&val){d.innerHTML=esc(txt)+`<span class="${val==='OK'?'ok':'dim'}">[${esc(val)}]</span>`;d.className='ok'}
    else if(cls==='dim')d.className='dim';
    else if(!txt)d.remove();
    logEl.scrollTop=logEl.scrollHeight;
    const p=Math.round((i+1)/BOOT_LINES.length*100);
    barEl.style.width=p+'%';
    pctEl.textContent='LOADING '+p+'%';
    i++;
    setTimeout(type,110+Math.random()*190);
  };
  setTimeout(type,340);
}
function finishBoot(){
  try{Audio2.init();Audio2.boot()}catch(e){console.warn('[NEXUS] audio unavailable',e)}
  const b=$('#boot');
  b.classList.add('off');
  setTimeout(()=>{b.classList.add('gone')},900);
  const first=!LS.get('booted',false);
  LS.set('booted',true);
  if(first){
    setTimeout(()=>Notify.send('Welcome to NEXUS',
      'Open the Start menu, or ask the assistant to do something for you.',{app:'nexus',icon:ICONS.nexus}),1100);
    setTimeout(()=>Achievements.grant('FIRST_BOOT'),1500);
  }
  setTimeout(()=>{
    const ov=LS.get('seenIntro',false);
    if(!ov)firstRunIntro();
  },700);
}
function firstRunIntro(){
  LS.set('seenIntro',true);
  const b=el('div','');
  b.innerHTML=`<p style="margin:0 0 12px;line-height:1.75">Everything here runs in one HTML file — the window manager,
    the filesystem, the terminal, the games. All of them share the same state, so a file you create in the
    Terminal appears in Files instantly.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin-bottom:12px">
      ${[['Win','Start menu'],['Alt+Tab','Switch windows'],['F12','Diagnostics'],['Ctrl+Shift+N','NEXUS assistant'],
         ['Drag to edge','Snap a window'],['Right-click','Context menus']].map(([k,v])=>
        `<div style="padding:9px;border-radius:9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09)">
          <div style="font-family:var(--mono);font-size:11.5px;color:var(--accent)">${k}</div>
          <div style="font-size:11px;color:#8ea0bd;margin-top:3px">${v}</div></div>`).join('')}
    </div>
    <p style="margin:0;font-size:12px;color:#8ea0bd">Best place to start: type <b>help</b> in the Terminal,
      or launch <b>NEXUS</b> and ask for something.</p>`;
  dialog({title:'Welcome to NEXUS OS',text:'',icon:ICONS.nexus,body:b,
    buttons:[{label:'Open the assistant',value:'nx'},{label:'Take me in',value:1,pri:true}]})
    .then(v=>{if(v==='nx')API.open('nexus',{single:false})});
}

/* ---------- INIT ---------- */
function init(){
  VFS.load();
  trackStorage();
  applySettings();
  Wall.init();
  renderDesktop();
  startClock();
  renderTray();
  Notify.render();
  startClock();
  // startup process
  setTimeout(()=>{
    Notify.send('System ready','NEXUS OS 4.2.1 · '+Object.keys(APPS).length+' applications registered',{icon:ICONS.nexus});
  },2400);
  // fs change → desktop icons
  Bus.on('fs',()=>{renderDesktopFiles();Achievements.checkOrganizer()});
  // Fps loop
  const loop=ts=>{Diag.tick(ts);requestAnimationFrame(loop)};
  requestAnimationFrame(loop);
  // 5 minute uptime achievement
  setTimeout(()=>Achievements.grant('NIGHT_OWL'),300000);
  // secret file lives in the filesystem
  if(!VFS.node('/Documents/.nexus')){
    VFS.tree.children.find(c=>c.name==='Documents').children.push({
      id:VFS.uid(),name:'.nexus',type:'file',ctime:Date.now(),mtime:Date.now(),size:0,
      content:'You found it.\n\nThis file is not listed anywhere. It is hidden because it begins with a dot,\nand NEXUS keeps dot-files out of the way unless you ask for them.\n\nTurn on "Show hidden files" in Settings → Appearance,\nor simply type:  cat /Documents/.nexus\n\nThere are more of these. Keep looking.\n'
    });
    VFS.save();
  }
  // diagnostics fullscreen grid
  $('#dgFullGrid').addEventListener('click',()=>{});
  $('#dgFull').addEventListener('click',e=>{if(e.target.id==='dgFull')Diag.toggleFull()});
  // global right-click on empty desktop handled by #icons
  // seeded mystery
  document.addEventListener('click',e=>{
    if(e.detail===3){
      $$('.dicon').forEach(d=>d.style.opacity='');
      if(Eggs.mark('triple'))toast('A third click. The desktop noticed.');
    }
  },true);
  boot();
}
window.addEventListener('error',e=>{
  console.error('[NEXUS]',e.message,e.filename,e.lineno);
});
window.addEventListener('unhandledrejection',e=>console.error('[NEXUS] unhandled',e.reason));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
