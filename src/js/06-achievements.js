const ACH_LIST=[
  {id:'FIRST_BOOT',name:'First Boot',desc:'Boot NEXUS OS for the first time.',icon:'bolt'},
  {id:'FIRST_FILE',name:'Creator',desc:'Create your first file.',icon:'file'},
  {id:'TERMINAL_MASTER',name:'Terminal Master',desc:'Run 25 commands in the Terminal.',icon:'terminal'},
  {id:'HIGH_SCORE',name:'High Score',desc:'Score 50+ in Neon Snake.',icon:'games'},
  {id:'PAINTER',name:'Artist',desc:'Draw something in Paint and save it.',icon:'paint'},
  {id:'EXPLORER',name:'Explorer',desc:'Visit every built-in app at least once.',icon:'compass'},
  {id:'SECRET_FOUND',name:'Secret Keeper',desc:'Discover a hidden secret.',icon:'eye'},
  {id:'KONAMI',name:'Konami',desc:'Enter the classic code. You know the one.',icon:'star'},
  {id:'DIAGNOSED',name:'Diagnosed',desc:'Open system diagnostics.',icon:'cpu'},
  {id:'ORGANIZER',name:'Organizer',desc:'Create 10 files across the filesystem.',icon:'folder'},
  {id:'RACER',name:'Racer',desc:'Complete a lap in Cyber Racer.',icon:'media'},
  {id:'NEXUS_TALK',name:'Talk to Me',desc:'Give NEXUS 10 commands.',icon:'nexus'},
  {id:'NIGHT_OWL',name:'Night Owl',desc:'Keep NEXUS running for 5 minutes.',icon:'eye'},
  {id:'CLEANER',name:'Clean Sweep',desc:'Take a screenshot and save it.',icon:'mon'},
  {id:'DJ',name:'Analog Night',desc:'Play a synthesised track to the end.',icon:'aud'},
  {id:'DIRECTOR',name:'Director',desc:'Watch the whole generated demo reel.',icon:'vid'}
];
const Achievements={
  got:LS.get('ach',{}),
  visited:LS.get('visited',{}),
  counts:LS.get('counts',{term:0,nexus:0,files:0}),
  has(id){return !!this.got[id]},
  grant(id){
    if(this.got[id])return;
    const a=ACH_LIST.find(x=>x.id===id); if(!a)return;
    this.got[id]={t:Date.now()};
    LS.set('ach',this.got);
        Notify.send('Achievement Unlocked',a.name+' — '+a.desc,{kind:'ach',icon:ICONS[a.icon]||ICONS.star});
    Audio2.achv();
    API.refreshTaskbar&&API.refreshTaskbar();
  },
  visit(app){
    if(this.visited[app])return;
    this.visited[app]=1;LS.set('visited',this.visited);
    const all=['files','terminal','editor','calculator','browser','paint','music','video','arcade','settings','nexus','achievements','diagnostics'];
    if(all.every(a=>this.visited[a]))this.grant('EXPLORER');
  },
  bump(k,n){this.counts[k]=(this.counts[k]||0)+(n||1);LS.set('counts',this.counts)},
  checkOrganizer(){
    if(this.has('ORGANIZER'))return;
    if(VFS.stats().files>=10)this.grant('ORGANIZER');
  },
  total(){return Object.keys(this.got).length},
  render(){
    const wrap=$('#achvGrid'); if(!wrap)return;
    wrap.innerHTML='';
    ACH_LIST.forEach(a=>{
      const g=this.got[a.id];
      const c=el('div','achCard'+(g?' got':''),wrap);
      c.innerHTML=`<div class="md">${ICONS[a.icon]||ICONS.star}</div><div><b>${esc(a.name)}</b>
        <span>${esc(a.desc)}</span>${g?`<span class="dt">UNLOCKED ${fmtStamp(g.t)}</span>`:'<span class="dt">LOCKED</span>'}</div>`;
    });
    const n=this.total();
    const p=$('#achvCount'); if(p)p.textContent=n+' / '+ACH_LIST.length;
    const bar=$('#achvBar'); if(bar)bar.style.width=(n/ACH_LIST.length*100)+'%';
  }
};
