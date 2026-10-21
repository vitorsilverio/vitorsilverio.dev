// Dimensões intrínsecas de uma imagem lidas do cabeçalho do arquivo (PNG, JPEG, GIF, WebP).
// Usado pelo gerador de artigos para preencher largura/altura de <app-figura>.

/** @param {Buffer} b @returns {{largura:number, altura:number}|null} */
export function dimensoes(b) {
  // PNG
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) };
  }
  // GIF
  if (b.length > 10 && b.toString('latin1', 0, 3) === 'GIF') {
    return { largura: b.readUInt16LE(6), altura: b.readUInt16LE(8) };
  }
  // JPEG: procura um marcador SOFn
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { altura: b.readUInt16BE(i + 5), largura: b.readUInt16BE(i + 7) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
    return null;
  }
  // WebP
  if (
    b.length > 30 &&
    b.toString('latin1', 0, 4) === 'RIFF' &&
    b.toString('latin1', 8, 12) === 'WEBP'
  ) {
    const t = b.toString('latin1', 12, 16);
    if (t === 'VP8X') return { largura: 1 + b.readUIntLE(24, 3), altura: 1 + b.readUIntLE(27, 3) };
    if (t === 'VP8 ') {
      return { largura: b.readUInt16LE(26) & 0x3fff, altura: b.readUInt16LE(28) & 0x3fff };
    }
    if (t === 'VP8L') {
      const v = b.readUInt32LE(21);
      return { largura: (v & 0x3fff) + 1, altura: ((v >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

/**
 * Interpreta o bloco ```figura: uma figura por linha,
 * `src | alt | largura x altura | legenda`. Largura x altura pode ficar vazio
 * (lido do arquivo via `lerDims`); legenda é opcional.
 */
export function parseFiguras(texto, lerDims) {
  const figuras = [];
  const erros = [];
  for (const linha of texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)) {
    const [src = '', alt = '', dims = '', ...resto] = linha.split('|').map((s) => s.trim());
    if (!src || !alt) {
      erros.push(`figura sem src ou alt: "${linha.slice(0, 60)}"`);
      continue;
    }
    let largura, altura;
    const m = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(dims);
    if (m) {
      largura = Number(m[1]);
      altura = Number(m[2]);
    } else {
      const d = lerDims(src);
      if (!d) {
        erros.push(`figura sem "largura x altura" e arquivo não encontrado: ${src}`);
        continue;
      }
      ({ largura, altura } = d);
    }
    figuras.push({ src, alt, largura, altura, legenda: resto.join('|').trim() });
  }
  return { figuras, erros };
}
