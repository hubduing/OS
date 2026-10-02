APPS.computer={
  title:'Computer',icon:ICONS.computer,desc:'This PC',w:820,h:580,
  build(w){
    w.body.innerHTML=`<div class="toolbar"><b style="font-size:13px">This PC</b>
      <span class="sp"></span>
      <button class="btn" data-a="refresh">${ICONS.reload} Refresh</button>
      <button class="btn" data-a="diag">${ICONS.cpu} Diagnostics</button></div>
      <div class="scroll" style="padding:20px 24px"></div>`;
    const main=w.body.querySelector('.scroll');
    function render(){
      const st=VFS.stats();
      main.innerHTML=`
        <div style="display:flex;gap:18px;align-items:center;padding:18px;border-radius:15px;
          background:linear-gradient(135deg,rgba(55,224,255,.12),rgba(176,107,255,.09));border:1px solid rgba(55,224,255,.24);margin-bottom:20px">
          <div style="width:66px;height:66px;flex:0 0 auto">${ICONS.computer}</div>
          <div style="flex:1">
            <b style="font-size:16px">NEXUS-STATION-01</b>
            <div style="font-size:12px;color:#8ea0bd;margin-top:4px">
              NEXUS OS 4.2.1 · ${Diag.cpuName()} · ${Diag.ramTotal} MB RAM</div>
            <div style="font-size:11.5px;color:#8ea0bd;margin-top:6px">Uptime ${Diag.uptimeStr()} · ${WM.wins.length} windows open</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:22px;font-weight:200;color:var(--accent)">${Diag.fps}</div>
            <div style="font-size:10px;color:#8ea0bd;letter-spacing:.14em">FPS</div>
          </div>
        </div>
        <h3 style="font-size:13px;margin:0 0 10px">Folders</h3>
        <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">
          ${['Desktop','Documents','Downloads','Pictures','Music','Videos','Games','Home'].map(p=>{
            const n=VFS.node('/'+p);
            if(!n)return '';
            return `<button class="card" data-open="files" data-path="/${p}">
              <span class="ic">${ICONS.folder}</span><b>${p}</b>
              <span>${(n.children||[]).length} items · ${fmtBytes(n.size||0)}</span></button>`}).join('')}
        </div>
        <h3 style="font-size:13px;margin:22px 0 10px">Devices</h3>
        <div style="border-radius:13px;overflow:hidden;border:1px solid rgba(255,255,255,.1)">
          ${[['Processor',Diag.cpuName(),ICONS.cpu,'Operational'],
             ['Memory',`${Diag.ram} / ${Diag.ramTotal} MB`,ICONS.grid,Diag.ram/Diag.ramTotal>.85?'High usage':'Operational'],
             ['Display',`${innerWidth}×${innerHeight} @${devicePixelRatio}×`,ICONS.mon,'Operational'],
             ['Audio',Audio2.ctx?Audio2.ctx.sampleRate+' Hz':'Idle',ICONS.media,Audio2.ctx?'Operational':'Standby'],
             ['Storage',`${fmtBytes(st.bytes)} of 512 MB virtual`,ICONS.files,st.bytes>450*1048576?'Nearly full':'Operational'],
             ['Network','NEXUS-LOCAL · 100%',ICONS.wifi,'Connected'],
             ['Battery',(60+40*Math.abs(Math.sin(Date.now()/90000))|0)+'% · Charging',ICONS.bat,'Charging']]
            .map(([n,v,ic,s])=>{
              const warn=s==='High usage'||s==='Nearly full';
              return `<div style="display:flex;align-items:center;gap:13px;padding:12px 15px;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02)">
                <span style="width:26px;height:26px;flex:0 0 auto;opacity:.8">${ic}</span>
                <div style="flex:1;min-width:0"><b style="font-size:12.5px;display:block">${n}</b>
                  <span style="font-size:11.5px;color:#8ea0bd">${esc(v)}</span></div>
                <span style="font-size:10.5px;color:${warn?'#ffc857':'#3ddc84'};font-family:var(--mono)">${s}</span>
              </div>`}).join('')}
        </div>
        <h3 style="font-size:13px;margin:22px 0 10px">Running applications</h3>
        ${WM.wins.length?`<div style="border-radius:13px;overflow:hidden;border:1px solid rgba(255,255,255,.1)">
          ${WM.wins.map(x=>`<div style="display:flex;align-items:center;gap:11px;padding:10px 15px;border-bottom:1px solid rgba(255,255,255,.06)">
            <span style="width:20px;height:20px;flex:0 0 auto">${x.icon}</span>
            <span style="flex:1;font-size:12.5px">${esc(x.title)}</span>
            <span style="font-size:10.5px;color:#8ea0bd;font-family:var(--mono)">${(28+Math.random()*80).toFixed(0)} MB (sim.)</span>
            <span style="font-size:10.5px;color:${x.min?'#8ea0bd':'#3ddc84'}">${x.min?'minimized':'running'}</span>
          </div>`).join('')}</div>`:'<p style="font-size:12.5px;color:#8ea0bd">No applications are open. Double-click a desktop icon to launch one.</p>'}
      `;
    }
    w.body.addEventListener('click',e=>{
      const b=e.target.closest('[data-a]');if(!b)return;
      if(b.dataset.a==='refresh'){render();toast('Refreshed')}
      else if(b.dataset.a==='diag')API.open('diagnostics');
      const c=e.target.closest('[data-open]');
      if(c)API.open(c.dataset.open,{path:c.dataset.path});
    });
    render();
    const un=Bus.on('fs',()=>{if(WM.get(w.id))render()});
    return {destroy:()=>un()};
  }
};
/* ---------- ACHIEVEMENT VIEWER ---------- */
