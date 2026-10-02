/* ============================================================
   MUSIC SYNTHESIS — note scheduler
   ============================================================
   A song is data, not audio. Each part is a string of steps:

     '.'  rest          'C4'  trigger note C4          '='  hold previous

   Steps are 16th notes, so stepDur = 60 / bpm / 4. A scheduler wakes every
   TICK ms and queues any event falling inside the next LOOKAHEAD seconds
   straight onto the AudioContext clock, which is the only clock that is
   sample-accurate — setInterval drifts, and a drifting clock on a sequencer
   accumulates jitter you can hear by the second bar.

   Seeking is a binary search over the compiled event list, not a restart from
   zero, so jumping into the middle of a track is instant.

   Everything routes into Audio2's bus, so the system volume and the
   "Media sounds" toggle apply. When the category is muted the transport keeps
   running and no nodes are built at all; unmuting mid-track resumes sound
   from where the transport happens to be. */
const SYNTH_STEP={look:0.14,tick:25};

const Synth={
  track:null, events:[], cursor:0, playing:false,
  offset:0, startedAt:0, timer:0, live:new Set(), noiseBuf:null, onend:null,

  /* ---------- pattern compilation ---------- */
  noteHz(m){return 440*Math.pow(2,(m-69)/12)},
  parse(name){
    const m=/^([A-Ga-g])([#b]?)(-?\d)$/.exec(name);
    if(!m)return null;
    const base={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1].toUpperCase()];
    const acc=m[2]==='#'?1:m[2]==='b'?-1:0;
    return base+acc+(+m[3]+1)*12;
  },
  /* Classify a pattern string once, so the compiler and the authoring guard in
     tools/test-songs.js can never disagree about what a token means. A bar
     marker may sit tight against its neighbour (".|"), so strip it first
     rather than demanding whitespace either side. */
  tokenize(text){
    const out=[];
    for(const raw of String(text).split(/\s+/)){
      const tok=raw.trim().replace(/\|+$/,'');
      if(!tok)continue;
      if(tok==='='){out.push({k:'hold',m:0});continue}
      if(tok==='.'){out.push({k:'rest',m:0});continue}
      const m=this.parse(tok);
      if(m===null)out.push({k:'bad',m:0,t:tok});
      else out.push({k:'note',m});
    }
    return out;
  },
  /* parts: {lead:'...', bass:'...', drum:'...'} -> flat, time-sorted events
     spec.r repeats the pattern, so a track is written as a handful of bars
     that loop rather than eighty bars spelled out step by step. */
  compile(song){
    const step=60/song.bpm/4, out=[];
    for(const part in song.parts){
      const spec=song.parts[part];
      const inst=spec.i||part;
      const text=new Array((spec.r||1)+1).join(spec.s);
      let held=null, n=0;
      for(const t of this.tokenize(text)){
        if(t.k==='hold'){n++;continue}
        if(held){out.push({t:held.t,d:step*n-held.t,m:held.m,i:inst});held=null}
        if(t.k==='note')held={t:step*n,m:t.m};
        n++;
      }
      if(held)out.push({t:held.t,d:step*n-held.t,m:held.m,i:inst});
    }
    out.sort((a,b)=>a.t-b.t);
    return out;
  },
  span(events){
    let d=0;
    for(let i=0;i<events.length;i++){const e=events[i];if(e.t+e.d>d)d=e.t+e.d}
    return d;
  },
  durationOf(song){
    if(song._dur==null)try{song._dur=this.span(this.compile(song))}catch(e){song._dur=0}
    return song._dur||0;
  },
  duration(){return this.track?this.durationOf(this.track):0},

  /* ---------- transport ---------- */
  load(song){
    this.stop();
    this.track=song;
    this.events=this.compile(song);
    this.offset=0;
    this.cursor=0;
    return this;
  },
  time(){
    if(!this.track)return 0;
    if(!this.playing)return this.offset;
    return Math.min(this.duration(),this.offset+(Audio2.ctx.currentTime-this.startedAt));
  },
  seek(sec){
    if(!this.track)return;
    const t=Math.max(0,Math.min(this.duration(),sec));
    this.halt();
    this.offset=t;
    let lo=0,hi=this.events.length;
    while(lo<hi){const m=(lo+hi)>>1;if(this.events[m].t<t)lo=m+1;else hi=m}
    this.cursor=lo;
    if(this.playing){this.startedAt=Audio2.ctx.currentTime;this.tick()}
  },
  play(){
    if(!this.track||this.playing)return;
    if(this.offset>=this.duration()-0.05)this.offset=0;
    Audio2.init();Audio2.resume();
    this.playing=true;
    this.startedAt=Audio2.ctx.currentTime;
    this.tick();
    this.timer=setInterval(()=>this.tick(),SYNTH_STEP.tick);
  },
  pause(){
    if(!this.playing)return;
    this.offset=this.time();
    this.playing=false;
    clearInterval(this.timer);this.timer=0;
    this.halt();
  },
  toggle(){this.playing?this.pause():this.play()},
  stop(){
    this.playing=false;
    clearInterval(this.timer);this.timer=0;
    this.halt();
    this.offset=0;this.cursor=0;
  },
  /* Silence everything already queued, so a pause or seek does not leave a
     140 ms tail of notes still ringing from the lookahead window. */
  halt(){
    for(const o of this.live){try{o.stop()}catch(e){}try{o.disconnect()}catch(e){}}
    this.live.clear();
  },

  /* ---------- scheduling ---------- */
  tick(){
    if(!this.playing||!this.track)return;
    const ctx=Audio2.ctx;
    if(!ctx)return;
    const pos=this.time(), until=pos+SYNTH_STEP.look;
    while(this.cursor<this.events.length&&this.events[this.cursor].t<until){
      const e=this.events[this.cursor++];
      this.voice(e,ctx.currentTime-this.startedAt+e.t);
    }
    if(pos>=this.duration()-0.01){
      this.pause();
      this.offset=this.duration();
      const cb=this.onend;this.onend=null;
      if(cb)cb();
    }
  },
  /* One note, scheduled at absolute ctx time `at`. */
  voice(e,at){
    if(!Audio2.on('media'))return;
    const ctx=Audio2.ctx;
    if(!ctx)return;
    const inst=INSTRUMENTS[e.i];
    if(!inst)return;
    const when=Math.max(ctx.currentTime+0.005,at);
    const dur=Math.max(0.04,e.d);
    const out=this.out();
    if(!out)return;
    inst(e,this.noteHz(e.m),when,dur,out,this);
  },
  out(){return Audio2.bus},
  /* Track every source so halt() can silence it. */
  keep(node){
    this.live.add(node);
    node.onended=()=>{this.live.delete(node);try{node.disconnect()}catch(e){}};
    return node;
  },
  /* One second of white noise, generated once and reused by every drum hit
     with different playback rates. Allocating a buffer per hit would churn
     megabytes a second at tempo. */
  noise(){
    if(this.noiseBuf)return this.noiseBuf;
    try{
      const ctx=Audio2.ctx,n=ctx.sampleRate;
      const b=ctx.createBuffer(1,n,ctx.sampleRate);
      const d=b.getChannelData(0);
      for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
      this.noiseBuf=b;
    }catch(e){this.noiseBuf=null}
    return this.noiseBuf;
  },
  /* Percussive envelope: silence -> peak -> silence, with no sustain. */
  hit(when,dur,peak,out,hp){
    const ctx=Audio2.ctx;
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.0001,when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002,peak),when+0.004);
    g.gain.exponentialRampToValueAtTime(0.0001,when+dur);
    if(hp){
      const f=ctx.createBiquadFilter();
      f.type='highpass';f.frequency.value=hp;
      g.connect(f);f.connect(out);
    }else g.connect(out);
    return g;
  },
  noiseHit(when,dur,peak,out,hp,rate){
    const ctx=Audio2.ctx,buf=this.noise();
    if(!buf)return;
    const s=ctx.createBufferSource();
    s.buffer=buf;s.playbackRate.value=rate||1;
    s.connect(this.hit(when,dur,peak,out,hp));
    this.keep(s);
    s.start(when);s.stop(when+dur+0.02);
  }
};
