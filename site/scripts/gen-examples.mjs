// Espelha DOCS/curso-arm/exemplos/ para site/public/curso-arm/exemplos/, para os
// exemplos de código da trilha serem baixáveis direto do site
// (https://vitorsilverio.dev/curso-arm/exemplos/<arquivo>), sem passar pelo GitHub.
// Fonte da verdade = DOCS/curso-arm/exemplos/. Roda em `npm run gen:assets`.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, cpSync, rmSync, existsSync, readdirSync } from 'node:fs';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(SITE_ROOT, '../DOCS/curso-arm/exemplos');
const OUT = resolve(SITE_ROOT, 'public/curso-arm/exemplos');

if (!existsSync(SRC)) {
  console.log('• gen-examples: DOCS/curso-arm/exemplos/ não existe — nada a fazer.');
  process.exit(0);
}

// Recria o destino do zero para não deixar arquivo órfão de um exemplo removido.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Copia a árvore inteira (inclui subpastas como java/), ignorando dotfiles e
// artefatos de build que não devem ir para o site.
cpSync(SRC, OUT, {
  recursive: true,
  filter: (src) => {
    const base = src.split(/[\\/]/).pop();
    return !base.startsWith('.') && !/\.(class|o)$/.test(base);
  },
});

const count = (dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) =>
    d.isFile(),
  ).length;

console.log(
  `✓ exemplos: ${count(OUT)} arquivo(s) copiado(s) para public/curso-arm/exemplos/`,
);
