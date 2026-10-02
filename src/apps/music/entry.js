/* ============================================================
   MUSIC - synthesiser library + local audio playback
   ------------------------------------------------------------
   This is an APP module, so it is handed the kernel surface through
   ctx.core. Synth and TRACKS are still kernel names: they leave the
   kernel in a later task, and until then there is nothing to ctx.use().
   ============================================================ */
function register(ctx) {
  const { Achievements, APPS, Audio2, ICONS, Synth, TRACKS,
    clamp, el, esc, fmtBytes, fmtDur, toast } = ctx.core;

  APPS.music={
    title:'Music',icon:ICONS.aud,desc:'NexusPlayer',w:900,h:600,
    build(w,opts){
      w.body.innerHTML=`<div class="md">
        <div class="mdMain">
          <div class="mdStage" data-stage>
            <canvas id="muViz"></canvas>
            <div class="muNow" data-now>
              <div class="muArt" data-art></div>
              <b data-title>No track selected</b>
              <span data-sub>Pick something from the library, or open a local audio file.</span>
            </div>
          </div>
          <div class="mdCtrl">
            <button class="mbtn" data-a="prev" title="Previous">${ICONS.prev}</button>
            <button class="mbtn play" data-a="play" title="Play / pause">${ICONS.play}</button>
            <button class="mbtn" data-a="next" title="Next">${ICONS.next}</button>
            <div class="mdSeek" data-seek><i style="width:0"></i><b style="left:0"></b></div>
            <span class="mdTime" data-time>0:00 / 0:00</span>
            <button class="mbtn" data-a="mute" title="Mute" style="width:34px;height:34px">${ICONS.vol}</button>
            <input type="range" min="0" max="100" value="80" data-vol style="width:80px;accent-color:var(--accent)" title="Player volume">
          </div>
          <div class="toolbar" style="border-radius:11px">
            <button class="btn" data-a="openfile">${ICONS.open} Open audio file…</button>
            <button class="btn" data-a="shuffle" data-on="0">Shuffle</button>
            <button class="btn" data-a="repeat" data-on="1">Repeat</button>
            <span class="sp"></span>
            <span data-meta style="font-size:11px;color:#8ea0bd;font-family:var(--mono)"></span>
          </div>
        </div>
        <div class="mdList">
          <div style="padding:10px;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#8ea0bd">Library</div>
          <div data-items style="flex:1;overflow-y:auto"></div>
        </div>
      </div>`;
      const stage=w.body.querySelector('[data-stage]'),
        viz=w.body.querySelector('#muViz'),
        itemsEl=w.body.querySelector('[data-items]'),
        seek=w.body.querySelector('[data-seek]'),
        timeEl=w.body.querySelector('[data-time]'),
        metaEl=w.body.querySelector('[data-meta]'),
        nowEl=w.body.querySelector('[data-now]'),
        titleEl=w.body.querySelector('[data-title]'),
        subEl=w.body.querySelector('[data-sub]'),
        artEl=w.body.querySelector('[data-art]'),
        volInp=w.body.querySelector('[data-vol]'),
        playBtn=w.body.querySelector('[data-a="play"]');

      /* A detached <audio> for user files. The synthesiser needs no element at
         all — it writes straight onto the bus. */
      const audio=el('audio');audio.preload='metadata';
      const st={list:[],idx:-1,el:null,raf:0,shuffle:false,repeat:true,elUrl:null};

      const isSynth=it=>it&&it.kind==='synth';
      /* Position and length come from the synthesiser or the element, so the
         rest of the app never has to care which one is loaded. */
      const curTime=()=>isSynth(st.el)?Synth.time():(st.el?st.el.currentTime:0);
      const curDur=()=>isSynth(st.el)?Synth.duration():(st.el&&isFinite(st.el.duration)?st.el.duration:0);

      function addItem(item){st.list.push(item);renderList()}

      function artFor(it){
        if(!it)return '';
        const hue=isSynth(it)?it.song.hue:200;
        return `<div style="position:absolute;inset:0;background:
          radial-gradient(120% 120% at 30% 20%,hsl(${hue} 90% 55% / .55),transparent 62%),
          radial-gradient(90% 90% at 78% 82%,hsl(${(hue+58)%360} 90% 55% / .42),transparent 60%)"></div>`;
      }
      function renderList(){
        itemsEl.innerHTML='';
        if(!st.list.length){
          itemsEl.innerHTML='<div style="padding:14px;font-size:11.5px;color:#8ea0bd;line-height:1.6">Playlist is empty.</div>';
          return;
        }
        st.list.forEach((it,i)=>{
          const b=el('button','mdItem'+(i===st.idx?' on':''),itemsEl);
          const sub=isSynth(it)
            ? `${it.song.artist} · ${it.song.bpm} BPM`
            : `${fmtBytes(it.size||0)}`;
          const dur=isSynth(it)?fmtDur(Synth.durationOf(it.song)):fmtDur(it.el?it.el.duration:0);
          b.innerHTML=`<span class="ic">${isSynth(it)?ICONS.aud:ICONS.file}</span>
            <span class="nm"><b style="display:block;font-weight:600">${esc(it.name)}</b>
              <span style="font-size:9.5px;color:#8ea0bd">${esc(sub)}</span></span>
            <span style="font-size:9.5px;color:#8ea0bd;font-family:var(--mono)">${dur}</span>
            <span class="x" data-x>×</span>`;
          b.onclick=e=>{if(e.target.dataset.x)return;load(i)};
          b.querySelector('[data-x]').onclick=e=>{
            e.stopPropagation();
            if(st.idx===i)stopAll();
            if(it.objUrl)URL.revokeObjectURL(it.objUrl);
            if(isSynth(it)&&st.idx===i)Synth.stop();
            st.list.splice(i,1);
            if(st.idx>i)st.idx--;
            renderList();
          };
        });
      }

      function stopAll(){
        if(isSynth(st.el))Synth.pause();
        else if(st.el)st.el.pause();
        stopViz();
      }
      function load(i){
        if(i<0||i>=st.list.length)return;
        stopAll();
        st.idx=i;
        const it=st.list[i];
        st.el=it;
        if(isSynth(it)){
          Synth.load(it.song);
          listenDone=false;
          play();
        }else{
          audio.src=it.url;
          audio.volume=+volInp.value/100;
          audio.play().then(()=>{syncPlay();drawViz()})
            .catch(()=>{syncPlay();toast('Press play to start')});
        }
        titleEl.textContent=it.name;
        subEl.textContent=isSynth(it)
          ? `${it.song.artist} · ${it.song.bpm} BPM · ${it.song.key} · synthesised live`
          : 'local file';
        artEl.innerHTML=artFor(it);
        nowEl.classList.add('live');
        w.el.querySelector('.ttl').textContent=it.name+' — Music';
        renderList();
      }
      function play(){
        Audio2.init();Audio2.resume();
        if(isSynth(st.el))Synth.play();
        else if(st.el)st.el.play().catch(()=>{});
        syncPlay();
        drawViz();
      }
      function syncPlay(){
        const on=isSynth(st.el)?Synth.playing:!!(st.el&&!st.el.paused);
        playBtn.innerHTML=on?ICONS.pause:ICONS.play;
      }
      function advance(){
        if(!st.list.length)return;
        let n;
        if(st.shuffle&&st.list.length>1){
          do{n=0|Math.random()*st.list.length}while(n===st.idx);
        }else n=st.idx+1;
        if(n>=st.list.length){
          if(!st.repeat){syncPlay();return}
          n=0;
        }
        load(n);
      }
      /* A track only counts once it has actually run to the end. Without this
         guard, skipping to the end of a track grants the achievement and it
         stops meaning anything. */
      let listenDone=false;
      Synth.onend=()=>{
        if(!listenDone){
          listenDone=true;
          Achievements.grant('DJ');
        }
        advance();
      };
      const step=()=>{
        const d=curDur(),t=curTime();
        seek.querySelector('i').style.width=(d?t/d*100:0)+'%';
        seek.querySelector('b').style.left=(d?t/d*100:0)+'%';
        timeEl.textContent=fmtDur(t)+' / '+fmtDur(d);
      };

      /* ---------- visualiser ---------- */
      const vc=viz.getContext('2d');
      const bins=new Uint8Array(128);
      let idleT=0;
      function sizeCanvas(){
        const r=viz.getBoundingClientRect();
        const d=Math.min(devicePixelRatio||1,2);
        if(viz.width!==Math.round(r.width*d)){
          viz.width=Math.round(r.width*d);viz.height=Math.round(r.height*d);
          vc.setTransform(d,0,0,d,0,0);
        }
        return r;
      }
      function drawViz(){
        stopViz();
        const frame=()=>{
          st.raf=requestAnimationFrame(frame);
          const r=sizeCanvas(),W=r.width,H=r.height;
          const t=curTime(),d=curDur();
          /* Mirrors the transport so the bars sweep instead of jumping. */
          const p=d?t/d:0;
          vc.clearRect(0,0,W,H);
          const ana=Audio2.spectrum(bins);
          const n=48,gap=2,bw=(W-gap*(n-1))/n;
          const hue=isSynth(st.el)?st.el.song.hue:200;
          for(let i=0;i<n;i++){
            let v;
            if(ana){
              /* Fold 128 bins down to 48 bars logarithmically, so bass does not
                 own the left third and the treble is not a flat line. */
              const lo=Math.floor(Math.pow(i/n,1.9)*120)+1;
              const hi=Math.max(lo+1,Math.floor(Math.pow((i+1)/n,1.9)*120)+1);
              let m=0;
              for(let k=lo;k<hi&&k<bins.length;k++)if(bins[k]>m)m=bins[k];
              v=m/255;
            }else v=.12+Math.abs(Math.sin(performance.now()/260+i*.5))*.12;
            const h=Math.max(2,v*H*.82);
            const g=vc.createLinearGradient(0,H,0,H-h);
            g.addColorStop(0,`hsl(${hue} 90% 60% / .28)`);
            g.addColorStop(1,`hsl(${(hue+40)%360} 95% 66% / .95)`);
            vc.fillStyle=g;
            vc.fillRect(i*(bw+gap),H-h,bw,h);
          }
          /* progress hairline */
          if(d>0){
            vc.fillStyle=`hsl(${hue} 95% 70% / .85)`;
            vc.fillRect(0,H-2,W*p,2);
          }
          step();
        };
        st.raf=requestAnimationFrame(frame);
      }
      function stopViz(){
        if(st.raf)cancelAnimationFrame(st.raf);
        st.raf=0;
        idleT=0;
      }

      /* ---------- events ---------- */
      w.body.addEventListener('click',e=>{
        const b=e.target.closest('[data-a]');if(!b)return;
        const a=b.dataset.a;
        if(a==='play'){
          if(st.idx<0){toast('Pick a track first');return}
          if(isSynth(st.el))Synth.toggle();
          else if(st.el)st.el.paused?play():st.el.pause();
          Audio2.init();
        }
        else if(a==='prev'){if(st.idx>0)load(st.idx-1);else seekTo(0)}
        else if(a==='next')advance();
        else if(a==='mute'){
          audio.muted=!audio.muted;
          w.body.querySelector('[data-a="mute"]').innerHTML=audio.muted?ICONS.mute:ICONS.vol;
          Audio2.init();
        }
        else if(a==='shuffle'){
          st.shuffle=!st.shuffle;
          b.dataset.on=st.shuffle?'1':'0';
          b.classList.toggle('on',st.shuffle);
          toast(st.shuffle?'Shuffle on':'Shuffle off');
        }
        else if(a==='repeat'){
          st.repeat=!st.repeat;
          b.dataset.on=st.repeat?'1':'0';
          b.classList.toggle('on',st.repeat);
          toast(st.repeat?'Repeat on':'Repeat off');
        }
        else if(a==='openfile'){
          const inp=el('input');inp.type='file';inp.accept='audio/*';inp.multiple=true;
          inp.onchange=()=>{
            [...inp.files].forEach(f=>addItem({
              name:f.name,kind:'file',size:f.size,url:URL.createObjectURL(f),objUrl:true
            }));
            if(st.idx<0)load(0);
            toast('Added '+inp.files.length+' file'+(inp.files.length>1?'s':''));
          };
          inp.click();
        }
      });
      volInp.oninput=()=>{audio.volume=+volInp.value/100;audio.muted=+volInp.value===0};
      const seekTo=e=>{
        const r=seek.getBoundingClientRect();
        const p=clamp((e.clientX-r.left)/r.width,0,1);
        const d=curDur();
        if(d)seek._to=p*d;
      };
      seek.onpointerdown=e=>{
        seek.setPointerCapture(e.pointerId);seekTo(e);seek._d=true;
        if(seek._to!=null){
          if(isSynth(st.el))Synth.seek(seek._to);
          else if(st.el)st.el.currentTime=seek._to;
          seek._to=null;step();
        }
      };
      seek.onpointermove=e=>{if(seek._d)seekTo(e)};
      seek.onpointerup=()=>{seek._d=false;seek._to=null};

      /* The synthesiser runs on its own timer, so the UI has to be repainted
         from somewhere; 100 ms is smooth enough for a progress bar. */
      const uiTimer=setInterval(()=>{
        if(st.idx<0)return;
        const on=isSynth(st.el)?Synth.playing:!!(st.el&&!st.el.paused);
        if(on){step();if(!st.raf)drawViz()}
        else{syncPlay();stopViz()}
      },100);

      /* seed the library */
      TRACKS.forEach(song=>addItem({name:song.title,kind:'synth',song}));
      renderList();
      if(opts.track)load(opts.track);

      return {destroy:()=>{
        clearInterval(uiTimer);
        stopViz();
        Synth.stop();
        audio.pause();
        st.list.forEach(i=>{if(i.objUrl)URL.revokeObjectURL(i.objUrl)});
      }};
    }
  };
}
