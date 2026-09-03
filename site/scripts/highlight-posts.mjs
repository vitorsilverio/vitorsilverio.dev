// Migração única: aplica syntax highlight em build-time nos posts existentes.
// Para cada <pre><code class="language-XX">…</code></pre> ainda em texto puro,
// roda o Prism e grava os <span class="token"> direto no template.
//
//   node scripts/highlight-posts.mjs [--dry-run]
//
// Idempotente: blocos que já têm <span class="token"> são pulados.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { highlightCode, decodeEntities, neutralizeBraces } from './lib/highlight.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const POSTS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/app/pages/article-detail/posts',
);

const BLOCK = /<pre><code class="language-([a-z0-9-]+)">([\s\S]*?)<\/code><\/pre>/g;

// Desfaz o escaping de template string TS (ordem inversa da aplicação).
const unTs = (s) =>
  s.replace(/\$\\\{/g, '${').replace(/\\`/g, '`').replace(/\\\\/g, '\\');

// Reaplica o escaping de template string TS.
const reTs = (s) =>
  s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '$\\{');

let totalFiles = 0;
let totalBlocks = 0;

for (const file of readdirSync(POSTS_DIR).filter((n) => n.endsWith('.ts'))) {
  const path = resolve(POSTS_DIR, file);
  const before = readFileSync(path, 'utf8');
  let count = 0;

  const after = before.replace(BLOCK, (match, lang, body) => {
    // Já destacado mas com chaves cruas -> só neutraliza as chaves.
    if (body.includes('<span class="token')) {
      if (!/[{}]/.test(body)) return match;
      count++;
      return `<pre><code class="language-${lang}">${reTs(
        neutralizeBraces(unTs(body)),
      )}</code></pre>`;
    }

    // texto puro do código: desfaz TS-escaping e entidades HTML, destaca,
    // re-aplica TS-escaping (highlightCode já neutraliza as chaves).
    const rawCode = decodeEntities(unTs(body));
    const { html } = highlightCode(rawCode, lang);
    count++;
    return `<pre><code class="language-${lang}">${reTs(html)}</code></pre>`;
  });

  if (count && after !== before) {
    totalFiles++;
    totalBlocks += count;
    if (DRY_RUN) {
      console.log(`  (dry-run) ${file}: ${count} bloco(s)`);
    } else {
      writeFileSync(path, after, 'utf8');
      console.log(`✓ ${file}: ${count} bloco(s) destacado(s)`);
    }
  } else {
    console.log(`• ${file}: nada a fazer`);
  }
}

console.log(
  `\n${DRY_RUN ? '(dry-run) ' : ''}${totalBlocks} bloco(s) em ${totalFiles} arquivo(s).`,
);
