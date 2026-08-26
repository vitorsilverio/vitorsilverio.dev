import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const POSTS_DIR = resolve(SITE_ROOT, 'src/app/pages/article-detail/posts');
const ARTICLES_TS = resolve(SITE_ROOT, 'src/app/data/articles.ts');
const ROUTES_TS = resolve(SITE_ROOT, 'src/app/app.routes.ts');
const PRERENDER = resolve(SITE_ROOT, 'src/prerender-routes.txt');
const SITEMAP = resolve(SITE_ROOT, 'public/sitemap.xml');
const BASE_URL = 'https://vitorsilverio.dev';

const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      opts[key] = next;
      i++;
    } else {
      opts[key] = true;
    }
  }
}

const DRY_RUN = !!opts['dry-run'];
const slug = opts.slug;
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('Uso: node scripts/new-article.mjs --slug <slug-kebab> [--title "Título"] [--tags "Tag1,Tag2"] [--excerpt "..."] [--reading-time "9 min"] [--dry-run]');
  process.exit(1);
}

const title = opts.title ?? slug;
const excerpt = opts.excerpt ?? 'TODO: escreva o resumo (excerpt) do artigo.';
const readingTime = opts['reading-time'] ?? '9 min';
const tags = (opts.tags ?? 'Artigo')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);
const today = new Date().toISOString().slice(0, 10);
const className = 'Article' + slug.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const read = (p) => readFileSync(p, 'utf8');
const write = (p, c) => {
  if (DRY_RUN) {
    console.log(`  (dry-run) escreveria ${p}`);
    return;
  }
  writeFileSync(p, c, 'utf8');
};

const log = (msg) => console.log(msg);

// 1) Componente do post
const postFile = resolve(POSTS_DIR, `${slug}.ts`);
if (existsSync(postFile)) {
  log(`• posts/${slug}.ts já existe — pulando criação.`);
} else {
  const tpl = `import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HighlightDirective } from '../../../shared/highlight.directive';

@Component({
  imports: [RouterLink],
  hostDirectives: [HighlightDirective],
  selector: 'app-article-${slug}',
  template: \`
    <p>TODO: escreva o artigo "${title}".</p>

    <h2>Seção de exemplo</h2>
    <p>Texto de exemplo com <a routerLink="/artigos">link para artigos</a>.</p>

    <pre><code class="language-armasm">.syntax unified
.text
.global _start

_start:
    mov   r0, #1
    bx    lr</code></pre>
  \`,
})
export class ${className} {}
`;
  write(postFile, tpl);
  log(`✓ criado posts/${slug}.ts (classe ${className})`);
}

// 2) articles.ts
let articles = read(ARTICLES_TS);
if (articles.includes(`slug: '${slug}'`)) {
  log('• articles.ts já tem este slug — pulando.');
} else {
  const entry = `  {\n    slug: '${esc(slug)}',\n    title: '${esc(title)}',\n    date: '${today}',\n    readingTime: '${esc(readingTime)}',\n    excerpt: '${esc(excerpt)}',\n    tags: [${tags.map((t) => `'${esc(t)}'`).join(', ')}],\n  },`;
  const idx = articles.lastIndexOf('];');
  if (idx === -1) {
    console.error('Não encontrei "];" em articles.ts');
    process.exit(1);
  }
  articles = articles.slice(0, idx) + entry + '\n];' + articles.slice(idx + 2);
  write(ARTICLES_TS, articles);
  log('✓ articles.ts atualizado');
}

// 3) app.routes.ts (postLoaders)
let routes = read(ROUTES_TS);
if (routes.includes(`m.${className}`)) {
  log('• app.routes.ts já tem o loader — pulando.');
} else {
  const loader = `  '${slug}': () =>\n    import('./pages/article-detail/posts/${slug}').then((m) => m.${className}),\n`;
  const idx = routes.lastIndexOf('} as const;');
  if (idx === -1) {
    console.error('Não encontrei "as const" do postLoaders em app.routes.ts');
    process.exit(1);
  }
  routes = routes.slice(0, idx) + loader + routes.slice(idx);
  write(ROUTES_TS, routes);
  log('✓ app.routes.ts (postLoaders) atualizado');
}

// 4) prerender-routes.txt
let pre = read(PRERENDER);
const preLine = `/artigos/${slug}`;
if (pre.includes(preLine)) {
  log('• prerender-routes.txt já tem esta rota — pulando.');
} else {
  pre = pre.replace(/\n*$/, '\n') + preLine + '\n';
  write(PRERENDER, pre);
  log('✓ prerender-routes.txt atualizado');
}

// 5) sitemap.xml
let sm = read(SITEMAP);
  const smLoc = `${BASE_URL}/artigos/${slug}/`;
if (sm.includes(smLoc)) {
  log('• sitemap.xml já tem esta URL — pulando.');
} else {
  const block = `  <url>\n    <loc>${smLoc}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
  const idx = sm.lastIndexOf('</urlset>');
  if (idx === -1) {
    console.error('Não encontrei </urlset> em sitemap.xml');
    process.exit(1);
  }
  sm = sm.slice(0, idx) + block + sm.slice(idx);
  write(SITEMAP, sm);
  log('✓ sitemap.xml atualizado');
}

log(DRY_RUN ? '\n(dry-run) nenhuma alteração foi gravada.' : `\nPronto. Agora edite posts/${slug}.ts com o conteúdo real e rode "npm run build".`);
