/* ============================================================
   VIDEO PLAYER
   ------------------------------------------------------------
   An APP module. Reel arrives through ctx.use('reel') because reel is
   already a package; Subs is still a kernel name, so it comes off
   ctx.core. That asymmetry is temporary - see task 5b.
   ============================================================ */
function register(ctx) {
  const { Reel } = ctx.use('reel');
  const { Achievements, APPS, Audio2, ICONS, LS, Subs, VFS,
    clamp, el, fmtDur, toast } = ctx.core;

  APPS.video={
    title:'Video',icon:ICONS.vid,desc:'ReelPlayer',w:980,h:620,
    build(w,opts){
      w.body.innerHTML=`<div class="vd">
        <div class="vdStage" data-stage>
          <video data-el playsinline style="display:none"></video>
          <canvas data-canvas style="display:none"></canvas>
          <div class="vdSubs" data-subs style="display:none"></div>
          <div class="vdEmpty" data-empty>
            <div style="width:56px;height:56px;opacity:.5">${ICONS.vid}</div>
            <b>Nothing loaded</b>
            <span>Play the generated reel, or open a video file from your computer.</span>
            <div style="display:flex;gap:8px;margin-top:12px">
              <button class="btn pri" data-a="reel">${ICONS.play} Play demo reel</button>
              <button class="btn" data-a="openfile">${ICONS.open} Open file…</button>
            </div>
          </div>
          <div class="vdBadge" data-badge></div>
          <div class="vdBig" data-bigplay>${ICONS.play}</div>
        </div>
        <div class="vdBar">
          <button class="mbtn" data-a="prev" title="Previous">${ICONS.prev}</button>
          <button class="mbtn play" data-a="play" title="Play / pause (space)">${ICONS.play}</button>
          <button class="mbtn" data-a="next" title="Next">${ICONS.next}</button>
          <span class="vdTime" data-time>0:00 / 0:00</span>
          <div class="mdSeek vdSeek" data-seek><i style="width:0"></i><b style="left:0"></b><u data-chaps></u></div>
          <span class="vdRate" data-rateBtn title="Playback speed">1.0x</span>
          <button class="mbtn" data-a="cc" title="Subtitles (C)">CC</button>
          <button class="mbtn" data-a="pip" title="Picture in picture (P)">${ICONS.pip}</button>
          <button class="mbtn" data-a="full" title="Full screen (F)">${ICONS.full}</button>
          <button class="mbtn" data-a="mute" title="Mute (M)" style="width:34px;height:34px">${ICONS.vol}</button>
          <input type="range" min="0" max="100" value="80" data-vol style="width:72px;accent-color:var(--accent)" title="Volume">
        </div>
        <div class="toolbar" style="border-radius:11px">
          <button class="btn" data-a="reel">${ICONS.vid} Demo reel</button>
          <button class="btn" data-a="openfile">${ICONS.open} Open video…</button>
          <button class="btn" data-a="srt">Load subtitles…</button>
          <span class="sp"></span>
          <span data-meta style="font-size:11px;color:#8ea0bd;font-family:var(--mono)"></span>
        </div>
        <div class="vdRecent" data-recent></div>
      </div>`;
      const stage=w.body.querySelector('[data-stage]'),
        video=w.body.querySelector('[data-el]'),
        canvas=w.body.querySelector('[data-canvas]'),
        subsEl=w.body.querySelector('[data-subs]'),
        emptyEl=w.body.querySelector('[data-empty]'),
        badgeEl=w.body.querySelector('[data-badge]'),
        bigEl=w.body.querySelector('[data-bigplay]'),
        seek=w.body.querySelector('[data-seek]'),
        chapsEl=w.body.querySelector('[data-chaps]'),
        timeEl=w.body.querySelector('[data-time]'),
        rateEl=w.body.querySelector('[data-rateBtn]'),
        metaEl=w.body.querySelector('[data-meta]'),
        recentEl=w.body.querySelector('[data-recent]'),
        volInp=w.body.querySelector('[data-vol]'),
        playBtn=w.body.querySelector('[data-a="play"]');
      const vc=canvas.getContext('2d');
      const st={src:null,kind:null,raf:0,last:0,time:0,rate:1,playing:false,
        cues:null,ccOn:true,recentAuto:true,recent:LS.get('videoRecent',[])};
      const RATES=[0.25,0.5,0.75,1,1.25,1.5,2,4];

      /* ---------- source layer ---------- */
      const isReel=()=>st.kind==='reel';
      const now=()=>isReel()?st.time:(isFinite(video.currentTime)?video.currentTime:0);
      const duration=()=>isReel()?Reel.duration:(isFinite(video.duration)?video.duration:0);
      const setNow=t=>{
        if(isReel())st.time=clamp(t,0,Reel.duration);
        else if(isFinite(video.duration))video.currentTime=clamp(t,0,video.duration);
        step();
      };
      const setRate=r=>{
        st.rate=r;
        if(!isReel())video.playbackRate=r;
        /* toFixed then trim: (1).toFixed(2) is "1.00", and a fixed 2 decimals
           reads as a setting rather than a speed control. */
        rateEl.textContent=(Math.round(r*100)/100)+'x';
        rateEl.classList.toggle('on',r!==1);
        rateEl.dataset.rate=String(r);
      };

      /* ---------- rendering ---------- */
      function sizeCanvas(){
        const r=stage.getBoundingClientRect();
        const d=Math.min(devicePixelRatio||1,2);
        const w=Math.round(r.width*d),h=Math.round(r.height*d);
        if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
        vc.setTransform(d,0,0,d,0,0);
        return r;
      }
      function frame(ts){
        if(!st.playing)return;
        st.raf=requestAnimationFrame(frame);
        /* clamp both ends: a huge dt after a tab is backgrounded would skip the
           reel forward by however long the user was away */
        const dt=clamp((ts-st.last)/1000,0,.05);
        st.last=ts;
        if(isReel()){
          st.time+=dt*st.rate;
          if(st.time>=Reel.duration){st.time=Reel.duration;pause();onEnd();return}
          const r=sizeCanvas();
          Reel.render(vc,r.width,r.height,st.time,st.rate,Audio2.analyser());
          paintSubs();
          paintBadge();
          step();
        }
      }
      function onEnd(){
        if(isReel()){
          if(!watched){watched=true;Achievements.grant('DIRECTOR')}
          setNow(0);
          play();
          return;
        }
        if(st.recentAuto)loadRecent(0);
      }
      function paintSubs(){
        if(!st.ccOn||!st.cues){subsEl.style.display='none';subsEl.textContent='';return}
        const cue=Subs.active(st.cues,now());
        if(!cue){subsEl.style.display='none';subsEl.textContent='';return}
        subsEl.style.display='';
        /* keep the same element and only touch textContent when it changes,
           otherwise the browser re-lays out the caption every frame */
        if(subsEl.textContent!==cue.text)subsEl.textContent=cue.text;
      }
      function paintBadge(){
        if(!isReel()){badgeEl.textContent='';return}
        const i=Reel.chapterAt(st.time);
        const ch=Reel.chapters[i];
        const local=st.time-ch.t;
        badgeEl.textContent=`CHAPTER ${i+1}/5 · ${ch.name.toUpperCase()} · ${fmtDur(local)}`;
      }
      function step(){
        const d=duration(),t=now();
        seek.querySelector('i').style.width=(d?t/d*100:0)+'%';
        seek.querySelector('b').style.left=(d?t/d*100:0)+'%';
        timeEl.textContent=fmtDur(t)+' / '+fmtDur(d);
        if(!isReel())paintSubs();
      }

      /* ---------- transport ---------- */
      function loadReel(){
        unload();
        st.kind='reel';st.src={name:'NEXUS Visual Systems — Reference Reel',reel:true};
        st.cues=Reel.subtitles();
        st.time=0;st.rate=1;
        watched=false;
        video.style.display='none';
        canvas.style.display='';
        emptyEl.style.display='none';
        rateEl.textContent='1x';rateEl.classList.remove('on');rateEl.dataset.rate='1';
        metaEl.textContent='generated at run time · no video file';
        w.el.querySelector('.ttl').textContent='Reference Reel — Video';
        drawChapters();
        play();
      }
      function loadFile(name,url,objUrl,fromVfs){
        unload();
        st.kind='file';st.src={name,url,objUrl:!!objUrl,fromVfs:!!fromVfs};
        st.cues=null;st.rate=1;
        canvas.style.display='none';
        video.style.display='';
        emptyEl.style.display='none';
        video.src=url;
        video.volume=+volInp.value/100;
        video.playbackRate=1;
        rateEl.textContent='1x';rateEl.classList.remove('on');rateEl.dataset.rate='1';
        metaEl.textContent=fromVfs?'virtual filesystem':'local file';
        w.el.querySelector('.ttl').textContent=name+' — Video';
        drawChapters();
        if(fromVfs)autoSubtitles(url);
        video.play().catch(()=>{syncPlay();bigEl.style.display=''});
        remember(name);
      }
      function unload(){
        if(st.playing)pause();
        video.pause();
        video.removeAttribute('src');
        video.load();
        st.kind=null;st.src=null;st.cues=null;st.time=0;
      }
      function play(){
        if(!st.kind)return;
        Audio2.init();Audio2.resume();
        st.playing=true;
        if(isReel()){
          st.last=performance.now();
          cancelAnimationFrame(st.raf);
          st.raf=requestAnimationFrame(frame);
        }else{
          video.play().catch(()=>{st.playing=false;syncPlay()});
        }
        bigEl.style.display='none';
        syncPlay();
      }
      function pause(){
        st.playing=false;
        cancelAnimationFrame(st.raf);st.raf=0;
        if(!isReel())video.pause();
        syncPlay();
      }
      function syncPlay(){
        playBtn.innerHTML=st.playing?ICONS.pause:ICONS.play;
        bigEl.style.display=st.playing?'none':'';
      }
      function toggle(){st.playing?pause():play()}
      function drawChapters(){
        chapsEl.innerHTML='';
        if(!isReel())return;
        Reel.chapters.forEach(c=>{
          const u=el('u','',chapsEl);
          u.style.left=(c.t/Reel.duration*100)+'%';
          u.title=c.name;
          u.dataset.t=c.t;
        });
      }
      function remember(name){
        st.recent=[name,...st.recent.filter(n=>n!==name)].slice(0,6);
        LS.set('videoRecent',st.recent);
        renderRecent();
      }
      /* Reopen a recent file by looking its name back up in the filesystem. */
      function loadRecent(i){
        const n=st.recent[i];
        const hit=n&&VFS.search(n)[0];
        const node=hit&&hit.node;
        const url=node&&(node.dataUrl||node.blobUrl);
        if(url)loadFile(node.name,url,false,true);
      }
      let watched=false;
      function renderRecent(){
        if(!st.recent.length){recentEl.innerHTML='';return}
        recentEl.innerHTML='<span style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#8ea0bd">Recent</span>';
        st.recent.forEach(n=>{
          const b=el('button','vdChip',recentEl);
          b.textContent=n;
          b.onclick=()=>{
            /* The chip holds a display name, not a path. Look it back up rather
               than trusting the label, and do not assume the file is still
               there — the filesystem can be reset underneath us. */
            const hit=VFS.search(n)[0];
            const node=hit&&hit.node;
            const url=node&&(node.dataUrl||node.blobUrl);
            if(url)loadFile(node.name,url,false,true);
            else toast('That file is no longer in the filesystem');
          };
        });
      }
      /* If a file with the same base name and a .srt extension exists, use it
         without asking — subtitles that "just work" are the expected default. */
      function autoSubtitles(url){
        if(!url||url.startsWith('blob:'))return;
        const base=url.replace(/\.[^./]+$/,'');
        const hit=VFS.search(base+'.srt')[0];
        const node=hit&&hit.node;
        if(node&&node.text!=null){
          st.cues=Subs.parse(node.text);
          if(st.cues.length)metaEl.textContent='virtual filesystem · subtitles loaded';
        }
      }

      /* ---------- input ---------- */
      w.body.addEventListener('click',e=>{
        const b=e.target.closest('[data-a]');
        if(b){
          const a=b.dataset.a;
          if(a==='play')toggle();
          else if(a==='next'||a==='prev'){/* single source; rewind instead of change */setNow(0)}
          else if(a==='reel')loadReel();
          else if(a==='cc'){
            st.ccOn=!st.ccOn;
            b.classList.toggle('on',st.ccOn);
            paintSubs();
            toast(st.ccOn?'Subtitles on':'Subtitles off');
          }
          else if(a==='full')toggleFullscreen();
          else if(a==='pip')togglePip();
          else if(a==='mute'){
            video.muted=!video.muted;
            w.body.querySelector('[data-a="mute"]').innerHTML=video.muted?ICONS.mute:ICONS.vol;
            Audio2.init();
          }
          else if(a==='openfile'){
            const inp=el('input');inp.type='file';inp.accept='video/*';inp.multiple=false;
            inp.onchange=()=>{
              const f=inp.files[0];
              if(f)loadFile(f.name,URL.createObjectURL(f),true,false);
            };
            inp.click();
          }
          else if(a==='srt')loadSrt();
          return;
        }
        if(e.target.closest('[data-rateBtn]')){
          const i=RATES.indexOf(st.rate);
          setRate(RATES[(i+1)%RATES.length]);
          return;
        }
        /* clicking the picture toggles playback, the way every player does */
        if(e.target===stage||e.target===video||e.target===canvas){
          if(st.kind)toggle();
          else bigEl.click();
        }
      });
      volInp.oninput=()=>{
        video.volume=+volInp.value/100;
        video.muted=+volInp.value===0;
        w.body.querySelector('[data-a="mute"]').innerHTML=video.muted?ICONS.mute:ICONS.vol;
      };
      function loadSrt(){
        const inp=el('input');inp.type='file';inp.accept='.srt,text/plain';
        inp.onchange=()=>{
          const f=inp.files[0];
          if(!f)return;
          const r=new FileReader();
          r.onload=()=>{
            st.cues=Subs.parse(r.result);
            st.ccOn=true;
            w.body.querySelector('[data-a="cc"]').classList.add('on');
            paintSubs();
            toast(st.cues.length?st.cues.length+' subtitle cues loaded':'No cues found in that file');
          };
          r.readAsText(f);
        };
        inp.click();
      }
      const seekTo=e=>{
        const r=seek.getBoundingClientRect();
        setNow(clamp((e.clientX-r.left)/r.width,0,1)*duration());
      };
      seek.onpointerdown=e=>{
        seek.setPointerCapture(e.pointerId);seekTo(e);seek._d=true;
      };
      seek.onpointermove=e=>{if(seek._d)seekTo(e)};
      seek.onpointerup=()=>{seek._d=false};
      /* clicking a chapter marker jumps straight to it */
      chapsEl.onclick=e=>{
        const u=e.target.closest('u');
        if(u)setNow(+u.dataset.t);
      };
      function toggleFullscreen(){
        if(document.fullscreenElement)document.exitFullscreen();
        else if(stage.requestFullscreen)stage.requestFullscreen().catch(()=>toast('Full screen was refused'));
        else toast('Full screen is not available here');
      }
      function togglePip(){
        if(isReel()){toast('Picture-in-picture needs a real video file');return}
        if(!video.requestPictureInPicture){toast('Picture-in-picture is not supported in this browser');return}
        if(document.pictureInPictureElement)document.exitPictureInPicture();
        else video.requestPictureInPicture().catch(()=>toast('Picture-in-picture was refused'));
      }
      /* chapter keys on a real file jump by 10% of its length */
      w.el.addEventListener('keydown',e=>{
        if(!st.kind)return;
        if(e.target&&/INPUT|TEXTAREA/.test(e.target.tagName))return;
        const k=e.key.toLowerCase();
        if(k===' '||e.code==='Space'){e.preventDefault();toggle()}
        else if(k==='f'){e.preventDefault();toggleFullscreen()}
        else if(k==='p'){e.preventDefault();togglePip()}
        else if(k==='c'){e.preventDefault();w.body.querySelector('[data-a="cc"]').click()}
        else if(k==='m'){e.preventDefault();w.body.querySelector('[data-a="mute"]').click()}
        else if(k==='r'){e.preventDefault();setNow(0);play()}
        else if(k==='arrowright'){e.preventDefault();setNow(now()+10)}
        else if(k==='arrowleft'){e.preventDefault();setNow(now()-10)}
        else if(k==='arrowup'){e.preventDefault();volInp.value=clamp(+volInp.value+5,0,100);volInp.oninput()}
        else if(k==='arrowdown'){e.preventDefault();volInp.value=clamp(+volInp.value-5,0,100);volInp.oninput()}
      });
      video.addEventListener('play',()=>{if(!isReel()){st.playing=true;syncPlay();bigEl.style.display='none'}});
      video.addEventListener('pause',()=>{if(!isReel()){st.playing=false;syncPlay()}});
      video.addEventListener('ended',()=>{st.playing=false;syncPlay();onEnd()});
      video.addEventListener('loadedmetadata',()=>{
        if(isReel())return;
        const d=isFinite(video.duration)?video.duration:0;
        metaEl.textContent=`${video.videoWidth}×${video.videoHeight} · ${fmtDur(d)}`;
        if(!st.playing)bigEl.style.display='';
        step();
      });
      video.addEventListener('timeupdate',step);

      renderRecent();
      setRate(1);
      syncPlay();
      if(opts.path){
        const n=VFS.node(opts.path);
        if(n&&(n.dataUrl||n.blobUrl))loadFile(n.name,n.dataUrl||n.blobUrl,false,true);
      }else if(opts.reel)loadReel();

      return {destroy:()=>{unload();cancelAnimationFrame(st.raf)}};
    }
  };
}
