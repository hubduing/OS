/* ============================================================
   PART 7 — NEXUS ARCADE: NEON SNAKE + CYBER RACER
   ============================================================ */
const GAMES={
  snake:{id:'snake',name:'Neon Snake',desc:'Grid arcade. Eat, grow, survive. Speed rises with every pellet.',
    best:()=>LS.get('snakeBest',0)},
  racer:{id:'racer',name:'Cyber Racer',desc:'Pseudo-3D night circuit. Five rivals, three checkpoints a lap.',
    best:()=>{const v=LS.get('racerBest',null);return v?formatLap(v):'—'}}
};

/* ---------- ARCADE HUB ---------- */
APPS.arcade={
  title:'NEXUS ARCADE',icon:ICONS.games,desc:'Games',w:820,h:600,
  build(w,opts){
    w.body.innerHTML=`<div class="arcadeHome">
      <h1>NEXUS ARCADE</h1>
      <div class="sub">TWO GAMES · CANVAS RENDERED · SCORES PERSIST</div>
      <div class="gcards"></div>
    </div>`;
    const home=w.body.querySelector('.arcadeHome');
    const cards=w.body.querySelector('.gcards');
    function renderHome(){
      home.style.display='';
      Object.values(GAMES).forEach(g=>{
        const c=el('button','gcard',cards);
        c.innerHTML=`<div class="gthumb"><canvas width="320" height="118"></canvas>
          <span class="hs">BEST ${g.id==='snake'?g.best():g.best()}</span></div>
          <div class="info"><b>${g.name}</b><span>${g.desc}</span></div>`;
        const cv=c.querySelector('canvas'),x=cv.getContext('2d');
        let f=0;
        const anim=()=>{
          if(!c.isConnected)return;
          f++;
          x.clearRect(0,0,320,118);
          x.fillStyle='#04060d';x.fillRect(0,0,320,118);
          if(g.id==='snake'){
            x.strokeStyle='rgba(55,224,255,.13)';x.lineWidth=1;
            for(let i=0;i<10;i++){x.beginPath();x.moveTo(0,i*12);x.lineTo(320,i*12);x.stroke();
              x.beginPath();x.moveTo(i*32,0);x.lineTo(i*32,118);x.stroke()}
            x.shadowBlur=12;x.shadowColor='#37e0ff';x.fillStyle='#37e0ff';
            for(let i=0;i<7;i++){x.beginPath();
              x.arc(20+i*44, 30+((i*23+f*1.6)%70), 6, 0, 7);x.fill()}
            x.shadowColor='#ff4d9d';x.fillStyle='#ff4d9d';
            x.beginPath();x.arc(250+Math.sin(f/22)*40,55+Math.cos(f/18)*26,5,0,7);x.fill();
            x.shadowBlur=0;
          }else{
            x.fillStyle='rgba(176,107,255,.10)';x.fillRect(0,0,320,118);
            x.strokeStyle='rgba(55,224,255,.5)';
            const rows=[];
            for(let i=0;i<16;i++)rows.push({y:((i*10+f*3)%140)-20,w:2+i*13});
            rows.forEach((r,i)=>{
              x.globalAlpha=.25+i/26;
              x.fillStyle=i%2?'#37e0ff':'#ff4d9d';
              x.fillRect(160-r.w/2,r.y,r.w,2);
            });
            x.globalAlpha=1;
            const cy=76+Math.sin(f/12)*7;
            x.fillStyle='#b06bff';x.beginPath();
            x.moveTo(160,cy-11);x.lineTo(170,cy+9);x.lineTo(160,cy+4);x.lineTo(150,cy+9);x.closePath();x.fill();
            x.shadowBlur=14;x.shadowColor='#b06bff';x.fill();
            x.shadowBlur=0;
            [130,190,225,255,290].forEach((ox,i)=>{
              const sc=.4+i*.05, oy=cy-(cy-70)*sc*.35;
              x.globalAlpha=.35+sc*.4;x.fillStyle='#37e0ff';
              x.beginPath();
              x.moveTo(ox,oy-7*sc);x.lineTo(ox+7*sc,oy+7*sc);x.lineTo(ox,oy+3*sc);x.lineTo(ox-7*sc,oy+7*sc);
              x.closePath();x.fill();
            });
            x.globalAlpha=1;
          }
          requestAnimationFrame(anim);
        };
        anim();
        c.onclick=()=>launch(g.id);
      });
    }
    function launch(game){
      home.style.display='none';
      if(game==='snake')buildSnake(w);
      else buildRacer(w);
    }
    renderHome();
    if(opts.game)setTimeout(()=>launch(opts.game),50);
    return {destroy(){w._gameCleanup&&w._gameCleanup()}};
  }
};

/* ---------- NEON SNAKE ---------- */
