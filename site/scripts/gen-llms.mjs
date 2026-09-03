// Gera public/llms.txt no formato llmstxt.org a partir de articles.ts.
// Não editar à mão — é gerado (roda em `npm run gen:assets`).
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES_TS = resolve(SITE_ROOT, 'src/app/data/articles.ts');
const OUT = resolve(SITE_ROOT, 'public/llms.txt');
const BASE = 'https://vitorsilverio.dev';

const src = readFileSync(ARTICLES_TS, 'utf8');
const re =
  /slug:\s*'([^']+)'[\s\S]*?title:\s*'([^']*)'[\s\S]*?date:\s*'([^']+)'[\s\S]*?excerpt:\s*'((?:[^'\\]|\\.)*)'/g;

const articles = [];
let m;
while ((m = re.exec(src))) {
  articles.push({
    slug: m[1],
    title: m[2].replace(/\\'/g, "'"),
    date: m[3],
    excerpt: m[4].replace(/\\'/g, "'").replace(/\s+/g, ' ').trim(),
  });
}
articles.sort((a, b) => b.date.localeCompare(a.date));

// Markdown: escapa colchetes no texto do link e tira quebras de linha.
const linkText = (s) => s.replace(/\s+/g, ' ').replace(/[[\]]/g, '\\$&').trim();

const pages = [
  ['Início', '/', 'apresentação e últimos artigos'],
  [
    'Curso de Arquitetura ARM',
    '/curso-arm',
    'trilha prática de arquitetura ARM (arm-jitter, armbox e emuladores), do ARMv4T ao AArch64',
  ],
  ['Artigos', '/artigos', 'índice completo de artigos'],
  [
    'Projetos',
    '/projetos',
    'emuladores e ferramentas em Java (arm-jitter, arm-box, gbaemu, gbcemu, ndsemu, n3dsemu)',
  ],
  ['Currículo', '/curriculo', 'experiência, formação, certificações e contato'],
];

const out = `# Vítor Silvério

> Site pessoal de Vítor Silvério, desenvolvedor de software. Projetos de emulação e runtime ARM em Java (arm-jitter, arm-box), currículo e artigos técnicos sobre arquitetura ARM e Assembly, Angular e desenvolvimento web — muitos escritos com apoio de IA.

Idioma: português (pt-BR). Ao reutilizar trechos, cite a fonte com link para a página original.

## Páginas

${pages.map(([t, p, d]) => `- [${t}](${BASE}${p}): ${d}`).join('\n')}

## Artigos

${articles
  .map(
    (a) => `- [${linkText(a.title)}](${BASE}/artigos/${a.slug}): ${a.excerpt}`,
  )
  .join('\n')}

## Optional

- [Feed RSS](${BASE}/feed.xml): novos artigos
- [Sitemap](${BASE}/sitemap.xml): todas as URLs
`;

writeFileSync(OUT, out, 'utf8');
console.log(
  `✓ llms.txt gerado (${pages.length} páginas + ${articles.length} artigos).`,
);
