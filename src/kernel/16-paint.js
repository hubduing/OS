APPS.paint={
  title:'Paint',icon:ICONS.paint,desc:'NexusCanvas',w:1000,h:680,
  build(w){
    w.body.innerHTML=`<div class="pt">
      <div class="ptTools"></div>
      <div class="ptSide">
        <div class="ptColors"></div>
        <label>Brush size <b data-sizel>6</b></label>
        <input type="range" min="1" max="60" value="6" data-size>
        <label>Opacity <b data-opl>100</b>%</label>
        <input type="range" min="5" max="100" value="100" data-op>
        <label>Fill mode</label>
        <select class="inp" data-fillmode style="width:100%">
          <option value="solid">Solid</option><option value="outline">Outline</option></select>
      </div>
      <div class="ptCanvasWrap"><canvas id="ptCanvas" width="900" height="560"></canvas></div>
    </div>`;
    const cv=w.body.querySelector('#ptCanvas'),
      ctx=cv.getContext('2d',{willReadFrequently:true}),
      toolsEl=w.body.querySelector('.ptTools'),
      colorsEl=w.body.querySelector('.ptColors');
    const PALETTE=['#000000','#ffffff','#37e0ff','#b06bff','#ff4d9d','#3ddc84','#ffc857','#ff6b35',
      '#6fb0ff','#8ea0bd','#1a2740','#e8f1ff','#ff2e63','#00ffc8','#ffe066','#c0ff2e'];
    const TOOLS=[['pencil','Pencil',ICONS.pencil],['brush','Brush',ICONS.brush],['eraser','Eraser',ICONS.eraser],
      ['line','Line',ICONS.line],['rect','Rectangle',ICONS.rect],['circle','Circle',ICONS.circ],
      ['fill','Fill',ICONS.fill],['picker','Color picker',ICONS.dropper]];
    const st={tool:'pencil',color:'#37e0ff',size:6,op:1,fillMode:'solid',drawing:false,
      start:null,snapshot:null,undo:[],redo:[]};
    TOOLS.forEach(([id,nm,ic])=>{
      const b=el('button','ptTool'+(id===st.tool?' on':''),toolsEl);
      b.innerHTML=ic;b.title=nm;
      b.onclick=()=>{st.tool=id;$$('.ptTool',toolsEl).forEach(x=>x.classList.toggle('on',x===b));
        w.el.querySelector('.ttl').textContent='Paint — '+nm};
    });
    PALETTE.forEach(c=>{
      const s=el('div','sw'+(c===st.color?' on':''),colorsEl);
      s.style.background=c;s.title=c;
      s.onclick=()=>{st.color=c;$$('.sw',colorsEl).forEach(x=>x.classList.toggle('on',x===s))};
    });
    const sizeInp=w.body.querySelector('[data-size]'),
      opInp=w.body.querySelector('[data-op]'),
      fillInp=w.body.querySelector('[data-fillmode]');
    sizeInp.oninput=()=>{st.size=+sizeInp.value;w.body.querySelector('[data-sizel]').textContent=st.size};
    opInp.oninput=()=>{st.op=+opInp.value/100;w.body.querySelector('[data-opl]').textContent=opInp.value};
    fillInp.onchange=()=>{st.fillMode=fillInp.value};
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,cv.width,cv.height);
    ctx.lineCap='round';ctx.lineJoin='round';

    const push=()=>{
      st.undo.push(ctx.getImageData(0,0,cv.width,cv.height));
      if(st.undo.length>25)st.undo.shift();
      st.redo.length=0;updateUndo();
    };
    const updateUndo=()=>{
      w.body.querySelectorAll('[data-a]').forEach(b=>b.disabled=false);
    };
    const pos=e=>{
      const r=cv.getBoundingClientRect();
      return {x:(e.clientX-r.left)*cv.width/r.width, y:(e.clientY-r.top)*cv.height/r.height};
    };
    cv.onpointerdown=e=>{
      cv.setPointerCapture(e.pointerId);
      const p=pos(e);
      if(st.tool==='picker'){pick(p);return}
      push();
      st.drawing=true;st.start=p;
      if(['line','rect','circle'].includes(st.tool))st.snapshot=ctx.getImageData(0,0,cv.width,cv.height);
      else if(st.tool==='fill'){floodFill(p);st.drawing=false;return}
      else{
        ctx.beginPath();ctx.moveTo(p.x,p.y);
        ctx.strokeStyle=st.tool==='eraser'?'#ffffff':st.color;
        ctx.lineWidth=st.tool==='brush'?st.size*2.2:st.size;
        ctx.globalAlpha=st.tool==='eraser'?1:st.op;
        ctx.lineTo(p.x+.01,p.y);
        ctx.stroke();
      }
    };
    cv.onpointermove=e=>{
      if(!st.drawing)return;
      const p=pos(e);
      if(['line','rect','circle'].includes(st.tool)){
        ctx.putImageData(st.snapshot,0,0);
        ctx.strokeStyle=st.color;ctx.lineWidth=st.size;ctx.globalAlpha=st.op;
        ctx.fillStyle=st.color;ctx.globalAlpha=st.op*0.35;
        ctx.beginPath();
        if(st.tool==='line'){ctx.moveTo(st.start.x,st.start.y);ctx.lineTo(p.x,p.y)}
        else if(st.tool==='rect'){ctx.rect(st.start.x,st.start.y,p.x-st.start.x,p.y-st.start.y)}
        else{ctx.arc(st.start.x,st.start.y,Math.hypot(p.x-st.start.x,p.y-st.start.y),0,7)}
        if(st.fillMode==='solid'&&st.tool!=='line')ctx.fill();
        ctx.stroke();
      }else{
        ctx.strokeStyle=st.tool==='eraser'?'#ffffff':st.color;
        ctx.lineWidth=st.tool==='brush'?st.size*2.2:st.size;
        ctx.globalAlpha=st.tool==='eraser'?1:st.op;
        ctx.lineTo(p.x,p.y);ctx.stroke();
      }
    };
    const stop=()=>{st.drawing=false;st.snapshot=null;ctx.globalAlpha=1};
    cv.onpointerup=stop;cv.onpointercancel=stop;cv.onpointerleave=()=>{if(st.drawing)stop()};
    function pick(p){
      const d=ctx.getImageData(Math.floor(p.x),Math.floor(p.y),1,1).data;
      const hex='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
      st.color=hex;
      $$('.sw',colorsEl).forEach(x=>x.classList.toggle('on',x.title.toLowerCase()===hex));
      toast('Picked '+hex.toUpperCase());
    }
    function floodFill(p){
      const W=cv.width,H=cv.height;
      const img=ctx.getImageData(0,0,W,H),d=img.data;
      const x0=Math.floor(p.x),y0=Math.floor(p.y);
      if(x0<0||y0<0||x0>=W||y0>=H)return;
      const idx=(y0*W+x0)*4;
      const tr=d[idx],tg=d[idx+1],tb=d[idx+2],ta=d[idx+3];
      const c=hexRGB(st.color);
      if(Math.abs(tr-c[0])<2&&Math.abs(tg-c[1])<2&&Math.abs(tb-c[2])<2)return;
      const tol=28;
      const match=i=>Math.abs(d[i]-tr)<=tol&&Math.abs(d[i+1]-tg)<=tol&&Math.abs(d[i+2]-tb)<=tol&&Math.abs(d[i+3]-ta)<=tol;
      const stack=[[x0,y0]];
      let guard=W*H;
      while(stack.length&&guard-->0){
        const [sx,sy]=stack.pop();
        let yy=sy;
        for(;;){
          let xx=sx;
          for(;xx<W;xx++){ if(!match((yy*W+xx)*4))break;
            const i=(yy*W+xx)*4;
            d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255; }
          yy++;
          if(yy>=H)break;
          const i=(yy*W+xx)*4;
          if(!match(i))break;
          stack.push([xx,yy]);
        }
        yy--;
        for(;yy>=sy;yy--){
          let xx=sx;
          for(;xx>=0;xx--){const i=(yy*W+xx)*4;if(!match(i))break}
          while(++xx<W){const i=(yy*W+xx)*4;if(!match(i))break;
            if(yy-1>=0&&match(((yy-1)*W+xx)*4))stack.push([xx,yy-1]);
            if(yy+1<H&&match(((yy+1)*W+xx)*4))stack.push([xx,yy+1])}
        }
      }
      ctx.putImageData(img,0,0);
    }
    function hexRGB(h){const n=parseInt(h.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}
    const bar=el('div','toolbar',w.body);
    bar.style.cssText='border-top:1px solid rgba(255,255,255,.08);border-bottom:none';
    [['undo',ICONS.undo,'Undo (Ctrl+Z)'],['redo',ICONS.redo,'Redo (Ctrl+Y)'],
      ['clear',ICONS.trash,'Clear canvas'],['save',ICONS.save,'Save to /Pictures']].forEach(([a,ic,t])=>{
      const b=el('button','btn',bar);b.innerHTML=ic;b.title=t;
      b.onclick=()=>{
        if(a==='undo'){if(!st.undo.length)return toast('Nothing to undo');
          st.redo.push(ctx.getImageData(0,0,cv.width,cv.height));ctx.putImageData(st.undo.pop(),0,0)}
        else if(a==='redo'){if(!st.redo.length)return toast('Nothing to redo');
          st.undo.push(ctx.getImageData(0,0,cv.width,cv.height));ctx.putImageData(st.redo.pop(),0,0)}
        else if(a==='clear'){push();ctx.fillStyle='#ffffff';ctx.fillRect(0,0,cv.width,cv.height);toast('Canvas cleared')}
        else if(a==='save')savePNG();
      };
    });
    const sEl=el('span','',bar);sEl.style.cssText='flex:1;text-align:right;font-size:11px;color:#8ea0bd;font-family:var(--mono)';
    const updSize=()=>{sEl.textContent=cv.width+' × '+cv.height+' px · '+st.tool};
    updSize();
    async function savePNG(){
      const name=await prompt2('Save Drawing','File name:','drawing-'+Date.now().toString(36)+'.png');
      if(!name)return;
      const r=VFS.write('/Pictures/'+name,'');
      if(r.err){toast(r.err,ICONS.warn);return}
      r.node.type='file';
      r.node.mime='image/png';
      r.node.blobUrl=cv.toDataURL('image/png');
      r.node.dataUrl=r.node.blobUrl;
      r.node.content='';
      r.node.size=Math.round(r.node.blobUrl.length*0.75);
      VFS.save();
      Notify.send('Drawing saved','/Pictures/'+name,{app:'paint',icon:ICONS.paint});
      Achievements.grant('PAINTER');
      toast('Saved to /Pictures/'+name);
    }
    w.el.addEventListener('keydown',e=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();
        bar.querySelector('[title^="Undo"]').click()}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();
        bar.querySelector('[title^="Redo"]').click()}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();savePNG()}
    });
    return {destroy(){},onResize(){}};
  }
};
/* serve data-URL image files */
function isImageNode(n){return n&&n.type==='file'&&(n.dataUrl||n.mime&&n.mime.startsWith('image/')||EXT_ICON[extOf(n.name)]==='img')}

/* ---------- MEDIA ---------- */
