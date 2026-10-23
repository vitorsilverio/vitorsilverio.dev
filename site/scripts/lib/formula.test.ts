import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { palavrasSoltas, secoesFormula, tagFormula } from './formula.mjs';

const ident = (s: string) => s;
const corpo = [
  'Q = d \\cdot G',
  '---',
  'd: a chave privada',
  'G: o gerador',
  '---',
  'Um raciocínio.',
].join('\n');

describe('formula', () => {
  it('separa as seções por uma linha só com ---', () => {
    expect(secoesFormula('a\r\n---\r\nb\n  ---  \nc')).toEqual(['a', 'b', 'c']);
  });

  it('gera MathML sem xmlns, legenda em dl e parágrafo de explicação', () => {
    const { html, erros } = tagFormula('Chave pública', corpo, ident);
    expect(erros).toEqual([]);
    expect(html).toContain('<app-formula titulo="Chave pública">');
    expect(html).toMatch(/<math display="block"[^>]*>/);
    expect(html).not.toContain('xmlns');
    expect(html).toContain('<mo>⋅</mo>');
    expect(html).toContain('<dt><math><mi>d</mi></math></dt>');
    expect(html).toContain('<dd>a chave privada</dd>');
    expect(html).toContain('<p>Um raciocínio.</p>');
    expect(html).toMatch(/<\/app-formula>\n$/);
  });

  it('legenda e explicação são opcionais; título também', () => {
    const { html } = tagFormula('', 'x^2', ident);
    expect(html!.startsWith('<app-formula>')).toBe(true);
    expect(html).not.toContain('<dl>');
    expect(html).not.toContain('<p>');
  });

  it('usa o renderizador inline e escapa @ no texto', () => {
    const { html } = tagFormula('', 'x\n---\nx: veja @if **b**\n---\n**p**', (s) =>
      s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'),
    );
    expect(html).toContain('<dd>veja &#64;if <strong>b</strong></dd>');
    expect(html).toContain('<p><strong>p</strong></p>');
  });

  it('não deixa linha em branco dentro do bloco (quebraria o HTML do Markdown)', () => {
    const { html } = tagFormula('t', corpo + '\n\nOutro parágrafo.', ident);
    expect(html).not.toMatch(/\n\s*\n/);
  });

  it('LaTeX inválido vira aviso e não gera bloco', () => {
    const r = tagFormula('', '\\frac{1', ident);
    expect(r.html).toBeNull();
    expect(r.erros[0]).toContain('LaTeX inválido');
  });

  it('avisa de palavra solta no LaTeX (comando sem a barra invertida)', () => {
    const r = tagFormula('', 'T(k) approx 2^{k/2}', ident);
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0]).toContain('"approx"');
  });

  it('não avisa de comandos com barra, \\text{...} nem de letras isoladas', () => {
    expect(palavrasSoltas('T(k) \\approx 2^{k/2} \\quad\\text{até}\\quad \\mathrm{mod}\\, n')).toEqual([]);
    expect(palavrasSoltas('x(d \\cdot G) \\mapsto d')).toEqual([]);
    expect(tagFormula('', 'Q = d \\cdot G', ident).erros).toEqual([]);
  });

  it('cerca vazia vira aviso', () => {
    expect(tagFormula('', '  ', ident)).toEqual({
      html: null,
      erros: ['bloco ```formula sem LaTeX (ignorado)'],
    });
  });

  it('linha de legenda sem ": " vira aviso e as demais continuam', () => {
    const r = tagFormula('', 'x\n---\nsem separador\ny: ok', ident);
    expect(r.erros).toHaveLength(1);
    expect(r.html).toContain('<dd>ok</dd>');
  });
});

describe('new-article --from com ```formula (ponta a ponta, --dry-run)', () => {
  const site = resolve(import.meta.dirname, '../..');

  function gerar(corpoMd: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'formula-'));
    try {
      const md = join(dir, 'teste-formula.md');
      writeFileSync(
        md,
        `# Teste\n\n**Slug:** \`teste-formula\`\n**Tags:** \`ARM\`\n**Reading time:** 5 min\n**Excerpt:** Resumo.\n\n---\n\n${corpoMd}\n`,
      );
      const r = spawnSync(
        process.execPath,
        ['scripts/new-article.mjs', '--from', md, '--dry-run', '--print'],
        { cwd: site, encoding: 'utf8' },
      );
      expect(r.status).toBe(0);
      return r.stdout;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('converte a cerca, escapa chaves e importa Formula uma vez', () => {
    const out = gerar(
      [
        'Antes.',
        '',
        '```formula Conjunto',
        'S = \\{ 1, 2 \\}',
        '---',
        'S: o `conjunto`',
        '```',
        '',
        'Depois.',
      ].join('\n'),
    );
    expect(out).toContain('<app-formula titulo="Conjunto">');
    expect(out).toContain('<code>conjunto</code>');
    expect(out).toContain('&#123;');
    expect(out).not.toMatch(/<math[^>]*>[^]*\{[^]*<\/math>/);
    expect(out.match(/import \{ Formula \}/g)).toHaveLength(1);
    expect(out).toContain('imports: [Formula]');
    expect(out).not.toMatch(/<p>\s*<app-formula/);
  });

  it('sem fórmula, não importa Formula', () => {
    expect(gerar('Só texto.')).not.toContain('import { Formula }');
  });
});
