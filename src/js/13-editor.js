const HL={
  lang(name){
    const e=extOf(name);
    return {js:'js',ts:'js',json:'json',html:'html',htm:'html',css:'css',md:'md',py:'py',sh:'sh'}[e]||'txt';
  },
  run(text,lang){
    if(lang==='txt'||!text)return esc(text);
    let s=esc(text);
    if(lang==='js'||lang==='ts'){
      s=s.replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g,'<i class="tk-com">$1</i>')
        .replace(/(`(?:\\.|[^`\\])*`|'[^'\n]*'|"[^"\n]*")/g,'<i class="tk-str">$1</i>')
        .replace(/\b(function|return|const|let|var|if|else|for|while|class|new|await|async|this|typeof|of|in|break|continue|switch|case|default|try|catch|finally|throw|import|export|from|null|undefined|true|false)\b/g,'<i class="tk-key">$1</i>')
        .replace(/\b(\d+\.?\d*)\b/g,'<i class="tk-num">$1</i>')
        .replace(/\b([A-Za-z_$][\w$]*)\s*\(/g,'<i class="tk-fn">$1</i>(');
    }else if(lang==='json'){
      s=s.replace(/("(?:\\.|[^"\\])*")(\s*:)/g,'<i class="tk-attr">$1</i>$2')
        .replace(/:\s*("(?:\\.|[^"\\])*")/g,': <i class="tk-str">$1</i>')
        .replace(/\b(-?\d+\.?\d*)\b/g,'<i class="tk-num">$1</i>')
        .replace(/\b(true|false|null)\b/g,'<i class="tk-key">$1</i>');
    }else if(lang==='html'){
      s=s.replace(/(&lt;!--[\s\S]*?--&gt;)/g,'<i class="tk-com">$1</i>')
        .replace(/(&lt;\/?)([\w-]+)/g,'$1<i class="tk-tag">$2</i>')
        .replace(/([\w-]+)(=)(&quot;[^&]*?&quot;)/g,'<i class="tk-attr">$1</i>$2<i class="tk-str">$3</i>')
        .replace(/(&lt;\/?)([\w-]+)/g,'$1<i class="tk-tag">$2</i>');
    }else if(lang==='css'){
      s=s.replace(/(\/\*[\s\S]*?\*\/)/g,'<i class="tk-com">$1</i>')
        .replace(/([\w-]+)(\s*:\s*)([^;{}\n]+)/g,'<i class="tk-attr">$1</i>$2<i class="tk-str">$3</i>')
        .replace(/(^|\n)([^{}\n]+)(\{)/g,'$1<i class="tk-tag">$2</i>$3')
        .replace(/([.#@][\w-]+)/g,'<i class="tk-fn">$1</i>');
    }else if(lang==='py'){
      s=s.replace(/(#[^\n]*)/g,'<i class="tk-com">$1</i>')
        .replace(/(`(?:\\.|[^`\\])*`|'[^'\n]*'|"[^"\n]*")/g,'<i class="tk-str">$1</i>')
        .replace(/\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|finally|raise|lambda|None|True|False|and|or|not|in|is|pass|break|continue|global)\b/g,'<i class="tk-key">$1</i>')
        .replace(/\b(\d+\.?\d*)\b/g,'<i class="tk-num">$1</i>')
        .replace(/\b([A-Za-z_][\w]*)\s*\(/g,'<i class="tk-fn">$1</i>(');
    }else if(lang==='sh'){
      s=s.replace(/(#[^\n]*)/g,'<i class="tk-com">$1</i>')
        .replace(/('[^']*'|"[^"]*")/g,'<i class="tk-str">$1</i>')
        .replace(/\b(if|then|else|fi|for|in|do|done|while|case|esac|function|return|export|local|echo|cd|ls|rm|cp|mv|mkdir|cat|touch)\b/g,'<i class="tk-key">$1</i>');
    }else if(lang==='md'){
      s=s.replace(/^(#{1,6} .*)$/gm,'<i class="tk-tag">$1</i>')
        .replace(/(`[^`\n]*`)/g,'<i class="tk-str">$1</i>')
        .replace(/^(\s*[-*+] )/gm,'<i class="tk-num">$1</i>')
        .replace(/\*\*([^*]+)\*\*/g,'<i class="tk-key">$1</i>');
    }
    return s;
  }
};
APPS.editor={
  title:'Notes',icon:ICONS.notes,desc:'Text & code editor',w:900,h:620,
  build(w,opts){
    w.body.innerHTML=`
      <div class="edTabs"></div>
      <div class="toolbar">
        <button class="btn" data-a="new">${ICONS.plus} New</button>
        <button class="btn" data-a="open">${ICONS.open} Open</button>
        <button class="btn pri" data-a="save">${ICONS.save} Save</button>
        <button class="btn" data-a="saveas">Save As</button>
        <span class="sp"></span>
        <span class="edAutostave" style="font-size:11px;color:#8ea0bd"></span>
        <button class="btn" data-a="run" title="Run in terminal">${ICONS.terminal} Run</button>
      </div>
      <div class="ed">
        <div class="edGutter"></div>
        <div class="edArea"><pre class="edPre"></pre><textarea class="edTa" spellcheck="false"></textarea></div>
      </div>
      <div class="edStatus">
        <span data-pos>Ln 1, Col 1</span><span data-count>0 words · 0 chars</span>
        <span data-lang>Text</span><span class="sp" style="flex:1"></span>
        <span data-save></span>
      </div>`;
    const tabsEl=w.body.querySelector('.edTabs'),
      gut=w.body.querySelector('.edGutter'),
      pre=w.body.querySelector('.edPre'),
      ta=w.body.querySelector('.edTa'),
      posEl=w.body.querySelector('[data-pos]'),
      cntEl=w.body.querySelector('[data-count]'),
      langEl=w.body.querySelector('[data-lang]'),
      saveEl=w.body.querySelector('[data-save]'),
      autostave=w.body.querySelector('.edAutostave');
    const st={tabs:[],cur:null,auto:null,dirtyTimer:null};

    function newTab(path,content){
      const t={id:'t'+Date.now()+Math.random().toString(36).slice(2,5),
        path:path||null,name:path?path.split('/').pop():'Untitled-'+(st.tabs.length+1),
        content:content!=null?content:'',saved:content||'',dirty:false};
      st.tabs.push(t);st.cur=t.id;render();sync();
      return t;
    }
    function cur(){return st.tabs.find(t=>t.id===st.cur)}
    function openPath(p){
      const n=VFS.node(p);
      if(!n||n.type==='dir'){toast('Cannot open folder','<span style="color:#ff5c72">!</span>');return}
      const ex=st.tabs.find(t=>t.path===VFS.norm(p));
      if(ex){st.cur=ex.id;render();sync();return}
      newTab(VFS.norm(p),n.content||'');
    }
    function closeTab(id){
      const i=st.tabs.findIndex(t=>t.id===id);if(i<0)return;
      const t=st.tabs[i];
      const doClose=()=>{
        st.tabs.splice(i,1);
        if(st.cur===id)st.cur=st.tabs[Math.min(i,st.tabs.length-1)]?.id||null;
        if(!st.tabs.length)newTab();
        else{render();sync()}
      };
      if(t.dirty){
        dialog({title:'Unsaved changes',text:'"'+t.name+'" has unsaved changes.',
          icon:ICONS.warn,buttons:[
            {label:'Cancel',value:0},{label:'Discard',value:'d',danger:1},{label:'Save',value:'s',pri:1}]})
          .then(v=>{if(v==='d')doClose();else if(v==='s'){save(t);doClose()}});
      }else doClose();
    }
    function save(t,saveAs){
      t=t||cur();if(!t)return;
      const write=path=>{
        const r=VFS.write(path,t.content);
        if(r.err){toast(r.err,ICONS.warn);return false}
        t.path=r.path;t.name=r.path.split('/').pop();
        t.saved=t.content;t.dirty=false;
        render();sync();
        Notify.send('File saved',t.path,{app:'editor',icon:ICONS.save});
        return true;
      };
      if(!t.path||saveAs){
        prompt2('Save As','Save to path (e.g. /Documents/notes.txt):',t.path||'/Documents/'+t.name)
          .then(v=>{if(v)write(v)});
        return;
      }
      if(write(t.path)){Audio2.click();toast('Saved '+t.name)}
    }
    function highlight(){
      const t=cur();if(!t)return;
      const lang=HL.lang(t.name);
      pre.innerHTML=HL.run(t.content,lang)+'\n';
      const lines=t.content.split('\n').length;
      if(gut._n!==lines){
        gut.innerHTML='';
        for(let i=1;i<=lines;i++)el('div','',gut).textContent=i;
        gut._n=lines;
      }
      langEl.textContent={js:'JavaScript',ts:'TypeScript',json:'JSON',html:'HTML',css:'CSS',md:'Markdown',py:'Python',sh:'Shell',txt:'Plain Text'}[lang];
    }
    function sync(){
      const t=cur();if(!t)return;
      if(ta.value!==t.content)ta.value=t.content;
      highlight();
      const lines=t.content.split('\n');
      const upto=t.content.slice(0,ta.selectionStart);
      const ln=upto.split('\n');
      posEl.textContent=`Ln ${ln.length}, Col ${ln[ln.length-1].length+1}`;
      const words=t.content.trim()?(t.content.trim().match(/\S+/g)||[]).length:0;
      cntEl.textContent=`${words} words · ${t.content.length} chars · ${lines.length} lines`;
      saveEl.textContent=t.dirty?'● Unsaved':(t.path?'✓ Saved':'— Unsaved file');
      saveEl.className=t.dirty?'wr':'ok';
      w.el.querySelector('.ttl').textContent=(t.dirty?'● ':'')+t.name+' — Notes';
      clearTimeout(st.auto);
      if(t.dirty){
        st.auto=setTimeout(()=>{
          if(!t.path)return;
          VFS.write(t.path,t.content);
          t.saved=t.content;
          saveEl.textContent='✓ Autosaved';saveEl.className='ok';
          autostave.textContent='autosaved '+fmtHMS(new Date());
          Bus.emit('fs');
        },2500);
      }else autostave.textContent='';
    }
    function render(){
      tabsEl.innerHTML='';
      st.tabs.forEach(t=>{
        const b=el('div','edTab'+(t.id===st.cur?' on':''),tabsEl);
        b.innerHTML=`${t.dirty?'<span class="dot"></span>':''}<span>${esc(t.name)}</span><span class="x" data-x>×</span>`;
        b.onclick=e=>{if(e.target.dataset.x)return;st.cur=t.id;render();sync()};
        b.oncontextmenu=e=>{e.preventDefault();
          ctxMenu(e.clientX,e.clientY,[
            {label:'Close',icon:ICONS.x,act:()=>closeTab(t.id)},
            {label:'Close Others',icon:ICONS.x,act:()=>{[...st.tabs].filter(x=>x.id!==t.id).forEach(x=>closeTab(x.id))}},
            {sep:1},
            {label:'Save',icon:ICONS.save,act:()=>save(t)},
            {label:'Copy Path',icon:ICONS.copy,act:()=>{navigator.clipboard&&navigator.clipboard.writeText(t.path||'/');toast('Path copied')}}
          ],t.name);
        };
        b.querySelector('[data-x]').onclick=e=>{e.stopPropagation();closeTab(t.id)};
      });
    }
    ta.addEventListener('input',()=>{const t=cur();if(!t)return;t.content=ta.value;t.dirty=t.content!==t.saved;sync()});
    ta.addEventListener('scroll',()=>{pre.scrollTop=ta.scrollTop;pre.scrollLeft=ta.scrollLeft;gut.scrollTop=ta.scrollTop});
    ta.addEventListener('keyup',sync);ta.addEventListener('click',sync);
    ta.addEventListener('keydown',e=>{
      if(e.key==='Tab'){
        e.preventDefault();
        const s=ta.selectionStart,en=ta.selectionEnd;
        ta.value=ta.value.slice(0,s)+'  '+ta.value.slice(en);
        ta.selectionStart=ta.selectionEnd=s+2;
        cur().content=ta.value;cur().dirty=true;sync();
      }
      if((e.ctrlKey||e.metaKey)){
        const k=e.key.toLowerCase();
        if(k==='s'){e.preventDefault();save(cur(),e.shiftKey)}
        else if(k==='o'){e.preventDefault();pickFile()}
        else if(k==='n'){e.preventDefault();newTab();ta.focus()}
        else if(k==='w'){e.preventDefault();closeTab(st.cur)}
      }
    });
    async function pickFile(){
      const p=await filePicker();
      if(p)openPath(p);
    }
    w.body.addEventListener('click',e=>{
      const b=e.target.closest('[data-a]');if(!b)return;
      const a=b.dataset.a;
      if(a==='new'){newTab();ta.focus()}
      else if(a==='open')pickFile();
      else if(a==='save'){save(cur(),e.shiftKey);ta.focus()}
      else if(a==='saveas')save(cur(),true);
      else if(a==='run'){
        const t=cur();if(!t)return;
        if(!t.path){toast('Save the file first');return}
        const ext=extOf(t.name);
        if(ext==='js'){API.open('terminal',{cmd:'node '+t.path,autoClose:false})}
        else if(ext==='sh'){API.open('terminal',{cmd:'bash '+t.path,autoClose:false})}
        else if(ext==='py'){API.open('terminal',{cmd:'python3 '+t.path,autoClose:false})}
        else if(ext==='md'){API.open('browser',{url:'nexus://md?f='+encodeURIComponent(t.path)})}
        else toast('Nothing to run for .'+ext+' files');
      }
    });
    const un=Bus.on('fs',()=>{
      st.tabs.forEach(t=>{if(t.path&&!t.dirty){const n=VFS.node(t.path);if(n&&n.type==='file')t.content=n.content}});
      if(!st.tabs.length)newTab();else sync();
    });
    // initial
    if(opts.path){const n=VFS.node(opts.path);
      if(n&&n.type==='file')newTab(VFS.norm(opts.path),n.content);
      else newTab();
    }else newTab();
    setTimeout(()=>ta.focus(),100);
    return {destroy:()=>{un();clearTimeout(st.auto)},onResize(){}};
  }
};
/* file picker dialog */
function filePicker(startDir){
  return new Promise(res=>{
    let dir=startDir||'/';
    const body=el('div','');
    body.style.cssText='max-height:340px;overflow:auto';
    const render=()=>{
      body.innerHTML='';
      const crumbs=el('div','',body);
      crumbs.style.cssText='display:flex;flex-wrap:wrap;gap:3px;margin-bottom:9px';
      const segs=dir.split('/').filter(Boolean);
      const rb=el('button','btn',crumbs);rb.textContent='/';rb.onclick=()=>{dir='/';render()};
      let acc='';
      segs.forEach(s=>{acc+='/'+s;
        const sp=el('span','',crumbs);sp.textContent='›';sp.style.cssText='opacity:.5;align-self:center';
        const b=el('button','btn',crumbs);b.textContent=s;b.onclick=()=>{dir=acc;render()}});
      const list=el('div','',body);
      list.style.cssText='max-height:250px;overflow:auto;display:flex;flex-direction:column;gap:2px';
      const d=VFS.node(dir);
      if(d&&d.type==='dir'){
        if(dir!=='/'){
          const up=el('button','appRow',list);
          up.innerHTML='<span class="ic">'+ICONS.back+'</span><b>.. (up)</b>';
          up.onclick=()=>{dir=dir.replace(/\/[^/]+$/,'')||'/';render()};
        }
        (d.children||[]).filter(n=>S.showHidden||n.name[0]!=='.').sort((a,b)=>
          (a.type===b.type)?a.name.localeCompare(b.name):(a.type==='dir'?-1:1)).forEach(n=>{
          const b=el('button','appRow',list);
          b.innerHTML=`<span class="ic">${iconForNode(n,n.type==='dir')}</span><b>${esc(n.name)}</b><i>${n.type==='dir'?(n.children||[]).length+' items':fmtBytes(n.size||0)}</i>`;
          b.onclick=()=>{
            if(n.type==='dir'){dir=(dir==='/'?'':dir)+'/'+n.name;render()}
            else{closeDialog();res(dir.replace(/\/$/,'')+'/'+n.name)}
          };
        });
      }
      if(!(d&&d.children&&d.children.length))list.innerHTML='<div style="padding:16px;color:#8ea0bd;font-size:12px">This folder is empty.</div>';
    };
    render();
    dialog({title:'Open File',text:'Choose a file to open.',icon:ICONS.open,body,
      buttons:[{label:'Cancel',value:null},{label:'New File',value:'new'},{label:'Open',value:1,pri:1}]})
      .then(async v=>{
        if(v===1)res(selPath);
        else if(v==='new'){
          const nm=await prompt2('New File','File name (with extension):','Untitled.txt');
          if(nm){const r=VFS.write((dir==='/'?'':dir)+'/'+nm,'');if(!r.err)res(r.path);else toast(r.err)}
        }
      });
    let selPath=dir;
  });
}
