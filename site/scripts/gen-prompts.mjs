// Emite os prompts de capa, um por artigo, prontos para colar num gerador de imagem.
// O padrão e a escolha do tratamento estão em DOCS/curso-arm/CAPAS.md.
//
//   npm run prompts                      todos, tratamento A
//   npm run prompts -- --estilo=b         todos, serigrafia
//   npm run prompts -- --slug=aarch64     um só
//   npm run prompts -- --mascote          os três conceitos de mascote
//
// REGRA DURA: nenhum console real é citado pelo nome (marca registrada, e o modelo
// devolve o produto reconhecível). Só descrição genérica.

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES_TS = resolve(SITE_ROOT, 'src/app/data/articles.ts');

const args = process.argv.slice(2);
const flag = (n, d) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.split('=')[1] : d;
};
const has = (n) => args.includes(`--${n}`);

// ---------------------------------------------------------------- estilos
const ESTILOS = {
  a: {
    nome: 'A · Macro de hardware',
    bloco: `Style: cinematic macro photography, tactile and physical, shot on a 100mm macro lens.
Palette: strictly limited to deep near-black and warm amber — amber is the ONLY light source in the scene. No other hues.
Light: a single hard warm light raking from one side, deep black shadows, strong rim light along the subject's edges.
Composition: ONE dominant subject filling most of the frame, slightly off-center, shallow depth of field. The bottom third stays dark and empty for a title overlay.
No text, no letters, no numbers, no logos, no UI. Aspect ratio 16:9.`,
  },
  b: {
    nome: 'B · Serigrafia de duas cores',
    bloco: `Style: screen-print poster illustration with visible halftone grain and slight ink misregistration.
Palette: exactly two inks — warm amber and near-black. No gradients, no third color.
Form: bold flat shapes, heavy contrast, thick confident outlines, one dominant silhouette reading clearly at thumbnail size.
Composition: subject centered and large, bottom third left as flat dark ink for a title overlay.
No text, no letters, no numbers, no logos. Aspect ratio 16:9.`,
  },
  c: {
    nome: 'C · Render isométrico',
    bloco: `Style: clean isometric 3D studio render, matte materials, soft micro-bevels.
Palette: near-black background and matte dark objects, with warm amber as the only emissive/accent color.
Light: single warm rim light plus a dim fill, deep shadows, subtle contact shadow.
Composition: one dominant object centered, generous negative space, bottom third empty and dark for a title overlay.
No text, no letters, no numbers, no logos. Aspect ratio 16:9.`,
  },
};

// ------------------------------------------------- assunto e termo por artigo
// `termo` é a palavra-gancho que o compositor desenha por cima.
// `assunto` é a única parte variável do prompt.
const MAPA = {
  'boas-vindas': { termo: 'OLÁ', assunto: 'an empty desk with a switched-on desk lamp and a closed notebook' },
  'angular-signals-na-pratica': { termo: 'SIGNAL', assunto: 'a network of glowing filaments branching out from a single point, like a dependency graph made physical' },

  'por-que-emular-arm': { termo: 'EMULAR', assunto: 'a row of fictional retro handheld consoles of different shapes standing on a shelf, seen from a low angle' },
  'ambiente-arm': { termo: 'SETUP', assunto: 'a workbench with a soldering iron, a small development board and neatly coiled cables' },
  'convencoes-assembly-arm': { termo: 'SINTAXE', assunto: 'a stack of old technical reference manuals with worn edges, one lying open' },

  'fundamentos-arm': { termo: 'ARM', assunto: 'a bare microprocessor chip resting on an anti-static mat, seen very close' },
  'registradores-e-cpsr-arm': { termo: 'CPSR', assunto: 'a row of sixteen identical small metal switches on a control panel, one of them flipped' },
  'thumb-e-thumb-2': { termo: 'THUMB', assunto: 'two metal rulers of different lengths lying side by side, one exactly half the other' },
  'anatomia-instrucao-arm': { termo: 'ADD', assunto: 'a precision caliper measuring a tiny segmented metal bar divided into unequal sections' },
  'fetch-decode-execute-armcore': { termo: 'STEP', assunto: 'a mechanical conveyor of small metal blocks passing through three stations' },

  'do-c-ao-binario-arm': { termo: 'GCC', assunto: 'a paper punch card half-fed into a machine, holes catching the light' },
  'decodificando-instrucoes-arm-objdump': { termo: 'OBJDUMP', assunto: 'a magnifying glass held over a dense grid of tiny engraved marks' },
  'decodificando-thumb-a-mao': { termo: '16 BITS', assunto: 'a small brass gauge with sixteen tick marks, needle resting between two of them' },
  'flags-e-desvios-condicionais': { termo: 'NZCV', assunto: 'four small indicator lamps on a dark panel, only one of them lit' },
  'decoder-do-arm-jitter': { termo: 'DECODE', assunto: 'a mechanical sorting machine dropping small blocks into four separate chutes' },

  'primeiro-programa-assembly-arm': { termo: 'FIB', assunto: 'a spiral of nested metal rings growing outward, each one larger than the last' },
  'montar-e-ligar-arm': { termo: 'LD', assunto: 'two precision-machined metal parts being fitted together, seen at the seam' },
  'hello-armbox': { termo: 'HELLO', assunto: 'a small fictional handheld device powering on for the first time, its screen the only lit thing' },
  'carga-e-armazenamento-arm': { termo: 'LDR', assunto: 'a robotic arm lifting a single small block from a grid of identical slots' },
  'sub-rotinas-arm-bl-bx-pilha': { termo: 'BL', assunto: 'a tall stack of identical metal plates, one being placed on top' },
  'arm-jitter-api-java': { termo: 'API', assunto: 'a patch bay with cables connecting two banks of ports' },
  'gdb-no-armbox': { termo: 'GDB', assunto: 'a probe from an oscilloscope touching a single pin on a circuit board' },

  'dentro-do-emulador-o-core': { termo: 'CORE', assunto: 'a chip with its metal lid removed, the bare silicon die exposed at the center' },
  'memoria-e-mmio-no-emulador': { termo: 'MMIO', assunto: 'a wall of numbered mailboxes, one of them open' },
  'ir-otimizador-e-backends': { termo: 'JIT', assunto: 'a foundry pour, molten metal running into a mold' },
  'performance-e-encadeamento-de-blocos': { termo: 'CACHE', assunto: 'a chain of interlocking metal links stretched tight' },
  'interrupcoes-excecoes': { termo: 'IRQ', assunto: 'a red emergency lever on a dark industrial panel, mid-pull' },

  'armv4t-arm7tdmi-gba': { termo: 'ARMv4T', assunto: 'a fictional horizontal handheld console with a cartridge slot, seen from a three-quarter angle' },
  'armv5te-arm9-nds': { termo: 'ARMv5TE', assunto: 'a fictional clamshell handheld console open at ninety degrees, two screens facing up' },
  'armv6k-arm11-3ds': { termo: 'LDREX', assunto: 'two mechanical keys inserted into a single lock, only one able to turn' },
  'thumb-2-instrucoes-32-bit': { termo: 'IT', assunto: 'a railway switch splitting one track into two, the lever set to one side' },
  'instrucoes-condicionais-thumb': { termo: 'ITE', assunto: 'a row of four mechanical gates on a track, two open and two shut, set by a single cam' },
  'manipulacao-bits-thumb': { termo: 'BFI', assunto: 'a watchmaker tweezers placing one tiny gear into a row of identical gears' },
  'armv7a-e-vfpv2': { termo: 'VFP', assunto: 'a slide rule with its cursor mid-slide, engraved scales catching the light' },
  'barreiras-memoria': { termo: 'DMB', assunto: 'a heavy steel floodgate half-lowered across a channel' },
  'cortex-m-perfil-m': { termo: 'CORTEX-M', assunto: 'a bare microcontroller development board, tiny and dense, held between two fingertips' },
  'semihosting': { termo: 'BKPT', assunto: 'a service hatch cut into a sealed machine housing, propped open' },
  'aarch64': { termo: 'AArch64', assunto: 'a modern system-on-chip package, much larger than the chips around it' },

  'estudo-de-caso-gba-gbaemu': { termo: 'GBA', assunto: 'a fictional horizontal handheld console disassembled into its layers, laid out flat' },
  'estudo-de-caso-nds-ndsemu': { termo: 'DUAL', assunto: 'two identical mechanical movements running side by side, connected by a single shaft' },
  'estudo-de-caso-3ds-n3dsemu': { termo: 'MPCORE', assunto: 'a fictional clamshell handheld console with a stereoscopic top screen, shell removed' },
  'estudo-de-caso-linux-virtual-arm-box': { termo: 'BOOT', assunto: 'an old CRT terminal glowing in a dark server room, cables running out of frame' },

  'vfp-ponto-flutuante': { termo: 'FLOAT', assunto: 'a precision balance scale at rest, its pointer just off center' },
  'exclusivity-monitor-ldrex-strex': { termo: 'STREX', assunto: 'two hands reaching for the same single lever on a control panel' },
  'mmu-e-paginacao-cp15': { termo: 'MMU', assunto: 'a card catalog drawer pulled open, index cards standing in rows' },
  'escrevendo-um-ir-pass': { termo: 'IR', assunto: 'a machinist adding one new tooth to a metal gear on a workbench' },
};

// ---------------------------------------------------------------- mascote
const MASCOTE = [
  {
    n: 'A · O Impostor',
    ideia: 'Emulação é fingir ser outra máquina, e fingir convincentemente.',
    p: `Flat vector mascot logo of a small soft round creature holding a handheld game console shell in front of its face like a mask, big expressive eyes visible through the screen opening. Thick confident outlines, only two colors: warm amber and near-black, plus white for the eyes. Simple bold shapes readable at 16 pixels. Centered, plain background, no text. Friendly and mischievous.`,
  },
  {
    n: 'B · O Fantasma do Cartucho',
    ideia: 'Emulação ressuscita hardware morto. (Fantasma já é comum em marca de dev — avalie.)',
    p: `Flat vector mascot logo of a small friendly ghost rising out of a cartridge slot, semi-transparent body with a soft warm amber glow, simple dot eyes. Thick outlines, two colors only: warm amber and near-black. Bold simple silhouette readable at 16 pixels. Centered, plain background, no text.`,
  },
  {
    n: 'C · O Bicho de Placa',
    ideia: 'A máquina viva. Menos metafórico, mais fácil de manter consistente.',
    p: `Flat vector mascot logo of a small round creature whose body is a circuit board and whose face is a lit screen with two simple glowing eyes, tiny chip-pin legs. Thick outlines, two colors only: warm amber and near-black. Chunky simple shapes readable at 16 pixels. Centered, plain background, no text. Cute and sturdy.`,
  },
];

// ---------------------------------------------------------------- saída
const LINHA = '─'.repeat(74);

if (has('mascote')) {
  console.log(`\n${LINHA}\nMASCOTE — gere 5 de cada e compare em 16 px\n${LINHA}`);
  for (const m of MASCOTE) {
    console.log(`\n### ${m.n}\n${m.ideia}\n\n${m.p}\n`);
  }
  process.exit(0);
}

const estiloKey = (flag('estilo', 'a') || 'a').toLowerCase();
const estilo = ESTILOS[estiloKey];
if (!estilo) {
  console.error(`Estilo desconhecido: ${estiloKey}. Use a, b ou c.`);
  process.exit(1);
}

const src = readFileSync(ARTICLES_TS, 'utf8');
const publicados = [...src.matchAll(/slug:\s*'([^']+)'[\s\S]*?title:\s*'((?:[^'\\]|\\.)*)'/g)]
  .map((m) => ({ slug: m[1], title: m[2].replace(/\\'/g, "'") }));
const publicadosSet = new Set(publicados.map((a) => a.slug));

const filtro = flag('slug', null);
const alvos = Object.keys(MAPA).filter((s) => !filtro || s === filtro);

if (!alvos.length) {
  console.error(`Nenhum artigo casa com --slug=${filtro}.`);
  process.exit(1);
}

console.log(`\n${LINHA}`);
console.log(`Tratamento ${estilo.nome} · ${alvos.length} artigo(s)`);
console.log(`Sem nome de console real. Ver DOCS/curso-arm/CAPAS.md.`);
console.log(LINHA);

for (const slug of alvos) {
  const { termo, assunto } = MAPA[slug];
  const pub = publicadosSet.has(slug);
  console.log(`\n\n### ${slug}${pub ? '' : '   (ainda não publicado)'}`);
  console.log(`termo: ${termo}\n`);
  console.log(`${assunto.charAt(0).toUpperCase()}${assunto.slice(1)}.\n`);
  console.log(estilo.bloco);
}

const semMapa = publicados.filter((a) => !MAPA[a.slug]).map((a) => a.slug);
if (semMapa.length && !filtro) {
  console.log(`\n\n${LINHA}`);
  console.log(`Sem assunto mapeado (adicione em MAPA neste arquivo):`);
  semMapa.forEach((s) => console.log(`  · ${s}`));
}
console.log('');
