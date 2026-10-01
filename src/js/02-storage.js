/* ============================================================
   PART 2 — STORAGE, SETTINGS, AUDIO, VFS, NOTIFY, ACHIEVEMENTS
   ============================================================ */
const LS={
  get(k,d){try{const v=localStorage.getItem('nexus.'+k);return v===null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem('nexus.'+k,JSON.stringify(v))}catch(e){}},
  del(k){try{localStorage.removeItem('nexus.'+k)}catch(e){}}
};
let storageBytes=0;
function trackStorage(){try{let t=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('nexus.'))t+=(localStorage.getItem(k)||'').length}storageBytes=t;}catch(e){storageBytes=0}}

const DEFAULT_SETTINGS={
  wallpaper:'city', accent:'#37e0ff', accent2:'#b06bff', theme:'nexus',
  transparency:78, animations:true, iconSize:'medium', taskbarPos:'bottom',
  clock24:true, showSeconds:false, volume:60, uiSounds:true, gameSounds:true,
  mediaSounds:true, showHidden:false
};
let S=Object.assign({},DEFAULT_SETTINGS,LS.get('settings',{}));

const WALLPAPERS=[
  {id:'city',name:'Cyber City',anim:true,kind:'city'},
  {id:'space',name:'Deep Space',anim:true,kind:'space'},
  {id:'aurora',name:'Aurora',anim:true,kind:'aurora'},
  {id:'matrix',name:'Matrix',anim:true,kind:'matrix'},
  {id:'sunset',name:'Sunset Grid',anim:true,kind:'sunset'},
  {id:'minimal',name:'Minimal Dark',anim:true,kind:'minimal'},
  {id:'nebula',name:'Nebula Flow',anim:true,kind:'nebula'},
  {id:'vortex',name:'Event Horizon',anim:true,kind:'vortex'},
  {id:'plasma',name:'Plasma',anim:true,kind:'plasma'},
  {id:'wireframe',name:'Wireframe',anim:true,kind:'wireframe'},
  {id:'void',name:'The Void',anim:true,kind:'void'},
  {id:'zero',name:'NULLSPACE',anim:true,kind:'zero',secret:true}
];
const ACCENTS=['#37e0ff','#b06bff','#ff4d9d','#3ddc84','#ffc857','#ff6b35','#6fb0ff','#ff2e63'];

/* ---------- AUDIO ENGINE ---------- */
