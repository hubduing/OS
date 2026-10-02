const NEXUS_PAGES={
  home:{title:'NEXUS Start',fav:'#37e0ff',render(){
    return `<div class="page"><div class="hero">
      <h1>NEXUS</h1>
      <p>A complete desktop environment running inside a single HTML file. No servers, no build step, no frameworks — just the browser.</p>
      <a class="btnG" data-go="nexus://about">About this system</a>
    </div><div class="wrap">
      <h2>Where would you like to go?</h2>
      <div class="cards">
        ${['about','games','system','terminal'].map(p=>{
          const meta={about:['About','What NEXUS is, and what is under the hood',ICONS.info],
            games:['Games','NEXUS ARCADE — Neon Snake and Cyber Racer',ICONS.games],
            system:['System','Live hardware and service status',ICONS.mon],
            terminal:['Terminal','Command reference and quick start',ICONS.terminal]}[p];
          return `<button class="card" data-go="nexus://${p}">
            <span class="ic">${meta[2]}</span><b>${meta[0]}</b><span>${meta[1]}</span></button>`}).join('')}
      </div>
      <h3>Your filesystem</h3>
      <p id="bhFs">Loading…</p>
      <div class="cards" id="bhApps"></div>
    </div></div>`}},
  about:{title:'About NEXUS',fav:'#b06bff',render(){
    return `<div class="page"><div class="hero"><h1>About</h1>
      <p>NEXUS OS is a fake operating system that behaves like a real one.</p></div>
    <div class="wrap">
      <h2>What this is</h2>
      <p>A single HTML file containing a window manager, a persistent virtual filesystem, a terminal, a text editor, a canvas paint program, a media player, a mini web browser, two complete games, an intent-parsing assistant, and a synthetic system monitor. Everything shares one state model, so a file created in the Terminal appears in Files immediately.</p>
      <h2>Architecture</h2>
      <table class="tbl"><tr><th>Layer</th><th>Responsibility</th></tr>
        <tr><td>Kernel</td><td>State bus, persistence, event bus, audio service</td></tr>
        <tr><td>VFS</td><td>Path resolution, node model, localStorage persistence</td></tr>
        <tr><td>Window manager</td><td>Drag, resize, snap, focus, z-order, taskbar sync</td></tr>
        <tr><td>App registry</td><td>One build() contract for every application</td></tr>
        <tr><td>Diagnostics</td><td>Synthetic metrics derived from real activity</td></tr>
      </table>
      <h2>Keyboard shortcuts</h2>
      <p>
        <span class="kbd">Win</span> start menu &nbsp; <span class="kbd">Win</span>+<span class="kbd">S</span> search &nbsp;
        <span class="kbd">Win</span>+<span class="kbd">D</span> show desktop &nbsp; <span class="kbd">Win</span>+<span class="kbd">E</span> files &nbsp;
        <span class="kbd">Win</span>+<span class="kbd">T</span> terminal &nbsp; <span class="kbd">Alt</span>+<span class="kbd">Tab</span> cycle windows &nbsp;
        <span class="kbd">F12</span> diagnostics &nbsp; <span class="kbd">Esc</span> close menus
      </p>
      <h2>Credits</h2>
      <p>Built with vanilla JavaScript, Canvas 2D, SVG, and the Web Audio API. No dependencies.</p>
    </div></div>`}},
  games:{title:'Games',fav:'#ff4d9d',render(){
    return `<div class="page"><div class="hero"><h1>NEXUS ARCADE</h1>
      <p>Two complete games, running on Canvas. Best scores persist in your browser.</p>
      <a class="btnG" data-open="arcade">Launch Arcade</a></div>
    <div class="wrap">
      <div class="cards">
        <button class="card" data-game="snake"><span class="ic">${ICONS.games}</span>
          <b>Neon Snake</b><span>Classic snake with increasing speed, three difficulty tiers, screen shake and synthesized sound. Best: <b>${LS.get('snakeBest',0)}</b></span></button>
        <button class="card" data-game="racer"><span class="ic">${ICONS.media}</span>
          <b>Cyber Racer</b><span>Pseudo-3D neon racer with AI opponents, checkpoints, laps and an engine drone. Best lap: <b>${LS.get('racerBest',null)?formatLap(LS.get('racerBest')):'—'}</b></span></button>
      </div>
      <h2>How to play</h2>
      <p><b>Neon Snake</b> — arrow keys or WASD to steer. <span class="kbd">Space</span> pauses, <span class="kbd">R</span> restarts. Eat to grow; every meal makes you faster.</p>
      <p><b>Cyber Racer</b> — <span class="kbd">↑</span> accelerate, <span class="kbd">↓</span> brake, <span class="kbd">←</span><span class="kbd">→</span> steer. Pass three checkpoints per lap against five AI cars.</p>
    </div></div>`}},
  system:{title:'System',fav:'#3ddc84',render(){
    const st=VFS.stats();
    return `<div class="page"><div class="hero"><h1>System Status</h1>
      <p>Live view of the synthetic hardware model driving NEXUS diagnostics.</p></div>
    <div class="wrap">
      <h2>Host</h2>
      <table class="tbl">
        <tr><td>Operating system</td><td>NEXUS OS 4.2.1 (Web)</td></tr>
        <tr><td>Kernel</td><td>nexus-kernel 4.2.1</td></tr>
        <tr><td>Window manager</td><td>NexusWM</td></tr>
        <tr><td>Uptime</td><td id="bUptime">—</td></tr>
        <tr><td>Viewport</td><td>${innerWidth} × ${innerHeight} @${devicePixelRatio}×</td></tr>
      </table>
      <h2>Resources <span style="font-size:11px;color:#8ea0bd">(simulated)</span></h2>
      <div id="bRes"></div>
      <h2>Filesystem</h2>
      <table class="tbl">
        <tr><td>Files</td><td>${st.files}</td></tr>
        <tr><td>Folders</td><td>${st.dirs}</td></tr>
        <tr><td>Content size</td><td>${fmtBytes(st.bytes)}</td></tr>
        <tr><td>Browser storage used</td><td>${fmtBytes(storageBytes)}</td></tr>
      </table>
      <h2>Open windows</h2>
      <div id="bWins"></div>
    </div></div>`}},
  terminal:{title:'Terminal',fav:'#3ddc84',render(){
    return `<div class="page"><div class="hero"><h1>NexusShell</h1>
      <p>Twenty commands operating on the shared virtual filesystem.</p>
      <a class="btnG" data-open="terminal">Open a terminal</a></div>
    <div class="wrap">
      <h2>Quick start</h2>
      <p>Paste this into any terminal window:</p>
      <pre style="background:#0e1424;color:#9fe8ff;padding:16px;border-radius:12px;overflow:auto;font-family:var(--mono);font-size:12.5px;line-height:1.8;border:1px solid #1e2a44">mkdir Projects
cd Projects
touch demo.txt
echo "Hello from NEXUS" &gt; demo.txt
cat demo.txt
tree /</pre>
      <h2>Command reference</h2>
      <table class="tbl"><tr><th>Command</th><th>Purpose</th></tr>
        ${[['help','list every command'],['pwd','print working directory'],['ls [-a]','list a directory'],
          ['cd DIR','change directory'],['mkdir NAME','create a folder'],['touch FILE','create an empty file'],
          ['cat FILE','print a file'],['echo TEXT &gt; FILE','write text to a file'],['rm PATH','delete'],
          ['cp SRC DST','copy'],['mv SRC DST','move / rename'],['tree PATH','recursive tree'],
          ['find TEXT','search the whole filesystem'],['open TARGET','open a file or application'],
          ['calc EXPR','evaluate an expression'],['sysinfo','system report'],['neofetch','ASCII summary'],
          ['theme COLOR','change the accent color'],['history','command history'],['date / whoami','session info'],
          ['clear','clear the screen']]
          .map(r=>`<tr><td><code>${r[0]}</code></td><td>${r[1]}</td></tr>`).join('')}
      </table>
      <p style="color:#8ea0bd">Tab completes paths and commands. ↑ and ↓ walk through history. There are commands that are not listed here.</p>
    </div></div>`}},
  md:{title:'Document',fav:'#ffc857',render(p){
    const path=decodeURIComponent((p.query||'').replace(/^f=/,''));
    const n=VFS.node(path);
    if(!n)return `<div class="page"><div class="wrap"><h2>Not found</h2><p>${esc(path)}</p></div></div>`;
    return `<div class="page"><div class="wrap"><h2>${esc(n.name)}</h2>
      <p style="font-family:var(--mono);font-size:12px;color:#8ea0bd">${esc(path)} · modified ${fmtStamp(n.mtime)}</p>
      <pre style="background:#0e1424;color:#c8d6ee;padding:18px;border-radius:12px;overflow:auto;font-family:var(--mono);font-size:12.5px;line-height:1.8;white-space:pre-wrap;border:1px solid #1e2a44">${esc(n.content)}</pre>
      <button class="btnG" style="margin-top:18px" data-open="editor" data-path="${esc(path)}">Open in editor</button></div></div>`}}
};
APPS.browser={
  title:'Browser',icon:ICONS.browser,desc:'NexusBrowser',w:940,h:640,
  build(w,opts){
    const BOOKMARKS=LS.get('bookmarks',['nexus://home','nexus://about','nexus://games','nexus://system','nexus://terminal']);
    w.body.innerHTML=`<div class="br">
      <div class="brTabs"></div>
      <div class="brBar">
        <button class="nav" data-a="back" title="Back">${ICONS.back}</button>
        <button class="nav" data-a="fwd" title="Forward">${ICONS.fwd}</button>
        <button class="nav" data-a="reload" title="Reload">${ICONS.reload}</button>
        <button class="nav" data-a="home" title="Home">${ICONS.home}</button>
        <div class="brUrl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
          <input spellcheck="false" placeholder="nexus://home"></div>
        <button class="nav" data-a="star" title="Bookmark">${ICONS.star}</button>
        <select class="inp" data-bm style="max-width:150px" title="Bookmarks"></select>
      </div>
      <div class="brView"></div>
    </div>`;
    const tabsEl=w.body.querySelector('.brTabs'),
      view=w.body.querySelector('.brView'),
      urlInp=w.body.querySelector('.brUrl input'),
      bmSel=w.body.querySelector('[data-bm]');
    let tabs=[],cur=0,live=null;
    function newTab(url){
      const t={id:'bt'+Date.now()+Math.random().toString(36).slice(2,4),url:url||'nexus://home',title:'Loading…',hist:[],hi:-1};
      tabs.push(t);cur=tabs.length-1;navigate(t.url);renderTabs();
      return t;
    }
    function closeTab(i){
      if(tabs.length===1){newTab('nexus://home');return}
      tabs.splice(i,1);
      if(cur>=tabs.length)cur=tabs.length-1;
      renderTabs();navigate(tabs[cur].url);
    }
    function renderTabs(){
      tabsEl.innerHTML='';
      tabs.forEach((t,i)=>{
        const d=el('div','brTab'+(i===cur?' on':''),tabsEl);
        d.innerHTML=`<span class="fav"></span><span class="t">${esc(t.title)}</span><span class="x">×</span>`;
        d.querySelector('.fav').style.background=t.fav||'linear-gradient(135deg,#37e0ff,#b06bff)';
        d.onclick=()=>{cur=i;renderTabs();navigate(t.url)};
        d.querySelector('.x').onclick=e=>{e.stopPropagation();closeTab(i)};
        d.oncontextmenu=e=>{e.preventDefault();ctxMenu(e.clientX,e.clientY,[
          {label:'Reload',icon:ICONS.reload,act:()=>{cur=i;navigate(t.url)}},
          {label:'Duplicate',icon:ICONS.copy,act:()=>{const n={...t,id:'bt'+Date.now(),hist:[...t.hist],hi:t.hi};tabs.splice(i+1,0,n);cur=i+1;renderTabs();navigate(n.url)}},
          {sep:1},
          {label:'Close',icon:ICONS.x,act:()=>closeTab(i)},
          {label:'Close Others',icon:ICONS.x,act:()=>{tabs=[t];cur=0;renderTabs();navigate(t.url)}}
        ],t.title)};
      });
    }
    function renderBm(){
      bmSel.innerHTML='<option value="">Bookmarks</option>'+
        BOOKMARKS.map(b=>`<option value="${esc(b)}">${esc(b.replace('nexus://',''))}</option>`).join('');
    }
    function navigate(url){
      const t=tabs[cur];if(!t)return;
      url=String(url||'').trim();
      if(!url)url='nexus://home';
      if(!/^[a-z]+:\/\//i.test(url)&&!/^nexus:/i.test(url))url='nexus://'+url;
      if(t.url!==url||t.hist[t.hi]!==url){
        t.hist=t.hist.slice(0,t.hi+1);t.hist.push(url);t.hi=t.hist.length-1;
      }
      t.url=url;
      urlInp.value=url;
      w.body.querySelector('[data-a="back"]').disabled=t.hi<=0;
      w.body.querySelector('[data-a="fwd"]').disabled=t.hi>=t.hist.length-1;
      const key=url.split('?')[0].replace(/\/$/,'');
      const pg=NEXUS_PAGES[key.split('://')[1]]||NEXUS_PAGES[key];
      if(pg){
        t.title=pg.title;t.fav=pg.fav;
        view.style.background='#f7f9fc';
        view.innerHTML=pg.render(url.split('?')[1]||'');
        view.scrollTop=0;
        w.el.querySelector('.ttl').textContent=pg.title+' — Browser';
        if(key.endsWith('system'))startLive();
        else stopLive();
        if(key.endsWith('home'))fillHome();
      }else{
        t.title='Cannot reach page';t.fav='#ff5c72';
        view.style.background='#f7f9fc';
        view.innerHTML=`<div class="page"><div class="wrap" style="padding-top:60px;text-align:center">
          <div style="width:64px;height:64px;margin:0 auto 18px;opacity:.35">${ICONS.warn}</div>
          <h2>This site cannot be reached</h2>
          <p>NEXUS is an offline system. Only <code>nexus://</code> pages exist inside its network.</p>
          <p style="color:#8ea0bd">Try: <a href="#" data-go="nexus://home" style="color:#37e0ff">nexus://home</a> ·
          <a href="#" data-go="nexus://about" style="color:#37e0ff">nexus://about</a> ·
          <a href="#" data-go="nexus://games" style="color:#37e0ff">nexus://games</a></p>
          <button class="btnG" style="margin-top:20px" data-go="nexus://home">Go to start page</button></div></div>`;
        stopLive();
      }
      renderTabs();renderBm();
    }
    function fillHome(){
      const fs=$('#bhFs');
      if(fs){const st=VFS.stats();fs.textContent=`The virtual filesystem currently holds ${st.files} files across ${st.dirs} folders, using ${fmtBytes(st.bytes)}.`}
      const apps=$('#bhApps');
      if(apps){
        apps.innerHTML=Object.keys(APPS).filter(k=>!['diagnostics','computer'].includes(k)).slice(0,8).map(k=>
          `<button class="card" data-open="${k}"><span class="ic">${APPS[k].icon}</span><b>${esc(APPS[k].title)}</b><span>${esc(APPS[k].desc||'')}</span></button>`).join('');
      }
    }
    let liveTimer=null;
    function startLive(){
      stopLive();
      liveTimer=setInterval(()=>{
        const up=$('#bUptime');if(up)up.textContent=Diag.uptimeStr();
        const res=$('#bRes');
        if(res){
          res.innerHTML=[['CPU',Diag.cpu,'%'],['RAM',Math.round(Diag.ram/Diag.ramTotal*100),'%'],
            ['Storage',Math.min(99,Math.round(storageBytes/5242880*100)),'%'],['Frame rate',Diag.fps,' fps']]
            .map(([n,v,u])=>`<p><b>${n}</b> — ${v}${u}</p>
              <div class="bar2"><i style="width:${clamp(v,0,100)}%"></i></div>`).join('');
        }
        const wins=$('#bWins');
        if(wins){
          wins.innerHTML=WM.wins.length?`<table class="tbl"><tr><th>Application</th><th>State</th><th>Memory (sim.)</th></tr>`+
            WM.wins.map(x=>`<tr><td>${esc(x.title)}</td><td>${x.min?'minimized':'open'}</td><td>${(40+Math.random()*90).toFixed(0)} MB</td></tr>`).join('')+'</table>'
            :'<p>No windows are open.</p>';
        }
      },700);
    }
    function stopLive(){if(liveTimer){clearInterval(liveTimer);liveTimer=null}}
    view.addEventListener('click',e=>{
      const go=e.target.closest('[data-go]');
      if(go){e.preventDefault();navigate(go.dataset.go);return}
      const op=e.target.closest('[data-open]');
      if(op){API.open(op.dataset.open,op.dataset.path?{path:op.dataset.path}:{});return}
      const g=e.target.closest('[data-game]');
      if(g){API.open('arcade',{game:g.dataset.game})}
    });
    urlInp.addEventListener('keydown',e=>{if(e.key==='Enter'){navigate(urlInp.value);urlInp.blur()}});
    urlInp.addEventListener('focus',()=>urlInp.select());
    w.body.querySelector('.brBar').addEventListener('click',e=>{
      const b=e.target.closest('[data-a]');if(!b)return;
      const a=b.dataset.a,t=tabs[cur];
      if(a==='back'){if(t.hi>0){t.hi--;navigate(t.hist[t.hi])}}
      else if(a==='fwd'){if(t.hi<t.hist.length-1){t.hi++;navigate(t.hist[t.hi])}}
      else if(a==='reload'){navigate('nexus://'+t.url.split('?')[0].replace('nexus://','')+(t.url.includes('?')?'?'+t.url.split('?')[1]:''))}
      else if(a==='home')navigate('nexus://home');
      else if(a==='star'){
        if(BOOKMARKS.includes(t.url)){BOOKMARKS.splice(BOOKMARKS.indexOf(t.url),1);toast('Bookmark removed')}
        else{BOOKMARKS.push(t.url);toast('Bookmarked')}
        LS.set('bookmarks',BOOKMARKS);renderBm();
      }
      Audio2.click();
    });
    bmSel.onchange=()=>{if(bmSel.value)navigate(bmSel.value)};
    renderBm();
    newTab(opts.url||'nexus://home');
    return {destroy:()=>{stopLive();if(live){URL.revokeObjectURL(live);live=null}}};
  }
};

/* ---------- PAINT ---------- */
