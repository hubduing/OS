const WM={
  wins:[], z:100, seq:0, focused:null,
  open(app,opts){
    opts=opts||{};
    if(opts.single!==false){
      const ex=this.wins.find(w=>w.app===app.id);
      if(ex){ if(ex.min)WM.restore(ex.id); WM.focus(ex.id); if(opts.onExisting)opts.onExisting(ex); return ex; }
    }
    const a=APPS[app.id]||app;
    const w={
      id:'w'+(++this.seq), app, title:a.title||app.id, icon:a.icon||ICONS.file,
      x:opts.x, y:opts.y, w:opts.w||a.w||820, h:opts.h||a.h||560,
      min:false, max:false, pre:{x:0,y:0,w:0,h:0}, body:null, api:null, resizable:a.resizable!==false
    };
    const d=el('div','win opening',$('#windows'));
    d.dataset.wid=w.id; d.innerHTML=
      `<div class="tbar"><div class="ic">${w.icon}</div><div class="ttl">${esc(w.title)}</div>
       <div class="wbtns">
         <button class="wbtn mn" title="Minimize">${ICONS.min}</button>
         <button class="wbtn mx" title="Maximize">${ICONS.max}</button>
         <button class="wbtn cl" title="Close">${ICONS.x}</button>
       </div></div><div class="wbody"></div>`;
    if(w.resizable){
      ['n','s','w','e','nw','ne','sw','se'].forEach(r=>el('div','rsz '+r,d));
    }else{
      // A maximize button that silently does nothing is worse than no button.
      d.querySelector('.mx').style.display='none';
    }
    w.el=d; w.body=d.querySelector('.wbody');
    this.wins.push(w);
    this.place(w);
    d.querySelector('.mn').onclick=e=>{e.stopPropagation();this.minimize(w.id)};
    d.querySelector('.mx').onclick=e=>{e.stopPropagation();this.toggleMax(w.id)};
    d.querySelector('.cl').onclick=e=>{e.stopPropagation();this.close(w.id)};
    d.querySelector('.tbar').addEventListener('dblclick',e=>{
      if(e.target.closest('.wbtn'))return;
      if(w.resizable)this.toggleMax(w.id);
    });
    d.addEventListener('pointerdown',()=>this.focus(w.id),true);
    this.dragify(w);
    if(w.resizable)this.resizify(w);
    w.api=APPS[app.id].build(w,opts)||{};
    if(w.api.onResize)w.api.onResize(w.w,w.h);
    d.addEventListener('transitionend',()=>d.classList.remove('opening','snapping'),{once:true});
    setTimeout(()=>d.classList.remove('opening'),240);
    this.focus(w.id);
    Audio2.open();
    Achievements.visit(app.id);
    this.renderTaskbar();
    return w;
  },
  /* Usable screen area. The taskbar overlays the viewport, so windows must be
     laid out inside what is left over — otherwise a maximized or snapped
     window hides its bottom rows (and its resize grip) behind the bar. */
  workArea(){
    const bar=$('#taskbar');
    /* offsetParent is null for position:fixed, so measure the box instead. */
    let tb=0;
    if(bar){const r=bar.getBoundingClientRect();if(r.height>0)tb=r.height}
    const top=S.taskbarPos==='top';
    return {x:0,y:top?tb:0,w:innerWidth,h:Math.max(200,innerHeight-(top?0:tb))};
  },
  place(w){
    const A=this.workArea();
    if(w.x==null){
      const n=this.wins.length;
      const W=A.w-80,H=A.h-120;
      w.w=Math.min(w.w,W); w.h=Math.min(w.h,H);
      w.x=Math.max(12,Math.round((W-w.w)/2)+((n-1)%6)*26-70);
      w.y=Math.max(8,A.y+Math.round((H-w.h)/2.4)+((n-1)%6)*24-40);
    }
    w.w=Math.max(280,Math.min(w.w,A.w-16));
    w.h=Math.max(160,Math.min(w.h,A.h-80));
    w.x=clamp(w.x,-w.w+90,A.w-90);
    w.y=clamp(w.y,A.y,A.y+A.h-70);
    this.applyGeo(w);
  },
  applyGeo(w){
    const A=this.workArea();
    if(w.max){
      w.el.style.left=A.x+'px';w.el.style.top=A.y+'px';
      w.el.style.width=A.w+'px';w.el.style.height=A.h+'px';
    }else{
      w.el.style.left=w.x+'px';w.el.style.top=w.y+'px';
      w.el.style.width=w.w+'px';w.el.style.height=w.h+'px';
    }
    if(w.api&&w.api.onResize)w.api.onResize(w.max?A.w:w.w, w.max?A.h:w.h);
  },
  /* Programmatic snap — the drag handler uses the same geometry. */
  snap(id,zone){
    const w=this.wins.find(x=>x.id===id); if(!w)return false;
    const A=this.workArea();
    if(w.max){w.max=false;w.el.classList.remove('max');Object.assign(w,w.pre||{})}
    if(zone==='max'){this.toggleMax(id);return true}
    if(zone==='left')      {w.x=A.x;            w.y=A.y;             w.w=Math.round(A.w/2); w.h=A.h;}
    else if(zone==='right') {w.x=A.x+Math.round(A.w/2); w.y=A.y;      w.w=Math.round(A.w/2); w.h=A.h;}
    else if(zone==='max')   {this.toggleMax(id);return true;}
    else                    {w.x=A.x;            w.y=A.y+Math.round(A.h/2); w.w=A.w; w.h=Math.round(A.h/2);}
    w.el.classList.add('snapping');
    this.applyGeo(w);this.focus(id);
    setTimeout(()=>w.el.classList.remove('snapping'),180);
    return true;
  },
  dragify(w){
    const bar=w.el.querySelector('.tbar');
    let sx,sy,ox,oy,snapZone=null,dragWin=false;
    bar.addEventListener('pointerdown',e=>{
      if(e.target.closest('.wbtn'))return;
      if(e.button!==0)return;
      dragWin=true; sx=e.clientX; sy=e.clientY;
      if(w.max){
        const ratio=(e.clientX)/innerWidth;
        w.max=false; w.el.classList.remove('max');
        w.w=Math.min(940,innerWidth-40); w.h=Math.min(640,innerHeight-110);
        w.x=clamp(e.clientX-w.w*ratio,0,innerWidth-120); w.y=Math.max(0,e.clientY-16);
        this.applyGeo(w);
      }
      ox=w.x; oy=w.y;
      bar.setPointerCapture(e.pointerId);
      w.el.classList.add('snapping');
    });
    bar.addEventListener('pointermove',e=>{
      if(!dragWin)return;
      const dx=e.clientX-sx, dy=e.clientY-sy;
      w.x=ox+dx; w.y=Math.max(0,oy+dy);
      w.el.style.left=w.x+'px'; w.el.style.top=w.y+'px';
      const z=this.snapTarget(e.clientX,e.clientY);
      const h=$('#snapHint');
      if(z){h.classList.add('on');
        const p=this.snapRect(z);
        Object.assign(h.style,{left:p.x+'px',top:p.y+'px',width:p.w+'px',height:p.h+'px'});
        snapZone=z;
      } else {h.classList.remove('on');snapZone=null}
    });
    const end=e=>{
      if(!dragWin)return;dragWin=false;
      w.el.classList.remove('snapping');
      $('#snapHint').classList.remove('on');
      if(snapZone){
        this.snap(w.id,snapZone);
      }else{
        const A=this.workArea();
        w.x=clamp(w.x,-w.w+90,A.w-90);
        w.y=clamp(w.y,A.y,A.y+A.h-70);
        this.applyGeo(w);
      }
      snapZone=null;
    };
    bar.addEventListener('pointerup',end);
    bar.addEventListener('pointercancel',end);
    // double-click titlebar empty area already handled
  },
  snapTarget(x,y){
    const A=this.workArea(),T=18;
    if(y<=A.y+T)return 'max';
    if(x<=T)return 'left';
    if(x>=innerWidth-T)return 'right';
    if(y>=A.y+A.h-T)return 'bottom';
    return null;
  },
  /* Preview geometry — must match snap() exactly or the ghost lies. */
  snapRect(z){
    const A=this.workArea(),hw=Math.round(A.w/2),hh=Math.round(A.h/2);
    if(z==='left')  return{x:A.x,y:A.y,w:hw,h:A.h};
    if(z==='right') return{x:A.x+hw,y:A.y,w:hw,h:A.h};
    if(z==='bottom')return{x:A.x,y:A.y+hh,w:A.w,h:hh};
    return{x:A.x,y:A.y,w:A.w,h:A.h};
  },
  resizify(w){
    let active=false,dir='',sx,sy,og;
    w.el.querySelectorAll('.rsz').forEach(h=>{
      h.addEventListener('pointerdown',e=>{
        e.stopPropagation();
        if(w.max){w.max=false;w.el.classList.remove('max')}
        active=true;dir=h.className.split(' ')[1];
        sx=e.clientX;sy=e.clientY;og={x:w.x,y:w.y,w:w.w,h:w.h};
        h.setPointerCapture(e.pointerId);
        w.el.classList.add('snapping');
      });
      h.addEventListener('pointermove',e=>{
        if(!active)return;
        const dx=e.clientX-sx, dy=e.clientY-sy, M=260, MINW=280, MINH=160;
        if(dir.includes('e'))w.w=clamp(og.w+dx,MINW,innerWidth-og.x-4);
        if(dir.includes('s'))w.h=clamp(og.h+dy,MINH,innerHeight-og.y-4);
        if(dir.includes('w')){const nw=clamp(og.w-dx,MINW,og.x+og.w-4);w.x=og.x+(og.w-nw);w.w=nw}
        if(dir.includes('n')){const nh=clamp(og.h-dy,MINH,og.y+og.h-56);w.y=og.y+(og.h-nh);w.h=nh}
        this.applyGeo(w);
      });
      const up=()=>{if(active){active=false;w.el.classList.remove('snapping');
        if(w.api&&w.api.onResize)w.api.onResize(w.w,w.h)}};
      h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up);
    });
  },
  focus(id){
    const w=this.wins.find(x=>x.id===id); if(!w)return;
    if(w.min){w.min=false;w.el.classList.remove('min')}
    if(this.focused===id){w.el.style.zIndex=++this.z;return}
    this.focused=id;
    this.wins.forEach(x=>x.el.classList.toggle('focus',x.id===id));
    w.el.style.zIndex=++this.z;
    this.renderTaskbar();
  },
  minimize(id){
    const w=this.wins.find(x=>x.id===id);if(!w)return;
    w.min=true;w.el.classList.add('min');
    setTimeout(()=>{if(w.min)w.el.style.display='none'},200);
    if(this.focused===id){
      this.focused=null;
      const nxt=this.wins.filter(x=>!x.min).sort((a,b)=>(+b.el.style.zIndex)-(+a.el.style.zIndex))[0];
      if(nxt)this.focus(nxt.id);
    }
    Audio2.close();
    this.renderTaskbar();
  },
  restore(id){
    const w=this.wins.find(x=>x.id===id);if(!w)return;
    w.min=false;w.el.style.display='';w.el.classList.remove('min');
    this.focus(id);
  },
  toggleMax(id){
    const w=this.wins.find(x=>x.id===id);if(!w||!w.resizable)return;
    if(w.max){w.max=false;w.el.classList.remove('max');
      Object.assign(w,w.pre);
    }else{
      w.pre={x:w.x,y:w.y,w:w.w,h:w.h};
      w.max=true;w.el.classList.add('max');
    }
    w.el.classList.add('snapping');
    this.applyGeo(w);
    Audio2.click();
  },
  close(id){
    const i=this.wins.findIndex(x=>x.id===id);if(i<0)return;
    const w=this.wins[i];
    if(w.api&&w.api.destroy){try{w.api.destroy()}catch(e){}}
    w.el.classList.add('closing');
    Audio2.close();
    setTimeout(()=>w.el.remove(),160);
    this.wins.splice(i,1);
    if(this.focused===id){
      this.focused=null;
      const nxt=this.wins.filter(x=>!x.min).sort((a,b)=>(+b.el.style.zIndex)-(+a.el.style.zIndex))[0];
      if(nxt)this.focus(nxt.id);
    }
    this.renderTaskbar();
  },
  get(id){return this.wins.find(x=>x.id===id)},
  cycle(){
    const list=this.wins.filter(w=>!w.min);
    if(!list.length)return;
    const sorted=list.sort((a,b)=>(+b.el.style.zIndex)-(+a.el.style.zIndex));
    const nxt=sorted[1]||sorted[0];
    this.focus(nxt.id);
    if(sorted.length>1)toast(sorted.length>2?'Cycle window: '+nxt.title:'Cycle window: '+nxt.title);
  },
  minimizeAll(){this.wins.filter(w=>!w.min).forEach(w=>this.minimize(w.id))},
  closeAll(){[...this.wins].forEach(w=>this.close(w.id))},
  renderTaskbar(){
    const t=$('#taskItems');t.innerHTML='';
    this.wins.forEach(w=>{
      const b=el('button','titem'+(this.focused===w.id?' active':''),t);
      b.innerHTML=`<span class="ic">${w.icon}</span><span class="tt">${esc(w.title)}</span><span class="und"></span>`;
      b.title=w.title;
      b.onclick=()=>{
        Audio2.click();
        if(this.focused===w.id&&!w.min)this.minimize(w.id);
        else if(w.min)this.restore(w.id);
        else this.focus(w.id);
      };
      b.oncontextmenu=e=>{
        e.preventDefault();
        ctxMenu(e.clientX,e.clientY,[
          {label:w.min?'Restore':'Minimize',icon:ICONS.min,act:()=>w.min?this.restore(w.id):this.minimize(w.id)},
          {label:w.max?'Restore Down':'Maximize',icon:ICONS.max,act:()=>this.toggleMax(w.id),dis:w.resizable===false},
          {sep:1},
          {label:'Close',icon:ICONS.x,act:()=>this.close(w.id)}
        ],'Window: '+w.title);
      };
    });
  },
  reflow(){
    const A=this.workArea();
    this.wins.forEach(w=>{
      if(w.max){this.applyGeo(w);return}
      if(w.x>A.w-90)w.x=Math.max(A.x,A.w-w.w-10);
      if(w.y>A.y+A.h-60)w.y=Math.max(A.y,A.y+A.h-70);
      w.w=Math.min(w.w,A.w-16);
      w.h=Math.min(w.h,A.h-80);
      this.applyGeo(w);
    });
  }
};
addEventListener('resize',()=>WM.reflow());

/* ---------- CONTEXT MENU ---------- */
let openCtx=null;
function ctxMenu(x,y,items,title){
  closeCtx();
  const m=el('div','ctx');document.body.appendChild(m);
  if(title)m.appendChild(Object.assign(el('div','title'),{textContent:title}));
  items.forEach(it=>{
    if(it.sep){el('hr','',m);return}
    const b=el('button','',m);
    b.innerHTML=(it.icon||'')+`<span>${esc(it.label)}</span>`+(it.key?`<span class="k">${esc(it.key)}</span>`:'');
    if(it.dis)b.style.opacity=.35;
    b.onclick=e=>{e.stopPropagation();closeCtx();Audio2.click();it.act&&it.act()};
    m.appendChild(b);
  });
  m.style.left='0px';m.style.top='0px';
  const r=m.getBoundingClientRect();
  m.style.left=Math.min(x,innerWidth-r.width-8)+'px';
  m.style.top=Math.min(y,innerHeight-r.height-8)+'px';
  openCtx=m;
  setTimeout(()=>document.addEventListener('pointerdown',ctxOutside),true);
  return m;
}
function ctxOutside(e){if(openCtx&&!openCtx.contains(e.target))closeCtx()}
function closeCtx(){if(openCtx){openCtx.remove();openCtx=null;document.removeEventListener('pointerdown',ctxOutside,true)}}

/* ---------- DESKTOP ICONS ---------- */
