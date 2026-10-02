/* Sound routing.
   Every sound belongs to exactly one category, and the Settings toggles switch
   them independently:

     'ui'    system chrome, apps, terminal, assistant
     'game'  the arcade
     'media' music and video playback

   The volume slider is the master fader. Sounds are suppressed at the source,
   so a muted category never even builds an oscillator.

   Graph — one AudioContext for the whole system:

     voices / <audio> / <video>  ->  bus  ->  analyser  ->  master  ->  out

   Everything connects to `bus`, never to the destination. Connecting straight
   to the destination is what makes the volume slider appear to do nothing, and
   a second AudioContext per subsystem is what exhausts Chrome's context limit.
   The analyser sits on the bus so a visualiser can read the mix without
   tapping a private node. */
const Audio2={
  ctx:null, master:null, bus:null, _ana:null,
  init(){
    if(this.ctx)return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      this.ctx=new AC();
      this.bus=this.ctx.createGain();
      this.ana=this.ctx.createAnalyser();
      this.ana.fftSize=256;
      this.ana.smoothingTimeConstant=.75;
      this.master=this.ctx.createGain();
      this.master.gain.value=this._vol();
      this.bus.connect(this.ana);
      this.ana.connect(this.master);
      this.master.connect(this.ctx.destination);
    }catch(e){}
  },
  _vol(){return Math.max(0,Math.min(100,+S.volume||0))/100},
  resume(){this.init();if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume()},
  setVol(v){this.init();if(this.master)this.master.gain.value=Math.max(0,Math.min(100,+v||0))/100},
  /* Shared spectrum tap for visualisers. fftSize/2 bins, 0..255. */
  analyser(){this.init();return this.ana},
  spectrum(out){if(!this.ana)return null;this.ana.getByteFrequencyData(out);return out},
  /* The single input every producer must connect to. Null if audio is
     unavailable, so callers degrade instead of throwing. */
  input(){this.init();return this.bus},
  /* Is a sound in this category currently allowed to play? */
  on(cat){
    if(S.volume<=0)return false;
    return cat==='game'?!!S.gameSounds:cat==='media'?!!S.mediaSounds:!!S.uiSounds;
  },
  tone(freq,dur,type,vol,slideTo,delay,cat){
    if(!this.on(cat))return;
    this.init();
    if(!this.ctx||this.ctx.state==='closed')return;
    const t0=this.ctx.currentTime+(delay||0);
    const o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type||'sine';o.frequency.setValueAtTime(freq,t0);
    if(slideTo)o.frequency.exponentialRampToValueAtTime(Math.max(20,slideTo),t0+dur);
    const peak=(vol==null?.16:vol);
    g.gain.setValueAtTime(.0001,t0);
    g.gain.exponentialRampToValueAtTime(peak,t0+Math.min(.02,dur/3));
    g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
    o.connect(g);g.connect(this.bus);
    o.start(t0);o.stop(t0+dur+.02);
  },
  noise(dur,vol,hp,cat){
    if(!this.on(cat))return;
    this.init();
    if(!this.ctx||this.ctx.state==='closed')return;
    const t0=this.ctx.currentTime;
    const n=Math.floor(this.ctx.sampleRate*dur);
    const buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const s=this.ctx.createBufferSource();s.buffer=buf;
    const f=this.ctx.createBiquadFilter();f.type=hp?'highpass':'lowpass';f.frequency.value=hp||900;
    const g=this.ctx.createGain();g.gain.value=vol||.1;
    s.connect(f);f.connect(g);g.connect(this.bus);s.start();
  },
  click(){this.tone(880,.05,'triangle',.07,660,undefined,'ui')},
  hover(){this.tone(1400,.02,'sine',.02,undefined,undefined,'ui')},
  open(){this.tone(520,.12,'sine',.10,880,undefined,'ui');this.tone(1040,.09,'sine',.04,1320,.04,'ui')},
  close(){this.tone(700,.10,'sine',.07,380,undefined,'ui')},
  notify(){this.tone(880,.09,'sine',.10,undefined,undefined,'ui');this.tone(1320,.12,'sine',.08,undefined,.08,'ui')},
  error(){this.tone(220,.18,'square',.08,150,undefined,'ui')},
  key(){this.tone(1500,.014,'square',.016,undefined,undefined,'ui')},
  achv(){[523,659,784,1046,1318].forEach((f,i)=>this.tone(f,.16,'triangle',.09,undefined,i*.075,'ui'));},
  eat(){this.tone(660,.07,'square',.08,1180,undefined,'game');this.tone(1320,.06,'sine',.05,1760,.05,'game')},
  die(){this.tone(340,.5,'sawtooth',.12,80,undefined,'game')},
  crash(){this.noise(.28,.18,600,'game');this.tone(120,.3,'sawtooth',.12,50,undefined,'game')},
  win(){[659,784,988,1318].forEach((f,i)=>this.tone(f,.2,'sine',.09,undefined,i*.09,'game'));},
  boot(){[110,165,220,330,440,660].forEach((f,i)=>this.tone(f,.5,'sine',.07,undefined,i*.11,'ui'));}
};
document.addEventListener('pointerdown',()=>Audio2.resume(),{once:true});
document.addEventListener('keydown',()=>Audio2.resume(),{once:true});

/* ---------- VIRTUAL FILESYSTEM ---------- */
