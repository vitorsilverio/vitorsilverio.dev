import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Breakpoints em em (relativos à fonte do navegador), não em px: com texto maior o layout
// recolhe mais cedo (WCAG 1.4.4). Container queries em rem ficam como estão.
const raiz = resolve(import.meta.dirname, '../src');

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      return nome === 'posts' ? [] : arquivos(caminho);
    }
    return /\.(css|ts)$/.test(nome) && !/\.spec\.ts$/.test(nome) ? [caminho] : [];
  });
}

describe('breakpoints', () => {
  const consultas = arquivos(raiz).flatMap((arq) =>
    readFileSync(arq, 'utf8')
      .split(/\r?\n/)
      .map((linha, i) => ({ arq, linha: linha.trim(), n: i + 1 }))
      .filter(({ linha }) => /(@media|matchMedia|MEDIA|CONSULTA)/.test(linha))
      .filter(({ linha }) => /(min|max)-(width|height)/.test(linha)),
  );

  it('encontra as media queries do site', () => {
    expect(consultas.length).toBeGreaterThanOrEqual(9);
  });

  it('nenhuma media query de largura usa px', () => {
    const ruins = consultas.filter(({ linha }) =>
      /(min|max)-(width|height):\s*[\d.]+px/.test(linha),
    );
    expect(ruins.map((r) => `${r.arq}:${r.n} ${r.linha}`)).toEqual([]);
  });
});
