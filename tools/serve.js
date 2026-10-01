#!/usr/bin/env node
/* Zero-dependency static server for local development.
   Usage:  node tools/serve.js [port]                                          */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2]) || 8899;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let rel = url === '/' ? '/nexus-os.html' : url;
    if (!path.extname(rel)) rel += '.html';
    const file = path.join(ROOT, path.normalize(rel).replace(/^([/\\])+/, ''));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('404 ' + rel);
        return;
      }
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(buf);
    });
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`NEXUS dev server  →  http://127.0.0.1:${PORT}/nexus-os.html`);
  });
