import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES_TS = resolve(SITE_ROOT, 'src/app/data/articles.ts');
const OUT_DIR = resolve(SITE_ROOT, 'public/assets/covers');

const ACCENTS = ['#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#60a5fa'];

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function hashIndex(s) {
  let h = 0;
  for (const c of s) h = (h + c.charCodeAt(0)) % 9973;
  return h % ACCENTS.length;
}

function wrap(title, max = 24) {
  const words = title.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= max) cur = cur + ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function wrapTags(items, max = 38) {
  const lines = [];
  let cur = '';
  for (const it of items) {
    if (!cur) cur = it;
    else if ((cur + ' • ' + it).length <= max) cur = cur + ' • ' + it;
    else {
      lines.push(cur);
      cur = it;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

function buildSvg({ title, date, tags, accent }) {
  const lines = wrap(title);
  const titleSvg = lines
    .map(
      (ln, i) =>
        `<text x="80" y="${240 + i * 74}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="62" font-weight="700" fill="#ffffff">${esc(ln)}</text>`,
    )
    .join('\n  ');
  const dateStr = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date + 'T00:00:00'));
  const tagsLines = wrapTags(tags.map((t) => t.toUpperCase()), 38);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1e1b4b"/>
      <stop offset="1" stop-color="#312e81"/>
    </linearGradient>
    <radialGradient id="glow" cx="78%" cy="22%" r="60%">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <g stroke="${accent}" stroke-opacity="0.22" stroke-width="2" fill="none">
    <path d="M780 90 H1120 V250 H960 V470 H1120"/>
    <path d="M840 150 H1060 V360 H900"/>
    <circle cx="780" cy="90" r="6" fill="${accent}"/>
    <circle cx="1120" cy="250" r="6" fill="${accent}"/>
    <circle cx="960" cy="470" r="6" fill="${accent}"/>
    <circle cx="840" cy="150" r="6" fill="${accent}"/>
    <circle cx="1060" cy="360" r="6" fill="${accent}"/>
    <circle cx="900" cy="360" r="6" fill="${accent}"/>
  </g>
  <text x="80" y="120" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="30" letter-spacing="6" fill="#c7d2fe">VÍTOR SILVÉRIO · ARTIGO</text>
  ${titleSvg}
  ${tagsLines
    .map(
      (ln, i) =>
        `<text x="80" y="${470 + i * 34}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="26" letter-spacing="2" fill="${accent}">${esc(ln)}</text>`,
    )
    .join('\n  ')}
  <text x="80" y="565" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="28" fill="#a5b4fc">${dateStr}</text>
</svg>
`;
}

const src = readFileSync(ARTICLES_TS, 'utf8');
const re =
  /slug:\s*'([^']+)'[\s\S]*?title:\s*'([^']*)'[\s\S]*?date:\s*'([^']+)'[\s\S]*?tags:\s*\[([^\]]*)\]/g;
const entries = [];
let m;
while ((m = re.exec(src))) {
  const tags = (m[4].match(/'([^']+)'/g) || []).map((t) => t.replace(/'/g, ''));
  entries.push({ slug: m[1], title: m[2], date: m[3], tags });
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

for (const e of entries) {
  const accent = ACCENTS[hashIndex(e.slug)];
  const svg = buildSvg({ ...e, accent });
  writeFileSync(resolve(OUT_DIR, `${e.slug}.svg`), svg, 'utf8');
  console.log(`✓ capa gerada: assets/covers/${e.slug}.svg (accent ${accent})`);
}

console.log(`\n${entries.length} capa(s) gerada(s) em public/assets/covers/.`);
