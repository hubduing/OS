/* ============================================================
   INSTRUMENTS AND TRACKS
   ============================================================
   Every instrument is a factory: (event, hz, when, dur, out, synth) -> void.
   It schedules its own nodes and hands any source back to synth.keep(), so a
   pause or a seek can silence it immediately instead of letting a lookahead
   tail ring out.

   Pattern language, one token per 16th note:

     '.'  rest          'C4'  note, triggers here          '='  hold previous
     '|'  ignored, purely so the source reads like sheet music

   A part may set r to repeat its pattern, which is what keeps a multi-minute
   track from having to be written out bar by bar. */

const INSTRUMENTS={
  /* Two detuned saws through a lowpass. The classic synthwave lead: slightly
     detuned voices beat against each other and the filter opens over the
     note, so a held note still moves. */
  lead(e,hz,when,dur,out,synth){
    const ctx=Audio2.ctx;
    const g=ctx.createGain();
    const f=ctx.createBiquadFilter();
    f.type='lowpass';
    f.frequency.setValueAtTime(Math.min(9000,hz*7),when);
    f.frequency.linearRampToValueAtTime(Math.min(11000,hz*2+900),when+Math.min(.28,dur));
    f.Q.value=6;
    const peak=.13;
    g.gain.setValueAtTime(0.0001,when);
    g.gain.exponentialRampToValueAtTime(peak,when+.012);
    g.gain.setTargetAtTime(peak*.62,when+.012,dur*.4);
    g.gain.exponentialRampToValueAtTime(0.0001,when+dur);
    f.connect(g);g.connect(out);
    for(const cents of [-7,7]){
      const o=ctx.createOscillator();
      o.type='sawtooth';o.frequency.value=hz;o.detune.value=cents;
      o.connect(f);
      synth.keep(o);
      o.start(when);o.stop(when+dur+.02);
    }
  },
  /* Single pulse wave, short and dry. */
  pulse(e,hz,when,dur,out,synth){
    const ctx=Audio2.ctx;
    const o=ctx.createOscillator();
    o.type='square';o.frequency.value=hz;
    o.connect(synth.hit(when,dur,.10,out,0));
    synth.keep(o);
    o.start(when);o.stop(when+dur+.02);
  },
  /* Bass sits below the lowpass and gets a touch of the oscillators above. */
  bass(e,hz,when,dur,out,synth){
    const ctx=Audio2.ctx;
    const f=ctx.createBiquadFilter();
    f.type='lowpass';f.frequency.value=520;f.Q.value=3;
    const g=synth.hit(when,dur,.20,out,0);
    f.connect(g);
    const o=ctx.createOscillator();
    o.type='sawtooth';o.frequency.value=hz;
    const o2=ctx.createOscillator();
    o2.type='square';o2.frequency.value=hz/2;
    o.connect(f);o2.connect(f);
    synth.keep(o);synth.keep(o2);
    o.start(when);o.stop(when+dur+.02);
    o2.start(when);o2.stop(when+dur+.02);
  },
  /* Slow swell, long tail — the ambient bed. */
  pad(e,hz,when,dur,out,synth){
    const ctx=Audio2.ctx;
    const g=ctx.createGain();
    const atk=Math.min(1.1,dur*.45);
    g.gain.setValueAtTime(0.0001,when);
    g.gain.linearRampToValueAtTime(.075,when+atk);
    g.gain.setTargetAtTime(.05,when+atk,dur*.5);
    g.gain.exponentialRampToValueAtTime(0.0001,when+dur);
    g.connect(out);
    for(const [type,mult,amp] of [['sine',1,1],['sine',2,.4],['triangle',3,.16]]){
      const o=ctx.createOscillator();
      o.type=type;o.frequency.value=hz*mult;
      const vg=ctx.createGain();vg.gain.value=amp;
      o.connect(vg);vg.connect(g);
      synth.keep(o);
      o.start(when);o.stop(when+dur+.02);
    }
  },
  /* Fast decay, no sustain — arpeggio sparkle. */
  pluck(e,hz,when,dur,out,synth){
    const ctx=Audio2.ctx;
    const o=ctx.createOscillator();
    o.type='triangle';o.frequency.value=hz;
    const d=Math.min(dur,.28);
    o.connect(synth.hit(when,d,.11,out,0));
    synth.keep(o);
    o.start(when);o.stop(when+d+.02);
  },
  /* Bell: fundamental plus a inharmonic partial, struck and left to ring. */
  bell(e,hz,when,dur,out,synth){
    const ctx=Audio2.ctx;
    for(const [mult,amp] of [[1,.09],[2.76,.045],[5.4,.02]]){
      const o=ctx.createOscillator();
      o.type='sine';o.frequency.value=hz*mult;
      o.connect(synth.hit(when,dur,amp,out,0));
      synth.keep(o);
      o.start(when);o.stop(when+dur+.02);
    }
  },
  /* Percussion uses the same note language as everything else, with the pitch
     class choosing the drum and the octave ignored. A drum part is then
     readable and editable without a second notation to learn. */
  drum(e,hz,when,dur,out,synth){
    const pc=((e.m%12)+12)%12;
    if(pc===0)synth.noiseHit(when,.05,.09,out,7000,1.7);          // closed hat
    else if(pc===2)synth.noiseHit(when,.24,.13,out,5200,1.05);    // crash / open hat
    else if(pc===3)synth.noiseHit(when,.17,.20,out,1400,1);       // snare
    else if(pc===4)synth.noiseHit(when,.06,.07,out,8200,1.9);     // tight hat
    else{                                                          // kick
      const ctx=Audio2.ctx;
      const o=ctx.createOscillator();
      o.type='sine';
      o.frequency.setValueAtTime(150,when);
      o.frequency.exponentialRampToValueAtTime(44,when+.11);
      o.connect(synth.hit(when,.30,.44,out,0));
      synth.keep(o);
      o.start(when);o.stop(when+.32);
    }
  },
  /* ---- percussion ---- */
  k(e,hz,when,dur,out,synth){
    const ctx=Audio2.ctx;
    const o=ctx.createOscillator();
    o.type='sine';
    o.frequency.setValueAtTime(150,when);
    o.frequency.exponentialRampToValueAtTime(44,when+.11);
    o.connect(synth.hit(when,.30,.44,out,0));
    synth.keep(o);
    o.start(when);o.stop(when+.32);
  },
  s(e,hz,when,dur,out,synth){
    synth.noiseHit(when,.17,.20,out,1400,1);
  },
  h(e,hz,when,dur,out,synth){
    synth.noiseHit(when,.045,.075,out,7000,1.6);
  },
  c(e,hz,when,dur,out,synth){
    synth.noiseHit(when,.22,.13,out,5200,1.1);
  }
};

const TRACKS=[
  {id:'arterial',title:'Neon Arterial',artist:'Vector Drive',bpm:108,key:'Am',
   hue:188,tags:['synthwave'],
   parts:{
     lead:{r:5,s:
`| A4 = = . E5 = = . C5 = = . E5 = = . D5 = = . |
| C5 = = . A4 = = . G4 = = . E4 = = . A4 = = . |
| F4 = = . C5 = = . E5 = = . G5 = = . E5 = = . |
| E5 = D5 = C5 = B4 = A4 = B4 = C5 = D5 = E5 =`},
     bass:{r:5,s:
`| A2 . . . A2 . . . A2 . . . A2 . . . |
| A2 . . . A2 . . . G2 . . . G2 . . . |
| F2 . . . F2 . . . E2 . . . E2 . . . |
| A2 . . A2 . A2 . . E2 . . E2 . . . .`},
     pad:{r:1,s:'| A3 = = = = = = = = = = = = = = ='},
     drum:{r:5,s:
`| C3 . . F3 . . F3 D3 . C3 . . F3 . F3 D3 . |
| C3 . . F3 . . F3 D3 . C3 . . F3 . F3 . . |
| C3 . . F3 . . F3 D3 . C3 . . F3 . F3 D3 . |
| C3 . . F3 . . F3 D3 . C3 C3 D3 . F3 D3 D3 .`}
   }},
  {id:'circuit',title:'Circuit Bloom',artist:'MOS-8',bpm:146,key:'C',
   hue:320,tags:['chiptune'],
   parts:{
     pulse:{r:7,s:
`| C5 . E5 . G5 . E5 . C5 . D5 . F5 . A5 . F5 . |
| E5 . G5 . C6 . . E6 . G5 . E5 . C5 . D5 . G5 . |
| F5 . A5 . C6 . A5 . F5 . G5 . B5 . D6 . B5 . G5 . |
| C6 . B5 . G5 . E5 . D5 . E5 . G5 . C6 . = = = =`},
     bass:{r:7,s:
`| C3 . G3 . C3 . G3 . C3 . G3 . C3 . G3 . |
| D3 . A3 . D3 . A3 . D3 . A3 . D3 . A3 . |
| E3 . B3 . E3 . B3 . F3 . C4 . F3 . C4 . |
| G3 . D4 . G3 . D4 . C3 . G3 . C3 . G3 . .`},
     drum:{r:7,s:
`| C3 . F3 . D3 . F3 . C3 . F3 . D3 . F3 . F3 |
| C3 . F3 . D3 . F3 . C3 . F3 . D3 . F3 . F3 |
| C3 . F3 . D3 . F3 . C3 . F3 . D3 . F3 D3 F3 . |
| C3 . F3 . D3 . F3 . C3 C3 D3 . F3 D3 D3 F3`}
   }},
  {id:'nullspace',title:'Nullspace',artist:'Hollow Signal',bpm:68,key:'Dm',
   hue:265,tags:['ambient'],
   parts:{
     pad:{r:3,s:
`| D3 = = = = = = = = = = = = = = = |
| Bb2 = = = = = = = = = = = = = = = |
| F3 = = = = = = = = = = = = = = = |
| A2 = = = = = = = = = = = = = = =`},
     bell:{r:3,s:
`| . . A4 . . . . . . . . D5 . . . |
| . . F5 . . . . . . . . A5 . . . |
| . . . . D5 . . . . . . . . F5 . . |
| . . . . A4 . . . . . . . . . . =`},
     bass:{r:3,s:'| D2 = = = = = = = = = = = = = = ='}
   }},
  {id:'overclock',title:'Overclock',artist:'NullSet',bpm:168,key:'Em',
   hue:150,tags:['drum and bass'],
   parts:{
     bass:{r:9,s:
`| E2 . . . E2 . . . B2 . . . E2 . . . |
| F2 . . . F2 . . . C3 . . . F2 . . . |
| E2 . . . E2 . . . B2 . . . E2 . E2 . |
| G2 . . . F2 . . . E2 . . . E2 . . .`},
     lead:{r:9,s:
`| . . E4 . G4 . . E4 . . . B3 . . . |
| . . F4 . A4 . . F4 . . . C4 . . . |
| . . E4 . B4 . . E4 . . . G4 . . . |
| . . A4 . . . G4 . . . B4 . . . .`},
     drum:{r:9,s:
`| C3 . . . D3 . C3 . D3 . C3 . . . D3 . |
| C3 . C3 . D3 . C3 . D3 . C3 . . . D3 . |
| C3 . . . D3 . C3 . D3 . C3 . D3 . D3 . |
| C3 . C3 . D3 . C3 . D3 . C3 . D3 . D3 D3`}
   }},
  {id:'rain',title:'Digital Rain',artist:'Vellum',bpm:92,key:'Gm',
   hue:210,tags:['downtempo'],
   parts:{
     pad:{r:4,s:
`| G3 = = = = = = = = = = = = = = = |
| D4 = = = = = = = = = = = = = = = |
| Eb4 = = = = = = = = = = = = = = = |
| D4 = = = = = = = = = = = = = = =`},
     pluck:{r:4,s:
`| B4 . D5 . G5 . D5 . B4 . D5 . G5 . A5 . |
| . G5 . D5 . B4 . D5 . G5 . D5 . B4 . . |
| Eb5 . G5 . Bb5 . G5 . Eb5 . G5 . Bb5 . C6 . |
| . Bb5 . G5 . Eb5 . G5 . D5 . B4 . D5 . .`},
     bass:{r:4,s:
`| G2 = = . . . . G2 = = . . . . |
| D3 = = . . . . D3 = = . . . . |
| Eb2 = = . . . . Eb2 = = . . . . |
| D3 = = . . . . G2 = = . . . .`},
     drum:{r:4,s:
`| C3 . . F3 . . F3 D3 . C3 . . F3 . F3 D3 . |
| C3 . . F3 . . F3 D3 . C3 . . F3 . F3 . . |
| C3 . . F3 . . F3 D3 . C3 . . F3 . F3 D3 . |
| C3 . . F3 . . F3 D3 . C3 C3 D3 . F3 D3 D3 .`}
   }},
  {id:'terminal',title:'Terminal Velocity',artist:'Sector Nine',bpm:152,key:'Am',
   hue:20,tags:['electro'],
   parts:{
     lead:{r:7,s:
`| A5 = G5 = E5 = A5 = B5 = A5 = G5 = E5 = |
| D5 = F5 = A5 = D6 = C6 = A5 = F5 = D5 = |
| C5 = E5 = G5 = C6 = B5 = G5 = E5 = C5 = |
| E5 = D5 = C5 = B4 = A4 = = = = = =`},
     bass:{r:7,s:
`| A1 . . A1 . . A1 . . G1 . . G1 . . |
| F1 . . F1 . . F1 . . E1 . . E1 . . |
| A1 . . A1 . A1 . . E1 . . E1 . . . |
| G1 . . F1 . . E1 . . A1 . . A1 . .`},
     drum:{r:7,s:
`| C3 . F3 . D3 . F3 . C3 . F3 . D3 . F3 F3 |
| C3 F3 D3 . F3 . C3 . F3 . D3 . F3 . F3 |
| C3 . F3 . D3 . F3 . C3 . F3 . D3 . F3 D3 F3 . |
| C3 . F3 . D3 . F3 . C3 C3 D3 . F3 D3 D3 F3`}
   }}
];
