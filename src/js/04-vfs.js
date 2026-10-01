const VFS={
  tree:null,
  uid(){return 'n'+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4)},
  default(){
    const D=(n)=>({id:this.uid(),name:n,type:'dir',children:[],mtime:Date.now(),ctime:Date.now()});
    const F=(n,c)=>({id:this.uid(),name:n,type:'file',content:c||'',mtime:Date.now(),ctime:Date.now(),size:0});
    const mk=(n,ch)=>{const d=D(n);d.children=ch;return d};
    const root=D('/');
    root.children=[
      mk('Desktop',[
        F('Welcome.txt',WELCOME_TEXT),
        D('Screenshots')
      ]),
      mk('Documents',[
        F('Welcome.txt',WELCOME_TEXT),
        F('Ideas.txt',IDEAS_TEXT),
        D('Reports',[F('quarterly.txt','Q3 revenue: +12%\nUser growth: +8%\nChurn: -3%\n\nNotes: everything is going well.')])
      ]),
      mk('Downloads',[
        F('readme.md','# Downloads\n\nDrop files here.\nUse the Terminal to create files: `touch notes.txt`')
      ]),
      mk('Pictures',[]),
      mk('Music',[]),
      mk('Videos',[]),
      mk('Games',[]),
      mk('Home',[D('Projects'),D('Notes')]),
      mk('.config',[F('secret',SECRET_TEXT)])
    ];
    return root;
  },
  load(){
    const raw=LS.get('fs',null);
    this.tree=raw?this.rehydrate(raw):this.default();
    if(!this.tree)this.tree=this.default();
    this.recalc(this.tree);
  },
  rehydrate(n){
    if(!n||typeof n!=='object')return n;
    if(!n.id)n.id=this.uid();
    n.mtime=n.mtime||Date.now(); n.ctime=n.ctime||n.mtime;
    if(n.type==='dir'){n.children=n.children||[];n.children.forEach(c=>this.rehydrate(c))}
    else {n.content=n.content||''}
    return n;
  },
  recalc(n){
    if(!n)return 0;
    if(n.type!=='dir'){n.size=n.dataUrl||n.blobUrl?Math.round(((n.dataUrl||n.blobUrl).length)*0.75):(n.content?n.content.length*2:0);return n.size}
    let s=0;(n.children||[]).forEach(c=>{s+=this.recalc(c)});
    n.size=s;return s;
  },
  save(){
    this.recalc(this.tree);
    LS.set('fs',this.tree);
    trackStorage();
    Bus.emit('fs');
  },
  norm(p,cwd){
    if(!p)p='/';
    let a=(p.startsWith('/')?p:(cwd||'/')+'/'+p).split('/');
    const st=[];
    for(const s of a){ if(!s||s==='.')continue; if(s==='..')st.pop(); else st.push(s); }
    return '/'+st.join('/');
  },
  node(p,cwd){
    const f=this.norm(p,cwd);
    if(f==='/')return this.tree;
    let cur=this.tree;
    for(const seg of f.slice(1).split('/')){
      if(cur.type!=='dir')return null;
      const nx=(cur.children||[]).find(c=>c.name.toLowerCase()===seg.toLowerCase());
      if(!nx)return null;
      cur=nx;
    }
    return cur;
  },
  parent(p,cwd){
    const f=this.norm(p,cwd);
    if(f==='/')return null;
    const i=f.lastIndexOf('/');
    const pp=i<=0?'/':f.slice(0,i);
    return {dir:this.node(pp),path:pp};
  },
  exists(p,cwd){return !!this.node(p,cwd)},
  uniqName(dir,name){
    let n=name, i=1;
    const has=x=>(dir.children||[]).some(c=>c.name.toLowerCase()===x.toLowerCase());
    if(!has(name))return name;
    const dot=name.lastIndexOf('.');
    const base=dot>0?name.slice(0,dot):name, ext=dot>0?name.slice(dot):'';
    do{n=base+' ('+(++i)+')'+ext}while(has(n));
    return n;
  },
  mkdir(p,cwd){
    const par=this.parent(p,cwd); if(!par)return {err:'cannot create root'};
    if(!par.dir)return {err:'parent not found'};
    if(par.dir.type!=='dir')return {err:'not a directory'};
    const seg=p.replace(/\/+$/,'').split('/').pop();
    if(par.dir.children.some(c=>c.name.toLowerCase()===seg.toLowerCase()))return {err:'already exists'};
    const nd={id:this.uid(),name:seg,type:'dir',children:[],mtime:Date.now(),ctime:Date.now(),size:0};
    par.dir.children.push(nd); this.save();
    return {node:nd,path:this.norm(p,cwd)};
  },
  write(p,content,cwd){
    const par=this.parent(p,cwd); if(!par)return {err:'invalid path'};
    if(!par.dir||par.dir.type!=='dir')return {err:'directory not found'};
    const seg=p.replace(/\/+$/,'').split('/').pop();
    let f=par.dir.children.find(c=>c.name.toLowerCase()===seg.toLowerCase());
    if(f&&f.type==='dir')return {err:'is a directory'};
    if(!f){f={id:this.uid(),name:seg,type:'file',content:'',mtime:Date.now(),ctime:Date.now(),size:0};par.dir.children.push(f)}
    f.content=content;f.mtime=Date.now();
    this.save();return {node:f,path:this.norm(p,cwd)};
  },
  rm(p,cwd,force){
    const par=this.parent(p,cwd); if(!par)return {err:'cannot remove root'};
    const nm=p.replace(/\/+$/,'').split('/').pop();
    const i=par.dir.children.findIndex(c=>c.name.toLowerCase()===nm.toLowerCase());
    if(i<0)return {err:'not found'};
    if(!force&&par.dir.children[i].type==='dir'&&par.dir.children[i].children.length)
      return {err:'directory not empty',node:par.dir.children[i]};
    const [nd]=par.dir.children.splice(i,1);
    if(nd.blobUrl)URL.revokeObjectURL(nd.blobUrl);
    this.save();return {node:nd,path:this.norm(p,cwd)};
  },
  rename(p,newName,cwd){
    const par=this.parent(p,cwd); if(!par)return {err:'invalid'};
    const nm=p.replace(/\/+$/,'').split('/').pop();
    const f=par.dir.children.find(c=>c.name.toLowerCase()===nm.toLowerCase());
    if(!f)return {err:'not found'};
    newName=String(newName).replace(/[\/\\]/g,'').trim();
    if(!newName)return {err:'invalid name'};
    if(newName.toLowerCase()!==nm.toLowerCase()&&par.dir.children.some(c=>c.name.toLowerCase()===newName.toLowerCase()))
      return {err:'name already used'};
    f.name=newName;f.mtime=Date.now();this.save();
    return {node:f,path:this.norm(p,cwd)};
  },
  move(src,dstDir,cwd){
    const sp=this.norm(src,cwd), dp=this.norm(dstDir,cwd);
    if(sp===dp)return {err:'same location'};
    if(dp.startsWith(sp+'/'))return {err:'cannot move into itself'};
    const s=this.node(sp); const d=this.node(dp);
    if(!s)return {err:'source not found'};
    if(!d||d.type!=='dir')return {err:'target not a directory'};
    const par=this.parent(sp);
    const i=par.dir.children.findIndex(c=>c.id===s.id);
    par.dir.children.splice(i,1);
    s.name=this.uniqName(d,s.name);
    s.mtime=Date.now();
    d.children.push(s);
    this.save();
    return {node:s,path:dp+'/'+s.name};
  },
  copy(src,dstDir,cwd){
    const sp=this.norm(src,cwd), dp=this.norm(dstDir,cwd);
    if(sp===dp)return {err:'same location'};
    if(dp.startsWith(sp+'/'))return {err:'cannot copy into itself'};
    const s=this.node(sp), d=this.node(dp);
    if(!s)return {err:'source not found'};
    if(!d||d.type!=='dir')return {err:'target not a directory'};
    const clone=JSON.parse(JSON.stringify(s));
    const reid=n=>{n.id=this.uid();if(n.children)n.children.forEach(reid)};
    reid(clone);
    clone.name=this.uniqName(d,clone.name);
    clone.mtime=Date.now();clone.ctime=Date.now();
    d.children.push(clone);
    this.save();
    return {node:clone,path:dp+'/'+clone.name};
  },
  search(q){
    q=String(q).toLowerCase();const out=[];
    const walk=(n,path)=>{
      const p=path+(path.endsWith('/')?'':'/')+n.name;
      if(n.name.toLowerCase().includes(q))out.push({node:n,path:p});
      if(n.children)n.children.forEach(c=>walk(c,p));
    };
    (this.tree.children||[]).forEach(c=>walk(c,'/'));
    return out;
  },
  stats(){
    let files=0,dirs=0,bytes=0,deepest=0;
    const walk=(n,d)=>{
      if(n.type==='dir'){dirs++;deepest=Math.max(deepest,d);(n.children||[]).forEach(c=>walk(c,d+1))}
      else{files++;bytes+=n.size||0}
    };
    walk(this.tree,0);
    return {files,dirs,bytes,deepest};
  },
  treeText(path,cwd,depth,prefix,out){
    depth=depth||0;prefix=prefix||'';out=out||'';
    const d=(path&&typeof path==='object')?path:this.node(path,cwd);
    if(!d||d.type!=='dir')return out;
    const ch=[...(d.children||[])].sort((a,b)=>
      (a.type===b.type)?a.name.localeCompare(b.name):(a.type==='dir'?-1:1));
    ch.forEach((c,i)=>{
      const last=i===ch.length-1;
      out+=prefix+(last?'└── ':'├── ')+(c.type==='dir'?'\x1b[36m'+c.name+'\x1b[0m':c.name);
      if(c.type==='dir'&&depth<6)out+='\n'+this.treeText(c,'',depth+1,prefix+(last?'    ':'│   '),'');
    });
    return out;
  }
};
const WELCOME_TEXT=`Welcome to NEXUS OS
===================

You are running a complete operating system inside a single HTML file.

QUICK START
  * Press Win (or Ctrl+Esc) to open the Start menu
  * Double-click desktop icons to launch apps
  * Right-click the desktop for a context menu
  * Alt+Tab switches between windows
  * Drag a window to a screen edge to snap it
  * Press F12 for system diagnostics

TRY THIS
  1. Open the Terminal and type: neofetch
  2. Create a file:  echo "hi" > /Documents/hello.txt
  3. Open Files and see it appear instantly
  4. Ask NEXUS: "run diagnostics"
  5. Play NEON SNAKE in NEXUS ARCADE

Everything you create is saved in your browser.
Have fun exploring.
`;
const IDEAS_TEXT=`NEXUS PROJECT IDEAS
===================

[ ] Rewrite the compositor in WebGL
[ ] Add a real syntax-highlighting parser
[ ] Ship a filesystem search index
[x] Window snapping
[x] Notification center
[x] Virtual filesystem
[ ] Multiplayer snake over BroadcastChannel
[ ] Theme editor
[ ] Easter egg: there are 5 more than you think

Tip: the Konami code works here too.
`;
/* Hidden by default: Files, the Editor and `ls` all skip dot-names unless
   Settings → Show hidden files is on. The Terminal can still cat it. */
const SECRET_TEXT=`you found the file the shell told you not to look for.

  there is nothing behind this one. but you kept digging anyway,
  which is the only thing this place ever wanted from you.

  ↳ try:  contact dragon
`;

/* ---------- EVENT BUS ---------- */
