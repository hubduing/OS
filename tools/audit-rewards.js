// Dev helper: reports achievements / easter eggs that have no trigger site.
// Parses the two defining modules directly, then greps every source module.
'use strict';
const fs = require('fs');
const path = require('path');
const manifest = require('./lib/manifest');

// Manifest-driven: the kernel tree moved from src/js to src/kernel, and this
// audit greps every source file — pointing it at a directory that no longer
// exists reported "no triggers" for every achievement, which is indistinguishable
// from the real answer.
const JS = path.join(__dirname, '..', manifest.load().kernel.dir);
const read = f => fs.readFileSync(path.join(JS, f), 'utf8');

let all = '';
for (const f of fs.readdirSync(JS).filter(f => f.endsWith('.js')).sort()) {
  all += read(f) + '\n';
}

const achSrc = read('06-achievements.js');
const achIds = [...achSrc.match(/ACH_LIST=\[([\s\S]*?)\n\];/)[1].matchAll(/id:'([A-Z_]+)'/g)].map(m => m[1]);

const eggSrc = read('26-eggs.js');
const eggIds = [...eggSrc.match(/list:\[([\s\S]*?)\n  \],/)[1].matchAll(/id:'([a-z0-9-]+)'/g)].map(m => m[1]);

const grants = id => (all.match(new RegExp("\\.grant\\(\\s*'" + id + "'", 'g')) || []).length;
const marks = id => (all.match(new RegExp("Eggs\\.mark\\(\\s*'" + id + "'", 'g')) || []).length;

let bad = 0;
console.log('ACHIEVEMENTS (' + achIds.length + ')');
for (const id of achIds) {
  const n = grants(id);
  if (!n) bad++;
  console.log('  ' + (n ? '  ok' : '  MISSING') + '  ' + id.padEnd(16) + n + ' grant site(s)');
}
console.log('\nEASTER EGGS (' + eggIds.length + ')');
for (const id of eggIds) {
  const n = marks(id);
  if (!n) bad++;
  console.log('  ' + (n ? '  ok' : '  MISSING') + '  ' + id.padEnd(16) + n + ' trigger(s)');
}
console.log('\n' + (bad ? bad + ' unreachable' : 'all wired'));
if (bad) process.exitCode = 1;
