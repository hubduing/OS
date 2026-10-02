/* ============================================================
   PART 4 — APPS: FILES, TERMINAL, EDITOR
   ============================================================ */

/* ---------- FILES ---------- */
APPS.files={
  title:'Files',icon:ICONS.files,desc:'Browse the filesystem',w:900,h:580,
  build(w,opts){
    const st={path:opts.path||'/Desktop',view:LS.get('fmView','grid'),sel:new Set(),
      sort:'name',asc:true,clip:Clipboard,hist:[],hi:-1,query:'',copied:false};
    w.body.innerHTML=`
      <div class="toolbar">
        <button class="btn" data-a="back" title="Back">${ICONS.back}</button>
        <button class="btn" data-a="up" title="Up one level">${ICONS.fwd}</button>
        <div class="inp" style="flex:1;min-width:100px;display:flex;align-items:center;gap:8px" data-searchbox>
          <span style="width:12px;height:12px;display:inline-grid;opacity:.6">${ICONS.files}</span>
          <input placeholder="Search all files…" style="flex:1;background:none;border:none;min-width:0" data-search>
        </div>
        <div class="seg" data-sortseg>
          <button data-sort="name">Name</button><button data-sort="size">Size</button><button data-sort="mtime">Date</button>
        </div>
        <div class="seg"><button data-a="grid">${ICONS.grid}</button><button data-a="list">${ICONS.list}</button></div>
        <span class="sp"></span>
        <button class="btn" data-a="newdir" title="New folder">${ICONS.folder}</button>
        <button class="btn" data-a="newfile" title="New file">${ICONS.txt}</button>
        <button class="btn" data-a="copy" title="Copy">${ICONS.copy}</button>
        <button class="btn" data-a="cut" title="Cut">${ICONS.cut}</button>
        <button class="btn" data-a="paste" title="Paste">${ICONS.paste}</button>
        <button class="btn dgr" data-a="del" title="Delete">${ICONS.trash}</button>
      </div>
      <div class="fm">
        <div class="fmSide"></div>
        <div class="fmMain">
          <div class="crumbs"></div>
          <div class="flist"></div>
        </div>
      </div>
      <div class="fmStatus"><span data-info>—</span><span class="sp" style="flex:1"></span><span data-sel></span></div>`;
    const list=w.body.querySelector('.flist'),
      side=w.body.querySelector('.fmSide'),
      crumbs=w.body.querySelector('.crumbs'),
      info=w.body.querySelector('[data-info]'),
      selInfo=w.body.querySelector('[data-sel]');
    const PLUS=['Desktop','Documents','Downloads','Pictures','Music','Videos','Games','Home'];

    function go(p,push){
      const n=VFS.node(p);
      if(!n||n.type!=='dir')return toast('Folder not found','<span style="color:#ff5c72">!</span>');
      st.path=VFS.norm(p);st.sel.clear();st.query='';
      w.body.querySelector('[data-search]').value='';
      if(push){st.hist=st.hist.slice(0,st.hi+1);st.hist.push(st.path);st.hi=st.hist.length-1}
      render();
    }
    function renderSide(){
      side.innerHTML='<div class="lbl">Places</div>';
      PLUS.forEach(p=>{
        const node=VFS.node('/'+p);
        if(!node||node.type!=='dir')return;
        const b=el('button','sideIco'+(st.path.startsWith('/'+p)?' on':''),side);
        b.innerHTML=`<span class="ic">${ICONS.folder}</span><span>${p}</span>
          <span class="cnt">${(node.children||[]).length}</span>`;
        b.onclick=()=>go('/'+p);
      });
      el('div','lbl',side).textContent='System';
      [['/',ICONS.computer,'Root'],['/Desktop',ICONS.folder,'Desktop']].forEach(([p,i,nm])=>{
        const b=el('button','sideIco'+(st.path===p?' on':''),side);
        b.innerHTML=`<span class="ic">${i}</span><span>${nm}</span>`;
        b.onclick=()=>go(p);
      });
      const stt=VFS.stats();
      side.insertAdjacentHTML('beforeend',
        `<div class="lbl">Storage</div>
         <div style="padding:4px 9px;font-size:11px;color:#8ea0bd;line-height:1.8">
           <div>${stt.files} files</div><div>${stt.dirs} folders</div>
           <div>${fmtBytes(stt.bytes)} used</div></div>`);
    }
    function renderCrumbs(){
      crumbs.innerHTML='';
      const segs=st.path.split('/').filter(Boolean);
      const root=el('button','',crumbs);root.innerHTML='<span style="display:inline-grid;width:13px;height:13px">'+ICONS.computer+'</span>';
      root.onclick=()=>go('/');
      let acc='';
      segs.forEach(s=>{
        acc+='/'+s;
        const sp=el('span','sp',crumbs);sp.textContent='›';
        const b=el('button','',crumbs);b.textContent=s;
        const target=acc;b.onclick=()=>go(target);
        if(target===st.path)b.style.color='#fff';
      });
    }
    function nodeList(){
      if(st.query){
        return VFS.search(st.query).map(r=>({n:r.node,p:r.path})).filter(r=>S.showHidden||r.n.name[0]!=='.');
      }
      const d=VFS.node(st.path);if(!d)return [];
      let ch=[...(d.children||[])];
      ch=ch.filter(n=>S.showHidden||n.name[0]!=='.');
      ch.sort((a,b)=>{
        if((a.type==='dir')!==(b.type==='dir'))return a.type==='dir'?-1:1;
        let r=0;
        if(st.sort==='name')r=a.name.localeCompare(b.name,undefined,{numeric:true});
        else if(st.sort==='size')r=(a.size||0)-(b.size||0);
        else r=(a.mtime||0)-(b.mtime||0);
        return st.asc?r:-r;
      });
      return ch.map(n=>({n,p:st.path.replace(/\/$/,'')+'/'+n.name}));
    }
    function renderList(){
      list.className='flist'+(st.view==='grid'?' grid':'');
      list.innerHTML='';
      const items=nodeList();
      if(!items.length){
        list.innerHTML=`<div class="empty" style="grid-column:1/-1">
          <div>${ICONS.folder}</div><b>${st.query?'No matches':'This folder is empty'}</b>
          <span>${st.query?'Try a different search.':'Right-click here to create a folder or file, or use the toolbar above.'}</span></div>`;
        info.textContent=st.query?`${items.length} results`:'Empty folder';
        selInfo.textContent='';return;
      }
      const mark=new Set(Clipboard.items.map(i=>i.src));
      items.forEach(({n,p})=>{
        const f=el('div','fitem'+(st.sel.has(p)?' sel':'')+(mark.has(p)&&Clipboard.mode==='cut'?' cut':''),list);
        f.innerHTML=`<span class="ic">${iconForNode(n,n.type==='dir')}</span>
          <span class="nm" title="${esc(n.name)}">${esc(n.name)}</span>
          <span class="mt">${n.type==='dir'?(n.children||[]).length+' items':fmtBytes(n.size||0)}<br>
            <span style="opacity:.75">${fmtDateShort(n.mtime)}</span></span>`;
        f.draggable=true;
        f.onclick=e=>{
          if(e.ctrlKey){st.sel.has(p)?st.sel.delete(p):st.sel.add(p)}
          else{st.sel.clear();st.sel.add(p)}
          renderSel();
        };
        f.ondblclick=()=>{
          if(n.type==='dir')go(p);
          else if(EXT_ICON[extOf(n.name)]==='vid')API.open('video',{path:p});
          else if(EXT_ICON[extOf(n.name)]==='aud')API.open('music',{file:p});
          else if(EXT_ICON[extOf(n.name)]==='img')API.openFile(p);
          else API.open('editor',{path:p});
        };
        f.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();
          if(!st.sel.has(p)){st.sel.clear();st.sel.add(p);renderSel()}
          itemMenu(e,n,p);
        };
        f.ondragstart=e=>{e.dataTransfer.setData('text/nexus',p);e.dataTransfer.effectAllowed='move'};
        f.ondragover=e=>{e.preventDefault();f.classList.add('dragover')};
        f.ondragleave=()=>f.classList.remove('dragover');
        f.ondrop=e=>{
          e.preventDefault();e.stopPropagation();f.classList.remove('dragover');
          const src=e.dataTransfer.getData('text/nexus');
          if(src&&src!==p&&n.type==='dir'){
            const r=VFS.move(src,p);
            r.err?toast(r.err,ICONS.warn):(toast('Moved to '+n.name),render());
          }
        };
        f.ondblclick2=null;
      });
      const d=VFS.node(st.path);
      info.textContent=st.query?`${items.length} result${items.length>1?'s':''}`:
        `${items.length} item${items.length>1?'s':''}${d?' · '+fmtBytes(d.size||0)+' in folder':''}`;
      renderSel();
    }
    function renderSel(){
      const paths=[...st.sel];
      $$('.fitem',list).forEach(f=>{
        const p=paths.find(x=>f.querySelector('.nm').title===x.split('/').pop());
        f.classList.toggle('sel',!!p);
      });
      const tot=paths.reduce((a,p)=>{const n=VFS.node(p);return a+(n?(n.type==='dir'?0:(n.size||0)):0)},0);
      selInfo.textContent=paths.length?`${paths.length} selected · ${fmtBytes(tot)}`:'';
    }
    function itemMenu(e,n,p){
      ctxMenu(e.clientX,e.clientY,[
        {label:'Open',icon:ICONS.open,act:()=>n.type==='dir'?go(p):fitemDbl(n,p)},
        {label:'Open in Editor',icon:ICONS.notes,dis:n.type==='dir',act:()=>API.open('editor',{path:p})},
        {label:'Open in Terminal',icon:ICONS.terminal,act:()=>API.open('terminal',{cwd:n.type==='dir'?p:VFS.norm(p.replace(/\/[^/]+$/,''))})},
        {sep:1},
        {label:'Copy',icon:ICONS.copy,key:'Ctrl+C',act:()=>{Clipboard.copy([...st.sel.size>1?st.sel:[p]]);toast('Copied')}},
        {label:'Cut',icon:ICONS.cut,key:'Ctrl+X',act:()=>{Clipboard.cut([...st.sel.size>1?st.sel:[p]]);toast('Cut')}},
        {label:'Rename…',icon:ICONS.pencil,key:'F2',act:async()=>{
          const v=await prompt2('Rename','New name:',n.name);
          if(v){const r=VFS.rename(p,v);r.err?toast(r.err,ICONS.warn):render()}
        }},
        {label:'Duplicate',icon:ICONS.copy,act:()=>{const r=VFS.copy(p,st.path);r.err?toast(r.err,ICONS.warn):render()}},
        {label:'Delete',icon:ICONS.trash,key:'Del',danger:1,act:async()=>delSel([...st.sel.size>1?st.sel:[p]])},
        {sep:1},
        {label:'Properties',icon:ICONS.info,key:'Alt+Enter',act:()=>showProps(p)}
      ],n.name);
    }
    function fitemDbl(n,p){
      if(n.type==='dir')go(p);
      else if(EXT_ICON[extOf(n.name)]==='vid')API.open('video',{path:p});
          else if(EXT_ICON[extOf(n.name)]==='aud')API.open('music',{file:p});
      else API.open('editor',{path:p});
    }
    async function delSel(paths){
      if(!paths.length)return;
      const names=paths.map(p=>p.split('/').pop());
      if(await confirmBox('Delete '+names.length+' item'+(names.length>1?'s':'')+'?',
        names.slice(0,6).join(', ')+(names.length>6?'…':'')+'\nThis cannot be undone.',true)){
        let n=0;
        paths.forEach(p=>{const r=VFS.rm(p,null,true);if(!r.err){n++;Bus.emit('fs')}});
        st.sel.clear();render();
        toast(`${n} item${n>1?'s':''} deleted`);
        Audio2.tone(300,.15,'sawtooth',.07,120);
      }
    }
    list.oncontextmenu=e=>{
      if(e.target.closest('.fitem'))return;
      e.preventDefault();
      ctxMenu(e.clientX,e.clientY,[
        {label:'New Folder',icon:ICONS.folder,act:async()=>{const v=await prompt2('New Folder','Name:','New Folder');if(v){VFS.mkdir(st.path+'/'+v);render()}}},
        {label:'New Text File',icon:ICONS.txt,act:async()=>{const v=await prompt2('New File','Name:','Untitled.txt');if(v){VFS.write(st.path+'/'+v,'');render();Achvements.grant('FIRST_FILE')}}},
        {sep:1},
        {label:'Paste',icon:ICONS.paste,key:'Ctrl+V',dis:!Clipboard.items.length,act:()=>{Clipboard.pasteInto(st.path);render()}},
        {label:'Select All',icon:ICONS.ok,key:'Ctrl+A',act:()=>{nodeList().forEach(({p})=>st.sel.add(p));renderSel()}},
        {sep:1},
        {label:'Open Terminal Here',icon:ICONS.terminal,act:()=>API.open('terminal',{cwd:st.path})},
        {label:'Refresh',icon:ICONS.reload,key:'F5',act:()=>render()},
        {label:'Sort by Name',icon:ICONS.list,act:()=>{st.sort='name';st.asc=!st.asc;render()}}
      ],'Files');
    };
    list.ondragover=e=>{if(e.target===list)e.preventDefault()};
    list.ondrop=e=>{
      if(e.target!==list)return;e.preventDefault();
      const src=e.dataTransfer.getData('text/nexus');
      if(src&&VFS.node(src).type==='dir'){
        const r=VFS.move(src,st.path);r.err?toast(r.err,ICONS.warn):(toast('Moved'),render());
      }else if(src){const r=VFS.copy(src,st.path);r.err?toast(r.err,ICONS.warn):(toast('Copied'),render())}
    };
    w.body.addEventListener('click',e=>{
      const b=e.target.closest('[data-a]');if(!b)return;
      const a=b.dataset.a;
      if(a==='back'){if(st.hi>0){st.hi--;go(st.hist[st.hi],false)}else toast('No more history')}
      else if(a==='up'){const p=VFS.parent(st.path);if(p)go(p.path)}
      else if(a==='grid'||a==='list'){st.view=a;LS.set('fmView',a);render()}
      else if(a==='newdir'){ (async()=>{const v=await prompt2('New Folder','Name:','New Folder');if(v){VFS.mkdir(st.path+'/'+v);render()}})() }
      else if(a==='newfile'){ (async()=>{const v=await prompt2('New File','Name:','Untitled.txt');if(v){VFS.write(st.path+'/'+v,'');render();Achvements.grant('FIRST_FILE')}})() }
      else if(a==='copy'){if(st.sel.size){Clipboard.copy([...st.sel]);toast(st.sel.size+' copied');renderList()}}
      else if(a==='cut'){if(st.sel.size){Clipboard.cut([...st.sel]);toast(st.sel.size+' cut');renderList()}}
      else if(a==='paste'){if(Clipboard.items.length){Clipboard.pasteInto(st.path);render()}else toast('Clipboard is empty')}
      else if(a==='del')delSel([...st.sel]);
    });
    w.body.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{
      if(b.dataset.sort==='sort')return;
      if(st.sort===b.dataset.sort)st.asc=!st.asc;else{st.sort=b.dataset.sort;st.asc=true}
      render();
    });
    const sInp=w.body.querySelector('[data-search]');
    sInp.addEventListener('input',()=>{st.query=sInp.value.trim();renderList();
      info.textContent=st.query?VFS.search(st.query).length+' results':info.textContent});
    w.el.addEventListener('keydown',e=>{
      if(e.target.tagName==='INPUT')return;
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();nodeList().forEach(({p})=>st.sel.add(p));renderSel()}
      else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'){Clipboard.copy([...st.sel])}
      else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='x'){Clipboard.cut([...st.sel])}
      else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v'){Clipboard.pasteInto(st.path);render()}
      else if(e.key==='Delete')delSel([...st.sel]);
      else if(e.key==='F2'&&st.sel.size===1){const p=[...st.sel][0];
        prompt2('Rename','New name:',p.split('/').pop()).then(v=>{if(v){VFS.rename(p,v);render()}})}
      else if(e.key==='F5'){e.preventDefault();render()}
      else if(e.key==='Enter'&&st.sel.size){const p=[...st.sel][0];const n=VFS.node(p);
        if(n)n.type==='dir'?go(p):fitemDbl(n,p)}
      else if(e.key==='Backspace'){const p=VFS.parent(st.path);if(p)go(p.path)}
    });
    w.el.tabIndex=0;
    function render(){
      if(!VFS.node(st.path))st.path='/Desktop';
      renderSide();renderCrumbs();renderList();
      $$('[data-sort]',w.body).forEach(b=>{
        b.classList.toggle('on',b.dataset.sort===st.sort);
        if(b.dataset.sort===st.sort)b.textContent=b.dataset.sort==='name'?(st.asc?'Name ↑':'Name ↓'):b.dataset.sort==='size'?(st.asc?'Size ↑':'Size ↓'):(st.asc?'Date ↑':'Date ↓');
      });
      $$('[data-a]',w.body).forEach(b=>b.classList.toggle('on',(b.dataset.a===st.view)));
      w.el.querySelector('.ttl').textContent=st.path==='/'?'Files — Root':'Files — '+st.path.split('/').pop();
    }
    render();
    st.onResize=()=>{};
    const un=Bus.on('fs',()=>{if(WM.get(w.id))render()});
    return {destroy:()=>un()};
  }
};

/* ---------- TERMINAL ---------- */
