// Dev helper: show numbered lines of a source module (to pick split points).
const fs = require('fs');
const [file, from, to] = process.argv.slice(2);
const L = fs.readFileSync(file, 'utf8').split('\n');
const a = Number(from) || 1, b = Number(to) || L.length;
for (let i = a - 1; i < Math.min(b, L.length); i++) {
  console.log(String(i + 1).padStart(5), L[i].slice(0, 100));
}
console.log('--- total', L.length);
