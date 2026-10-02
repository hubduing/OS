const Eggs={
  found:LS.get('secrets',{}),
  list:[
    {id:'konami',name:'Konami'},
    {id:'term-secrets',name:'The secrets command'},
    {id:'nw',name:'north-wind'},
    {id:'wp-zero',name:'The null wallpaper'},
    {id:'dragon',name:'Contact'},
    {id:'idchip',name:'ID chip'},
    {id:'mystery',name:'The hidden file'},
    {id:'triple',name:'Triple click'},
    {id:'logo',name:'The logo'},
    {id:'matrix2',name:'Second matrix'}
  ],
  mark(id){
    if(this.found[id])return false;
    this.found[id]=1;LS.set('secrets',this.found);
    const e=this.list.find(x=>x.id===id);
    Notify.send('Secret discovered',e?e.name:'Something hidden in the system',{kind:'ach',icon:ICONS.star});
    Achievements.grant('SECRET_FOUND');
    return true;
  },
  count(){return Object.keys(this.found).length}
};
const KONAMI=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let kIdx=0;
document.addEventListener('keydown',e=>{
  const k=e.key.length===1?e.key.toLowerCase():e.key;
  // Konami
  if(k===KONAMI[kIdx]){
    kIdx++;
    if(kIdx===KONAMI.length){
      kIdx=0;
      if(Eggs.mark('konami'))konami();
    }
  }else kIdx=(k===KONAMI[0])?1:0;
  // IDDOG
  if(k==='i'&&e.ctrlKey&&e.shiftKey&&e.altKey){Eggs.mark('idchip');toast('Another one.','<span style="width:15px;height:15px;color:#ffc857">★</span>');toast('🐕');}
  // Ctrl+Shift+N nexus
  if(e.ctrlKey&&e.shiftKey&&(k==='n'||k==='N')){e.preventDefault();API.open('nexus',{single:false})}
  // Ctrl+Alt+D
  if(e.ctrlKey&&e.altKey&&(k==='d'||k==='D')){e.preventDefault();Diag.toggleFull()}
});
function konami(){
  Audio2.win();
  const wp=setSetting('accent','#3ddc84');
  Wall.apply('aurora');
  Achievements.grant('KONAMI');
  toast('↑↑↓↓←→←→BA — the void rewards you');
  Notify.send('Invincible mode','Accent color shifted. That is all it ever was.',{icon:ICONS.star});
  setTimeout(()=>{setSetting('accent','#37e0ff');toast('…and back again')},6000);
}
document.addEventListener('keydown',e=>{
  // logo secret
  if(e.key==='g'&&e.altKey&&e.ctrlKey){e.preventDefault();Eggs.mark('logo');glitch()}
});
function glitch(){
  const d=el('div','');
  d.style.cssText='position:fixed;inset:0;z-index:19000;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,46,99,.16) 0 2px,transparent 2px 4px);animation:fadeIn .1s';
  document.body.appendChild(d);
  Audio2.tone(90,.5,'sawtooth',.12,50);
  Audio2.noise(.4,.14);
  setTimeout(()=>d.remove(),700);
  toast('REALITY BUFFER CORRUPTED');
}

/* ---------- API ---------- */
