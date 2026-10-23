// Espelha as pastas de exemplos de DOCS/ para site/public/, para os exemplos de
// código dos artigos serem baixáveis direto do site, sem passar pelo GitHub:
//   DOCS/curso-arm/exemplos/ -> /curso-arm/exemplos/<arquivo>  (trilha ARM)
//   DOCS/exemplos/<slug>/    -> /exemplos/<slug>/<arquivo>     (demais artigos)
// Fonte da verdade = DOCS/. Roda em `npm run gen:assets`.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, cpSync, rmSync, existsSync, readdirSync } from 'node:fs';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PASTAS = [
  { src: '../DOCS/curso-arm/exemplos', out: 'public/curso-arm/exemplos' },
  { src: '../DOCS/exemplos', out: 'public/exemplos' },
];

const count = (dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) =>
    d.isFile(),
  ).length;

for (const { src, out } of PASTAS) {
  const SRC = resolve(SITE_ROOT, src);
  const OUT = resolve(SITE_ROOT, out);
  const nome = src.replace('../', '');

  if (!existsSync(SRC)) {
    console.log(`• gen-examples: ${nome}/ não existe — nada a fazer.`);
    continue;
  }

  // Recria o destino do zero para não deixar arquivo órfão de um exemplo removido.
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  // Copia a árvore inteira (inclui subpastas como java/), ignorando dotfiles e
  // artefatos de build que não devem ir para o site.
  cpSync(SRC, OUT, {
    recursive: true,
    filter: (p) => {
      const base = p.split(/[\/]/).pop();
      return !base.startsWith('.') && !/\.(class|o)$/.test(base);
    },
  });

  console.log(`✓ exemplos: ${count(OUT)} arquivo(s) copiado(s) para ${out}/`);
}
