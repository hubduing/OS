APPS.terminal={
  title:'Terminal',icon:ICONS.terminal,desc:'NexusShell',w:800,h:500,
  build(w,opts){
    w.body.innerHTML=`<div class="termWrap">
      <div class="termOut" tabindex="0"></div>
      <div class="termIn"><span class="ps"></span><input spellcheck="false" autocomplete="off"><span class="cur"></span></div>
    </div>`;
    const wrap=w.body.querySelector('.termWrap'),
      out=w.body.querySelector('.termOut'),
      inp=w.body.querySelector('input'),
      ps=w.body.querySelector('.ps');
    const st={cwd:opts.cwd||'/Desktop',hist:LS.get('hist',[]),hi:-1,busy:false};
    let echoCursor=null;

    function promptStr(){return `<span style="color:#3ddc84">user@nexus</span>:<span style="color:#37e0ff">${st.cwd}</span>$`}
    function setPs(){ps.textContent=promptStr()}
    function print(html,cls){
      const d=el('div','termLine'+(cls?' '+cls:''),out);
      d.innerHTML=html;out.scrollTop=out.scrollHeight;
      return d;
    }
    function echoCmd(c){
      const d=el('div','termLine',out);
      d.innerHTML=`<span style="color:#3ddc84">user@nexus</span>:<span style="color:#37e0ff">${esc(st.cwd)}</span>$ <span class="t-wht">${esc(c)}</span><span class="cur" style="animation:none"></span>`;
      out.scrollTop=out.scrollHeight;
      return d.querySelector('.cur');
    }
    const argColors={help:'t-cyan',clear:'t-dim',pwd:'t-cyan',ls:'t-cyan',cd:'t-cyan',mkdir:'t-cyan',touch:'t-cyan',
      cat:'t-cyan',echo:'t-cyan',rm:'t-cyan',cp:'t-cyan',mv:'t-cyan',tree:'t-cyan',find:'t-cyan',date:'t-cyan',
      whoami:'t-cyan',history:'t-cyan',neofetch:'t-mag',calc:'t-cyan',open:'t-cyan',sysinfo:'t-cyan',
      matrix:'t-green',nw:'t-green',reboot:'t-red',secrets:'t-yel',theme:'t-mag',rmrf:'t-red',
      cowsay:'t-yel',banner:'t-mag',joke:'t-yel',fortune:'t-mag',matrix2:'t-green'};
    const CMDS={
      help:{
        d:'show this help',run(){
          const groups=[
            ['Filesystem','pwd ls cd mkdir touch cat rm cp mv tree find'],
            ['Content','echo open'],
            ['System','date whoami history sysinfo neofetch clear calc'],
            ['Fun','matrix banner cowsay joke fortune secrets nw'],
            ['Session','theme reboot']
          ];
          let h='\x1b[36mNEXUS Shell 1.0.0 — command reference\x1b[0m\n';
          groups.forEach(([g,cs])=>{
            h+=`\n\x1b[1m\x1b[36m  ${g}\x1b[0m\n`;
            cs.split(' ').forEach(c=>{
              h+=`    \x1b[32m${c.padEnd(10)}\x1b[0m\x1b[90m${(CMDS[c]&&CMDS[c].d)||'—'}\x1b[0m\n`;
            });
          });
          h+='\n\x1b[90m  Tab completes · ↑/↓ history · Ctrl+L clears · try "secrets" for a reason\x1b[0m';
          print(h);
        }},
      clear:{d:'clear the screen',run(){out.innerHTML=''}},
      pwd:{d:'print working directory',run(){print('\x1b[37m'+st.cwd+'\x1b[0m')}},
      ls:{d:'list directory (-a shows hidden)',run(a,red){
        const showAll=a.some(x=>/^-[a-zA-Z]*a/.test(x));
        const rest=a.filter(x=>!x.startsWith('-'));
        const p=rest[0]?VFS.norm(rest[0],st.cwd):st.cwd;
        const n=VFS.node(p);
        if(!n)return red('<x>ls: '+(rest[0]||'')+': not found</x>');
        if(n.type==='file')return red(lsLine(n));
        const ch=[...(n.children||[])].filter(x=>showAll||S.showHidden||x.name[0]!=='.')
          .sort((x,y)=>(x.type===y.type)?x.name.localeCompare(y.name):(x.type==='dir'?-1:1));
        if(!ch.length)return red('');
        red('\x1b[90m'+ch.length+' item'+(ch.length>1?'s':'')+'\x1b[0m\n'+ch.map(lsLine).join('\n'));
      }},
      cd:{d:'change directory',run(a,red){
        if(!a[0])return red('\x1b[37m'+st.cwd+'\x1b[0m');
        const p=a[0]==='~'?'/Home':a[0]==='-'?(st.prev||st.cwd):a[0];
        const n=VFS.node(p,st.cwd);
        if(!n)return red(`<x>cd: ${esc(a[0])}: no such directory</x>`);
        if(n.type!=='dir')return red(`<x>cd: ${esc(a[0])}: not a directory</x>`);
        st.prev=st.cwd;st.cwd=VFS.norm(p,st.cwd);setPs();
        Bus.emit('term-cwd',st.cwd);
      }},
      mkdir:{d:'create directory',run(a,red){
        if(!a[0])return red('<x>mkdir: missing operand</x>');
        a.forEach(x=>{const r=VFS.mkdir(x,st.cwd);r.err?red(`<x>mkdir: ${esc(x)}: ${r.err}</x>`):Bus.emit('fs')});
      }},
      touch:{d:'create empty file',run(a,red){
        if(!a[0])return red('<x>touch: missing operand</x>');
        a.forEach(x=>{const r=VFS.write(x,'',st.cwd);r.err?red(`<x>touch: ${esc(x)}: ${r.err}</x>`):Bus.emit('fs')});
        Achievements.grant('FIRST_FILE');
      }},
      cat:{d:'print file contents',run(a,red){
        if(!a[0])return red('<x>cat: missing operand</x>');
        a.forEach((f,i)=>{
          const n=VFS.node(f,st.cwd);
          if(!n)return red(`<x>cat: ${esc(f)}: no such file</x>`);
          if(n.type==='dir')return red(`<x>cat: ${esc(f)}: is a directory</x>`);
          // Any dot-segment in the resolved path makes it a hidden file.
          if(VFS.norm(f,st.cwd).split('/').some(s=>s[0]==='.')&&Eggs.mark('mystery'))
            red('\x1b[90m→ you are reading a file the file manager refuses to list\x1b[0m\n');
          red((i?'\n':'')+esc(n.content));
        });
      }},
      echo:{d:'print text (supports > file)',run(a,red,raw){
        const m=raw.match(/^echo\s+(.*?)\s*>\s*(\S+)\s*$/);
        if(m){
          const txt=m[1].replace(/^["']|["']$/g,'');
          const r=VFS.write(m[2],txt,st.cwd);
          r.err?red(`<x>echo: ${r.err}</x>`):(Bus.emit('fs'),print('\x1b[90m→ wrote '+fmtBytes((txt.length)*2)+' to '+esc(m[2])+'\x1b[0m'));
          return;
        }
        const m2=raw.match(/^echo\s+(.*?)\s*>>\s*(\S+)\s*$/);
        if(m2){
          const n=VFS.node(m2[2],st.cwd);
          const txt=(n&&n.type==='file'?n.content:'')+m2[1].replace(/^["']|["']$/g,'');
          VFS.write(m2[2],txt,st.cwd);Bus.emit('fs');
          return;
        }
        red(esc(raw.replace(/^echo\s*/,'').replace(/^["']|["']$/g,'')));
      }},
      rm:{d:'remove files',run(a,red){
        a.forEach(x=>{
          if(x==='-rf'||x==='-r'||x==='-f')return;
          const full=VFS.norm(x,st.cwd);
          if(full==='/'||full.startsWith('/Home/../'))return red('<x>rm: refusing to remove '+esc(full)+'</x>');
          const n=VFS.node(full);
          if(!n)return red(`<x>rm: ${esc(x)}: no such file</x>`);
          const r=VFS.rm(full,null,true);
          r.err?red(`<x>rm: ${esc(x)}: ${r.err}</x>`):Bus.emit('fs');
        });
      }},
      cp:{d:'copy files',run(a,red){
        if(a.length<2)return red('<x>cp: usage: cp SOURCE DEST</x>');
        const src=a[0], dst=VFS.norm(a[1],st.cwd);
        const dn=VFS.node(dst);
        let r;
        if(dn&&dn.type==='dir')r=VFS.copy(src,dst,st.cwd);
        else{
          r=VFS.copy(src,dst.replace(/\/[^/]+$/,'')||'/',st.cwd);
          if(!r.err){const rn=VFS.rename(r.path,a[1].split('/').pop(),null);if(rn.err)r=rn}
        }
        r.err?red(`<x>cp: ${r.err}</x>`):Bus.emit('fs');
      }},
      mv:{d:'move files',run(a,red){
        if(a.length<2)return red('<x>mv: usage: mv SOURCE DEST</x>');
        const dst=VFS.norm(a[1],st.cwd);const dn=VFS.node(dst);
        let r;
        if(dn&&dn.type==='dir')r=VFS.move(a[0],dst,st.cwd);
        else{
          r=VFS.move(a[0],dst.replace(/\/[^/]+$/,'')||'/',st.cwd);
          if(!r.err){const rn=VFS.rename(r.path,a[1].split('/').pop(),null);if(rn.err)r=rn}
        }
        r.err?red(`<x>mv: ${r.err}</x>`):Bus.emit('fs');
      }},
      tree:{d:'print directory tree',run(a,red){
        const p=a[0]||st.cwd;
        const n=VFS.node(p,st.cwd);
        if(!n)return red(`<x>tree: ${esc(p)}: not found</x>`);
        if(n.type==='file')return red(esc(n.name));
        red('\x1b[36m'+VFS.norm(p,st.cwd)+'\x1b[0m\n'+VFS.treeText(p,st.cwd,0,'',''));
      }},
      find:{d:'search for files',run(a,red){
        if(!a[0])return red('<x>find: usage: find NAME</x>');
        const r=VFS.search(a.join(' '));
        if(!r.length)return red('\x1b[90mno matches for "'+esc(a.join(' '))+'"\x1b[0m');
        red('\x1b[90m'+r.length+' match'+(r.length>1?'es':'')+':\x1b[0m\n'+r.map(x=>esc(x.path)+(x.node.type==='dir'?'/':'')).join('\n'));
      }},
      date:{d:'show date and time',run(a,red){red('<x>'+new Date().toString()+'</x>')}},
      whoami:{d:'print current user',run(a,red){red('<x>user</x> — uid=1000 groups=users,admin,nexus')}},
      history:{d:'command history',run(a,red){red(st.hist.slice(-40).map((h,i)=>`\x1b[90m${String(i+1).padStart(4)}\x1b[0m  ${esc(h)}`).join('\n')||'<x>no history</x>')}},
      neofetch:{d:'system summary with ASCII logo',run(){
        const stt=VFS.stats();
        const logo=`\x1b[36m        ▄▄▄▄▄▄▄▄▄▄        \x1b[0m
\x1b[36m     ▄█▀▀        ▀▀█▄     \x1b[0m
\x1b[36m   ▄█▀   \x1b[35m▄▄▄▄▄▄\x1b[0m   ▀█▄   \x1b[0m
\x1b[36m  ██   \x1b[35m█\x1b[36m      \x1b[35m█\x1b[0m   ██  \x1b[0m
\x1b[36m ██   \x1b[35m█\x1b[36m  \x1b[33m▄▄▄▄\x1b[0m  \x1b[35m█\x1b[0m   ██ \x1b[0m
\x1b[36m ██   \x1b[35m█\x1b[36m      \x1b[35m█\x1b[0m   ██ \x1b[0m
\x1b[36m  ██   \x1b[37m▀▀▀▀▀▀▀▀\x1b[0m   ██  \x1b[0m
\x1b[36m   ▀█▄            ▄█▀   \x1b[0m
\x1b[36m     ▀█▄▄▄▄▄▄▄▄▄▄█▀     \x1b[0m
\x1b[36m        ▀▀▀▀▀▀▀▀▀▀        \x1b[0m`;
        const info=[
          `\x1b[1m\x1b[36muser\x1b[0m@\x1b[1m\x1b[36mnexus\x1b[0m`,
          `\x1b[90m──────────────────────\x1b[0m`,
          `\x1b[33mOS\x1b[0m        NEXUS OS 4.2.1 (Web)`,
          `\x1b[33mKernel\x1b[0m    nexus-kernel 4.2.1`,
          `\x1b[33mUptime\x1b[0m    ${Diag.uptimeStr()}`,
          `\x1b[33mShell\x1b[0m     NexusShell 1.0.0`,
          `\x1b[33mDE\x1b[0m        NexusWM`,
          `\x1b[33mTheme\x1b[0m    ${S.theme} / ${S.wallpaper}`,
          `\x1b[33mTerminal\x1b[0m Web / Canvas`,
          `\x1b[33mCPU\x1b[0m      ${Diag.cpuName()} (${Diag.cpu}% load)`,
          `\x1b[33mGPU\x1b[0m      WebGL Canvas 2D Renderer`,
          `\x1b[33mMemory\x1b[0m   ${Diag.ram}MB / ${Diag.ramTotal}MB`,
          `\x1b[33mDisk\x1b[0m     ${fmtBytes(stt.bytes)} / 512MB (virtual)`,
          `\x1b[33mApps\x1b[0m     ${WM.wins.length} open, ${Object.keys(APPS).length} installed`,
          `\x1b[33mFiles\x1b[0m    ${stt.files} files, ${stt.dirs} folders`,
          `\x1b[33mAchv\x1b[0m     ${Achievements.total()}/${ACH_LIST.length}`,
          `\x1b[90m──────────────────────\x1b[0m`,
          `  \x1b[32m█\x1b[31m█\x1b[33m█\x1b[34m█\x1b[35m█\x1b[36m█\x1b[32m█\x1b[31m█\x1b[33m█\x1b[34m█\x1b[35m█\x1b[36m█\x1b[32m█\x1b[31m█\x1b[33m█\x1b[34m█\x1b[35m█\x1b[36m█\x1b[0m`,
          `  \x1b[37m█\x1b[37m█\x1b[37m█\x1b[37m█\x1b[37m█\x1b[37m█\x1b[37m█\x1b[37m█\x1b[37m█\x1b[37m█\x1b[37m█\x1b[37m█\x1b[37m█\x1b[37m█\x1b[37m█\x1b[37m█\x1b[37m█\x1b[37m█\x1b[0m`
        ];
        const rows=Math.max(logo.split('\n').length,info.length);
        let out='';
        for(let i=0;i<rows;i++)out+=(logo.split('\n')[i]||'').padEnd(30)+'  '+(info[i]||'')+'\n';
        print(out);
      }},
      calc:{d:'evaluate expression',run(a,red,raw){
        if(!a.length)return red('<x>calc: usage: calc 2+2*8</x>');
        const expr=raw.replace(/^calc\s*/,'');
        let v;
        try{v=Function('"use strict";return ('+expr.replace(/\^/g,'**')+')')()}
        catch(e){return red('<x>calc: invalid expression: '+esc(e.message)+'</x>')}
        if(typeof v!=='number'||!isFinite(v))return red('<x>calc: result is not a number</x>');
        red('\x1b[37m'+expr+' = \x1b[1m\x1b[36m'+v+'\x1b[0m');
        API.sendCalc(expr,v);
      }},
      open:{d:'open a file or app',run(a,red){
        if(!a[0])return red('<x>open: usage: open FILE|APP</x>');
        const t=a.join(' ');
        const n=VFS.node(t,st.cwd);
        if(n){n.type==='dir'?API.open('files',{path:VFS.norm(t,st.cwd)}):API.openFile(VFS.norm(t,st.cwd));return red('\x1b[90m→ opening '+esc(n.name)+'\x1b[0m')}
        const app=t.toLowerCase();
        if(APPS[app]){API.open(app);return red('\x1b[90m→ launching '+esc(APPS[app].title)+'\x1b[0m')}
        const alias=resolveApp(app);
        if(alias){API.open(alias,alias==='arcade'&&/snake|racer/.test(app)?{game:/racer/.test(app)?'racer':'snake'}:{});
          return red('\x1b[90m→ launching '+esc(APPS[alias].title)+'\x1b[0m')}
        if(APPS[app+'s'])return CMDS.open.run([app+'s'],red);
        if(APPS[app.replace(/s$/,'')])return CMDS.open.run([app.replace(/s$/,'')],red);
        red(`<x>open: ${esc(t)}: not found (try "open files", "open notes", "open snake")</x>`);
      }},
      sysinfo:{d:'detailed system report',run(){
        const s=VFS.stats();
        const rows=[
          ['Host','web-browser.local'],
          ['Kernel','nexus-kernel 4.2.1'],
          ['Uptime',Diag.uptimeStr()],
          ['CPU load',Diag.cpu+'% (simulated)'],
          ['Memory',Diag.ram+' / '+Diag.ramTotal+' MB (simulated)'],
          ['Frame rate',Diag.fps+' fps'],
          ['Processes',String(Diag.procCount())],
          ['Windows',WM.wins.length+' open'],
          ['Filesystem',s.files+' files / '+s.dirs+' dirs'],
          ['Content',fmtBytes(s.bytes)],
          ['Storage',fmtBytes(storageBytes)+' localStorage'],
          ['Display',innerWidth+'x'+innerHeight+' @'+devicePixelRatio+'x'],
          ['Audio',Audio2.ctx?Audio2.ctx.sampleRate+' Hz':'idle']
        ];
        const W=44,B=14;
        let box='\x1b[36m╔'+'═'.repeat(W)+'╗\x1b[0m\n';
        box+='\x1b[36m║\x1b[0m  \x1b[1mNEXUS SYSTEM REPORT\x1b[0m'+' '.repeat(W-21)+'\x1b[36m║\x1b[0m\n';
        box+='\x1b[36m╠'+'═'.repeat(W)+'╣\x1b[0m\n';
        rows.forEach(r=>{
          const line=('  '+r[0]).padEnd(B)+r[1];
          box+='\x1b[36m║\x1b[0m\x1b[90m'+line.slice(0,W-1).padEnd(W-1)+'\x1b[0m\x1b[36m║\x1b[0m\n';
        });
        box+='\x1b[36m╚'+'═'.repeat(W)+'╝\x1b[0m';
        print(box);
      }},
      theme:{d:'switch accent theme',run(a,red){
        if(!a[0])return red('\x1b[90mcurrent accent: '+S.accent+'\x1b[0m\n\x1b[90mavailable: '+ACCENTS.join(' ')+'\x1b[0m');
        const c=ACCENTS.find(x=>x.toLowerCase()===a[0].toLowerCase());
        if(!c)return red('<x>theme: unknown color</x>');
        setSetting('accent',c);red('\x1b[90m→ accent set to '+c+'\x1b[0m');
      }},
      secrets:{d:'?',run(){Eggs.mark('term-secrets');
        print('\x1b[33m  There is no manual for this.\x1b[0m\n\n'+
          '  \x1b[90mThings worth trying:\x1b[0m\n'+
          '    \x1b[32mmatrix\x1b[0m          it never ends\n'+
          '    \x1b[32mneofetch\x1b[0m        you have seen this\n'+
          '    \x1b[32mcowsay nexus\x1b[0m    say it out loud\n'+
          '    \x1b[32mfortune\x1b[0m         the oracle is online\n'+
          '    \x1b[32mnw\x1b[0m             ...\n'+
          '    \x1b[32mUP UP DOWN DOWN\x1b[0m  ← and so on\n'+
          '    \x1b[32m/.config/secret\x1b[0m  it is already there\n\n'+
          '\x1b[90m  6 secrets remain hidden in this shell. Type "help" for the rest.\x1b[0m');
      }},
      nw:{d:'?',run(){
        print('\x1b[35m  ███╗   ██╗\x1b[0m\n\x1b[35m  ████╗  ██║\x1b[0m\n\x1b[35m  ██╔██╗ ██║\x1b[0m\n\x1b[35m  ██║╚██╗██║\x1b[0m\n\x1b[35m  ██║ ╚████║\x1b[0m\n\x1b[35m  ╚═╝  ╚═══╝\x1b[0m\n\n  \x1b[90m  north-wind industries, est. 1984\x1b[0m');
        setTimeout(()=>{print('\x1b[31m  [CONNECTION LOST]\x1b[0m');Audio2.error()},900);
        Eggs.mark('nw');
      }},
      contact:{d:'?',run(a,red){
        const who=a.join(' ').trim();
        print('\x1b[36m  ┌──────────────────────────────────────────┐\x1b[0m');
        print('\x1b[36m  │\x1b[0m  \x1b[1mNEXUS // OUTBOUND COMMS\x1b[0m                  \x1b[36m│\x1b[0m');
        print('\x1b[36m  ├──────────────────────────────────────────┤\x1b[0m');
        print('\x1b[36m  │\x1b[0m  \x1b[90mchannel\x1b[0m     \x1b[33msub-ether\x1b[0m              \x1b[36m│\x1b[0m');
        print('\x1b[36m  │\x1b[0m  \x1b[90msignal\x1b[0m      \x1b[32mcarrier detected\x1b[0m         \x1b[36m│\x1b[0m');
        print('\x1b[36m  │\x1b[0m  \x1b[90morigin\x1b[0m      \x1b[35m0x2A.7F.04.E9\x1b[0m            \x1b[36m│\x1b[0m');
        print('\x1b[36m  └──────────────────────────────────────────┘\x1b[0m');
        if(who&&/dragon|wyrm|serpent/i.test(who)){
          print('\n\x1b[33m  A reply arrives, out of band.\x1b[0m');
          setTimeout(()=>{
            print('\x1b[35m                     ______\x1b[0m\n'+
              '\x1b[35m                _|/      \\_\x1b[0m\n'+
              '\x1b[35m                 |   ^   ^ |\x1b[0m\n'+
              '\x1b[35m                 |  \\_/_\\_/ |\x1b[0m\n'+
              '\x1b[35m                _|          |_\x1b[0m\n'+
              '\x1b[35m               |_____________|\x1b[0m');
            print('\x1b[90m  "you looked. most people stop at the wall."\x1b[0m');
            Audio2.tone(80,.7,'sawtooth',.1,55);
            Eggs.mark('dragon');
          },600);
        }else{
          print('\n\x1b[90m  No addressee. Try: contact dragon\x1b[0m');
        }
      }},
      banner:{d:'print NEXUS banner',run(){print(
        '\x1b[36m ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗\x1b[0m\n'+
        '\x1b[36m ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝\x1b[0m\n'+
        '\x1b[35m ██╔██╗ ██║███████╗ ╚███╔╝ ██║   ██║███████╗\x1b[0m\n'+
        '\x1b[35m ██║╚██╗██║╚════██║██╔██╗ ██║   ██║╚════██║\x1b[0m\n'+
        '\x1b[34m ██║ ╚████║███████║██║╚██╗╚██████╔╝███████║\x1b[0m\n'+
        '\x1b[34m ╚═╝  ╚═══╝╚══════╝╚═╝ ╚═╝ ╚═════╝ ╚══════╝\x1b[0m');}},
      cowsay:{d:'?',run(a){
        const m=a.join(' ').replace(/^["']|["']$/g,'')||'Mooo!';
        const L=Math.max(m.length,8);
        const top=' '+('_'.repeat(L+2));
        const mid='< '+m+' >';
        const bot=' '+('‾'.repeat(L+2));
        print('\x1b[33m'+top+'\x1b[0m\n\x1b[33m'+mid+'\x1b[0m\n\x1b[33m'+bot+'\x1b[0m\n'+
          '        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||');
        Audio2.tone(220,.35,'sawtooth',.10,110);
        Achievements.bump('term');
      }},
      joke:{d:'tell a joke',run(a,red){
        const j=[
          'Why did the developer go broke?\nBecause they used up all the cache.',
          'A byte walks into a bar looking miserable.\nThe bartender asks: "What\'s wrong?"\n"Not much. I just de-recompiled."',
          'There are 10 kinds of people in this OS:\nthose who understand binary, and those who don\'t.',
          'Why was the computer cold?\nIt left its Windows open.',
          'I would tell you a UDP joke, but you might not get it.'
        ];
        red('\x1b[37m'+j[(Math.random()*j.length)|0]+'\x1b[0m');
      }},
      fortune:{d:'consult the oracle',run(a,red){
        const f=['You will find the answer in ~/Projects.','Ship the feature. Then write the tests.','The bug is in the config you did not write.',
          'A window opened today will be closed by morning.','Value: measure twice, render once.',
          'The Konami code unlocks more than you think.','Your filesystem is 84% optimism.'];
        red('\x1b[33m'+f[(Math.random()*f.length)|0]+'\x1b[0m');
      }},
      reboot:{d:'restart NEXUS',run(){print('\x1b[33mRebooting NEXUS...\x1b[0m');setTimeout(()=>location.reload(),700)}},
      matrix:{d:'???',run(){
        print('Wake up, Neo…');
        st.matrices=(st.matrices||0)+1;
        if(st.matrices===2){
          print('\x1b[33m  There is no spoon.\x1b[0m');
          Eggs.mark('matrix2');
        }
        if(st.matrices>2)print('\x1b[90m  The rain does not stop. Neither does this.\x1b[0m');
        startMatrix();
      }}
    };
    function startMatrix(){
      if(wrap._mx)return;
      wrap._mx=true;wrap.classList.add('matrix');
      const cv=el('canvas','',wrap);cv.id='matrixCanvas';
      const c=cv.getContext('2d');
      const d=Math.min(devicePixelRatio||1,2);
      const fit=()=>{cv.width=wrap.clientWidth*d;cv.height=wrap.clientHeight*d;c.setTransform(d,0,0,d,0,0)};
      fit();
      const fs=15,cols=Math.ceil(cv.width/(fs*d)),drops=new Array(cols).fill(0).map(()=>Math.random()*-40);
      c.font=(fs*d)+'px monospace';
      let raf,t0=performance.now();
      const glyphs='ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789';
      const loop=()=>{
        raf=requestAnimationFrame(loop);
        const el2=(performance.now()-t0)/1000;
        if(el2>14){stopMatrix();print('\x1b[90mThe matrix continues without you.\x1b[0m');return}
        c.fillStyle='rgba(0,0,0,.07)';c.fillRect(0,0,cv.width,cv.height);
        for(let i=0;i<cols;i++){
          const ch=glyphs[(Math.random()*glyphs.length)|0];
          c.fillStyle=Math.random()>.97?'#dfffe8':'#25ff7a';
          c.fillText(ch,i*fs*d,drops[i]*fs*d);
          c.fillStyle='rgba(37,255,122,.4)';
          c.fillText(glyphs[(Math.random()*glyphs.length)|0],i*fs*d,(drops[i]-1)*fs*d);
          drops[i]+=.55+Math.random()*.7;
          if(drops[i]*fs*d>cv.height&&Math.random()>.975)drops[i]=-Math.random()*20;
        }
      };
      const stopMatrix=()=>{cancelAnimationFrame(raf);cv.remove();wrap.classList.remove('matrix');wrap._mx=false};
      w.api.matrixStop=stopMatrix;
      loop();
    }
    function lsLine(n){
      if(n.type==='dir')return `\x1b[1m\x1b[36m${n.name}/\x1b[0m`;
      const e=EXT_ICON[extOf(n.name)];
      const col=e==='code'?'\x1b[32m':e==='img'?'\x1b[35m':e==='aud'?'\x1b[33m':e==='vid'?'\x1b[34m':'\x1b[37m';
      return `${col}${n.name}\x1b[0m \x1b[90m${fmtBytes(n.size||0)}\x1b[0m`;
    }
    function run(raw){
      echoCursor&&echoCursor.remove();echoCursor=null;
      const line=raw.trim();
      if(!line){setPs();return}
      st.hist=st.hist.filter(h=>h!==line);
      st.hist.push(line);
      if(st.hist.length>200)st.hist.shift();
      LS.set('hist',st.hist.slice(-80));
      st.hi=st.hist.length;
      const parts=line.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)||[];
      const cmd=parts[0].toLowerCase();
      const a=parts.slice(1).map(s=>s.replace(/^["']|["']$/g,''));
      if(!CMDS[cmd]){
        print(`\x1b[31mnexus-sh: command not found: ${esc(cmd)}\x1b[0m\n\x1b[90mType "help" for the command list.\x1b[0m`);
        Audio2.tone(200,.1,'square',.05);
        setPs();return;
      }
      const lastLine=out.lastElementChild;
      let done=false;
      const red=(txt)=>{if(!done){done=true;print(txt)}};
      try{CMDS[cmd].run(a,red,line)}catch(e){red('<x>'+esc(e.message)+'</x>')}
      if(!done)print('');
      setPs();
      Achievements.bump('term');
      if(Achievements.counts.term>=25)Achievements.grant('TERMINAL_MASTER');
    }
    inp.addEventListener('keydown',e=>{
      Audio2.resume();
      if(e.key==='Enter'){const v=inp.value;inp.value='';run(v);return}
      if(e.key==='ArrowUp'){e.preventDefault();if(st.hi>0){st.hi--;inp.value=st.hist[st.hi]||''}return}
      if(e.key==='ArrowDown'){e.preventDefault();if(st.hi<st.hist.length-1){st.hi++;inp.value=st.hist[st.hi]||''}else{st.hi=st.hist.length;inp.value=''}return}
      if(e.key==='Tab'){
        e.preventDefault();
        const v=inp.value;const parts=v.split(' ');const last=parts[parts.length-1];
        const cmd=parts.length===1?last:parts[0];
        if(parts.length===1){
          const m=Object.keys(CMDS).filter(c=>c.startsWith(last.toLowerCase()));
          if(m.length===1)inp.value=m[0]+' ';
          else if(m.length>1)print('\x1b[90m'+m.join('  ')+'\x1b[0m');
        }else{
          const d=VFS.node(parts[0]==='cd'||parts[0]==='open'?st.cwd:st.cwd);
          const base=VFS.node(st.cwd);
          const pool=base?(base.children||[]).map(c=>c.name+(c.type==='dir'?'/':'')):[];
          const m=pool.filter(n=>n.toLowerCase().startsWith(last.toLowerCase()));
          if(m.length===1)inp.value=parts.slice(0,-1).join(' ')+' '+m[0];
          else if(m.length>1)print('\x1b[90m'+m.join('  ')+'\x1b[0m');
        }
        return;
      }
      if(e.ctrlKey&&e.key.toLowerCase()==='l'){e.preventDefault();out.innerHTML='';return}
      if(e.ctrlKey&&e.key.toLowerCase()==='c'){print('<x>^C</x>');inp.value='';echoCursor&&(echoCursor.style.display='none');return}
      if(e.ctrlKey&&e.key.toLowerCase()==='u'){e.preventDefault();inp.value='';return}
    });
    inp.addEventListener('input',()=>{if(!echoCursor)return;echoCursor.remove();echoCursor=null;
      echoCursor=echoCmd(inp.value)});
    out.addEventListener('click',()=>inp.focus());
    setPs();
    print(`\x1b[36mNEXUS Shell 1.0.0\x1b[0m  \x1b[90m(nexus-kernel 4.2.1)\x1b[0m
\x1b[90mType "help" for commands, "secrets" for a reason.\x1b[0m`);
    setTimeout(()=>inp.focus(),120);
    const un=Bus.on('fs',()=>{});
    return {destroy(){un();if(w.api.matrixStop)w.api.matrixStop()},onResize(){}};
  }
};

/* ---------- EDITOR ---------- */
