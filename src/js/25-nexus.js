/* ============================================================
   PART 8 — NEXUS ASSISTANT, EASTER EGGS, BOOT, INIT
   ============================================================ */
/* ---------- NEXUS ASSISTANT ---------- */



const NEXUS={
  intents:[],
  respond(txt,act){
    const delay=Math.min(900,180+txt.length*8);
    const log=this.el.querySelector('.nxLog');
    const t=el('div','msg a',log);
    t.innerHTML=`<span class="who">NEXUS</span>${esc(txt)}`;
    log.scrollTop=log.scrollHeight;
    Audio2.tone(560,.07,'sine',.05,720);
    if(act)setTimeout(act,delay);
  },
  sys(txt){
    const log=this.el.querySelector('.nxLog');
    const t=el('div','msg sys',log);t.textContent=txt;
    log.scrollTop=log.scrollHeight;
  },
  parse(raw){
    const t=raw.toLowerCase().trim().replace(/[.?!]+$/,'');
    if(!t)return;
    const has=(...w)=>w.some(x=>t.includes(x));
    const grab=(re)=>{const m=t.match(re);return m?m[1].trim():null};

    // greetings
    if(/^(hi|hello|hey|yo|greetings|good (morning|evening|day))\b/.test(t))
      return [random(['Online and listening.','Hello, operator.','Greetings, user.']),()=>{}];
    if(has('thank','thanks','cheers','nice work'))
      return ['Acknowledged.',()=>{}];
    if(has('who are you','what are you','your name'))
      return ['I am NEXUS. I am the intent layer of this operating system — a local command parser, not a language model. I can open applications, read and write the filesystem, change the desktop and report system state. Ask for something concrete.',()=>{}];

    // open apps
    if(/^(open|launch|start|run|show me|bring up)\b/.test(t)||has('open the','launch the')){
      let target=t.replace(/^(please\s+)?(can you\s+)?(open|launch|start|run|show me|bring up|show)\s+(the\s+)?/,'');
      target=target.replace(/app|application|program/g,'').trim();
      const name=target.split(/[^a-z0-9]+/).filter(Boolean)[0]||'';
      const app=resolveApp(name+' '+(target.split(/\s+/)[1]||''));
      if(app)return [launchLine(app),()=>API.open(app,{single:false})];
      if(has('file','files','documents'))return ['Opening Files.',()=>API.open('files',{single:false})];
    }
    // direct app names
    if(t==='games'||has('arcade'))return ['Launching NEXUS ARCADE…',()=>API.open('arcade',{single:false})];
    if(t.includes('snake'))return ['Launching NEON SNAKE. Steer with the arrow keys.',()=>API.open('arcade',{game:'snake',single:false})];
    if(t.includes('racer')||t.includes('race'))return ['Launching CYBER RACER. Three laps. Do not brake into the barriers.',()=>API.open('arcade',{game:'racer',single:false})];
    if(t.includes('terminal')||t.includes('shell')||t.includes('console'))return ['Opening NexusShell.',()=>API.open('terminal',{single:false})];
    if(t.includes('editor')||t.includes('notepad')||t.includes('write')&&t.includes('text'))return ['Opening the editor.',()=>API.open('editor',{single:false})];
    if(t.includes('paint')||t.includes('draw'))return ['Opening Paint.',()=>API.open('paint',{single:false})];
    if(t.includes('browser')||t.includes('internet')||t.includes('web'))return ['Opening the browser.',()=>API.open('browser',{single:false})];
    if(t.includes('calculator')||t.includes('calc'))return ['Opening the calculator.',()=>API.open('calculator',{single:false})];
    if(t.includes('video')||t.includes('film')||t.includes('movie'))return ['Opening the video player.',()=>API.open('video',{single:false})];
    if(t.includes('media')||t.includes('music')||t.includes('song')||t.includes('track')||t.includes('player'))return ['Opening the music player.',()=>API.open('music')];
    if(t.includes('setting')||t.includes('preference')||t.includes('config'))return ['Opening Settings.',()=>API.open('settings',{single:false})];
    if(t.includes('achievement'))return ['Opening the achievement viewer.',()=>API.open('achievements',{single:false})];
    if(t.includes('computer')||t.includes('this pc'))return ['Opening Computer.',()=>API.open('computer',{single:false})];
    if(t.includes('file')||t.includes('folder')||t.includes('director'))return ['Opening Files.',()=>API.open('files',{single:false})];
    if(t.includes('wallpaper')||t.includes('background')||t.includes('theme')){
      if(has('change','set','switch')){
        const opts=WALLPAPERS.filter(w=>!w.secret);
        const named=opts.find(w=>t.includes(w.name.toLowerCase())||t.includes(w.id));
        const pick=named||opts[(Math.random()*opts.length)|0];
        return [`Switching wallpaper to ${pick.name}.`,()=>{Wall.apply(pick.id);LS.set('settings',S);toast('Wallpaper: '+pick.name)}];
      }
      if(has('color','accent','colour')){
        const named=ACCENTS.find(a=>t.includes({ '#37e0ff':'cyan','#b06bff':'violet','#ff4d9d':'pink','#3ddc84':'green','#ffc857':'amber','#ff6b35':'orange','#6fb0ff':'blue','#ff2e63':'red' }[a]));
        const pick=named||ACCENTS[(Math.random()*ACCENTS.length)|0];
        return [`Setting accent to ${pick}.`,()=>setSetting('accent',pick)];
      }
      return ['Which wallpaper? Try "change wallpaper to aurora", or open Settings → Appearance for the full list.',()=>{}];
    }

    // filesystem
    if(/make|create|add/.test(t)&&/folder|directory|dir/.test(t)){
      const nm=grab(/(?:called|named)\s+([\w .-]+)/)||grab(/folder\s+([\w .-]+)/);
      if(nm){
        const name=nm.split(/\s+(?:in|inside|under|at)\s+/)[0].trim();
        const where=grab(/\s+(?:in|inside|under|at)\s+([\w/]+)/)||'/Home';
        const p=where.replace(/\/$/,'')+'/'+name;
        return [`Creating folder ${p}.`,()=>{
          const r=VFS.mkdir(p);
          if(r.err)NEXUS.sys('ERROR · '+r.err.toUpperCase());
          else{NEXUS.sys('OK · '+p);Bus.emit('fs');renderDesktopFiles();toast('Created '+p)}
        }];
      }
    }
    if(/make|create|add|write/.test(t)&&/file|note|document/.test(t)){
      const nm=grab(/(?:called|named)\s+([\w .-]+)/);
      const body=grab(/(?:with|containing|saying|that says)\s+["']?([^"']+)/);
      const name=(nm?nm.split(/\s+(?:in|inside|at|with|containing|saying)\s+/)[0]:'notes.txt').trim();
      if(!/\./.test(name))name+='.txt';
      const where=grab(/\s+(?:in|inside|at)\s+([\w/]+)/)||'/Documents';
      const p=where.replace(/\/$/,'')+'/'+name;
      return [`Writing ${p}.`,()=>{
        const r=VFS.write(p,body||'Created by NEXUS.\n');
        if(r.err)NEXUS.sys('ERROR · '+r.err.toUpperCase());
        else{NEXUS.sys('OK · '+r.path+' · '+fmtBytes(r.node.size));Bus.emit('fs');Achvements.grant('FIRST_FILE')}
      }];
    }
    if(/delete|remove|erase/.test(t)&&grab(/([\w/.-]+)/)){
      const p=grab(/\s+([\w/.-]+)/);
      if(p&&VFS.node(p)){
        return [`Deleting ${p}. This cannot be undone.`,()=>{
          const r=VFS.rm(p,null,true);
          NEXUS.sys(r.err?'ERROR · '+r.err.toUpperCase():'OK · '+p+' removed');
          if(!r.err){Bus.emit('fs');renderDesktopFiles()}
        }];
      }
    }
    if(has('show my files','list my files','my files','what files','show files','list files')){
      const st=VFS.stats();
      return [`The virtual filesystem holds ${st.files} files across ${st.dirs} folders, using ${fmtBytes(st.bytes)}. Opening Files at /Documents.`,()=>API.open('files',{path:'/Documents',single:false})];
    }
    if(/find|search/.test(t)&&grab(/(?:for|file named|file called)\s+([\w.-]+)/)){
      const q=grab(/(?:for|file named|file called)\s+([\w.-]+)/);
      const res=VFS.search(q);
      if(!res.length)return [`No files matching "${q}" exist anywhere in the filesystem.`,()=>{}];
      return [`Found ${res.length} match${res.length>1?'es':''} for "${q}":\n`+res.slice(0,6).map(r=>'  '+r.path+(r.node.type==='dir'?'/':'')).join('\n'),
        ()=>API.open('files',{path:res[0].node.type==='dir'?res[0].path:'/',single:false})];
    }
    if(/cat|read|contents of|what.*in.*file/.test(t)&&grab(/([\w/.-]+\.\w+)/)){
      const p=grab(/([\w/.-]+\.\w+)/);
      const n=VFS.node(p);
      if(!n)return [`There is no file at ${p}.`,()=>{}];
      return [`Contents of ${p}:\n`+(n.content||'(empty)').slice(0,700),()=>{}];
    }

    // diagnostics / status
    if(has('diagnostic','diagnostics','task manager','system monitor'))
      return ['Running system diagnostics.',()=>{Diag.toggleFull()}];
    if(has('status','system status','how are you','health','report')){
      const s=VFS.stats();
      return [`SYSTEM STATUS\n`
        +`  Uptime      ${Diag.uptimeStr()}\n`
        +`  CPU load    ${Diag.cpu}% (simulated)\n`
        +`  Memory      ${Diag.ram} / ${Diag.ramTotal} MB (simulated)\n`
        +`  Frame rate  ${Diag.fps} fps\n`
        +`  Processes   ${Diag.procCount()}\n`
        +`  Windows     ${WM.wins.length} open\n`
        +`  Filesystem  ${s.files} files, ${s.dirs} folders, ${fmtBytes(s.bytes)}\n`
        +`  Storage     ${fmtBytes(storageBytes)} in localStorage\n`
        +`  Achievements ${Achievements.total()} of ${ACH_LIST.length}\n\n`
        +`All hardware figures are generated from live OS activity, not real sensors.`,()=>{}];
    }
    if(has('cpu','memory','ram','performance','fps','frame rate')){
      return [`CPU ${Diag.cpu}% · memory ${Diag.ram}/${Diag.ramTotal} MB · ${Diag.fps} fps.\nThese values are simulated but track real window and file activity.`,()=>{}];
    }
    if(has('window')&&has('close all','minimize all','tile','cascade'))
      return ['Adjusting the window layout.',()=>{
        if(t.includes('close'))WM.closeAll();
        else if(t.includes('minimize'))WM.minimizeAll();
        else if(t.includes('tile'))tile();
        else cascade();
      }];
    if(has('close everything','close all windows'))return ['Closing every window.',()=>WM.closeAll()];
    if(has('minimize'))return ['Minimizing all windows.',()=>WM.minimizeAll()];
    if(has('lock'))return ['Locking the session.',()=>lockScreen()];
    if(has('restart','reboot'))return ['Restarting NEXUS.',()=>setTimeout(()=>location.reload(),600)];
    if(has('shut down','shutdown','power off'))
      return ['Shutting down. Session data has been flushed to localStorage.',()=>shutdown(false)];

    if(has('time','what time'))return [`Local time is ${fmtHMS(new Date())}.`,()=>{}];
    if(has('date','today'))return [`Today is ${fmtDayLong(new Date())}.`,()=>{}];
    if(has('joke','make me laugh','funny'))return [random(NEXUS_JOKES),()=>{Audio2.tone(720,.06,'triangle',.04,880)}];
    if(has('fortune','horoscope','predict'))return [random(NEXUS_FORTUNES),()=>{}];
    if(has('help','what can you do','commands'))return [NEXUS_HELP,()=>{}];
    if(has('volume')){
      const n=grab(/(\d{1,3})\s*%?/);
      if(n)return [`Setting master volume to ${clamp(+n,0,100)}%.`,()=>{setSetting('volume',clamp(+n,0,100));renderTray()}];
    }
    if(has('snapshot','screenshot'))return ['Capturing the screen.',()=>screenshot()];

    // small talk fallback
    const fall=random([
      'I did not map that to a system action. Try "open terminal", "change wallpaper to aurora", "create a folder called Projects", or "system status".',
      'No matching intent. I can launch applications, manipulate the filesystem, change the desktop and report state.',
      'That request is outside my command set. Type "help" for a list of what I can actually do.'
    ]);
    return [fall,()=>{}];
  }
};
const NEXUS_JOKES=[
  'A SQL query walks into a bar, approaches two tables and asks: "may I join you?"',
  'There are 10 kinds of people in the world: those who understand binary and those who do not.',
  'I would tell you a UDP joke, but you might not get it.',
  'A byte walks into a bar looking miserable. The bartender asks what is wrong. "Parity error." "Ah — I thought you looked a bit off."',
  'Why did the developer go broke? Because they used up all their cache.',
  'I have a clock in my code, but it is not right. It is two ticks behind.',
  'The racecar was feeling unwell, so the mechanic replaced its exhaust. Now it has turbo.',
];
const NEXUS_FORTUNES=[
  'You will ship the feature before the tests. Then write the tests.',
  'Value: measure twice, render once.',
  'A window opened today will be closed by morning.',
  'The bug is in the config you did not write.',
  'Your filesystem is 84% optimism.',
  'The Konami code unlocks more than you think.',
];
const NEXUS_HELP=
`I understand natural phrasing and map it to real system actions:

  open terminal / launch games / open paint
  launch snake · launch cyber racer
  show my files · find welcome.txt · read /Documents/Ideas.txt
  create a folder called Projects
  create a file called todo.txt with content buy milk
  delete /Documents/Ideas.txt
  change wallpaper to aurora · change accent color
  system status · run diagnostics
  open files at /Downloads        close all windows · tile windows
  lock · restart · shut down
  screenshot · set volume to 40
  tell me a joke · tell me my fortune

Anything else, I will tell you I do not understand.`;
function random(a){return a[(Math.random()*a.length)|0]}
function resolveApp(q){
  q=q.trim();
  const aliases={
    'file':'files','files':'files','explorer':'files','folder':'files','folders':'files',
    'term':'terminal','terminal':'terminal','shell':'terminal','bash':'terminal','console':'terminal',
    'note':'editor','notes':'editor','editor':'editor','text':'editor','notepad':'editor','code':'editor',
    'game':'arcade','games':'arcade','arcade':'arcade','play':'arcade',
    'web':'browser','browser':'browser','internet':'browser','net':'browser',
    'draw':'paint','paint':'paint','canvas':'paint',
    'calc':'calculator','calculator':'calculator',
    'music':'music','song':'music','track':'music','media':'music','player':'music','video':'video','film':'video','movie':'video',
    'setting':'settings','settings':'settings','preferences':'settings','config':'settings',
    'computer':'computer','pc':'computer',
    'achievements':'achievements','awards':'achievements','trophies':'achievements',
    'nexus':'nexus','assistant':'nexus','ai':'nexus'
  };
  return aliases[q]||aliases[q.replace(/s$/,'')]||(APPS[q]?q:null);
}
function launchLine(app){
  const msgs={
    files:'Opening Files.',
    terminal:'Opening NexusShell.',
    editor:'Opening the editor.',
    arcade:'Launching NEXUS ARCADE.',
    browser:'Opening the browser.',
    paint:'Opening Paint.',
    calculator:'Opening the calculator.',
    music:'Opening the music player.',
    song:'Opening the music player.',
    track:'Opening the music player.',
    media:'Opening the music player.',
    player:'Opening the music player.',
    video:'Opening the video player.',
    film:'Opening the video player.',
    movie:'Opening the video player.',
    settings:'Opening Settings.',
    achievements:'Opening the achievement viewer.',
    computer:'Opening Computer.',
    nexus:'Reinitialising. I am already here.',
    diagnostics:'Opening system diagnostics.'
  };
  return msgs[app]||('Launching '+(APPS[app]?APPS[app].title:app)+'.');
}
function screenshot(){
  try{
    const wv=Wall.canvas();
    const cv=document.createElement('canvas');
    cv.width=innerWidth;cv.height=innerHeight;
    const c=cv.getContext('2d');
    c.drawImage(wv,0,0,cv.width,cv.height);
    c.fillStyle='rgba(0,0,0,.18)';c.fillRect(0,0,cv.width,cv.height);
    const name='screenshot-'+Date.now().toString(36)+'.png';
    const r=VFS.write('/Pictures/'+name,'');
    if(r.err){toast('Screenshot failed');return}
    r.node.dataUrl=cv.toDataURL('image/png');
    r.node.mime='image/png';
    r.node.size=Math.round(r.node.dataUrl.length*.75);
    VFS.save();
    Notify.send('Screenshot saved','/Pictures/'+name,{app:'paint',icon:ICONS.mon});
    Achievements.grant('CLEANER');
    toast('Saved to /Pictures/'+name);
  }catch(e){toast('Screenshot failed')}
}
APPS.nexus={
  title:'NEXUS',icon:ICONS.nexus,desc:'System assistant',w:760,h:600,
  build(w){
    w.body.innerHTML=`<div class="nx">
      <div class="nxCore">
        <canvas id="nxOrb" width="118" height="118"></canvas>
        <div class="st" data-nxst>CORE ONLINE</div>
        <div style="font-size:10px;color:#8ea0bd;font-family:var(--mono);text-align:center;line-height:1.7">
          INTENT PARSER v1.0<br>LOCAL · NO NETWORK</div>
        <div class="diffbar" style="gap:5px">
          <button class="chip" data-clear>Clear</button>
          <button class="chip" data-help>Help</button>
        </div>
      </div>
      <div class="nxChat">
        <div class="nxLog"></div>
        <div class="nxChips">
          ${['open terminal','launch snake','system status','show my files','change wallpaper to aurora',
             'create a folder called Projects','run diagnostics','open browser','lock session','help']
            .map(c=>`<button class="chip">${c}</button>`).join('')}
        </div>
        <div class="nxIn">
          <input class="inp" style="flex:1" placeholder="Ask NEXUS to do something…" autocomplete="off">
          <button class="btn pri" data-send>Send</button>
        </div>
      </div>
    </div>`;
    NEXUS.el=w.body.querySelector('.nx');
    const log=w.body.querySelector('.nxLog'),
      inp=w.body.querySelector('.nxIn input'),
      orb=w.body.querySelector('#nxOrb'),
      stEl=w.body.querySelector('[data-nxst]');
    const oc=orb.getContext('2d');
    let ot=0,oraf;
    (function orbLoop(){
      oraf=requestAnimationFrame(orbLoop);
      ot+=.02;
      const W=118,R=44;
      oc.clearRect(0,0,W,W);
      const g=oc.createRadialGradient(W/2,W/2,0,W/2,W/2,W/2);
      g.addColorStop(0,hexA(S.accent,.5));g.addColorStop(.5,hexA(S.accent2,.22));g.addColorStop(1,'rgba(0,0,0,0)');
      oc.fillStyle=g;oc.beginPath();oc.arc(W/2,W/2,W/2,0,7);oc.fill();
      for(let i=0;i<3;i++){
        oc.save();oc.translate(W/2,W/2);oc.rotate(ot*(i%2?1:-1)*(1+i*.4));
        oc.strokeStyle=hexA(i===0?S.accent:S.accent2,clamp(.85-i*.2,0,1));
        oc.lineWidth=1.3;oc.shadowBlur=8;oc.shadowColor=S.accent;
        oc.beginPath();oc.ellipse(0,0,R-i*9,R*.42-i*4,0,0,7);oc.stroke();
        oc.restore();
      }
      oc.shadowBlur=16;oc.shadowColor='#fff';
      oc.fillStyle='#fff';oc.beginPath();oc.arc(W/2,W/2,5+Math.sin(ot*2)*1.4,0,7);oc.fill();
      oc.shadowBlur=0;
    })();
    orb.onclick=()=>{
      const s=random(['All systems nominal.','I am listening.','Awaiting instruction.',
        'The filesystem is stable.','Nothing needs your attention.']);
      NEXUS.sys('>> '+s);
    };
    function say(txt,who){
      const d=el('div','msg '+(who||'u'),log);
      d.innerHTML=who==='a'?`<span class="who">NEXUS</span>${esc(txt)}`:esc(txt);
      log.scrollTop=log.scrollHeight;
    }
    function typing(){
      const d=el('div','msg a',log);
      d.innerHTML='<span class="who">NEXUS</span><span class="typing"><span></span><span></span><span></span></span>';
      log.scrollTop=log.scrollHeight;
      return d;
    }
    function send(){
      const v=inp.value.trim();
      if(!v)return;
      say(v,'u');inp.value='';
      Achievements.bump('nexus');
      if(Achievements.counts.nexus>=10)Achievements.grant('NEXUS_TALK');
      const t=typing();
      const [reply,act]=NEXUS.parse(v);
      setTimeout(()=>{t.remove();NEXUS.respond(reply,act)},240+Math.random()*260);
      Audio2.click();
    }
    w.body.querySelector('[data-send]').onclick=send;
    w.body.querySelector('[data-help]').onclick=()=>{say('help','u');
      const t=typing();setTimeout(()=>{t.remove();NEXUS.respond(NEXUS_HELP)},400)};
    w.body.querySelector('[data-clear]').onclick=()=>{log.innerHTML='';say('Session cleared.','a')};
    w.body.querySelectorAll('.nxChips .chip').forEach(c=>c.onclick=()=>{inp.value=c.textContent;send()});
    inp.addEventListener('keydown',e=>{if(e.key==='Enter')send()});
    say('NEXUS core online.','a');
    setTimeout(()=>NEXUS.sys('Local intent parser loaded · 0 network calls'),400);
    setTimeout(()=>{say('I can open applications, work with your filesystem, change the desktop and report system state. Try one of the chips below, or type "help".','a')},900);
    stEl.classList.remove('warn');
    Achievements.bump('nexus');
    return {destroy:()=>cancelAnimationFrame(oraf),onResize(){}};
  }
};

/* ---------- EASTER EGGS ---------- */
