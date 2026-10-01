/* Detects and repairs block comments that straddle a src/js module boundary.
   A banner like
       /* ==============
          PART 2 ...
          ============== * /
   must live entirely inside one module.

   Run:  node tools/fix-boundaries.js  [--dry]                              */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'src', 'js');
const dry = process.argv.includes('--dry');

/* Banner comments always start at column 0 and always end with `* /` on their
   own line. Tracking only those avoids false positives from literals such as
   `accept="audio/*,video/*"`. */
function openAtEnd(lines) {
  let open = 0;
  for (const l of lines) {
    if (/^\/\*[^*]*$/.test(l)) open++;                       // opener at col 0
    else if (/^[^*]*\*\/\s*$/.test(l) && open > 0) open--;  // closer at col 0
  }
  return open;
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
const parts = files.map(f => {
  const p = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n');
  while (p.length && !p[p.length - 1].trim()) p.pop();
  return p;
});

let moved = 0;
for (let i = 0; i < parts.length - 1; i++) {
  let guard = 0;
  while (openAtEnd(parts[i]) > 0 && guard++ < 5) {
    const orphan = parts[i][parts[i].length - 1];
    // only safe to move if it is the comment opener
    if (!/^\s*\/\*[^*]*$/.test(orphan)) {
      console.error(`\n!! ${files[i]}: cannot auto-fix, last line is: ${JSON.stringify(orphan)}`);
      process.exit(1);
    }
    parts[i].pop();
    parts[i + 1].unshift(orphan);
    moved++;
    console.log(`${files[i]} -> ${files[i + 1]}:  moved ${JSON.stringify(orphan.trim().slice(0, 46))}`);
  }
}

if (moved && !dry) {
  parts.forEach((p, i) => {
    fs.writeFileSync(path.join(DIR, files[i]), p.join('\n') + '\n', 'utf8');
  });
}
console.log(moved ? `${moved} line(s) moved${dry ? ' (dry run)' : ''}` : 'all boundaries clean');
