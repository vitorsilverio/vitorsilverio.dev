import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { marked } from 'marked';
import { highlightCode } from './lib/highlight.mjs';

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
const USAGE =
  'Uso:\n' +
  '  node scripts/new-article.mjs --from proximos-artigos/<arquivo>.md [--dry-run]\n' +
  '  node scripts/new-article.mjs --slug <slug-kebab> [--title "..."] [--tags "A,B"] [--excerpt "..."] [--reading-time "9 min"] [--dry-run]';

// --------------------------------------------------------------------------
// Modo --from: extrai metadados + corpo de um Markdown no formato padrão de
// proximos-artigos/ e gera o template Angular do post.
// --------------------------------------------------------------------------
let mdMeta = null;
let mdTemplate = null;
let mdUsesRouterLink = false;

if (opts.from) {
  const mdPath = resolve(SITE_ROOT, opts.from);
  if (!existsSync(mdPath)) {
    console.error(`Arquivo não encontrado: ${mdPath}`);
    process.exit(1);
  }
  const raw = readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n');
  mdMeta = parseHeader(raw, mdPath);
  const knownSlugs = new Set(
    [...readFileSync(ARTICLES_TS, 'utf8').matchAll(/slug:\s*'([^']+)'/g)].map(
      (m) => m[1],
    ),
  );
  const { html, usesRouterLink } = mdBodyToHtml(mdMeta.body, knownSlugs);
  mdTemplate = html;
  mdUsesRouterLink = usesRouterLink;
}

const slug = opts.slug ?? mdMeta?.slug;
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error(`Slug inválido ou ausente: ${slug ?? '(nenhum)'}\n\n${USAGE}`);
  process.exit(1);
}

const title = opts.title ?? mdMeta?.title ?? slug;
const excerpt =
  opts.excerpt ?? mdMeta?.excerpt ?? 'TODO: escreva o resumo (excerpt) do artigo.';
const readingTime = opts['reading-time'] ?? mdMeta?.readingTime ?? '9 min';
const tags = (opts.tags ? opts.tags.split(',') : (mdMeta?.tags ?? ['Artigo']))
  .map((t) => t.trim())
  .filter(Boolean);
const today = new Date().toISOString().slice(0, 10);
const className =
  'Article' +
  slug.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
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

// 1) Componente do post -----------------------------------------------------
const postFile = resolve(POSTS_DIR, `${slug}.ts`);
if (existsSync(postFile)) {
  log(`• posts/${slug}.ts já existe — pulando criação.`);
} else {
  write(postFile, buildPostComponent());
  log(
    `✓ criado posts/${slug}.ts (classe ${className})` +
      (mdTemplate ? ' a partir do Markdown' : ' (stub)'),
  );
}

// 2) articles.ts ----------------------------------------------------------
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

// 3) app.routes.ts (postLoaders) ------------------------------------------
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

// 4) prerender-routes.txt ----------------------------------------------------
let pre = read(PRERENDER);
const preLine = `/artigos/${slug}`;
if (pre.includes(preLine)) {
  log('• prerender-routes.txt já tem esta rota — pulando.');
} else {
  pre = pre.replace(/\n*$/, '\n') + preLine + '\n';
  write(PRERENDER, pre);
  log('✓ prerender-routes.txt atualizado');
}

// 5) sitemap.xml ----------------------------------------------------------
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

// 6) Geradores de assets/SEO (capas, PNGs, sitemap, feed) ------------------
if (DRY_RUN) {
  log('  (dry-run) pularia "npm run gen:assets".');
} else {
  log('\n→ rodando "npm run gen:assets"…');
  try {
    execSync('npm run gen:assets', { cwd: SITE_ROOT, stdio: 'inherit' });
  } catch {
    log('⚠ "npm run gen:assets" falhou — rode "npm run gen:assets" antes do build.');
  }
}

log(
  DRY_RUN
    ? '\n(dry-run) nenhuma alteração foi gravada.'
    : mdTemplate
      ? `\nPronto. Revise posts/${slug}.ts e rode "npm run build" + "npm run test".`
      : `\nPronto. Agora edite posts/${slug}.ts com o conteúdo real e rode "npm run build".`,
);

// ========================================================================
// Helpers
// ========================================================================

/** Extrai `# Título`, **Slug/Tags/Reading time/Excerpt** e o corpo (após `---`). */
function parseHeader(raw, mdPath) {
  const sep = raw.match(/^---[ \t]*$/m);
  const sepIdx = sep ? sep.index : -1;
  const head = sepIdx === -1 ? raw : raw.slice(0, sepIdx);
  const body = sepIdx === -1 ? '' : raw.slice(raw.indexOf('\n', sepIdx) + 1);

  const field = (name) => {
    const m = head.match(
      new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+?)\\s*$`, 'im'),
    );
    return m ? m[1].trim() : undefined;
  };
  const unbacktick = (s) => (s ?? '').replace(/`/g, '').trim();

  const titleMatch = head.match(/^#\s+(.+?)\s*$/m);
  const slug =
    unbacktick(field('Slug')) ||
    basename(mdPath).replace(/\.md$/i, '');
  const tagsRaw = field('Tags') ?? '';
  const tags = tagsRaw
    .split(',')
    .map((t) => t.replace(/`/g, '').trim())
    .filter(Boolean);

  return {
    title: titleMatch ? titleMatch[1].trim() : slug,
    slug,
    tags,
    readingTime: field('Reading time') ?? field('Reading Time'),
    excerpt: field('Excerpt'),
    body,
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Converte o corpo Markdown para HTML pronto para o template inline do Angular:
 * - fences ```lang -> <pre><code class="language-lang">
 * - tabelas -> <div class="scroll-x"><table><caption?> com scope col/row
 *   (caption vem de uma linha "Tabela: ..." logo acima da tabela)
 * - links internos ("/artigos/...") -> [routerLink], externos -> href+target+rel
 *   (link para /artigos/<slug> inexistente vira texto simples + aviso)
 * - remove o rodapé "**Referências cruzadas:** ..." (redundante com a seção
 *   "Artigos relacionados" que o próprio article-detail já renderiza)
 */
function mdBodyToHtml(body, knownSlugs = new Set()) {
  let usesRouterLink = false;
  const deadLinks = [];

  // Remove a linha de "Referências cruzadas" (e sua régua/linhas em branco).
  let src = body.replace(
    /\n*^[*_]{0,2}Refer[êe]ncias cruzadas:?[*_]{0,2}.*$\n?/gim,
    '\n',
  );

  // Captions: "Tabela: X" (ou "Table: X") imediatamente antes de uma tabela.
  const captions = [];
  src = src.replace(
    /^(?:Tabela|Table):[ \t]*(.+)\r?\n(?=\s*\|)/gim,
    (_, c) => {
      captions.push(c.trim());
      return '';
    },
  );

  const renderer = new marked.Renderer();

  renderer.code = ({ text, lang }) => {
    const l = (lang || 'text').trim().split(/\s+/)[0] || 'text';
    const { html, langClass } = highlightCode(text, l);
    return `<pre><code class="${langClass}">${html}</code></pre>\n`;
  };

  renderer.table = (token) => {
    const cap = captions.shift();
    const caption = cap ? `<caption>${escapeHtml(cap)}</caption>` : '';
    const head = token.header
      .map((c) => `<th scope="col">${marked.parseInline(c.text)}</th>`)
      .join('');
    const rows = token.rows
      .map((row) => {
        const cells = row
          .map((c, i) =>
            i === 0
              ? `<th scope="row">${marked.parseInline(c.text)}</th>`
              : `<td>${marked.parseInline(c.text)}</td>`,
          )
          .join('');
        return `      <tr>${cells}</tr>`;
      })
      .join('\n');
    return (
      `<div class="scroll-x">\n  <table>\n    ${caption}` +
      `<thead>\n      <tr>${head}</tr>\n    </thead>\n` +
      `    <tbody>\n${rows}\n    </tbody>\n  </table>\n</div>\n`
    );
  };

  renderer.link = function ({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const t = title ? ` title="${escapeHtml(title)}"` : '';
    if (/^\/(?!\/)/.test(href)) {
      // Caminho interno com extensão de arquivo (/curso-arm/exemplos/x.s,
      // /feed.xml, ...) = asset estático servido direto, não uma rota do SPA.
      if (/\.[a-z0-9]+([#?].*)?$/i.test(href)) {
        return `<a href="${href}"${t}>${text}</a>`;
      }
      const m = href.match(/^\/artigos\/([^/#?]+)/);
      if (m && knownSlugs.size && !knownSlugs.has(m[1])) {
        deadLinks.push(href);
        return text; // artigo ainda não publicado: mantém o texto, sem link
      }
      usesRouterLink = true;
      return `<a routerLink="${href}"${t}>${text}</a>`;
    }
    if (/^https?:\/\//.test(href)) {
      return `<a href="${href}"${t} target="_blank" rel="noopener">${text}</a>`;
    }
    return `<a href="${href}"${t}>${text}</a>`;
  };

  marked.setOptions({ gfm: true, breaks: false });
  let html = marked.parse(src, { renderer, async: false });

  // Os .md de proximos-artigos usam `---` como divisória entre quase todas as
  // seções; no site o padrão é sem <hr>. Remove as réguas temáticas.
  html = html.replace(/<hr\s*\/?>\n?/g, '');

  // Angular: neutraliza interpolação/binding que possa existir no conteúdo.
  html = html.replace(/\{\{/g, '&#123;&#123;').replace(/\}\}/g, '&#125;&#125;');

  if (deadLinks.length) {
    console.warn(
      `⚠ ${deadLinks.length} link(s) para artigo(s) não publicado(s) — mantidos como texto:\n  ` +
        [...new Set(deadLinks)].join('\n  '),
    );
  }

  return { html: html.trim(), usesRouterLink };
}

/** Monta o arquivo .ts do componente do post. */
function buildPostComponent() {
  const bodyHtml = mdTemplate ?? stubTemplate();
  // Escapa para caber numa template string (crase e ${ ) — sem perder o texto.
  const safe = bodyHtml.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '$\\{');
  const wantsRouterLink = mdTemplate ? mdUsesRouterLink : true;
  const importLine = wantsRouterLink
    ? "import { RouterLink } from '@angular/router';\n"
    : '';
  const importsMeta = wantsRouterLink ? '  imports: [RouterLink],\n' : '';

  return (
    `import { Component } from '@angular/core';\n` +
    importLine +
    `\n@Component({\n` +
    importsMeta +
    `  selector: 'app-article-${slug}',\n` +
    `  template: \`\n${safe}\n\`,\n` +
    `})\n` +
    `export class ${className} {}\n`
  );
}

function stubTemplate() {
  const asm = highlightCode(
    '.syntax unified\n.text\n.global _start\n\n_start:\n    mov   r0, #1\n    bx    lr',
    'armasm',
  ).html;
  return (
    `    <p>TODO: escreva o artigo "${escapeHtml(title)}".</p>\n\n` +
    `    <h2>Seção de exemplo</h2>\n` +
    `    <p>Texto de exemplo com <a routerLink="/artigos">link para artigos</a>.</p>\n\n` +
    `    <pre><code class="language-armasm">${asm}</code></pre>`
  );
}
