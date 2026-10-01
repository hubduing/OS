/* ============================================================
   PART 3 — WALLPAPER, WINDOW MANAGER, DESKTOP, TASKBAR
   ============================================================ */
/* ---------- WALLPAPER ---------- */
const Wall={
  cur:null, cv:null, ctx:null, raf:0, t:0, parts:[], stars:[], running:false,
  init(){
    const w=$('#wall'); w.innerHTML='';
    this.cv=el('canvas','',w); this.cv.id='wpCanvas';
    this.ctx=this.cv.getContext('2d');
    this.resize();
    addEventListener('resize',()=>this.resize());
    this.apply(S.wallpaper,true);
  },
  resize(){
    if(!this.cv)return;
    const d=Math.min(devicePixelRatio||1,2);
    this.cv.width=innerWidth*d; this.cv.height=innerHeight*d;
    this.ctx.setTransform(d,0,0,d,0,0);
    this.W=innerWidth;this.H=innerHeight;
    this.seed();
  },
  seed(){
    this.stars=[];for(let i=0;i<170;i++)this.stars.push({x:Math.random()*this.W,y:Math.random()*this.H,
      r:Math.random()*1.4+.2,s:Math.random()*.9+.15,tw:Math.random()*6.28});
  },
  /* NULLSPACE is hidden until its easter egg is found, so that Shuffle cannot
     hand it out by accident and the Settings grid cannot spoil it. */
  shufflable(){return WALLPAPERS.filter(w=>!w.secret||Eggs.found['wp-zero'])},
  apply(id,silent){
    const wp=WALLPAPERS.find(w=>w.id===id)||WALLPAPERS[0];
    this.cur=wp.id;
    if(!silent){S.wallpaper=wp.id;LS.set('settings',S)}
    document.body.style.setProperty('--wp-id',wp.id);
    this.t=0;this.seed();
    if(!this.running){this.running=true;this.loop()}
    if(wp.secret)Eggs.mark('wp-zero');
  },
  loop(){
    this.raf=requestAnimationFrame(()=>this.loop());
    if(!S.animations){this.drawStatic();return}
    this.t+=0.016;
    this.draw(this.t);
  },
  drawStatic(){this.draw(0)},
  draw(t){
    const c=this.ctx,W=this.W,H=this.H,k=this.cur;
    c.clearRect(0,0,W,H);
    const A=S.accent,A2=S.accent2;
    const grad=(x0,y0,x1,y1,stops)=>{const g=c.createLinearGradient(x0,y0,x1,y1);stops.forEach(s=>g.addColorStop(s[0],s[1]));return g};

    if(k==='city'){
      c.fillStyle=grad(0,0,0,H,[[0,'#05070f'],[.45,'#0b1226'],[1,'#1a0f2e']]);c.fillRect(0,0,W,H);
      // sun
      const sy=H*.42,sr=Math.min(W,H)*.20;
      const sg=c.createRadialGradient(W*.5,sy,0,W*.5,sy,sr*1.6);
      sg.addColorStop(0,'rgba(255,110,180,.55)');sg.addColorStop(.4,'rgba(255,60,140,.22)');sg.addColorStop(1,'rgba(255,60,140,0)');
      c.fillStyle=sg;c.fillRect(0,0,W,H);
      c.save();c.beginPath();c.arc(W*.5,sy,sr,0,7);c.clip();
      c.fillStyle=grad(0,sy-sr,0,sy+sr,[[0,'#ffd76b'],[.5,'#ff6bb0'],[1,'#a05cff']]);c.fillRect(W*.5-sr,sy-sr,sr*2,sr*2);
      c.fillStyle='rgba(10,6,25,.85)';
      for(let i=0;i<9;i++){const y=sy+sr*0.12*i;c.fillRect(W*.5-sr,y,sr*2,Math.max(1,sr*0.028*(1+i*.16)))}
      c.restore();
      // grid
      const hy=H*.62;
      c.strokeStyle='rgba(80,220,255,.30)';c.lineWidth=1;
      for(let i=0;i<=26;i++){const x=(i/26)*W;c.beginPath();c.moveTo(x,hy);c.lineTo(W/2+(x-W/2)*2.6,H);c.stroke()}
      for(let i=0;i<20;i++){const p=((i/20+t*.28)%1);const y=hy+p*p*(H-hy);
        c.strokeStyle='rgba(80,220,255,'+(0.42*(1-p*.7)).toFixed(3)+')';
        c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke()}
      this.city(t,hy);
      c.fillStyle='rgba(3,5,12,.55)';c.fillRect(0,0,W,hy);
    }
    else if(k==='space'){
      c.fillStyle='#01020a';c.fillRect(0,0,W,H);
      for(const s of this.stars){
        const a=(0.35+0.65*Math.abs(Math.sin(t*1.1+s.tw)))*s.s;
        c.fillStyle=`rgba(210,235,255,${a.toFixed(3)})`;
        c.beginPath();c.arc(s.x,s.y,s.r,0,7);c.fill();
      }
      for(let i=0;i<3;i++){
        const cx=W*(.25+i*.28),cy=H*(.3+(i%2)*.3),rr=Math.min(W,H)*(.3+i*.09);
        const g=c.createRadialGradient(cx,cy,0,cx,cy,rr);
        g.addColorStop(0,['rgba(60,90,200,.18)','rgba(160,60,200,.16)','rgba(40,160,180,.14)'][i]);
        g.addColorStop(1,'rgba(0,0,0,0)');
        c.fillStyle=g;c.beginPath();c.arc(cx,cy,rr,0,7);c.fill();
      }
      // shooting star
      const sp=(t*.28)%7;
      if(sp<1.2){const p=sp/1.2;c.strokeStyle='rgba(255,255,255,'+(0.7*(1-p)).toFixed(2)+')';c.lineWidth=2;
        c.beginPath();c.moveTo(W*.85-p*W*.4,H*.15-p*H*.22);c.lineTo(W*.85-p*W*.4+70,H*.15-p*H*.22+38);c.stroke()}
    }
    else if(k==='aurora'){
      c.fillStyle=grad(0,0,0,H,[[0,'#01030c'],[1,'#061a2b']]);c.fillRect(0,0,W,H);
      this.stars.forEach(s=>{c.fillStyle='rgba(200,230,255,'+(s.s*.5).toFixed(2)+')';c.fillRect(s.x,s.y,s.r,s.r)});
      for(let b=0;b<3;b++){
        c.beginPath();
        const baseY=H*(.22+b*.13);
        for(let x=0;x<=W;x+=8){
          const y=baseY+Math.sin(x*.004+t*(.5+b*.25)+b*2)*40+Math.sin(x*.009-t*.35)*18;
          x===0?c.moveTo(x,y):c.lineTo(x,y);
        }
        const g=c.createLinearGradient(0,baseY-70,0,baseY+130);
        g.addColorStop(0,'rgba(0,0,0,0)');
        g.addColorStop(.5,[ 'rgba(70,255,190,.24)','rgba(120,140,255,.20)','rgba(255,120,220,.18)'][b]);
        g.addColorStop(1,'rgba(0,0,0,0)');
        c.fillStyle=g;c.fillRect(0,baseY-70,W,200);
      }
      const mg=c.createLinearGradient(0,H*.55,0,H);
      mg.addColorStop(0,'rgba(4,12,24,0)');mg.addColorStop(1,'rgba(2,6,14,.95)');
      c.fillStyle=mg;c.fillRect(0,H*.55,W,H*.45);
      c.fillStyle='rgba(0,0,0,.9)';c.beginPath();c.moveTo(0,H);
      for(let x=0;x<=W;x+=10)c.lineTo(x,H*.86+Math.sin(x*.006)*14+Math.cos(x*.017)*8);
      c.lineTo(W,H);c.closePath();c.fill();
    }
    else if(k==='matrix'){
      c.fillStyle='rgba(0,4,2,.14)';c.fillRect(0,0,W,H);
      const fs=15,cols=Math.ceil(W/fs);
      if(!this._mc||this._mc.length!==cols||this._mcw!==W){
        this._mc=new Array(cols).fill(0).map(()=>Math.random()*H|0); this._mcw=W;
      }
      c.font=fs+'px monospace';c.textBaseline='top';
      for(let i=0;i<cols;i++){
        const ch=String.fromCharCode(0x30a0+Math.random()*96|0);
        c.fillStyle='rgba(120,255,160,.92)';c.fillText(ch,i*fs,this._mc[i]);
        c.fillStyle='rgba(0,255,110,.35)';c.fillText(ch,i*fs,this._mc[i]-fs);
        this._mc[i]=(this._mc[i]+fs*(0.6+Math.random()*1.6))%H;
      }
      const vg=c.createRadialGradient(W/2,H/2,Math.min(W,H)*.15,W/2,H/2,Math.max(W,H)*.7);
      vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.75)');
      c.fillStyle=vg;c.fillRect(0,0,W,H);
    }
    else if(k==='sunset'){
      c.fillStyle=grad(0,0,0,H,[[0,'#1a0733'],[.42,'#6b1a5e'],[.68,'#e0567a'],[1,'#ffb26b']]);c.fillRect(0,0,W,H);
      c.fillStyle='rgba(255,240,200,.95)';
      c.beginPath();c.arc(W*.5,H*.62,Math.min(W,H)*.13,0,7);c.fill();
      for(let i=0;i<10;i++){
        const y=H*(.06+i*.045),a=.05*(1-i/11);
        c.fillStyle=`rgba(255,255,255,${a.toFixed(3)})`;c.fillRect(0,y,W,1+(i%2));
      }
      const hy=H*.66;
      c.strokeStyle='rgba(255,220,180,.42)';
      for(let i=0;i<=24;i++){const x=(i/24)*W;c.beginPath();c.moveTo(x,hy);c.lineTo(W/2+(x-W/2)*2.4,H);c.stroke()}
      for(let i=0;i<18;i++){const p=((i/18+t*.22)%1);const y=hy+p*p*(H-hy);
        c.strokeStyle='rgba(255,200,160,'+(0.4*(1-p*.6)).toFixed(3)+')';c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke()}
    }
    else if(k==='minimal'){
      c.fillStyle=grad(0,0,W,H,[[0,'#08090d'],[1,'#101319']]);c.fillRect(0,0,W,H);
      const g=c.createRadialGradient(W*.3,H*.3,0,W*.3,H*.3,Math.max(W,H)*.8);
      g.addColorStop(0,hexA(A,.10));g.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle=g;c.fillRect(0,0,W,H);
      c.strokeStyle=hexA(A,.16+0.05*Math.sin(t*.6));c.lineWidth=1;
      const r=Math.min(W,H)*.3+Math.sin(t*.4)*14;
      c.beginPath();c.arc(W*.5,H*.5,r,0,7);c.stroke();
      c.strokeStyle=hexA(A2,.12);c.beginPath();c.arc(W*.5,H*.5,r*.72,-t*.3,t*.9);c.stroke();
      this.stars.forEach(s=>{c.fillStyle=hexA(A,s.s*.25*(0.5+0.5*Math.sin(t+s.tw)));c.fillRect(s.x,s.y,s.r,s.r)});
    }
    else if(k==='nebula'){
      c.fillStyle='#03030c';c.fillRect(0,0,W,H);
      for(let i=0;i<7;i++){
        const cx=W*(.2+Math.sin(t*.13+i*1.3)*.32),cy=H*(.3+Math.cos(t*.11+i*2.1)*.28);
        const rr=Math.min(W,H)*(.25+((i*37)%40)/90);
        const g=c.createRadialGradient(cx,cy,0,cx,cy,rr);
        g.addColorStop(0,hexA([A,A2,'#ff4d9d','#3ddc84'][i%4],.20));
        g.addColorStop(1,'rgba(0,0,0,0)');
        c.fillStyle=g;c.beginPath();c.arc(cx,cy,rr,0,7);c.fill();
      }
      this.stars.forEach(s=>{c.fillStyle='rgba(255,255,255,'+(s.s*.7*Math.abs(Math.sin(t*.9+s.tw))).toFixed(2)+')';
        c.fillRect(s.x,s.y,s.r,s.r)});
    }
    else if(k==='vortex'){
      c.fillStyle='#01020a';c.fillRect(0,0,W,H);
      c.save();c.translate(W/2,H/2);
      for(let i=0;i<90;i++){
        const a=t*.22+i*.07, r=(i/90)*Math.max(W,H)*.72+((i*13)%20);
        c.rotate(.005);
        c.strokeStyle=hexA(i%3?A2:A,clamp(.5-i/110,.02,.5));
        c.lineWidth=1.2;
        c.beginPath();
        c.moveTo(Math.cos(a)*r,Math.sin(a)*r);
        c.lineTo(Math.cos(a+.35)*r*1.06,Math.sin(a+.35)*r*1.06);
        c.stroke();
      }
      const g=c.createRadialGradient(0,0,0,0,0,Math.min(W,H)*.2);
      g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(.2,hexA(A,.5));g.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle=g;c.beginPath();c.arc(0,0,Math.min(W,H)*.2,0,7);c.fill();
      c.restore();
    }
    else if(k==='plasma'){
      for(let y=0;y<H;y+=3)for(let x=0;x<W;x+=3){
        const v=Math.sin(x*.012+t)+Math.sin(y*.016-t*.8)+Math.sin((x+y)*.008+t*.6);
        const q=(v+3)/6;
        c.fillStyle=`hsl(${(q*300+t*30)%360},75%,${10+q*22}%)`;
        c.fillRect(x,y,3,3);
      }
    }
    else if(k==='wireframe'){
      c.fillStyle='#04060e';c.fillRect(0,0,W,H);
      c.strokeStyle=hexA(A,.32);c.lineWidth=1;
      for(let i=0;i<=20;i++){
        const x=(i/20)*W;
        c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke();
      }
      for(let i=0;i<=14;i++){
        const y=(i/14)*H;
        c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();
      }
      c.strokeStyle=hexA(A2,.5);
      this.stars.forEach((s,i)=>{
        if(i>26)return;
        c.beginPath();c.moveTo(s.x,s.y);
        c.lineTo(s.x+Math.sin(t*.7+s.tw)*90,s.y+Math.cos(t*.6+s.tw)*50);
        c.stroke();
      });
    }
    else if(k==='void'){
      c.fillStyle='#000';c.fillRect(0,0,W,H);
      const g=c.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*.55);
      g.addColorStop(0,hexA(A,.14+0.05*Math.sin(t)));g.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle=g;c.fillRect(0,0,W,H);
      for(let i=0;i<4;i++){
        const r=(t*22+i*Math.max(W,H)*.22)%(Math.max(W,H)*.75);
        c.strokeStyle=hexA(A,(1-r/(Math.max(W,H)*.75))*.20);c.lineWidth=2;
        c.beginPath();c.arc(W/2,H/2,r,0,7);c.stroke();
      }
    }
    else if(k==='zero'){
      c.fillStyle='#000';c.fillRect(0,0,W,H);
      c.font='13px monospace';c.textBaseline='top';
      for(let i=0;i<(H/17|0);i++){
        const s=(Math.random()*.6+.4).toFixed(1);
        c.fillStyle='rgba(255,0,90,'+s+')';
        c.fillText(['0x0','NULL','∅','01010101','[EMPTY]','void*','NULLPTR'][i%7],Math.random()*W,i*17+((t*40)%17));
      }
      c.font='26px monospace';c.textAlign='center';
      c.fillStyle='rgba(255,0,90,'+(0.16+0.1*Math.sin(t*2))+')';
      c.fillText('0x00000000',W/2,H/2-13);c.textAlign='left';
    }
  },
  city(t,hy){
    const c=this.ctx,W=this.W,H=this.H;
    if(!this._b){this._b=[];for(let i=0;i<44;i++)this._b.push({x:Math.random()*W,w:14+Math.random()*36,h:60+Math.random()*230,
      w2:0.0,win:[]});
      this._b.forEach(b=>{b.w2=b.w;for(let y=0;y<b.h/11;y++)for(let x=0;x<b.w2/8;x++)b.win.push([x*8+2,y*11+3,Math.random()<.32])});}
    c.fillStyle='#03050c';
    this._b.forEach(b=>{
      const bob=Math.sin(t*.4+b.x*.01)*1.2;
      c.fillRect(b.x,hy-b.h+bob,b.w2,b.h);
      b.win.forEach(w=>{
        if(!w[2])return;
        c.fillStyle='rgba(255,'+(140+((w[0]*37+b.x)|0)%110)+',80,'+(0.25+0.6*Math.abs(Math.sin(t*.7+w[0]*.5+w[1]*.3))).toFixed(2)+')';
        c.fillRect(b.x+w[0],hy-b.h+bob+w[1],2.4,3.4);
      });
    });
    c.fillStyle='rgba(0,0,0,.35)';c.fillRect(0,hy,W,H-hy);
  },
  canvas(){return this.cv}
};
function hexA(hex,a){
  const h=hex.replace('#','');
  const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}

/* ---------- WINDOW MANAGER ---------- */
