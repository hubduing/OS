const DESKTOP_APPS=[
  {id:'files',name:'Files',icon:ICONS.files},
  {id:'terminal',name:'Terminal',icon:ICONS.terminal},
  {id:'editor',name:'Notes',icon:ICONS.notes},
  {id:'arcade',name:'Games',icon:ICONS.games},
  {id:'browser',name:'Browser',icon:ICONS.browser},
  {id:'paint',name:'Paint',icon:ICONS.paint},
  {id:'music',name:'Music',icon:ICONS.aud},
  {id:'video',name:'Video',icon:ICONS.vid},
  {id:'calculator',name:'Calculator',icon:ICONS.calc},
  {id:'computer',name:'Computer',icon:ICONS.computer},
  {id:'settings',name:'Settings',icon:ICONS.settings}
];
function renderDesktop(){
  const c=$('#icons');c.innerHTML='';
  DESKTOP_APPS.forEach(a=>{
    const d=el('div','dicon',c);
    d.innerHTML=`<div class="ico">${a.icon}</div><span>${a.name}</span>`;
    d.onclick=e=>{e.stopPropagation();$$('.dicon').forEach(x=>x.classList.remove('sel'));d.classList.add('sel')};
    d.ondblclick=()=>API.open(a.id);
    d.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();
      $$('.dicon').forEach(x=>x.classList.remove('sel'));d.classList.add('sel');
      ctxMenu(e.clientX,e.clientY,[
        {label:'Open',icon:ICONS.open,act:()=>API.open(a.id)},
        {sep:1},
        {label:'Open Terminal Here',icon:ICONS.terminal,act:()=>API.open('terminal',{cwd:'/Desktop'})},
        {label:'Pin to Start',icon:ICONS.star,act:()=>{if(!Pinned.list.includes(a.id)){Pinned.add(a.id);toast('Pinned '+a.name)}}},
        {sep:1},
        {label:'Properties',icon:ICONS.info,act:()=>API.open('settings',{tab:'about'})}
      ],a.name);
    };
  });
  renderDesktopFiles();
}
function renderDesktopFiles(){
  const c=$('#icons');
  $$('[data-vfile]',c).forEach(n=>n.remove());
  const d=VFS.node('/Desktop');if(!d)return;
  const list=(d.children||[]).filter(n=>n.type==='dir'||n.type==='file');
  if(!list.length)return;
  const hdr=el('div','dicon',c);
  hdr.style.pointerEvents='none';hdr.style.opacity=.45;hdr.style.width='auto';
  hdr.innerHTML=`<div class="ico" style="width:24px;height:24px;opacity:.6">${ICONS.folder}</div>
    <span style="font-size:9px;letter-spacing:.14em">DESKTOP FILES</span>`;
  list.forEach(n=>{
    const d2=el('div','dicon',c);d2.dataset.vfile=n.name;
    d2.innerHTML=`<div class="ico">${iconForNode(n,n.type==='dir')}</div><span>${esc(n.name)}</span>`;
    d2.onclick=e=>{e.stopPropagation();$$('.dicon').forEach(x=>x.classList.remove('sel'));d2.classList.add('sel')};
    d2.ondblclick=()=>{ if(n.type==='dir')API.open('files',{path:'/Desktop/'+n.name}); else API.openFile('/Desktop/'+n.name) };
    d2.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();
      ctxMenu(e.clientX,e.clientY,[
        {label:'Open',icon:ICONS.open,act:()=>{n.type==='dir'?API.open('files',{path:'/Desktop/'+n.name}):API.openFile('/Desktop/'+n.name)}},
        n.type==='file'?{label:'Open in Editor',icon:ICONS.notes,act:()=>API.open('editor',{path:'/Desktop/'+n.name})}:null,
        {sep:1},
        {label:'Rename',icon:ICONS.pencil,act:async()=>{const v=await prompt2('Rename','New name:',n.name);if(v)VFS.rename('/Desktop/'+n.name,v)&&renderDesktopFiles()}},
        {label:'Delete',icon:ICONS.trash,danger:1,act:async()=>{if(await confirmBox('Delete "'+n.name+'"?','This cannot be undone.',true)){VFS.rm('/Desktop/'+n.name,'/Desktop',true);renderDesktopFiles()}}},
        {sep:1},
        {label:'Properties',icon:ICONS.info,act:()=>showProps('/Desktop/'+n.name)}
      ].filter(Boolean),n.name);
    };
  });
}
async function showProps(path){
  const n=VFS.node(path);if(!n)return;
  VFS.recalc(VFS.tree);
  const b=el('div','');
  b.innerHTML=`<div style="display:flex;gap:14px;align-items:flex-start">
    <div style="width:56px;height:56px;flex:0 0 auto">${iconForNode(n,n.type==='dir')}</div>
    <div style="flex:1;font-size:12.5px;line-height:1.9">
      <div><span style="color:#8ea0bd;display:inline-block;width:92px">Type</span>${typeName(n)}</div>
      <div><span style="color:#8ea0bd;display:inline-block;width:92px">Location</span>${esc(path.replace(/\/[^/]+$/,''))||'/'}</div>
      <div><span style="color:#8ea0bd;display:inline-block;width:92px">Size</span>${fmtBytes(n.size||0)}</div>
      <div><span style="color:#8ea0bd;display:inline-block;width:92px">Modified</span>${fmtStamp(n.mtime)}</div>
      <div><span style="color:#8ea0bd;display:inline-block;width:92px">Created</span>${fmtStamp(n.ctime||n.mtime)}</div>
    </div></div>`;
  if(n.type==='file'&&n.content){
    const t=el('textarea','',b);
    t.style.cssText='width:100%;height:150px;margin-top:12px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:9px;font-family:var(--mono);font-size:11.5px;color:#c8d6ee;resize:vertical';
    t.value=n.content.slice(0,4000);t.readOnly=true;
  }
  dialog({title:n.name,text:'',icon:ICONS.info,body:b,buttons:[{label:'Close',value:1,pri:true}]});
}
/* desktop context menu + selection */
$('#icons').addEventListener('pointerdown',e=>{if(e.target.id==='icons'||e.target.closest('#icons')===e.target)$$('.dicon').forEach(x=>x.classList.remove('sel'))});
$('#icons').addEventListener('contextmenu',e=>{
  if(e.target.closest('.dicon'))return;
  e.preventDefault();
  ctxMenu(e.clientX,e.clientY,[
    {label:'New Folder',icon:ICONS.folder,key:'Ctrl+Shift+N',act:async()=>{
      const v=await prompt2('New Folder','Folder name:','New Folder');if(v){VFS.mkdir('/Desktop/'+v);renderDesktopFiles();toast('Folder created')}}},
    {label:'New Text File',icon:ICONS.txt,act:async()=>{
      const v=await prompt2('New File','File name:','Untitled.txt');if(v){VFS.write('/Desktop/'+v,'');renderDesktopFiles();Achvements.grant('FIRST_FILE');toast('File created')}}},
    {sep:1},
    {label:'Paste',icon:ICONS.paste,key:'Ctrl+V',dis:!Clipboard.items.length,act:()=>{Clipboard.pasteInto('/Desktop');renderDesktopFiles()}},
    {sep:1},
    {label:'Open Terminal',icon:ICONS.terminal,key:'Win+T',act:()=>API.open('terminal',{cwd:'/Desktop'})},
    {label:'Refresh',icon:ICONS.reload,key:'F5',act:()=>{renderDesktop();toast('Desktop refreshed')}},
    {sep:1},
    {label:'Change Wallpaper',icon:ICONS.img,act:()=>API.open('settings',{tab:'appearance'})},
    {label:'Personalize',icon:ICONS.settings,act:()=>API.open('settings',{tab:'personalize'})},
    {sep:1},
    {label:'System Diagnostics',icon:ICONS.cpu,key:'F12',act:()=>API.open('diagnostics')},
    {label:'Display Settings',icon:ICONS.settings,act:()=>API.open('settings')}
  ],'Desktop');
});
$('#desktop')&&null;

/* ---------- CLIPBOARD ---------- */
const Clipboard={items:[],mode:'copy',
  copy(paths){this.items=paths.map(p=>({src:VFS.norm(p)}));this.mode='copy';Bus.emit('fs')},
  cut(paths){this.items=paths.map(p=>({src:VFS.norm(p)}));this.mode='cut';Bus.emit('fs')},
  pasteInto(dir){
    let n=0;
    this.items.forEach(it=>{
      const r=this.mode==='cut'?VFS.move(it.src,dir):VFS.copy(it.src,dir);
      if(!r.err)n++;
    });
    if(this.mode==='cut')this.items=[];
    if(n)toast(`${n} item${n>1?'s':''} pasted`);
    return n;
  }
};

/* ---------- PINNED ---------- */
const Pinned={
  list:LS.get('pinned',['files','terminal','browser','arcade','nexus','editor','paint','music']),
  save(){LS.set('pinned',this.list)},
  add(id){if(!this.list.includes(id)){this.list.push(id);this.save();renderStart()}},
  remove(id){this.list=this.list.filter(x=>x!==id);this.save();renderStart()}
};

/* ---------- TASKBAR / START / CLOCK / TRAY ---------- */
