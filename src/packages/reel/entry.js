/* ============================================================
   GENERATED DEMO REEL - a package
   ------------------------------------------------------------
   It is a package and not an app because apps/video renders it and
   reaches it with ctx.use('reel'), while nothing else does. Subs is
   still a kernel name and is read from ctx.core.
   ============================================================ */
function register(ctx) {
  const { Subs, clamp, fmtDur } = ctx.core;

  const Reel={
    /* deterministic noise in [-1,1] */
    hash(n){
      let x=(n|0)*374761393+668265263;
      x=(x^(x>>13))*1274126177;
      return ((x^(x>>16))>>>0)/4294967295;
    },
    hue:188,
    chapters:[
      {t:0,   name:'Orbital',    dur:24},
      {t:24,  name:'City Grid',  dur:24},
      {t:48,  name:'Data Stream',dur:24},
      {t:72,  name:'Spectrum',   dur:24},
      {t:96,  name:'Signal Lost',dur:22}
    ],
    duration:118,

    chapterAt(t){
      for(let i=this.chapters.length-1;i>=0;i--)if(t>=this.chapters[i].t)return i;
      return 0;
    },
    progress(t){return clamp(t/this.duration,0,1)},

    subtitles(){
      return Subs.parse([
        '1',
        '00:00:01,000 --> 00:00:07,000',
        'NEXUS VISUAL SYSTEMS',
        'reference reel — sequence one',
        '',
        '2',
        '00:00:09,000 --> 00:00:15,000',
        'Every frame in this reel is generated',
        'at run time. No video file is loaded.',
        '',
        '3',
        '00:00:17,000 --> 00:00:23,500',
        'The renderer is a pure function of time,',
        'so the scrubber lands on the same frame.',
        '',
        '4',
        '00:00:26,000 --> 00:00:33,000',
        'ORBITAL',
        'terminator sweep at 04:12 sunrise',
        '',
        '5',
        '00:00:36,000 --> 00:00:44,000',
        'Light wraps the limb. The city below',
        'has already switched to night.',
        '',
        '6',
        '00:00:50,000 --> 00:00:58,000',
        'CITY GRID',
        'four parallax planes, seeded by index',
        '',
        '7',
        '00:01:01,000 --> 00:01:09,000',
        'Every window is lit by a hash of its own',
        'address, so it never flickers on re-render.',
        '',
        '8',
        '00:01:14,000 --> 00:01:22,000',
        'DATA STREAM',
        'tunnel depth 96 units',
        '',
        '9',
        '00:01:25,000 --> 00:01:32,000',
        'The rain is a rolling buffer of digits',
        'sampled from the same hash.',
        '',
        '10',
        '00:01:38,000 --> 00:01:46,000',
        'SPECTRUM',
        'this chapter follows live audio if any is playing',
        '',
        '11',
        '00:01:49,000 --> 00:01:56,000',
        'Otherwise it falls back to a fixed waveform,',
        'which keeps seeking deterministic.',
        '',
        '12',
        '00:02:00,000 --> 00:02:07,000',
        'SIGNAL LOST',
        'carrier degrading',
        '',
        '13',
        '00:02:10,000 --> 00:02:16,500',
        'End of reel.',
        'Press R to restart, F for full screen.'
      ].join('\n'));
    },

    /* ---------- helpers ---------- */
    sky(g,W,H,top,bot){
      const gr=g.createLinearGradient(0,0,0,H);
      gr.addColorStop(0,top);gr.addColorStop(1,bot);
      g.fillStyle=gr;g.fillRect(0,0,W,H);
    },
    vignette(g,W,H,amount){
      const gr=g.createRadialGradient(W/2,H/2,Math.min(W,H)*.2,W/2,H/2,Math.max(W,H)*.72);
      gr.addColorStop(0,'rgba(0,0,0,0)');
      gr.addColorStop(1,`rgba(0,0,0,${amount==null?.55:amount})`);
      g.fillStyle=gr;g.fillRect(0,0,W,H);
    },
    scanlines(g,W,H,gap,alpha){
      g.fillStyle=`rgba(0,0,0,${alpha})`;
      for(let y=0;y<H;y+=gap)g.fillRect(0,y,W,1);
    },
    caption(g,W,H,text,sub){
      g.font='600 13px ui-monospace,Consolas,monospace';
      g.textAlign='left';
      g.fillStyle='rgba(255,255,255,.55)';
      g.fillText(text,26,H-46);
      if(sub){
        g.font='11px ui-monospace,Consolas,monospace';
        g.fillStyle='rgba(255,255,255,.32)';
        g.fillText(sub,26,H-28);
      }
    },
    timecode(g,W,H,t,rate,idx){
      g.font='11px ui-monospace,Consolas,monospace';
      g.textAlign='right';
      g.fillStyle='rgba(255,255,255,.45)';
      g.fillText(`TC ${fmtDur(t)}   ${rate}x   SC ${String(idx+1).padStart(2,'0')}/05`,W-26,H-28);
      g.textAlign='left';
    },

    /* ---------- scenes ---------- */
    orbital(g,W,H,t){
      this.sky(g,W,H,'#050818','#0d1030');
      const cx=W*.5,cy=H*1.5,R=Math.min(W,H)*1.05;
      /* stars, fixed by index */
      for(let i=0;i<170;i++){
        const x=this.hash(i*3+1)*W, y=this.hash(i*3+2)*H*.92;
        const tw=.5+.5*Math.sin(t*2+i);
        g.fillStyle=`rgba(255,255,255,${.15+this.hash(i*3+3)*.5*tw})`;
        g.fillRect(x,y,1.6,1.6);
      }
      /* the limb, with the terminator sweeping across */
      g.save();
      g.beginPath();g.arc(cx,cy,R,0,Math.PI*2);g.clip();
      const lit=g.createLinearGradient(cx-R,cy-R,cx+R*.2,cy);
      const sweep=(t/24)*.8;
      lit.addColorStop(0,'#0a1c3a');
      lit.addColorStop(clamp(sweep,0.02,.96),'#2f6fb5');
      lit.addColorStop(clamp(sweep+.06,.05,.99),'#ffd9a0');
      lit.addColorStop(1,'#02040c');
      g.fillStyle=lit;g.fillRect(0,0,W,H);
      /* city lights on the night side */
      for(let i=0;i<70;i++){
        const a=this.hash(i*5+11)*Math.PI*2, d=R*.82;
        const x=cx+Math.cos(a)*d, y=cy+Math.sin(a)*d;
        if(y<cy-R*.82)continue;
        g.fillStyle=`rgba(255,200,120,${.2+this.hash(i*5+12)*.6})`;
        g.fillRect(x,y,1.5,1.5);
      }
      g.restore();
      g.strokeStyle='rgba(120,200,255,.5)';g.lineWidth=1.5;
      g.beginPath();g.arc(cx,cy,R,Math.PI*1.05,Math.PI*1.95);g.stroke();
      g.strokeStyle='rgba(120,200,255,.14)';
      for(let i=1;i<4;i++){g.beginPath();g.arc(cx,cy,R*(1-i*.005),Math.PI*1.05,Math.PI*1.95);g.stroke()}
      this.caption(g,W,H,'ORBITAL','terminator sweep');
    },
    cityGrid(g,W,H,t){
      const hor=H*.56;
      const sun=g.createLinearGradient(0,hor-H*.3,0,hor);
      sun.addColorStop(0,'#ff2e63');sun.addColorStop(.55,'#b06bff');sun.addColorStop(1,'#ffc857');
      g.fillStyle='#0a0418';g.fillRect(0,0,W,hor);
      g.fillStyle=sun;
      g.beginPath();g.arc(W*.5,hor-14,Math.min(W,H)*.16,Math.PI,0);g.fill();
      /* sun bands */
      g.fillStyle='#0a0418';
      for(let i=0;i<7;i++){
        const y=hor-6-i*Math.min(W,H)*.022;
        g.fillRect(W*.5-Math.min(W,H)*.17,y,Math.min(W,H)*.34,2+i*1.5);
      }
      /* four parallax skyline planes, each seeded by index and offset by t */
      for(let p=3;p>=0;p--){
        const par=0.06+p*.10, w=Math.max(18,W*.055-p*7);
        const base=this.hash(p*17+3)*W;
        g.fillStyle=`rgba(${8+p*4},${6+p*6},${20+p*10},1)`;
        const off=((t*par*40)%W);
        for(let k=-1;k<Math.ceil(W/w)+1;k++){
          const bi=Math.floor(base/w)+k;
          const bh=H*(.10+this.hash(bi*7+p*31)*.26);
          const x=k*w-off%w;
          g.fillRect(x,hor-bh,w*.86,bh);
          if(p>=2){
            g.fillStyle=`rgba(255,${180+p*20},${90+p*40},${.10+p*.12})`;
            const rows=Math.floor(bh/13);
            for(let r=0;r<rows;r++)for(let cI=0;cI<Math.floor(w/9);cI++){
              if(this.hash(bi*997+r*31+cI*7+p)<.42)continue;
              g.fillRect(x+3+cI*9,hor-bh+5+r*13,3,4);
            }
            g.fillStyle=`rgba(${8+p*4},${6+p*6},${20+p*10},1)`;
          }
        }
      }
      /* perspective floor */
      g.fillStyle='#07030f';g.fillRect(0,hor,W,H-hor);
      g.strokeStyle='rgba(176,107,255,.55)';g.lineWidth=1;
      for(let i=0;i<18;i++){
        const y=hor+Math.pow(i/18,2.1)*(H-hor);
        g.globalAlpha=1-i/20;
        g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();
      }
      g.globalAlpha=1;
      for(let i=-8;i<=8;i++){
        g.beginPath();g.moveTo(W/2+i*6,hor);g.lineTo(W/2+i*W*.16,H);g.stroke();
      }
      this.caption(g,W,H,'CITY GRID','four parallax planes');
    },
    dataStream(g,W,H,t){
      g.fillStyle='#000308';g.fillRect(0,0,W,H);
      /* wireframe tunnel, 96 units of depth */
      const cx=W/2,cy=H/2,R=Math.min(W,H)*.46;
      g.strokeStyle='rgba(55,224,255,.5)';g.lineWidth=1;
      for(let i=0;i<26;i++){
        const d=((i/26)+((t*.22)%(1/26)))%1;
        const k=Math.pow(1-d,3);
        const r=R*k;
        g.globalAlpha=k*.9;
        const sides=8, rot=t*.35+i*.2;
        g.beginPath();
        for(let s=0;s<=sides;s++){
          const a=rot+s/sides*Math.PI*2;
          const x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r;
          s?g.lineTo(x,y):g.moveTo(x,y);
        }
        g.closePath();g.stroke();
      }
      g.globalAlpha=1;
      /* number rain — column x and row y are hashed, the offset scrolls */
      g.font='13px ui-monospace,Consolas,monospace';
      const cols=Math.floor(W/16);
      for(let c=0;c<cols;c++){
        const h1=this.hash(c*13+5);
        const speed=40+h1*90;
        const head=(t*speed+h1*3000)%(H+40);
        for(let r=0;r<14;r++){
          const y=H-((head+r*20)%(H+40));        const a=(1-r/14)*.85;
          const d=this.hash(c*211+r*17+((Math.floor(t*2)+r)%7));
          g.fillStyle=`rgba(90,${200+d*55},${150+d*80},${a})`;
          g.fillText('0123456789ABCDEF'[(d*16)|0],c*16+6,y);
        }
      }
      this.caption(g,W,H,'DATA STREAM','tunnel depth 26 rings');
    },
    spectrum(g,W,H,t,ana){
      g.fillStyle='#04060f';g.fillRect(0,0,W,H);
      const bins=new Uint8Array(128);
      let live=false;
      if(ana&&ana.getByteFrequencyData){ana.getByteFrequencyData(bins);live=true}
      const N=64,hor=H*.82;
      /* horizon glow */
      const gl=g.createLinearGradient(0,hor-H*.2,0,hor+10);
      gl.addColorStop(0,'rgba(55,224,255,0)');gl.addColorStop(1,'rgba(55,224,255,.22)');
      g.fillStyle=gl;g.fillRect(0,hor-H*.2,W,H*.2+10);
      for(let i=0;i<N;i++){
        let v;
        if(live)v=bins[1+Math.floor(Math.pow(i/N,1.7)*110)]/255;
        else v=.30+.30*Math.abs(Math.sin(t*1.7+i*.42))+.12*Math.sin(t*5+i);
        v=clamp(v,0,1);
        const bw=W/N;
        const bh=v*(hor-H*.22);
        const gr=g.createLinearGradient(0,hor,0,hor-bh);
        gr.addColorStop(0,'rgba(61,220,132,.25)');
        gr.addColorStop(1,'rgba(255,200,87,.95)');
        g.fillStyle=gr;
        g.fillRect(i*bw+1,hor-bh,bw-2,bh);
      }
      g.strokeStyle='rgba(61,220,132,.7)';g.lineWidth=1.5;
      g.beginPath();g.moveTo(0,hor);g.lineTo(W,hor);g.stroke();
      /* reflection */
      g.globalAlpha=.16;
      for(let i=0;i<N;i++){
        const bw=W/N;
        const v=live?bins[1+Math.floor(Math.pow(i/N,1.7)*110)]/255
                    :.30+.30*Math.abs(Math.sin(t*1.7+i*.42))+.12*Math.sin(t*5+i);
        g.fillStyle='rgba(255,200,87,1)';
        g.fillRect(i*bw+1,hor,bw-2,v*40);
      }
      g.globalAlpha=1;
      this.caption(g,W,H,'SPECTRUM',live?'following live audio':'fixed waveform');
    },
    signalLost(g,W,H,t){
      const k=(t-96)/22;
      this.sky(g,W,H,'#120206','#000000');
      /* rolling horizontal tear bands */
      for(let i=0;i<9;i++){
        const y=this.hash(i*41)*H;
        const h=2+this.hash(i*41+1)*10*(.4+k);
        const off=this.hash(i*41+2)*W;
        g.fillStyle=`rgba(${40+i*8},${10+i*4},${30+i*10},${.10+k*.12})`;
        g.fillRect((off+t*40*(i+1))%W-40,y,60,h);
      }
      /* static blocks grow with the degradation */
      const blocks=Math.floor(k*k*260);
      for(let i=0;i<blocks;i++){
        const x=this.hash(i*97+1)*W, y=this.hash(i*97+2)*H;
        const w=2+this.hash(i*97+3)*46, h=2+this.hash(i*97+4)*9;
        g.fillStyle=`rgba(${180*this.hash(i*97+5)},${200},${255},${.04+this.hash(i*97+6)*.16})`;
        g.fillRect(x,y,w,h);
      }
      /* the logo resolving out of the noise */
      const a=clamp((k-.45)*2.6,0,1);
      g.textAlign='center';
      g.font='700 '+Math.round(Math.min(W*.09,64))+'px ui-monospace,Consolas,monospace';
      g.fillStyle=`rgba(55,224,255,${a*(.7+.3*Math.sin(t*9))})`;
      g.fillText('NEXUS',W/2,H*.44);
      g.font='12px ui-monospace,Consolas,monospace';
      g.fillStyle=`rgba(176,107,255,${a})`;
      g.fillText('END OF SEQUENCE',W/2,H*.44+30);
      g.textAlign='left';
      this.scanlines(g,W,H,3,.10+k*.28);
      this.vignette(g,W,H,.45+k*.35);
      this.caption(g,W,H,'SIGNAL LOST','carrier degrading');
    },

    /* ---------- entry point ---------- */
    render(g,W,H,t,rate,ana){
      const idx=this.chapterAt(t);
      const ch=this.chapters[idx];
      const local=Math.max(0,t-ch.t);
      g.save();
      /* Reel is authored 16:9; letterbox into whatever the stage is so the
         player is not forced to distort it. */
      const target=W/H, src=16/9;
      let dw=W,dh=H,dx=0,dy=0;
      if(target>src){dh=H;dw=H*src;dx=(W-dw)/2}
      else{dw=W;dh=W/src;dy=(H-dh)/2}
      g.translate(dx,dy);
      g.beginPath();g.rect(0,0,dw,dh);g.clip();
      if(idx===0)this.orbital(g,dw,dh,local);
      else if(idx===1)this.cityGrid(g,dw,dh,local);
      else if(idx===2)this.dataStream(g,dw,dh,local);
      else if(idx===3)this.spectrum(g,dw,dh,local,ana);
      else this.signalLost(g,dw,dh,local);
      g.restore();
      /* bars are outside the clip so the frame reads as letterboxed footage */
      if(dy>0){g.fillStyle='#000';g.fillRect(0,0,W,dy);g.fillRect(0,H-dy,W,dy)}
      if(dx>0){g.fillStyle='#000';g.fillRect(0,0,dx,H);g.fillRect(W-dx,0,dx,H)}
      this.timecode(g,W,H,t,rate,idx);
      this.vignette(g,W,H,.35);
    }
  };
  return { Reel };
}
