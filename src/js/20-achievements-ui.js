APPS.achievements={
  title:'Achievements',icon:ICONS.star,desc:'Records',w:760,h:600,
  build(w){
    w.body.innerHTML=`<div class="achv">
      <div class="achvHead">
        <h2>ACHIEVEMENTS</h2>
        <p><span id="achvCount">0 / 0</span> unlocked</p>
        <div class="achvBar"><i id="achvBar" style="width:0"></i></div>
      </div>
      <div class="achGrid" id="achvGrid"></div>
    </div>`;
    Achievements.render();
    Achievements.visited.achievements=1;
    return {onResize(){}};
  }
};
/* ---------- DIAGNOSTICS ---------- */
