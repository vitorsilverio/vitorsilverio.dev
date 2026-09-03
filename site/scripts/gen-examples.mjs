// Espelha DOCS/curso-arm/exemplos/ para site/public/curso-arm/exemplos/, para os
// exemplos de código da trilha serem baixáveis direto do site
// (https://vitorsilverio.dev/curso-arm/exemplos/<arquivo>), sem passar pelo GitHub.
// Fonte da verdade = DOCS/curso-arm/exemplos/. Roda em `npm run gen:assets`.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  readdirSync,
  mkdirSync,
  copyFileSync,
  rmSync,
  existsSync,
  statSync,
} from 'node:fs';

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

const files = readdirSync(SRC)
  .filter((n) => !n.startsWith('.') && statSync(resolve(SRC, n)).isFile())
  .sort();

for (const name of files) {
  copyFileSync(resolve(SRC, name), resolve(OUT, name));
}

console.log(
  `✓ exemplos: ${files.length} arquivo(s) copiado(s) para public/curso-arm/exemplos/`,
);
