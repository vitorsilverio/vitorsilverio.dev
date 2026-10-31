import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  atributo,
  MAX_SERIES,
  parseAbertura,
  parseCorpo,
  parseNumero,
  tagGrafico,
} from './grafico.mjs';

const site = resolve(import.meta.dirname, '../..');

const BASE = `resumo: A ligação domina o tempo.
unidade: ms
eixo-x: Versão
eixo-y: Tempo
fonte: Dados sintéticos
---
Versão | Compilação | Ligação
1.0 | 120 | 280
1.1 | 110,5 | -
`;

function dadosDe(html: string): {
  categorias: string[];
  series: { nome: string; valores: (number | null)[] }[];
} {
  const m = /dados="([^"]*)"/.exec(html)!;
  return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
}

describe('parseNumero', () => {
  it('aceita ponto e vírgula decimal, negativos e "sem dado"', () => {
    expect(parseNumero('12')).toBe(12);
    expect(parseNumero('1,5')).toBe(1.5);
    expect(parseNumero('1.5')).toBe(1.5);
    expect(parseNumero('-3')).toBe(-3);
    for (const v of ['', '-', '—', '  ']) expect(parseNumero(v), v).toBeNull();
  });
  it('rejeita o que não é número', () => {
    for (const v of ['abc', '1,000,5', '12ms', '1e3', '+4'])
      expect(parseNumero(v), v).toBeUndefined();
  });
});

describe('parseAbertura', () => {
  it('separa tipo e título', () => {
    expect(parseAbertura('barras Tempo por etapa')).toEqual({
      tipo: 'barras',
      titulo: 'Tempo por etapa',
    });
    expect(parseAbertura('Linhas')).toEqual({ tipo: 'linhas', titulo: '' });
    expect(parseAbertura('')).toEqual({ tipo: '', titulo: '' });
  });
});

describe('parseCorpo', () => {
  it('lê metadados, séries e valores nulos', () => {
    const r = parseCorpo(BASE);
    expect(r.erros).toEqual([]);
    expect(r.meta['unidade']).toBe('ms');
    expect(r.meta['eixo-x']).toBe('Versão');
    expect(r.categorias).toEqual(['1.0', '1.1']);
    expect(r.series).toEqual([
      { nome: 'Compilação', valores: [120, 110.5] },
      { nome: 'Ligação', valores: [280, null] },
    ]);
  });
  it('avisa quando falta a linha ---', () => {
    const r = parseCorpo('Cat | A\nx | 1');
    expect(r.erros[0]).toContain('---');
    expect(r.categorias).toEqual(['x']);
  });
  it('ignora linhas com número de colunas errado, texto no lugar de número e sem categoria', () => {
    const r = parseCorpo('---\nC | A | B\nok | 1 | 2\ncurta | 1\nruim | 1 | x\n | 1 | 2');
    expect(r.categorias).toEqual(['ok']);
    expect(r.erros).toHaveLength(3);
    expect(r.erros.join('\n')).toMatch(/2 colunas/);
    expect(r.erros.join('\n')).toMatch(/"x" não é número/);
    expect(r.erros.join('\n')).toMatch(/sem nome de categoria/);
  });
  it('avisa de metadado desconhecido e de categoria repetida', () => {
    const r = parseCorpo('cor: azul\n---\nC | A\nx | 1\nx | 2');
    expect(r.erros.some((e) => e.includes('metadado desconhecido'))).toBe(true);
    expect(r.erros.some((e) => e.includes('categoria repetida'))).toBe(true);
  });
  it(`limita a ${MAX_SERIES} séries`, () => {
    const nomes = Array.from({ length: 8 }, (_, i) => `S${i}`);
    const r = parseCorpo(`---\nC | ${nomes.join(' | ')}\nx | ${nomes.map(() => '1').join(' | ')}`);
    expect(r.series).toHaveLength(MAX_SERIES);
    expect(r.erros[0]).toContain('máximo');
    expect(r.series[0].valores).toEqual([1]);
  });
});

describe('tagGrafico', () => {
  it('gera <app-grafico> com os atributos e o JSON dos dados', () => {
    const { html, erros } = tagGrafico('barras-empilhadas Tempo por etapa', BASE);
    expect(erros).toEqual([]);
    expect(html).toMatch(/^<app-grafico\n/);
    expect(html).toContain('tipo="barras-empilhadas"');
    expect(html).toContain('titulo="Tempo por etapa"');
    expect(html).toContain('resumo="A ligação domina o tempo."');
    expect(html).toContain('unidade="ms"');
    expect(html).toContain('eixoX="Versão"');
    expect(html).toContain('eixoY="Tempo"');
    expect(html).toContain('fonte="Dados sintéticos"');
    expect(dadosDe(html!).series[1].valores).toEqual([280, null]);
  });
  it('aceita os três tipos e rejeita tipo desconhecido', () => {
    for (const t of ['barras', 'barras-empilhadas', 'linhas']) {
      expect(tagGrafico(`${t} X`, BASE).html, t).not.toBeNull();
    }
    const r = tagGrafico('pizza X', BASE);
    expect(r.html).toBeNull();
    expect(r.erros[0]).toContain('tipo "pizza" desconhecido');
  });
  it('avisa quando falta o resumo e coloca um genérico', () => {
    const { html, erros } = tagGrafico('barras X', '---\nC | A\nx | 1\ny | 2');
    expect(erros.some((e) => e.includes('falta `resumo:`'))).toBe(true);
    expect(html).toContain('resumo="Gráfico de barras com 2 categorias');
  });
  it('avisa de linha malformada sem derrubar o bloco', () => {
    const { html, erros } = tagGrafico('linhas X', `resumo: r\n---\nC | A\nx | 1\ny | z\nw | 3`);
    expect(dadosDe(html!).categorias).toEqual(['x', 'w']);
    expect(erros.some((e) => e.includes('não é número'))).toBe(true);
  });
  it('ignora o bloco sem dados válidos', () => {
    const r = tagGrafico('barras X', 'resumo: r\n---\n');
    expect(r.html).toBeNull();
    expect(r.erros.some((e) => e.includes('sem dados válidos'))).toBe(true);
  });
  it('escapa HTML nos atributos', () => {
    const { html } = tagGrafico(
      'barras <b>X</b> "y"',
      'resumo: a <script>alert(1)</script> & b\n---\nC | A\nx | 1',
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('titulo="&lt;b&gt;X&lt;/b&gt; &quot;y&quot;"');
    expect(html).toContain('&amp; b');
  });
  it('duas chaves abrindo num valor viram binding de texto (interpolação do Angular)', () => {
    const { html } = tagGrafico('barras T {{x}}', "resumo: r {{y}} 'q'\n---\nC | A\nx | 1");
    expect(html).toContain(`[titulo]="'T {{x}}'"`);
    expect(html).toContain(`[resumo]="'r {{y}} \\'q\\''"`);
    expect(html).toContain('tipo="barras"');
  });
});

describe('atributo', () => {
  it('atributo estático para texto comum', () => {
    expect(atributo('a', 'b & "c"')).toBe('a="b &amp; &quot;c&quot;"');
  });
});

describe('integração com o gerador (--dry-run)', () => {
  it('gera o import de Grafico e avisa do resumo ausente', () => {
    const dir = mkdtempSync(join(tmpdir(), 'grafico-'));
    try {
      const md = join(dir, 'g.md');
      writeFileSync(
        md,
        `# G\n\n**Slug:** \`g-teste\`\n**Tags:** \`T\`\n**Excerpt:** e\n\n---\n\n\`\`\`grafico barras Sem resumo\n---\nC | A\nx | 1\ny | 2\n\`\`\`\n`,
      );
      const r = spawnSync(
        process.execPath,
        ['scripts/new-article.mjs', '--from', md, '--dry-run', '--print'],
        { cwd: site, encoding: 'utf8' },
      );
      expect(r.stdout).toContain("import { Grafico } from '../../../shared/grafico/grafico';");
      expect(r.stdout).toContain('imports: [Grafico]');
      expect(r.stderr).toContain('problema(s) com gráficos');
      expect(r.stderr).toContain('falta `resumo:`');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
