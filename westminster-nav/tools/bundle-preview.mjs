#!/usr/bin/env node
// Builds a single self-contained HTML file of the whole app (code, styles and
// data inlined) for the claude.ai preview artifact.
//
//   npx --yes esbuild@0.23 --version   # once, to fetch esbuild
//   node tools/bundle-preview.mjs [out.html]

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(APP, 'wfd-nav-trainer.html');
const js = join(mkdtempSync(join(tmpdir(), 'wfd-')), 'app.js');
execFileSync('npx', ['--yes', 'esbuild@0.23', join(APP, 'js/app.js'), '--bundle', '--format=iife', '--minify', `--outfile=${js}`, '--log-level=warning'], { stdio: 'inherit' });
const read = (p) => readFileSync(join(APP, p), 'utf8');
const data = JSON.stringify({
  city: JSON.parse(read('data/city.json')),
  stations: JSON.parse(read('data/stations.json')),
  landmarks: JSON.parse(read('data/landmarks.json')),
}).replace(/</g, '\\u003c');
const body = read('index.html').split('<body>')[1].split('</body>')[0].replace(/<script[^>]*><\/script>/, '');
const html = `<title>WFD Nav Trainer</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Semi+Condensed:wght@500;600;700&display=swap">
<style>${read('css/style.css')}</style>
${body}
<script>window.WFD_DATA=${data};</script>
<script>${readFileSync(js, 'utf8').replace(/<\/script/g, '<\\/script')}</script>
`;
writeFileSync(out, html);
console.log(`wrote ${out} (${html.length} bytes)`);
