#!/usr/bin/env node
/* Extract one task's full text from a plan into its own file, without bash.
 * Usage: node tools/task-brief.js <plan-file> <task-number>
 * Prints the path it wrote.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const [planArg, nArg] = process.argv.slice(2);
if (!planArg || !nArg) { console.error('usage: node tools/task-brief.js <plan-file> <n>'); process.exit(1); }

const planPath = path.resolve(process.cwd(), planArg);
const slug = path.basename(planPath).replace(/\.md$/, '');
const n = String(parseInt(nArg, 10));

const lines = fs.readFileSync(planPath, 'utf8').split('\n');

// Global Constraints block belongs in every brief: the plan's own binding rules.
let gcStart = lines.findIndex(l => l.startsWith('## Global Constraints'));
let gcEnd = lines.findIndex((l, i) => i > gcStart && l.startsWith('## '));
const gc = lines.slice(gcStart, gcEnd < 0 ? lines.length : gcEnd).join('\n').trim();

// The task section: from its heading to the next "### Task" or "# " heading.
const head = lines.findIndex(l => l.startsWith(`### Task ${n}:`));
if (head < 0) { console.error(`no "### Task ${n}:" heading in ${planPath}`); process.exit(1); }
let end = lines.length;
for (let i = head + 1; i < lines.length; i++) {
  if (/^### Task \d+:/.test(lines[i]) || /^# Phase/.test(lines[i]) || /^---$/.test(lines[i])) { end = i; break; }
}
const body = lines.slice(head, end).join('\n').trim();

const outDir = path.join(ROOT, '.superpowers', 'sdd', slug);
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `task-${n}-brief.md`);

const header =
  `# Task ${n} — requirements\n\n` +
  `Source plan: ${planArg.replace(/\\/g, '/')}\n` +
  `Spec (binding authority): docs/superpowers/specs/2026-10-01-modular-apps-design.md\n\n` +
  `## Global Constraints (from the plan — bind this task)\n\n${gc}\n\n` +
  `---\n\n## This task\n\n${body}\n`;

fs.writeFileSync(out, header, 'utf8');
console.log(out);
