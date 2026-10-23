// Migração idempotente: marca as tabelas dos posts publicados para a apresentação
// "lista de definição" em telas estreitas (class="tabela-lista", roles ARIA e data-label).
// Só markup; o texto dos artigos não muda.
//
//   node scripts/tabelas-lista-posts.mjs [--dry-run] [slug.ts ...]
//
// Sem argumentos, processa todos os posts. Tabelas com class="tabela-matriz" (opt-out) e
// tabelas já marcadas são puladas. Tabelas sem estrutura simples (colspan, sem thead) são
// relatadas e ficam como estão (continuam rolando).
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { marcarTabelasEmHtml } from './lib/tabela-lista.mjs';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const pedidos = args.filter((a) => !a.startsWith('--')).map((a) => basename(a, '.ts') + '.ts');
const POSTS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/app/pages/article-detail/posts',
);

const arquivos = readdirSync(POSTS_DIR)
  .filter((n) => n.endsWith('.ts'))
  .filter((n) => !pedidos.length || pedidos.includes(n));

let totalArquivos = 0;
let totalTabelas = 0;

for (const file of arquivos) {
  const path = resolve(POSTS_DIR, file);
  const before = readFileSync(path, 'utf8');
  const r = marcarTabelasEmHtml(before);
  for (const motivo of r.ignoradas) console.log(`  ! ${file}: tabela ignorada (${motivo})`);
  if (r.marcadas && r.html !== before) {
    totalArquivos++;
    totalTabelas += r.marcadas;
    if (DRY_RUN) console.log(`  (dry-run) ${file}: ${r.marcadas} tabela(s)`);
    else {
      writeFileSync(path, r.html, 'utf8');
      console.log(`✓ ${file}: ${r.marcadas} tabela(s) marcada(s)`);
    }
  } else {
    console.log(`• ${file}: nada a fazer`);
  }
}

console.log(
  `\n${DRY_RUN ? '(dry-run) ' : ''}${totalTabelas} tabela(s) em ${totalArquivos} arquivo(s).`,
);
