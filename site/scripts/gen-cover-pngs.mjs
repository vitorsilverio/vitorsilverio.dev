import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COVERS = resolve(SITE_ROOT, 'public/assets/covers');

const FONTS = [
  'C:\\Windows\\Fonts\\segoeui.ttf',
  'C:\\Windows\\Fonts\\arial.ttf',
];

const files = readdirSync(COVERS).filter((f) => f.endsWith('.svg'));

for (const file of files) {
  const slug = file.replace(/\.svg$/, '');
  const svg = readFileSync(resolve(COVERS, file), 'utf8');
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: { fontFiles: FONTS, loadSystemFonts: false },
  });
  const png = resvg.render().asPng();
  writeFileSync(resolve(COVERS, `${slug}.png`), png);
  console.log(`✓ PNG gerado: assets/covers/${slug}.png (${png.length} bytes)`);
}

console.log(`\n${files.length} PNG(s) gerado(s).`);
