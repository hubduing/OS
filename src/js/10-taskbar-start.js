let clockTimer=null;
function startClock(){
  const c=$('#clock');
  const tick=()=>{
    const d=new Date();
    const t=S.clock24?`${pad(d.getHours())}:${pad(d.getMinutes())}${S.showSeconds?':'+pad(d.getSeconds()):''}`
                    :`${((d.getHours()%12)||12)}:${pad(d.getMinutes())}${S.showSeconds?':'+pad(d.getSeconds()):''}${d.getHours()<12?' AM':' PM'}`;
    const ds=fmtDay(d);
    if(c.querySelector('.t').textContent!==t){
      c.querySelector('.t').textContent=t;
      c.querySelector('.d').textContent=ds;
    }
  };
  tick();clearInterval(clockTimer);clockTimer=setInterval(tick,1000);
}
function renderTray(){
  const v=$('#trayVol');
  v.innerHTML=(S.volume===0||S.uiSounds===false&&S.gameSounds===false)?ICONS.mute:ICONS.vol;
  v.title='Volume: '+S.volume+'%';
  const b=$('#trayBat');
  b.innerHTML=ICONS.bat;
  const f=b.querySelector('#batFill');
  const pct=Math.round(60+40*Math.abs(Math.sin(Date.now()/90000)));
  if(f){f.setAttribute('width',(13*pct/100).toFixed(1));f.setAttribute('fill',pct<25?'#ff5c72':pct<45?'#ffc857':'currentColor')}
  b.title='Battery: '+pct+'%';
  const nc=$('#trayBell');
  const un=Notify.list.filter(n=>Date.now()-n.time<600000).length;
  if(un){nc.classList.add('badge');nc.setAttribute('data-n',un)}else{nc.classList.remove('badge');nc.removeAttribute('data-n')}
}
setInterval(renderTray,5000);
$('#trayVol').onclick=()=>ctxMenu(innerWidth-160,60,[
  {label:(S.volume===0?'Unmute':'Mute'),icon:S.volume===0?ICONS.vol:ICONS.mute,
   act:()=>{setSetting('volume',S.volume===0?60:0);renderTray()}},
  {sep:1},...ACCENTS.map((a,i)=>({label:['Cyan','Violet','Pink','Green','Amber','Orange','Blue','Red'][i],
    icon:'<span style="width:12px;height:12px;border-radius:50%;background:'+a+';display:inline-block"></span>',
    act:()=>setSetting('accent',a)})).filter((_,i)=>i<4)
],'Audio');
$('#trayNet').onclick=()=>toast('Network: Connected · NEXUS-LOCAL · 100% signal');
$('#trayBat').onclick=()=>toast('Battery: '+(60+40*Math.abs(Math.sin(Date.now()/90000))|0)+'% · Charging');
$('#tray').oncontextmenu=e=>{e.preventDefault();ctxMenu(e.clientX-100,e.clientY-120,[
  {label:'System Diagnostics',icon:ICONS.cpu,key:'F12',act:()=>API.open('diagnostics')},
  {label:'Achievements',icon:ICONS.star,act:()=>API.open('achievements')},
  {label:'Settings',icon:ICONS.settings,act:()=>API.open('settings')},
  {label:'NEXUS Assistant',icon:ICONS.nexus,act:()=>API.open('nexus')},
  {sep:1},
  {label:'Toggle Taskbar',icon:ICONS.list,act:()=>{$('#taskbar').classList.toggle('hidden')}}
],'System Tray')};
$('#trayBell').onclick=e=>{e.stopPropagation();
  const p=$('#ncPanel');
  const on=!p.classList.contains('on');
  p.classList.toggle('on',on);
  if(on)Notify.render();
};
$('#ncClose').onclick=()=>$('#ncPanel').classList.remove('on');
$('#ncClear').onclick=()=>{Notify.clear();Notify.render();toast('Notifications cleared')};
$('#clock').onclick=()=>ctxMenu(innerWidth-190,60,[
  {label:S.clock24?'24-hour clock':'12-hour clock',icon:ICONS.info,act:()=>setSetting('clock24',!S.clock24)},
  {label:S.showSeconds?'Hide seconds':'Show seconds',icon:ICONS.info,act:()=>setSetting('showSeconds',!S.showSeconds)},
  {sep:1},
  {label:'Open Calendar',icon:ICONS.notes,act:()=>API.open('notes')},
  {label:'System Diagnostics',icon:ICONS.cpu,act:()=>API.open('diagnostics')}
],'Clock');
$('#taskbar').oncontextmenu=e=>{
  if(e.target.closest('.titem'))return;
  e.preventDefault();
  ctxMenu(e.clientX,e.clientY-140,[
    {label:'Task Manager',icon:ICONS.cpu,act:()=>API.open('diagnostics')},
    {label:'System Diagnostics (fullscreen)',icon:ICONS.mon,key:'F12',act:()=>Diag.toggleFull()},
    {sep:1},
    {label:'Cascade Windows',icon:ICONS.grid,act:()=>cascade()},
    {label:'Tile Windows',icon:ICONS.grid,act:()=>tile()},
    {label:'Minimize All',icon:ICONS.min,act:()=>WM.minimizeAll()},
    {label:'Show Desktop',icon:ICONS.computer,act:()=>WM.minimizeAll()},
    {sep:1},
    {label:'Taskbar Position: '+({bottom:'Bottom',top:'Top'}[S.taskbarPos]||'Bottom'),icon:ICONS.list,act:()=>setSetting('taskbarPos',S.taskbarPos==='bottom'?'top':'bottom')}
  ],'Taskbar');
};
function cascade(){
  WM.wins.forEach((w,i)=>{
    if(w.max){w.max=false;w.el.classList.remove('max')}
    w.min=false;w.el.style.display='';w.el.classList.remove('min');
    w.x=40+i*30;w.y=30+i*28;w.w=Math.min(880,innerWidth-80-i*30);w.h=Math.min(600,innerHeight-130-i*28);
    w.el.classList.add('snapping');WM.applyGeo(w);
  });
  WM.renderTaskbar();
}
function tile(){
  const l=WM.wins.filter(w=>!w.min);
  if(!l.length)return;
  const cols=Math.ceil(Math.sqrt(l.length)),rows=Math.ceil(l.length/cols);
  l.forEach((w,i)=>{
    if(w.max){w.max=false;w.el.classList.remove('max')}
    const cx=i%cols, cy=(i/cols)|0;
    w.x=Math.round(cx*innerWidth/cols);w.y=Math.round(cy*innerHeight/rows);
    w.w=Math.round(innerWidth/cols)-4;w.h=Math.round(innerHeight/rows)-4;
    w.el.classList.add('snapping');WM.applyGeo(w);
  });
}
let startOpen=false;
function toggleStart(force){
  const s=$('#start');
  const on=force!=null?force:!startOpen;
  if(on===startOpen)return;
  startOpen=on;
  s.classList.toggle('on',on);
  $('#startBtn').classList.toggle('on',on);
  if(on){renderStart();closeCtx();$('#ncPanel').classList.remove('on');
    setTimeout(()=>$('#startSearch').focus(),60)}
  Audio2.click();
}
$('#startBtn').onclick=()=>toggleStart();
$('#searchBtn').onclick=()=>{toggleStart(true);$('#startSearch').focus()};
document.addEventListener('pointerdown',e=>{
  if(startOpen&&!e.target.closest('#start')&&!e.target.closest('#startBtn'))toggleStart(false);
});
function renderStart(){
  const q=($('#startSearch').value||'').toLowerCase();
  const pg=$('#pinGrid');pg.innerHTML='';
  Pinned.list.forEach(id=>{
    const a=APPS[id];if(!a)return;
    if(q&&!a.title.toLowerCase().includes(q))return;
    const b=el('button','pin',pg);
    b.innerHTML=`<span class="ic">${a.icon}</span><span>${esc(a.title)}</span>`;
    b.onclick=()=>{toggleStart(false);API.open(id)};
    b.oncontextmenu=e=>{e.preventDefault();ctxMenu(e.clientX,e.clientY,[
      {label:'Open',icon:ICONS.open,act:()=>{toggleStart(false);API.open(id)}},
      {label:'Unpin',icon:ICONS.x,act:()=>{Pinned.remove(id);toast('Unpinned '+a.title)}}
    ],a.title)};
  });
  const al=$('#appList');al.innerHTML='';
  const ids=Object.keys(APPS).filter(id=>!['diagnostics','hidden'].includes(id));
  const shown=ids.filter(id=>{
    if(q)return APPS[id].title.toLowerCase().includes(q)||(APPS[id].desc||'').toLowerCase().includes(q);
    return true;
  });
  $('#appListLbl').textContent=q?`Results (${shown.length})`:'All applications';
  if(!shown.length){al.innerHTML='<div style="padding:16px 8px;font-size:12px;color:#8ea0bd">No apps match "'+esc(q)+'"</div>'}
  shown.forEach(id=>{
    const a=APPS[id];
    const b=el('button','appRow',al);
    b.innerHTML=`<span class="ic">${a.icon}</span><b>${esc(a.title)}</b><i>${esc(a.desc||'')}</i>`;
    b.onclick=()=>{toggleStart(false);API.open(id)};
    b.oncontextmenu=e=>{e.preventDefault();ctxMenu(e.clientX,e.clientY,[
      {label:'Open',icon:ICONS.open,act:()=>{toggleStart(false);API.open(id)}},
      {label:Pinned.list.includes(id)?'Unpin from Start':'Pin to Start',icon:ICONS.star,act:()=>{
        Pinned.list.includes(id)?Pinned.remove(id):Pinned.add(id);toast(Pinned.list.includes(id)?'Pinned '+a.title:'Unpinned '+a.title)}}
    ],a.title)};
  });
  // file results
  if(q&&shown.length===0){
    const res=VFS.search(q).slice(0,8);
    if(res.length){
      const lbl=el('div','',al);
      lbl.style.cssText='font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#8ea0bd;padding:10px 8px 4px';
      lbl.textContent='Files';
      al.appendChild(lbl);
      res.forEach(r=>{
        const b=el('button','appRow',al);
        b.innerHTML=`<span class="ic">${iconForNode(r.node,r.node.type==='dir')}</span><b>${esc(r.node.name)}</b><i>${esc(r.path)}</i>`;
        b.onclick=()=>{toggleStart(false);
          r.node.type==='dir'?API.open('files',{path:r.path}):API.openFile(r.path)};
      });
    }
  }
}
$('#startSearch').addEventListener('input',renderStart);
$('#startSearch').addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    const first=$('#appList .appRow');
    if(first)first.click();
  }
});
$('#powerBtn').onclick=()=>{
  ctxMenu(innerWidth-180,innerHeight-90,[
    {label:'Shut Down',icon:ICONS.power,act:()=>shutdown(false)},
    {label:'Restart',icon:ICONS.reload,act:()=>shutdown(true)},
    {label:'Sign Out',icon:ICONS.computer,act:()=>shutdown(true)},
    {label:'Lock Session',icon:ICONS.dnd,act:()=>lockScreen()}
  ],'Power');
};

/* ---------- LOCK SCREEN ---------- */
function lockScreen(){
  const w=el('div','');
  w.style.cssText='position:fixed;inset:0;z-index:98000;background:radial-gradient(circle at 50% 40%,#0b1430,#03050c 70%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;backdrop-filter:blur(10px)';
  const t=new Date();
  w.innerHTML=`<div style="font-size:80px;font-weight:100;letter-spacing:.06em;color:#e8f1ff;line-height:1">${S.clock24?pad(t.getHours())+':'+pad(t.getMinutes()):((t.getHours()%12)||12)+':'+pad(t.getMinutes())+' '+(t.getHours()<12?'AM':'PM')}</div>
    <div style="color:#8ea0bd;letter-spacing:.24em;font-size:12px">${fmtDayLong(t)}</div>
    <div style="width:76px;height:76px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:grid;place-items:center;font-size:30px;font-weight:700;color:#001018;box-shadow:0 0 40px rgba(55,224,255,.4)">U</div>
    <div style="color:#8ea0bd;font-size:13px">Click anywhere or press any key to unlock</div>`;
  document.body.appendChild(w);
  Audio2.toneless;
  const un=()=>{w.remove();document.removeEventListener('keydown',un);Audio2.resume()};
  w.onclick=un;document.addEventListener('keydown',un);
  setTimeout(()=>Audio2.tone(440,.3,'sine',.08),50);
}
