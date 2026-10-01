function buildRacer(w){
  /* Circuit length is CFG.segments*SEG_LEN. It is deliberately short: at the
     speeds below a lap works out at roughly a minute, which is a race you can
     actually finish. The earlier 220-segment loop took 200s a lap. */
  const CFG={
    segments:120, maxSpeed:400, accel:300, brake:480,
    laps:3, ai:5
  };
  /* Geometry, in "camera units". CAM_BACK is how far behind the player the
     camera sits; it is deliberately larger than camH*camD, because with the
     player exactly one camera-height away the projection puts its baseline at
     the very bottom of the canvas and the car is drawn half off-screen. */
  const SEG_LEN=200;
  const camH=1000, camD=.84;
  const CAM_BACK=1300;
  const ROAD_HALF=620;   // road half-width
  const CAR_W=200;       // car width
  const DRAW_RANGE=70;   // segments in front of the camera
  const AI_COLORS=['#ff4d9d','#ffc857','#3ddc84','#b06bff','#ff6b35'];
  w.body.innerHTML=`<div class="gm">
    <canvas class="gmCanvas"></canvas>
    <div class="gmHud">
      <div class="s"><span>SPEED</span><b data-spd>0</b></div>
      <div class="s"><span>LAP</span><b data-lap>1/3</b></div>
      <div class="s"><span>TIME</span><b data-time>0:00.000</b></div>
      <div class="s"><span>POS</span><b data-pos>1/6</b></div>
      <div class="s"><span>SCORE</span><b data-score>0</b></div>
      <div class="s" style="margin-left:auto;text-align:right"><span>BEST LAP</span>
        <b data-best style="font-size:12px">${GAMES.racer.best()}</b></div>
    </div>
    <div class="gmKeys">
      ↑ / W accelerate &nbsp;·&nbsp; ↓ / S brake &nbsp;·&nbsp; ← → steer &nbsp;·&nbsp; SPACE handbrake &nbsp;·&nbsp; R restart
    </div>
    <div class="gmOverlay" data-ov>
      <h2>CYBER RACER</h2>
      <p>Three laps of the NEXUS night circuit against five AI rivals. Pass through all three
         checkpoints each lap. Collisions cost speed and time.</p>
      <button class="btn pri" data-go style="padding:12px 36px;font-size:14px">START RACE</button>
      <button class="btn" data-exit>Back to Arcade</button>
    </div>
  </div>`;
  const cv=w.body.querySelector('canvas'),ctx=cv.getContext('2d');
  const ov=w.body.querySelector('[data-ov]');
  const hud={spd:w.body.querySelector('[data-spd]'),lap:w.body.querySelector('[data-lap]'),
    time:w.body.querySelector('[data-time]'),pos:w.body.querySelector('[data-pos]'),
    score:w.body.querySelector('[data-score]')};

  // build track segments
  const segs=[];
  let curY=0,curCurve=0;
  for(let i=0;i<CFG.segments;i++){
    const progress=i/CFG.segments;
    let curve;
    if(progress<.14)curve=0;
    else if(progress<.30)curve=2.4;
    else if(progress<.44)curve=-2.0;
    else if(progress<.58)curve=0;
    else if(progress<.72)curve=3.2;
    else if(progress<.86)curve=-2.8;
    else curve=0;
    const y1=curY, y2=curY+SEG_LEN;
    segs.push({index:i,y1,y2,curve,p1:{world:{y:curY,camY:0}},p2:{world:{y:y2,camY:0}},
      cars:[],color:Math.floor(i/3)%2,check:i>0&&i%Math.floor(CFG.segments/12)===0});
    curY=y2;
  }
  const trackLen=curY;
  const st={
    pos:0,speed:0,steer:0,lap:1,time:0,score:0,state:'menu',countdown:3,
    keys:{},raf:0,shake:0,camH:1000,engine:null,best:LS.get('racerBest',null),
    offRoad:0,lapStart:0,cp:[false,false,false],finished:false
  };
  // player
  const player={x:0,offset:0,speed:0,steer:0,z:0,w:1.6,color:'#37e0ff',isPlayer:true};
  const ai=[];
  // starting grid: two wide, three rows deep, all ahead of the player
  const GRID=CFG.ai>4
    ? [[-.30,34],[.38,42],[-.36,86],[.42,94],[0,138]]
    : [[-.32,34],[.32,42],[-.32,88],[.32,96],[0,140]];
  for(let i=0;i<CFG.ai;i++)ai.push({x:GRID[i][0],offset:0,z:GRID[i][1],
    maxSpeed:230+Math.random()*90,skill:.72+Math.random()*.25,color:AI_COLORS[i],isPlayer:false,wait:0});
  let all=[player,...ai];
  function segAt(z){
    if(!isFinite(z))z=0;
    const i=clamp(Math.floor(z/SEG_LEN),0,segs.length-1);
    return segs[i]||segs[0];
  }
  /* The engine is a continuous oscillator, so it cannot go through Audio2.tone.
   It feeds Audio2's shared bus like every other source; going straight to
   the destination is what left the system volume slider with no effect. */
  function setupEngine(){
    if(st.engine)return;
    try{
      Audio2.init();
      const c=Audio2.ctx;
      const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();
      o.type='sawtooth';o.frequency.value=60;
      f.type='lowpass';f.frequency.value=700;
      g.gain.value=0;
      o.connect(f);f.connect(g);g.connect(Audio2.bus);o.start();
      st.engine={ctx:c,osc:o,gain:g,filt:f};
    }catch(e){st.engine=null}
  }
  function engineSound(){
    if(!st.engine)return;
    const rpm=60+st.speed*1.5;
    st.engine.osc.frequency.setTargetAtTime(rpm,st.engine.ctx.currentTime,.08);
    st.engine.gain.gain.setTargetAtTime(st.state==='play'&&Audio2.on('game')?.035:0,st.engine.ctx.currentTime,.15);
    st.engine.filt.frequency.setTargetAtTime(300+st.speed*5,st.engine.ctx.currentTime,.1);
  }
  function reset(){
    st.pos=0;st.speed=0;st.lap=1;st.time=0;st.score=0;st.finished=false;
    st.cp=[false,false,false];st.lapStart=0;st.shake=0;
    player.x=0;player.z=0;player.speed=0;player.steer=0;
    /* Staggered two-wide grid ahead of the player. An evenly packed row piles
       every car on the same few pixels of road, which reads as a smear rather
       than a race start. */
    ai.forEach((c,i)=>{
      const col=(i%2)?1:-1, row=Math.floor(i/2);
      c.x=col*(.30+row*.06);
      c.z=34+row*52+(i%2?8:0);
      c.speed=0;c.wait=0;
    });
    all=[player,...ai];
  }
  function startCountdown(){
    st.state='count';
    st.countdown=3.6;
    ov.classList.add('hide');
    setupEngine();
    Audio2.resume();
  }
  function start(){reset();startCountdown()}
  function exit(){w._gameCleanup&&w._gameCleanup();WM.close(w.id);API.open('arcade',{single:false})}

  function update(dt){
    if(st.state==='count'){
      st.countdown-=dt;
      const n=Math.ceil(st.countdown);
      if(st.countdown<=0){st.state='play';st.lapStart=st.time;Audio2.tone(880,.25,'square',.09,undefined,undefined,'game')}
      return n;
    }
    if(st.state!=='play')return;
    st.time+=dt;
    const K=st.keys;
    // player input
    const acc=(K.ArrowUp||K.w)?1:0, brk=(K.ArrowDown||K.s)?1:0;
    const hb=K[' '];
    if(acc)st.speed+=CFG.accel*dt*(hb?.4:1);
    else if(brk)st.speed-=CFG.brake*dt;
    else st.speed-=60*dt;
    if(hb)st.speed-=240*dt;
    st.speed=clamp(st.speed,0,CFG.maxSpeed*(hb?.55:1));
    const turnRate=(1.9+st.speed/300)*dt*(hb?1.5:1);
    if(K.ArrowLeft||K.a){player.steer=clamp(player.steer-turnRate,-1,1)}
    else if(K.ArrowRight||K.d){player.steer=clamp(player.steer+turnRate,-1,1)}
    else player.steer*=Math.pow(.02,dt);
    player.speed=st.speed;
    // road curve pushes player
    const seg=segAt(player.z+st.speed*dt);
    const drift=seg.curve/20000*st.speed*dt*60;
    player.x+=player.steer*dt*3.2*(0.35+st.speed/300);
    player.x-=drift*.06;
    // centrifugal
    player.x-=seg.curve*.000020*st.speed*dt*100;
    const maxX=1.02;
    if(Math.abs(player.x)>maxX){
      // off-road: heavy drag and a shake, but never a dead stop — a car pinned
      // at 0 km/h with the throttle open is unrecoverable
      st.speed=Math.max(CFG.maxSpeed*.32,st.speed-460*dt);
      st.offRoad+=dt;
      if(st.offRoad>.4)st.shake=4;
    }else st.offRoad=0;
    player.x=clamp(player.x,-1.35,1.35);
    player.z+=st.speed*dt;
    // AI
    ai.forEach(c=>{
      const ahead=segAt(c.z+30);
      let target=c.maxSpeed*c.skill;
      // avoid player
      const dz=c.z-player.z;
      if(Math.abs(dz)<26&&Math.abs(c.x-player.x)<.16){target*=.72;c.x+=Math.sign(c.x-player.x||1)*dt*.5}
      c.speed+=(target-c.speed)*dt*1.6;
      c.z+=c.speed*dt;
      c.x-=ahead.curve*.000045*c.speed*dt*100;
      c.x=clamp(c.x,-1.2,1.2);
      c.x+=(Math.sin((st.time+c.z*.01)*1.4)*.02)*dt;
    });
    // collisions
    for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
      const a=all[i],b=all[j];
      if(Math.abs(a.z-b.z)<4.4&&Math.abs(a.x-b.x)<.19){
        const push=(a.isPlayer?-1:1);
        a.x+=push*.06;b.x-=push*.06;
        if(a.isPlayer||b.isPlayer){
          st.speed*=.62;st.shake=11;Audio2.crash();
          Audio2.tone(90,.25,'square',.09,50,undefined,'game');
        }
      }
    }
    // laps: track player.z wrap
    const segCount=segs.length*SEG_LEN;
    if(player.z>=segCount){
      player.z-=segCount;ai.forEach(c=>c.z-=segCount);
      st.lap++;
      if(st.lap>CFG.laps){finish();return}
      const lapTime=st.time-st.lapStart;
      st.lapStart=st.time;st.cp=[false,false,false];
      Achievements.grant('RACER');
      if(!st.best||lapTime<st.best){st.best=lapTime;LS.set('racerBest',lapTime);
        Notify.send('New best lap','Cyber Racer — '+formatLap(lapTime),{icon:ICONS.media,app:'arcade'})}
      w.body.querySelector('[data-best]').textContent=formatLap(st.best);
      st.score+=Math.max(60,Math.round(900-lapTime*10));
      Audio2.win();
    }
    // checkpoints
    const prog=(player.z%segCount)/segCount;
    const cpIdx=Math.floor(prog*3);
    if(cpIdx>=0&&cpIdx<3&&!st.cp[cpIdx]){
      st.cp[cpIdx]=true;
      Audio2.tone(700+cpIdx*180,.1,'sine',.07,undefined,undefined,'game');
    }
    engineSound();
    hud.spd.textContent=Math.round(st.speed*0.62);
    hud.lap.textContent=st.lap+'/'+CFG.laps;
    hud.time.textContent=fmtTime(st.time);
    hud.score.textContent=st.score;
    const rank=1+ai.filter(c=>c.z>player.z).length;
    hud.pos.textContent=rank+'/'+all.length;
  }
  function finish(){
    st.state='over';st.finished=true;
    st.score+=Math.round(st.time*20);
    const won=1+ai.filter(c=>c.z>player.z).length===1;
    if(won)st.score+=1500;
    Audio2.tone(300,.5,'sawtooth',.1,80,undefined,'game');
    ov.classList.remove('hide');
    ov.innerHTML=`
      <h2>${won?'RACE WON':'RACE COMPLETE'}</h2>
      <p style="font-size:15px;color:#fff">${formatLap(st.time)} total · best lap ${formatLap(st.best||st.time)}</p>
      <p>Score <b>${st.score}</b> · ${won?'You took the win.':'You finished behind the pack.'}
         Session best lap: ${GAMES.racer.best()}.</p>
      <button class="btn pri" data-go style="padding:11px 30px">↻ RACE AGAIN <span style="opacity:.6;font-size:11px">(R)</span></button>
      <button class="btn" data-exit>Back to Arcade</button>`;
    ov.querySelector('[data-go]').onclick=start;
    ov.querySelector('[data-exit]').onclick=exit;
    Notify.send(won?'Race won':'Race finished',`Score ${st.score} · best lap ${formatLap(st.best||st.time)}`,
      {icon:ICONS.media,app:'arcade'});
  }
  function fmtTime(s){
    const m=(s/60)|0,sec=(s%60);
    return m+':'+(sec<10?'0':'')+sec.toFixed(3);
  }
  ov.querySelector('[data-go]').onclick=start;
  ov.querySelector('[data-exit]').onclick=exit;

  const onKey=e=>{
    const k=e.key.length===1?e.key.toLowerCase():e.key;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)){
      st.keys[e.key]=true;
      if(st.state==='play'||st.state==='count')e.preventDefault();
    }
    if(k==='r'||k==='R'){if(st.state!=='menu')start()}
    if(k==='Escape')exit();
    if(k==='Enter'&&st.state==='menu')start();
  };
  const onKeyUp=e=>{st.keys[e.key.length===1?e.key.toLowerCase():e.key]=false};
  w.el.addEventListener('keydown',onKey);
  window.addEventListener('keyup',onKeyUp);
  w.el.tabIndex=0;

  /* ---- perspective projection ------------------------------------------
     A point dz units in front of the camera has scale camD/dz, so it shrinks
     with distance and the road converges on the horizon. Road curvature is
     applied by accumulating each segment's `curve` into a lateral offset as we
     walk forward from the camera.

     This used a constant scale, which made every segment the same width, so the
     track rendered as a vertical band across the sky instead of a road. */
  function projX(dz){return camD/Math.max(40,dz)}
  function draw(ts){
    st.raf=requestAnimationFrame(draw);
    const d=Math.min(devicePixelRatio||1,2);
    const r=cv.getBoundingClientRect();
    if(cv.width!==Math.round(r.width*d)){cv.width=Math.round(r.width*d);cv.height=Math.round(r.height*d)}
    ctx.setTransform(d,0,0,d,0,0);
    const W=cv.width/d,H=cv.height/d;
    /* Clamped on both ends: a clock jump (tab restore, sleep) can hand us a
       negative delta, which would run the simulation backwards and poison
       every position with NaN. */
    const dt=clamp((ts-(st._t||ts))/1000,0,.05);st._t=ts;
    const cd=update(dt);
    if(st.state==='count')drawCountdown(cd,W,H);
    drawScene(W,H,player.z,player.x,ts);
    if(st.shake>0){st.shake*=.9}
  }
  /* W/H are CSS pixels: ctx already carries the devicePixelRatio transform, so
     using cv.width/cv.height here would draw the veil at 2x size on HiDPI and
     place the digits outside the canvas. */
  function drawCountdown(n,W,H){
    ctx.save();
    ctx.fillStyle='rgba(4,6,12,.55)';ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.font='700 110px '+getComputedStyle(document.body).fontFamily;
    if(n>0){
      ctx.fillStyle=S.accent;ctx.shadowColor=S.accent;ctx.shadowBlur=40;
      ctx.fillText(String(n),W/2,H/2);
    }else{
      ctx.fillStyle='#3ddc84';ctx.shadowColor='#3ddc84';ctx.shadowBlur=40;
      ctx.font='700 68px '+getComputedStyle(document.body).fontFamily;
      ctx.fillText('GO',W/2,H/2);
    }
    ctx.restore();
  }
  function drawScene(W,H,playerZ,playerX,ts){
    const HZ=H*.5;                 // the horizon is where the road converges
    ctx.fillStyle='#05040e';ctx.fillRect(0,0,W,H);
    // sky gradient + sun
    const sky=ctx.createLinearGradient(0,0,0,HZ);
    sky.addColorStop(0,'#0b0320');sky.addColorStop(.55,'#2a0b3d');sky.addColorStop(1,'#5b1046');
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,HZ);
    ctx.save();
    ctx.beginPath();ctx.arc(W/2,HZ-Math.min(W,H)*.2,Math.min(W,H)*.19,0,7);ctx.clip();
    const sg=ctx.createLinearGradient(0,HZ-Math.min(W,H)*.42,0,HZ+Math.min(W,H)*.02);
    sg.addColorStop(0,'#ffd76b');sg.addColorStop(.5,'#ff5fa2');sg.addColorStop(1,'#8b2be2');
    ctx.fillStyle=sg;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(8,3,20,.9)';
    for(let i=0;i<9;i++){const y=HZ-Math.min(W,H)*.36+i*Math.min(W,H)*.034;ctx.fillRect(0,y,W,2+i*.7)}
    ctx.restore();
    // stars
    ctx.fillStyle='rgba(255,255,255,.5)';
    for(let i=0;i<40;i++){
      const x=(i*97.3)%W, y=((i*53.7)%(HZ*.8));
      ctx.fillRect(x,y,1.4,1.4);
    }
    // ground
    const base=ctx.createLinearGradient(0,HZ,0,H);
    base.addColorStop(0,'#0a0618');base.addColorStop(1,'#150a24');
    ctx.fillStyle=base;ctx.fillRect(0,HZ,W,H-HZ);

    /* Walk the track forward from the camera, accumulating curvature, then
       paint far -> near so nearer segments overlap correctly.

       The walk starts at NEAR_DIST, not at the camera itself: a segment sitting
       exactly on the camera has zero depth, so its projected width is
       effectively infinite and it floods the whole screen with road. */
    const camZ=playerZ-CAM_BACK;
    const camLat=playerX*ROAD_HALF*.9;
    const NEAR_DIST=Math.max(60,CAM_BACK*.09);
    const baseI=clamp(Math.floor(camZ/SEG_LEN),0,segs.length-1);
    const basePct=(camZ-baseI*SEG_LEN)/SEG_LEN;
    let curveX=-(segs[baseI]?segs[baseI].curve*basePct:0);
    let dCurve=segs[baseI]?segs[baseI].curve:0;

    // near -> far
    const pts=[];
    for(let n=0;n<=DRAW_RANGE;n++){
      const i=baseI+n;
      const s=segs[((i%segs.length)+segs.length)%segs.length];
      const dzN=NEAR_DIST+n*SEG_LEN, dzF=dzN+SEG_LEN;
      curveX=curveX+dCurve;
      const scN=projX(dzN), scF=projX(dzF);
      pts.push({s,curveX,
        cxN:W/2+scN*(curveX-camLat)*W/2, cxF:W/2+scF*(curveX-camLat)*W/2,
        yN:H/2+scN*camH*H*.5,    yF:H/2+scF*camH*H*.5,
        hwN:scN*ROAD_HALF*W/2,   hwF:scF*ROAD_HALF*W/2});
      dCurve=s.curve;
    }
    // far -> near
    const segPts=pts.slice().reverse();

    // grass bands
    segPts.forEach(({s,yN,yF})=>{
      ctx.fillStyle=s.color?'#100a20':'#0d0819';
      ctx.fillRect(0,Math.min(yN,yF),W,Math.abs(yF-yN)+1.5);
    });
    // road surface
    segPts.forEach(({s,cxN,cxF,yN,yF,hwN,hwF})=>{
      if(hwN<.4)return;
      ctx.fillStyle='#1b1b28';
      ctx.beginPath();
      ctx.moveTo(cxN-hwN,yN);ctx.lineTo(cxN+hwN,yN);
      ctx.lineTo(cxF+hwF,yF);ctx.lineTo(cxF-hwF,yF);
      ctx.closePath();ctx.fill();
      // rumble
      const rc=s.color?'#ff2e63':'#37e0ff';
      ctx.fillStyle=rc;
      ctx.fillRect(cxN-hwN-3,yN,3,Math.abs(yF-yN)+1.5);
      ctx.fillRect(cxN+hwN,yN,3,Math.abs(yF-yN)+1.5);
      // lane markers
      if(!s.color){
        ctx.fillStyle='rgba(255,255,255,.28)';
        for(let l=-1;l<2;l++){
          const o=l*.33;
          ctx.fillRect(cxN-hwN*o-1,yN,2,Math.abs(yF-yN)+1.5);
        }
      }
      // checkpoints
      if(s.check){
        ctx.fillStyle='rgba(61,220,132,.22)';
        ctx.fillRect(cxN-hwN,yN,hwN*2,Math.abs(yF-yN)+1.5);
        ctx.fillStyle='#3ddc84';
        ctx.fillRect(cxN-hwN,yN,4,Math.abs(yF-yN)+1.5);
        ctx.fillRect(cxN+hwN-4,yN,4,Math.abs(yF-yN)+1.5);
      }
    });
    // side neon posts
    segPts.filter((_,i)=>i%6===0).forEach(({cxN,hwN,yN})=>{
      const hgt=Math.max(6,hwN*.5);
      ctx.fillStyle='rgba(176,107,255,.7)';
      ctx.fillRect(cxN-hwN-10,yN-hgt,3,hgt);
      ctx.fillRect(cxN+hwN+7,yN-hgt,3,hgt);
    });
    /* Cars: each one is projected against the same accumulated curve, sampled
       at its own distance. A car is only meaningful if it is ahead of the
       camera, so anything at or behind it is skipped. */
    const cars=all.map(c=>{
      const dz=c.z-camZ;
      if(dz<=0)return null;
      // lateral offset at that distance: re-walk the accumulated curve
      const i0=clamp(Math.floor((dz-NEAR_DIST)/SEG_LEN),0,pts.length-1);
      const p=pts[i0];
      if(!p)return null;
      const sc=projX(dz);
      const ox=c.x*ROAD_HALF;
      return {c,x:W/2+sc*(p.curveX+ox-camLat)*W/2,
              y:H/2+sc*camH*H*.5,cw:Math.max(3,sc*CAR_W*W/2)};
    }).filter(Boolean).sort((a,b)=>b.cw-a.cw);
    cars.forEach(({c,x,y,cw})=>{
      if(y>H+80||y<-40)return;
      const ch=cw*1.5;
      if(c.isPlayer)ctx.shadowColor=S.accent;
      else ctx.shadowColor=c.color;
      ctx.shadowBlur=c.isPlayer?22:12;
      ctx.fillStyle=c.color;
      ctx.beginPath();
      const bw=cw*.5,bh=ch*.34;
      ctx.moveTo(x-bw,y);ctx.lineTo(x+bw,y);
      ctx.lineTo(x+bw*.9,y-bh);ctx.lineTo(x-bw*.9,y-bh);ctx.closePath();ctx.fill();
      // cabin
      ctx.fillStyle='rgba(6,8,20,.92)';
      const tw=cw*.34,th=ch*.28;
      ctx.beginPath();
      ctx.moveTo(x-tw,y-bh*1.06);ctx.lineTo(x+tw,y-bh*1.06);
      ctx.lineTo(x+tw*.8,y-bh*1.06-th);ctx.lineTo(x-tw*.8,y-bh*1.06-th);
      ctx.closePath();ctx.fill();
      // tail lights
      ctx.fillStyle='#ff2e63';ctx.shadowBlur=6;
      ctx.fillRect(x-bw*.8,y-3,cw*.18,3);
      ctx.fillRect(x+bw*.62,y-3,cw*.18,3);
      ctx.shadowBlur=0;
      // wheels
      ctx.fillStyle='#0a0a12';
      ctx.fillRect(x-bw-2,y-bh*.5,3,ch*.12);
      ctx.fillRect(x+bw-1,y-bh*.5,3,ch*.12);
      // steering indicator under the nose
      if(c.isPlayer&&Math.abs(player.steer)>.3){
        ctx.fillStyle='rgba(255,46,99,.5)';
        ctx.fillRect(x-player.steer*cw*.3-bw*.4,y-ch*.2,cw*.8,3);
      }
    });
    // fog, anchored to the horizon so the far track dissolves into the sky
    const fog=ctx.createLinearGradient(0,HZ-H*.04,0,HZ+H*.18);
    fog.addColorStop(0,'rgba(8,3,24,.95)');fog.addColorStop(1,'rgba(8,3,24,0)');
    ctx.fillStyle=fog;ctx.fillRect(0,HZ-H*.04,W,H*.22);
    // speed lines
    if(st.speed>CFG.maxSpeed*.7){
      ctx.strokeStyle='rgba(55,224,255,'+(.06+(st.speed/CFG.maxSpeed-.7)*.2).toFixed(3)+')';
      ctx.lineWidth=2;
      for(let i=0;i<14;i++){
        const y=((ts*.02*(st.speed/60)+i*67)%(H+80))-40;
        const x=((i*137)%W);
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+50);ctx.stroke();
      }
    }
    // damage vignette
    if(Math.abs(player.x)>1){
      const v=ctx.createLinearGradient(0,0,0,H);
      v.addColorStop(0,'rgba(255,46,99,'+(Math.abs(player.x)-1)*.5+')');
      v.addColorStop(.4,'rgba(255,46,99,0)');
      ctx.fillStyle=v;ctx.fillRect(0,0,W,H);
    }
    // minimap — plot the real track shape, not a straight line
    const mw=Math.min(150,W*.22),mh=mw/3,mx=W-mw-14,my=H-mh-14;
    ctx.fillStyle='rgba(6,4,18,.7)';roundRectPath(ctx,mx,my,mw,mh,7);ctx.fill();
    ctx.strokeStyle='rgba(55,224,255,.3)';ctx.lineWidth=1;roundRectPath(ctx,mx,my,mw,mh,7);ctx.stroke();
    const segCount=segs.length*SEG_LEN;
    // lay the circuit out on the minimap by accumulating curve into lateral offset
    const mapPts=[];let mxAcc=0;
    segs.forEach((s,i)=>{
      if(i)mxAcc+=segs[i-1].curve*8;
      mapPts.push({x:mx+mxAcc,y:my+mh*(s.y1/segCount)});
    });
    let minX=Infinity,maxX=-Infinity;
    mapPts.forEach(p=>{if(p.x<minX)minX=p.x;if(p.x>maxX)maxX=p.x});
    const span=Math.max(1,maxX-minX),cxm=(minX+maxX)/2;
    mapPts.forEach(p=>{p.x=mx+mw*.1+(p.x-cxm)*mw*.8/span;p.y=my+mh*.08+(p.y-my-mh*.5)*mh*.84+mh*.42});
    ctx.strokeStyle='rgba(255,255,255,.28)';
    ctx.beginPath();
    mapPts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.closePath();ctx.stroke();
    const onMap=z=>{
      if(!isFinite(z))return mapPts[0];
      return mapPts[clamp(Math.floor(((z%segCount+segCount)%segCount)/SEG_LEN),0,mapPts.length-1)]||mapPts[0];
    };
    all.forEach(c=>{
      const p=onMap(c.z);
      ctx.fillStyle=c.color;
      ctx.beginPath();ctx.arc(p.x,p.y,c.isPlayer?3.4:2.4,0,7);ctx.fill();
    });
  }
  function roundRectPath(c,x,y,w,h,r){
    c.beginPath();
    c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);
    c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);
    c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
  }
  draw(performance.now());
  w._game=st;
  w._gameCleanup=()=>{
    cancelAnimationFrame(st.raf);
    w.el.removeEventListener('keydown',onKey);
    window.removeEventListener('keyup',onKeyUp);
    if(st.engine){try{st.engine.osc.stop();st.engine.ctx.close()}catch(e){}}
    st.engine=null;
    w._gameCleanup=null;
  };
  setTimeout(()=>w.el.focus(),60);
}
