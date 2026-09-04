// Converte blocos <pre><code> de artigos já publicados nos componentes novos.
//
//   npm run migra-blocos -- --dry-run     só relata
//   npm run migra-blocos                  aplica
//   npm run migra-blocos -- --slug=x      um artigo só
//
// Listagem de objdump é convertida automaticamente (o formato é reconhecível).
// Layout de campo de bits é apenas SINALIZADO: as larguras são livres demais
// para adivinhar, e um diagrama com largura errada mente para o leitor.

import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { ehObjdump, pareceBitField, textoCru } from './lib/blocos.mjs';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const POSTS = resolve(SITE_ROOT, 'src/app/pages/article-detail/posts');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const alvo = (args.find((a) => a.startsWith('--slug=')) || '').split('=')[1];

const BLOCO = /<pre><code class="language-([a-z0-9-]+)">([\s\S]*?)<\/code><\/pre>/g;

/// Desfaz o escaping de template string do TS para ler o conteúdo real.
const unTs = (s) => s.replace(/\$\\\{/g, '${').replace(/\\`/g, '`').replace(/\\\\/g, '\\');
/// Reaplica o escaping de template string do TS.
const reTs = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '$\\{');

const escAttr = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Insere o import e o nome em `imports: [...]` se ainda não estiverem lá. */
function garantirImport(src, nome, caminho) {
  let out = src;
  if (!out.includes(`from '${caminho}'`)) {
    const ultimoImport = out.lastIndexOf('\nimport ');
    const fim = out.indexOf('\n', ultimoImport + 1);
    out = out.slice(0, fim + 1) + `import { ${nome} } from '${caminho}';\n` + out.slice(fim + 1);
  }
  if (/imports:\s*\[/.test(out)) {
    if (!new RegExp(`imports:\\s*\\[[^\\]]*\\b${nome}\\b`).test(out)) {
      out = out.replace(/imports:\s*\[([^\]]*)\]/, (_, dentro) =>
        `imports: [${dentro.trim() ? dentro.trim() + ', ' : ''}${nome}]`,
      );
    }
  } else {
    out = out.replace(/(@Component\(\{\n)/, `$1  imports: [${nome}],\n`);
  }
  return out;
}

let totalObj = 0;
let totalBf = 0;
const arquivosTocados = [];
const candidatosBf = [];

const arquivos = readdirSync(POSTS)
  .filter((n) => n.endsWith('.ts'))
  .filter((n) => !alvo || n === `${alvo}.ts`);

if (!arquivos.length) {
  console.error(`Nenhum post casa com --slug=${alvo}.`);
  process.exit(1);
}

for (const nome of arquivos) {
  const caminho = resolve(POSTS, nome);
  const antes = readFileSync(caminho, 'utf8');
  let convertidos = 0;

  const depois = antes.replace(BLOCO, (todo, lang, corpo) => {
    const cru = textoCru(unTs(corpo));

    if (ehObjdump(cru)) {
      convertidos++;
      return `<app-objdump\n      listagem="${reTs(escAttr(cru))}"\n    />`;
    }
    if (pareceBitField(cru)) {
      candidatosBf.push({ arq: nome, amostra: cru.split('\n')[0].slice(0, 68) });
    }
    return todo;
  });

  if (!convertidos) continue;

  let final = garantirImport(depois, 'Objdump', '../../../shared/objdump/objdump');
  totalObj += convertidos;
  arquivosTocados.push(`${basename(nome, '.ts')} (${convertidos})`);

  if (!DRY) writeFileSync(caminho, final, 'utf8');
}

const LINHA = '─'.repeat(66);
console.log(`\n${LINHA}`);
console.log(DRY ? 'RELATÓRIO (nada foi gravado)' : 'MIGRAÇÃO APLICADA');
console.log(LINHA);

console.log(`\nobjdump convertidos: ${totalObj}`);
arquivosTocados.forEach((a) => console.log(`  · ${a}`));
if (!totalObj) console.log('  (nenhum)');

console.log(`\ncandidatos a bitfield (converter à mão): ${candidatosBf.length}`);
candidatosBf.forEach((c) => console.log(`  · ${c.arq}\n      ${c.amostra}`));
if (!candidatosBf.length) console.log('  (nenhum)');

totalBf = candidatosBf.length;
if (!DRY && totalObj) {
  console.log(`\nRode "npm run build" e "npm run test" para validar.`);
}
console.log('');
