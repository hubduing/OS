function buildSnake(w){
  const DIFF={
    calm:{name:'Calm',step:700,speedUp:0.55,label:'for thinking'},
    normal:{name:'Normal',step:550,speedUp:1,label:'the intended experience'},
    brutal:{name:'Brutal',step:400,speedUp:1.7,label:'good luck'}
  };
  const diff=LS.get('snakeDiff','normal');
  w.body.innerHTML=`<div class="gm">
    <canvas class="gmCanvas"></canvas>
    <div class="gmHud">
      <div class="s"><span>SCORE</span><b data-score>0</b></div>
      <div class="s"><span>BEST</span><b data-best>0</b></div>
      <div class="s"><span>LENGTH</span><b data-len>3</b></div>
      <div class="s"><span>LEVEL</span><b data-lvl>1</b></div>
      <div class="s" style="margin-left:auto;text-align:right"><span>DIFFICULTY</span>
        <b data-diff style="font-size:13px">${DIFF[diff].name}</b></div>
    </div>
    <div class="gmKeys">
      ARROWS / WASD — steer &nbsp;·&nbsp; SPACE — pause &nbsp;·&nbsp; R — restart &nbsp;·&nbsp; ESC — exit
    </div>
    <div class="gmOverlay" data-ov>
      <h2>NEON SNAKE</h2>
      <p>Steer with the arrow keys or WASD. Each pellet adds length and raises the step rate.
         Running into yourself or a wall ends the run.</p>
      <div class="diffbar">
        ${Object.entries(DIFF).map(([k,v])=>`<button class="btn${k===diff?' pri':''}" data-d="${k}">${v.name}<span style="opacity:.6;font-size:10px"> · ${v.label}</span></button>`).join('')}
      </div>
      <button class="btn pri" data-play style="padding:11px 34px;font-size:14px">▶ START RUN</button>
    </div>
  </div>`;
  const cv=w.body.querySelector('canvas'),ctx=cv.getContext('2d');
  const ov=w.body.querySelector('[data-ov]');
  const hud={score:w.body.querySelector('[data-score]'),best:w.body.querySelector('[data-best]'),
    len:w.body.querySelector('[data-len]'),lvl:w.body.querySelector('[data-lvl]')};
  const N=22;
  const st={snake:[],dir:{x:1,y:0},next:{x:1,y:0},food:{x:5,y:5},score:0,level:1,
    step:DIFF[diff].step,acc:0,last:0,state:'menu',shake:0,diff,particles:[],trail:[],flash:0,raf:0};
  hud.best.textContent=GAMES.snake.best();

  function fit(){
    const r=cv.getBoundingClientRect();
    const d=Math.min(devicePixelRatio||1,2);
    cv.width=Math.max(300,r.width*d);cv.height=Math.max(300,r.height*d);
    ctx.setTransform(d,0,0,d,0,0);
    st.cell=Math.floor(Math.min(cv.width,cv.height)/N);
    st.ox=(cv.width-st.cell*N)/2; st.oy=(cv.height-st.cell*N)/2;
  }
  function reset(){
    const c=Math.floor(N/2);
    st.snake=[{x:c,y:c},{x:c-1,y:c},{x:c-2,y:c}];
    st.dir={x:1,y:0};st.next={x:1,y:0};
    st.score=0;st.level=1;st.step=DIFF[st.diff].step;st.acc=0;st.shake=0;st.particles=[];
    placeFood();syncHUD();
  }
  function placeFood(){
    const free=[];
    for(let y=0;y<N;y++)for(let x=0;x<N;x++)
      if(!st.snake.some(s=>s.x===x&&s.y===y))free.push({x,y});
    st.food=free.length?free[(Math.random()*free.length)|0]:null;
  }
  function syncHUD(){
    hud.score.textContent=st.score;hud.len.textContent=st.snake.length;
    hud.lvl.textContent=st.level;
    hud.best.textContent=Math.max(GAMES.snake.best(),st.score);
  }
  function turn(x,y){
    if(st.dir.x===-x&&st.dir.y===-y)return;
    st.next={x,y};
  }
  function step(){
    st.dir=st.next;
    const h=st.snake[0];
    const nx=h.x+st.dir.x, ny=h.y+st.dir.y;
    if(nx<0||ny<0||nx>=N||ny>=N)return die('wall');
    if(st.snake.some(s=>s.x===nx&&s.y===ny))return die('self');
    st.snake.unshift({x:nx,y:ny});
    if(st.food&&nx===st.food.x&&ny===st.food.y){
      st.score+=10*st.level;
      st.level=1+Math.floor(st.score/50);
      st.step=Math.max(330,DIFF[st.diff].step-(st.level-1)*3*DIFF[st.diff].speedUp);
      st.shake=7;st.flash=1;
      Audio2.init();
      Audio2.tone(560+st.level*40,.07,'square',.07,900+st.level*90,undefined,'game');
      Audio2.tone(1200+st.level*60,.05,'sine',.04,1600,.05,'game');
      burst(nx,ny);
      placeFood();
      if(st.score>GAMES.snake.best())LS.set('snakeBest',st.score);
      if(st.score>=50)Achievements.grant('HIGH_SCORE');
      syncHUD();
    }else st.snake.pop();
    st.trail.push({x:nx,y:ny,a:1});
    if(st.trail.length>14)st.trail.shift();
  }
  function burst(gx,gy){
    for(let i=0;i<18;i++)st.particles.push({
      x:st.ox+gx*st.cell+st.cell/2, y:st.oy+gy*st.cell+st.cell/2,
      vx:(Math.random()-.5)*4.4, vy:(Math.random()-.5)*4.4, a:1,
      c:Math.random()<.5?S.accent:S.accent3||'#ff4d9d'});
  }
  function die(cause){
    st.state='over';
    Audio2.init();
    Audio2.tone(300,.5,'sawtooth',.12,60,undefined,'game');
    Audio2.noise(.3,.1,undefined,'game');
    const best=GAMES.snake.best();
    const isBest=st.score>best;
    if(isBest)LS.set('snakeBest',st.score);
    if(st.score>=50)Achievements.grant('HIGH_SCORE');
    ov.classList.remove('hide');
    ov.innerHTML=`
      <h2>${isBest?'NEW RECORD':'RUN OVER'}</h2>
      <p style="font-size:15px;color:#fff">${st.score} points · length ${st.snake.length} · level ${st.level}</p>
      <p>${isBest?'That is a personal best. It has been written to your browser.':'You hit the '+cause+'. Best so far: '+GAMES.snake.best()+'.'}</p>
      <button class="btn pri" data-play style="padding:11px 32px">↻ RUN AGAIN <span style="opacity:.6;font-size:11px">(R)</span></button>
      <button class="btn" data-exit>Back to Arcade</button>`;
    ov.querySelector('[data-play]').onclick=start;
    ov.querySelector('[data-exit]').onclick=exit;
    Notify.send(isBest?'New high score!':'Snake run ended',
      `${st.score} points on ${DIFF[st.diff].name} · best ${GAMES.snake.best()}`,
      {icon:ICONS.games,app:'arcade'});
  }
  function start(){
    reset();st.state='play';ov.classList.add('hide');st.last=performance.now();
    Audio2.resume();
    w.el.focus&&w.el.focus();
  }
  function pause(){
    if(st.state!=='play')return;
    st.state='pause';
    ov.classList.remove('hide');
    ov.innerHTML=`<h2>PAUSED</h2><p>Score ${st.score} · length ${st.snake.length}</p>
      <button class="btn pri" data-play>▶ RESUME <span style="opacity:.6;font-size:11px">(Space)</span></button>
      <button class="btn" data-quit>End run</button>`;
    ov.querySelector('[data-play]').onclick=resume;
    ov.querySelector('[data-quit]').onclick=exit;
  }
  function resume(){st.state='play';ov.classList.add('hide');st.last=performance.now()}
  function exit(){
    w._gameCleanup&&w._gameCleanup();
    WM.get(w.id)&&WM.close(w.id);
    API.open('arcade',{single:false});
  }
  w.body.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{
    st.diff=b.dataset.d;LS.set('snakeDiff',st.diff);
    w.body.querySelector('[data-diff]').textContent=DIFF[st.diff].name;
    w.body.querySelectorAll('[data-d]').forEach(x=>x.classList.toggle('pri',x===b));
    Audio2.click();reset();
  });
  ov.querySelector('[data-play]').onclick=start;

  const onKey=e=>{
    const k=e.key;
    if(k==='ArrowUp'||k==='w'||k==='W'){turn(0,-1);e.preventDefault()}
    else if(k==='ArrowDown'||k==='s'||k==='S'){turn(0,1);e.preventDefault()}
    else if(k==='ArrowLeft'||k==='a'||k==='A'){turn(-1,0);e.preventDefault()}
    else if(k==='ArrowRight'||k==='d'||k==='D'){turn(1,0);e.preventDefault()}
    else if(k===' '){
      e.preventDefault();
      st.state==='play'?pause():st.state==='pause'?resume():start();
    }
    else if(k==='r'||k==='R')start();
    else if(k==='Escape')exit();
  };
  w.el.addEventListener('keydown',onKey);
  w.el.tabIndex=0;
  const onTouch=(x,y)=>{
    if(st.state!=='play')return;
    st.tdx=x;st.tdy=y;
  };
  let tdx=0,tdy=0;
  cv.addEventListener('pointerdown',e=>{
    const r=cv.getBoundingClientRect();
    tdx=(e.clientX-r.left)/r.width-.5; tdy=(e.clientY-r.top)/r.height-.5;
  });
  w.el.addEventListener('touchstart',e=>{
    const t=e.touches[0];
    st.touch={x:t.clientX,y:t.clientY};
  },{passive:true});
  w.el.addEventListener('touchmove',e=>{
    if(!st.touch)return;
    e.preventDefault();
    const t=e.touches[0],dx=t.clientX-st.touch.x,dy=t.clientY-st.touch.y;
    if(Math.abs(dx)>22||Math.abs(dy)>22){
      if(Math.abs(dx)>Math.abs(dy))turn(Math.sign(dx),0);else turn(0,Math.sign(dy));
      st.touch={x:t.clientX,y:t.clientY};
    }
  },{passive:false});

  function draw(ts){
    st.raf=requestAnimationFrame(draw);
    const W=cv.width,H=cv.height,C=st.cell;
    fitIfNeeded();
    const dt=Math.min(50,ts-st.last);
    if(st.state==='play'){
      st.acc+=dt*(S.animations?1:0.5);
      while(st.acc>=st.step){st.acc-=st.step;step();if(st.state!=='play')break}
    }
    if(st.tdx||st.tdy){
      if(Math.abs(st.tdx)>.18&&Math.abs(st.tdx)>Math.abs(st.tdy)){turn(Math.sign(st.tdx),0)}
      else if(Math.abs(st.tdy)>.18){turn(0,Math.sign(st.tdy))}
      st.tdx=0;st.tdy=0;
    }
    ctx.save();
    if(st.shake>0){
      st.shake*=.86;
      ctx.translate((Math.random()-.5)*st.shake,(Math.random()-.5)*st.shake);
    }
    ctx.fillStyle='#050810';ctx.fillRect(-20,-20,W+40,H+40);
    // grid
    ctx.strokeStyle='rgba(55,224,255,.07)';ctx.lineWidth=1;
    ctx.beginPath();
    for(let i=0;i<=N;i++){
      ctx.moveTo(st.ox+i*C,st.oy);ctx.lineTo(st.ox+i*C,st.oy+N*C);
      ctx.moveTo(st.ox,st.oy+i*C);ctx.lineTo(st.ox+N*C,st.oy+i*C);
    }
    ctx.stroke();
    ctx.strokeStyle=hexA(S.accent,.32);ctx.lineWidth=2;
    ctx.strokeRect(st.ox-1,st.oy-1,N*C+2,N*C+2);
    // trail
    st.trail.forEach((t,i)=>{
      ctx.globalAlpha=(i/st.trail.length)*.12;
      ctx.fillStyle=S.accent;
      ctx.fillRect(st.ox+t.x*C,st.oy+t.y*C,C,C);
    });
    ctx.globalAlpha=1;
    // snake
    st.snake.forEach((s,i)=>{
      const t=i/Math.max(1,st.snake.length-1);
      const pad=i===0?0:C*0.09;
      const hue=i===0?S.accent:(i<6?S.accent:hexA(S.accent,clamp(1-t*1.3,0.18,1)));
      ctx.fillStyle=i===0?S.accent:(i<7?hexA(S.accent,clamp(1-t*.9,.3,1)):hexA('#3ddc84',clamp(1-t*.6,.2,1)));
      ctx.shadowColor=S.accent;ctx.shadowBlur=i===0?18:8;
      const r=i===0?C*.28:C*.3;
      roundRect(ctx,st.ox+s.x*C+pad,st.oy+s.y*C+pad,C-pad*2,C-pad*2,r);
      ctx.fill();
      ctx.shadowBlur=0;
    });
    // head eyes
    const h=st.snake[0];
    if(h){
      ctx.fillStyle='#04121a';
      const ex=st.ox+h.x*C+C/2+st.dir.x*C*.16, ey=st.oy+h.y*C+C/2+st.dir.y*C*.16;
      const px=st.dir.y*C*.17, py=st.dir.x*C*.17;
      ctx.beginPath();ctx.arc(ex-px,ey-py,C*.09,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(ex+px,ey+py,C*.09,0,7);ctx.fill();
    }
    // food
    if(st.food){
      const fx=st.ox+st.food.x*C+C/2, fy=st.oy+st.food.y*C+C/2;
      const pulse=1+Math.sin(ts/160)*.14;
      ctx.save();
      ctx.shadowColor='#ff4d9d';ctx.shadowBlur=22;
      ctx.fillStyle='#ff4d9d';
      ctx.beginPath();ctx.arc(fx,fy,C*.3*pulse,0,7);ctx.fill();
      ctx.shadowBlur=8;ctx.strokeStyle='rgba(255,77,157,.65)';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(fx,fy,C*.48*pulse,0,7);ctx.stroke();
      ctx.restore();
    }
    // particles
    st.particles.forEach((p,i)=>{
      p.x+=p.vx;p.y+=p.vy;p.vy*=.94;p.vx*=.94;p.a-=.045;
      ctx.globalAlpha=Math.max(0,p.a);ctx.fillStyle=p.c;
      ctx.fillRect(p.x-2,p.y-2,4,4);
    });
    st.particles=st.particles.filter(p=>p.a>0);
    ctx.globalAlpha=1;
    if(st.flash>0){
      st.flash*=.9;
      ctx.fillStyle=hexA(S.accent,st.flash*.10);
      ctx.fillRect(0,0,W,H);
    }
    if(st.state==='pause'){ctx.fillStyle='rgba(5,8,16,.4)';ctx.fillRect(0,0,W,H)}
    ctx.restore();
  }
  let lastW=0,lastH=0;
  function fitIfNeeded(){
    const r=cv.getBoundingClientRect();
    if(Math.abs(r.width-lastW)<1&&Math.abs(r.height-lastH)<1)return;
    lastW=r.width;lastH=r.height;fit();
  }
  function roundRect(c,x,y,w,h,r){
    c.beginPath();
    c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);
    c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);
    c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);
    c.closePath();
  }
  fit();reset();
  w._game=st;
  st.raf=requestAnimationFrame(draw);
  w._gameCleanup=()=>{
    cancelAnimationFrame(st.raf);
    w.el.removeEventListener('keydown',onKey);
    w._gameCleanup=null;
  };
  setTimeout(()=>{w.el.focus()},60);
}

/* ---------- CYBER RACER ---------- */
