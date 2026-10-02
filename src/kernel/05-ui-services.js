const Bus={
  m:{},
  on(k,f){(this.m[k]=this.m[k]||[]).push(f);return()=>this.off(k,f)},
  off(k,f){const a=this.m[k]||[];const i=a.indexOf(f);if(i>=0)a.splice(i,1)},
  emit(k,d){(this.m[k]||[]).slice().forEach(f=>{try{f(d)}catch(e){console.warn(e)}})}
};

/* ---------- TOAST / DIALOGS ---------- */
function toast(msg,icon){
  const t=$('#toast');
  t.innerHTML=(icon?`<span style="width:15px;height:15px;display:inline-grid">${icon}</span>`:'')+esc(msg);
  t.classList.add('on');
  clearTimeout(toast._t);
  toast._t=setTimeout(()=>t.classList.remove('on'),2200);
}
let modalResolve=null;
function dialog(o){
  return new Promise(res=>{
    modalResolve=res;
    $('#mdlIc').innerHTML=o.icon||ICONS.info;
    $('#mdlTitle').textContent=o.title||'NEXUS';
    $('#mdlText').textContent=o.text||'';
    const b=$('#mdlBody');b.innerHTML='';
    if(o.body)b.appendChild(o.body);
    b.style.display=o.body?'':'none';
    const f=$('#mdlFoot');f.innerHTML='';
    (o.buttons||[{label:'OK',value:true,pri:true}]).forEach(btn=>{
      const bt=el('button','btn'+(btn.pri?' pri':'')+(btn.danger?' dgr':''),f);
      bt.textContent=btn.label;
      bt.onclick=()=>{closeDialog();Audio2.click();res(btn.value)};
    });
    $('#modalWrap').classList.add('on');
    setTimeout(()=>{const i=f.querySelector('.pri');if(i)i.focus()},40);
  });
}
function closeDialog(){$('#modalWrap').classList.remove('on');modalResolve=null}
function prompt2(title,text,val,okLabel){
  return new Promise(res=>{
    const b=el('div','',$('#mdlBody'));
    b.style.display='';
    const i=el('input','inp',b);i.value=val||'';i.style.width='100%';
    dialog({title,text,icon:ICONS.pencil,body:b,
      buttons:[{label:'Cancel',value:null},{label:okLabel||'OK',value:'__',pri:true}]})
      .then(v=>{if(v==='__')setTimeout(()=>res(i.value),0);else res(null)});
  });
}
function confirmBox(title,text,danger){
  return dialog({title,text,icon:danger?ICONS.warn:ICONS.info,
    buttons:[{label:'Cancel',value:false},{label:danger?'Delete':'OK',value:true,pri:!danger,danger}]});
}
$('#modalWrap').addEventListener('pointerdown',e=>{if(e.target.id==='modalWrap')closeDialog()});

/* ---------- NOTIFICATIONS ---------- */
const Notify={
  list:LS.get('notifs',[]),
  save(){LS.set('notifs',this.list.slice(0,60))},
  send(title,body,opt){
    opt=opt||{};
    const n={id:'nt'+Date.now()+Math.random().toString(36).slice(2,6),title,body,app:opt.app||null,
      icon:opt.icon||ICONS.nexus,time:Date.now(),kind:opt.kind||'info'};
    this.list.unshift(n);
    if(this.list.length>60)this.list.length=60;
    this.save();
    this.render();
    toast(title,opt.icon);
    Audio2.notify();
    const w=$('#notifWrap');
    const d=el('div','notif'+(opt.kind==='ach'?' ach':''),w);
    d.innerHTML=`<div class="ic">${n.icon}</div><div class="tx"><b>${esc(title)}</b><span>${esc(body)}</span></div>`;
    d.onclick=()=>{dismiss(d);if(opt.app)API.open(opt.app);else if(opt.onClick)opt.onClick()};
    setTimeout(()=>dismiss(d),opt.ach?6500:4600);
    while(w.children.length>5)dismiss(w.children[0],true);
    return n;
  },
  render(){
    const l=$('#ncList');l.innerHTML='';
    if(!this.list.length){l.innerHTML=`<div class="empty" style="color:#8ea0bd;padding:34px 10px">
      <div style="width:44px;height:44px;opacity:.35">${ICONS.bell}</div><b>No notifications</b>
      <span>You're all caught up. Actions across NEXUS will appear here.</span></div>`;return}
    this.list.forEach(n=>{
      const d=el('div','ncItem',l);
      d.innerHTML=`<span class="tm">${ago(n.time)}</span><b>${esc(n.title)}</b><span>${esc(n.body)}</span>`;
      d.onclick=()=>{if(n.app)API.open(n.app);if(n.path)API.openFile(n.path)};
    });
  },
  clear(){this.list=[];this.save();this.render();$('#trayBell').classList.remove('badge');$('#trayBell').removeAttribute('data-n')}
};
function dismiss(d,instant){
  if(!d||d._out)return;d._out=1;
  if(instant){d.remove();return}
  d.classList.add('out');setTimeout(()=>d.remove(),300);
}
function ago(t){
  const s=(Date.now()-t)/1000;
  if(s<60)return Math.max(1,Math.floor(s))+'s ago';
  if(s<3600)return Math.floor(s/60)+'m ago';
  if(s<86400)return Math.floor(s/3600)+'h ago';
  return Math.floor(s/86400)+'d ago';
}
$('#trayBell').innerHTML=ICONS.bell;
$('#trayNet').innerHTML=ICONS.wifi;
$('#trayVol').innerHTML=ICONS.vol;
$('#trayBat').innerHTML=ICONS.bat;

/* ---------- ACHIEVEMENTS ---------- */
