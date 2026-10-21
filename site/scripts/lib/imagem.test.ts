import { describe, expect, it } from 'vitest';

import { dimensoes, parseFiguras } from './imagem.mjs';

function png(l: number, a: number): Buffer {
  const b = Buffer.alloc(33);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(l, 16);
  b.writeUInt32BE(a, 20);
  return b;
}

describe('imagem', () => {
  it('lê dimensões de PNG', () => {
    expect(dimensoes(png(1500, 900))).toEqual({ largura: 1500, altura: 900 });
  });

  it('lê dimensões de JPEG (SOF0)', () => {
    const b = Buffer.from([
      0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0x01, 0x2c, 0x02, 0x58, 3, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(dimensoes(b)).toEqual({ largura: 600, altura: 300 });
  });

  it('devolve null para formato desconhecido', () => {
    expect(dimensoes(Buffer.from('texto qualquer sem cabecalho de imagem'))).toBeNull();
  });

  it('interpreta linhas do bloco figura', () => {
    const { figuras, erros } = parseFiguras(
      '/a.png | Tela A | 1400 x 800 | Legenda | com barra\n/b.png | Tela B | | ',
      (s: string) => (s === '/b.png' ? { largura: 10, altura: 20 } : null),
    );
    expect(erros).toEqual([]);
    expect(figuras[0]).toEqual({
      src: '/a.png',
      alt: 'Tela A',
      largura: 1400,
      altura: 800,
      legenda: 'Legenda|com barra',
    });
    expect(figuras[1]).toMatchObject({ largura: 10, altura: 20, legenda: '' });
  });

  it('reporta erro sem alt ou sem dimensões legíveis', () => {
    const { figuras, erros } = parseFiguras('/a.png\n/c.png | alt | |', () => null);
    expect(figuras).toEqual([]);
    expect(erros).toHaveLength(2);
  });
});
