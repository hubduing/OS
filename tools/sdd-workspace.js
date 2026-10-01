#!/usr/bin/env node
/* Resolve the SDD workspace for a plan, without bash.
 * Prints: <repo>/.superpowers/sdd/<plan-dir-name>
 * Creates the directory if absent.  Usage: node tools/sdd-workspace.js <plan-file>
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const planArg = process.argv[2];
if (!planArg) { console.error('usage: node tools/sdd-workspace.js <plan-file>'); process.exit(1); }

const planPath = path.resolve(process.cwd(), planArg);
if (!fs.existsSync(planPath)) { console.error('no such plan: ' + planPath); process.exit(1); }

const slug = path.basename(planPath).replace(/\.md$/, '');
const dir = path.join(ROOT, '.superpowers', 'sdd', slug);
fs.mkdirSync(dir, { recursive: true });
console.log(dir);
