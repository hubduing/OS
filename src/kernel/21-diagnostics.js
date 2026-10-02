const Diag={
  boot:Date.now(),fps:60,cpu:12,ram:420,ramTotal:2048,
  hist:new Array(60).fill(0),histT:0,lastFrame:0,frames:0,full:false,
  cpuName(){return ['NexusCore i9-13900H (simulated)','NXR-8 Quantum Core (simulated)',
    'Vortex R9 5900X (simulated)','Photon A2-880 (simulated)'][0]},
  uptimeMs(){return Date.now()-this.boot},
  uptimeStr(){
    const s=this.uptimeMs()/1000|0;
    const h=s/3600|0,m=(s%3600)/60|0,ss=s%60;
    return (h?h+'h ':'')+(h||m?m+'m ':'')+ss+'s';
  },
  procCount(){
    const base=['kernel','init','compositor','wm','audio','input','compositor-gpu','event-loop','indexer','tray'];
    return base.length+WM.wins.length+(Wall.running?2:0)+Object.keys(APPS).length;
  },
  tick(ts){
    if(this.lastFrame){
      this.frames++;
      if(ts-this.lastFrame>=1000){
        this.fps=Math.round(this.frames*1000/(ts-this.lastFrame));
        this.frames=0;this.lastFrame=ts;
        this.sample();
      }
    }else this.lastFrame=ts;
    if(this.full)this.render();
  },
  sample(){
    const load=clamp(6+WM.wins.length*7+Math.random()*22+(this.fps<40?18:0),2,99);
    this.cpu=Math.round(this.cpu*0.6+load*0.4);
    const fs=VFS.stats();
    const used=340+WM.wins.length*78+Math.min(320,fs.bytes/900)+Math.random()*60;
    this.ram=Math.round(used);
    this.hist.push(this.cpu);this.hist.shift();
  },
  bars(){
    return [['CPU',this.cpu,100,'%'],['RAM',Math.round(this.ram/this.ramTotal*100),100,'%'],
      ['Storage',clamp(Math.round((storageBytes+this.ram*2048)/(512*1048576)*100),1,100),100,'%'],
      ['Frame rate',clamp(this.fps,0,120),120,' fps']];
  },
  sparkHTML(){
    return `<div class="dgBox" style="grid-column:1/-1">
      <h4>CPU load history (simulated)</h4>
      <canvas id="dgSpark" width="600" height="56"></canvas></div>`;
  },
  drawSpark(){
    const c=document.getElementById('dgSpark');if(!c)return;
    const d=window.devicePixelRatio||1;
    const W=c.clientWidth||600,H=56;
    c.width=W*d;c.height=H*d;
    const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);
    x.clearRect(0,0,W,H);
    x.strokeStyle='rgba(55,224,255,.13)';x.lineWidth=1;
    for(let i=1;i<4;i++){x.beginPath();x.moveTo(0,H*i/4);x.lineTo(W,H*i/4);x.stroke()}
    x.beginPath();
    this.hist.forEach((v,i)=>{const px=i/(this.hist.length-1)*W, py=H-(v/100)*H});
    this.hist.forEach((v,i)=>{const px=i/(this.hist.length-1)*W,py=H-(v/100)*H;
      i?x.lineTo(px,py):x.moveTo(px,py)});
    x.strokeStyle='#37e0ff';x.lineWidth=1.6;x.shadowColor='#37e0ff';x.shadowBlur=8;x.stroke();
    x.shadowBlur=0;
    x.lineTo(W,H);x.lineTo(0,H);x.closePath();
    const g=x.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'rgba(55,224,255,.28)');g.addColorStop(1,'rgba(55,224,255,0)');
    x.fillStyle=g;x.fill();
  },
  gridHTML(){
    const fs=VFS.stats();
    return this.sparkHTML()+`
      ${this.bars().map(([n,v,mx,u])=>`
        <div class="dgBox"><h4>${n}</h4>
          <div class="dgBar ${v/mx>.8?'warn':''}"><i style="width:${clamp(v/mx*100,0,100)}%"></i></div>
          <div class="dgRow"><span>${n==='Frame rate'?'Frame rate':n+' load'}</span><b>${v}${u}</b></div>
          <div class="dgRow"><span>Peak</span><b>${n==='Frame rate'?'60 fps':(mx)+u}</b></div>
        </div>`).join('')}
      <div class="dgBox"><h4>System</h4>
        <div class="dgRow"><span>Uptime</span><b>${this.uptimeStr()}</b></div>
        <div class="dgRow"><span>Processes</span><b>${this.procCount()}</b></div>
        <div class="dgRow"><span>Windows</span><b>${WM.wins.length}</b></div>
        <div class="dgRow"><span>Boot time</span><b>${fmtHMS(new Date(this.boot))}</b></div>
      </div>
      <div class="dgBox"><h4>Memory</h4>
        <div class="dgRow"><span>Used (sim.)</span><b>${this.ram} MB</b></div>
        <div class="dgRow"><span>Total</span><b>${this.ramTotal} MB</b></div>
        <div class="dgRow"><span>Free</span><b>${this.ramTotal-this.ram} MB</b></div>
        <div class="dgRow"><span>Heap nodes</span><b>${(performance.memory?(performance.memory.usedJSHeapSize/1048576).toFixed(0):'n/a')} MB</b></div>
      </div>
      <div class="dgBox"><h4>Filesystem</h4>
        <div class="dgRow"><span>Files</span><b>${fs.files}</b></div>
        <div class="dgRow"><span>Folders</span><b>${fs.dirs}</b></div>
        <div class="dgRow"><span>Content</span><b>${fmtBytes(fs.bytes)}</b></div>
        <div class="dgRow"><span>Depth</span><b>${fs.deepest}</b></div>
      </div>
      <div class="dgBox"><h4>Storage</h4>
        <div class="dgRow"><span>localStorage</span><b>${fmtBytes(storageBytes)}</b></div>
        <div class="dgRow"><span>Keys</span><b>${(()=>{try{let n=0;for(let i=0;i<localStorage.length;i++)if((localStorage.key(i)||'').startsWith('nexus.'))n++;return n}catch(e){return 0}})()}</b></div>
        <div class="dgRow"><span>Notifications</span><b>${Notify.list.length}</b></div>
        <div class="dgRow"><span>Achievements</span><b>${Achievements.total()}/${ACH_LIST.length}</b></div>
      </div>
      <div class="dgBox" style="grid-column:1/-1"><h4>Active processes (simulated)</h4>
        ${this.procTableHTML()}</div>`;
  },
  procTableHTML(){
    const base=[['kernel',0.4,12],['init',0.2,4],['nexuswm',0.9,64],['compositor',1.4,96],
      ['audio.service',0.3,18],['input.service',0.1,8],['indexer',0.6,42],['tray',0.2,10]];
    const wins=WM.wins.map(x=>['app:'+x.app.id,0.3+Math.random()*.5,28+Math.random()*70]);
    const rows=base.concat(wins);
    return `<div style="max-height:210px;overflow:auto"><table style="width:100%;font-size:11px;border-collapse:collapse">`+
      rows.map(([n,c,m])=>`<tr style="border-bottom:1px solid rgba(55,224,255,.08)">
        <td style="padding:4px 6px;color:#8ea0bd">${esc(n)}</td>
        <td style="padding:4px 6px;width:90px">${c.toFixed(1)}%</td>
        <td style="padding:4px 6px;width:80px;text-align:right">${m.toFixed(0)} MB</td>
        <td style="padding:4px 6px;width:70px;text-align:right;color:#3ddc84">running</td></tr>`).join('')+
      `</table></div>`;
  },
  render(){
    const g=document.getElementById(this.full?'dgFullGrid':'diagGrid');
    if(!g)return;
    g.innerHTML=this.gridHTML();
    this.drawSpark();
  },
  toggleFull(){
    this.full=!this.full;
    $('#dgFull').classList.toggle('on',this.full);
    if(this.full)this.render();
    Achievements.grant('DIAGNOSED');
  }
};
APPS.diagnostics={
  title:'System Monitor',icon:ICONS.mon,desc:'Live resource view',w:840,h:620,
  build(w){
    w.body.innerHTML=`<div class="dg"><div class="dgTop">
      <b>NEXUS // SYSTEM MONITOR</b>
      <span>values marked (sim.) are generated from live OS activity, not real hardware</span>
    </div><div class="dgGrid" id="diagGrid"></div></div>`;
    Diag.render();
    const t=setInterval(()=>{if(WM.get(w.id))Diag.render()},1100);
    return {destroy:()=>clearInterval(t)};
  }
};
