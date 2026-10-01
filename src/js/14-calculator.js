/* ============================================================
   PART 5 — CALCULATOR, BROWSER, PAINT, MEDIA
   ============================================================ */
/* ---------- CALCULATOR ---------- */
APPS.calculator={
  title:'Calculator',icon:ICONS.calc,desc:'NexusCalc',w:340,h:520,resizable:false,
  build(w){
    w.body.innerHTML=`<div class="calc">
      <div class="calcDisp"><div class="calcExpr">&nbsp;</div><div class="calcVal">0</div></div>
      <div class="calcHist"></div>
      <div class="calcPad"></div>
    </div>`;
    const disp=w.body.querySelector('.calcVal'),
      expr=w.body.querySelector('.calcExpr'),
      pad=w.body.querySelector('.calcPad'),
      histEl=w.body.querySelector('.calcHist');
    const st={cur:'0',prev:null,op:null,fresh:true,expr:'',hist:LS.get('calcHist',[])};
    const KEYS=[
      ['AC','fn'],['±','fn'],['%','fn'],['÷','op'],
      ['7',''],['8',''],['9',''],['×','op'],
      ['4',''],['5',''],['6',''],['−','op'],
      ['1',''],['2',''],['3',''],['+','op'],
      ['√','fn'],['0',''],['.',''],['=','eq']
    ];
    KEYS.forEach(([k,c])=>{
      const b=el('button','ckey '+c,pad);b.textContent=k;b.dataset.k=k;
      b.onclick=()=>press(k);
    });
    const fmt=n=>{
      if(!isFinite(n))return 'Error';
      if(Math.abs(n)>=1e16||(Math.abs(n)<1e-9&&n!==0))return n.toExponential(6);
      const s=parseFloat(n.toPrecision(12)).toString();
      if(s.length>14)return parseFloat(n.toPrecision(10)).toString();
      return s;
    };
    function compute(a,op,b){
      switch(op){
        case '+':return a+b; case '−':return a-b; case '×':return a*b; case '÷':return b===0?NaN:a/b;
      }
      return b;
    }
    function pushHist(expr,res){
      st.hist.unshift({e:expr,r:fmt(res)});
      if(st.hist.length>40)st.hist.pop();
      LS.set('calcHist',st.hist);
      renderHist();
    }
    function renderHist(){
      histEl.innerHTML='';
      if(!st.hist.length){histEl.innerHTML='<div style="padding:8px;font-size:11px;color:#5b6a86">No calculations yet</div>';return}
      st.hist.slice(0,20).forEach(h=>{
        const d=el('div','',histEl);
        d.innerHTML=`<span>${esc(h.e)}</span><b>${esc(h.r)}</b>`;
        d.onclick=()=>{st.cur=h.r;st.fresh=true;update()};
        d.oncontextmenu=e=>{e.preventDefault();st.hist=st.hist.filter(x=>x!==h);LS.set('calcHist',st.hist);renderHist()};
      });
    }
    function update(){
      disp.textContent=fmt(parseFloat(st.cur));
      expr.textContent=st.expr||'&nbsp;';
    }
    function press(k){
      Audio2.init();
      const isDigit=/^[0-9]$/.test(k);
      if(k==='AC'){st.cur='0';st.prev=null;st.op=null;st.fresh=true;st.expr='';Audio2.key()}
      else if(k==='±'){st.cur=String(-parseFloat(st.cur));Audio2.key()}
      else if(k==='%'){
        const v=parseFloat(st.cur);
        st.cur=String(st.prev!==null&&st.op? v*st.prev/100 : v/100);
        st.fresh=true;Audio2.key();
      }
      else if(k==='√'){
        const v=parseFloat(st.cur);
        if(v<0){disp.textContent='Error';st.cur='0';st.fresh=true;Audio2.error();return}
        st.cur=String(Math.sqrt(v));st.fresh=true;Audio2.tone(1200,.07,'sine',.06);update();return;
      }
      else if(k==='.'){
        if(st.fresh){st.cur='0.';st.fresh=false}
        else if(!st.cur.includes('.'))st.cur+='.';
        Audio2.key();
      }
      else if(isDigit){
        if(st.fresh){st.cur=k;st.fresh=false}
        else if(st.cur.replace(/[-.]/g,'').length<16)st.cur=st.cur==='0'?k:st.cur+k;
        Audio2.key();
      }
      else if('+−×÷'.includes(k)){
        const v=parseFloat(st.cur);
        if(st.op!==null&&!st.fresh&&st.prev!==null){
          const r=compute(st.prev,st.op,v);
          st.prev=r;st.cur=String(r);
          pushHist(st.prev==null?'':fmt(st.prev)+' '+st.op+' '+fmt(v),r);
        }else st.prev=v;
        st.op=k;st.fresh=true;
        st.expr=fmt(st.prev)+' '+k;
        Audio2.tone(700,.05,'sine',.05);
      }
      else if(k==='='){
        if(st.op!==null&&st.prev!==null){
          const v=parseFloat(st.cur);
          const e=fmt(st.prev)+' '+st.op+' '+fmt(v);
          const r=compute(st.prev,st.op,v);
          if(!isFinite(r)){
            disp.textContent=st.op==='÷'&&v===0?'Cannot divide by zero':'Error';
            st.cur='0';st.prev=null;st.op=null;st.expr='';st.fresh=true;
            Audio2.error();update();return;
          }
          pushHist(e,r);
          st.cur=String(r);st.expr=e+' =';st.prev=null;st.op=null;st.fresh=true;
          API.lastCalc={e,r};
        }
        Audio2.tone(520,.09,'triangle',.08,880);
      }
      update();
    }
    w.el.addEventListener('keydown',e=>{
      const k=e.key;
      if(/^[0-9]$/.test(k))press(k);
      else if(k==='.'||k===',')press('.');
      else if('+-*/'.includes(k))press({'+':'+','-':'−','*':'×','/':'÷'}[k]);
      else if(k==='Enter'||k==='=')press('=');
      else if(k==='Backspace'){st.cur=st.cur.length>1?st.cur.slice(0,-1):'0';update()}
      else if(k==='Escape'||k==='Delete')press('AC');
      else if(k==='%')press('%');
      else if(k==='r'||k==='R')press('√');
      else return;
      e.preventDefault();
    });
    w.el.tabIndex=0;setTimeout(()=>w.el.focus(),80);
    renderHist();update();
    return {onResize(){}};
  }
};

/* ---------- BROWSER ---------- */
