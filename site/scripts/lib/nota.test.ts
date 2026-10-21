import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { escapaArroba, paragrafosNota, tagNota } from './nota.mjs';

const ident = (s: string) => s;

describe('nota', () => {
  it('separa parágrafos por linha em branco e junta quebras simples', () => {
    expect(paragrafosNota('a\nb\n\n\nc\n')).toEqual(['a b', 'c']);
  });

  it('converte uma nota num <app-nota> com o número dado', () => {
    expect(tagNota(1, 'texto', ident)).toBe('<app-nota n="1">texto</app-nota>\n');
    expect(tagNota(3, 'x', ident)).toContain('n="3"');
  });

  it('vários parágrafos viram <p> cada um', () => {
    const h = tagNota(2, 'um\n\ndois', ident);
    expect(h).toContain('<p>um</p>');
    expect(h).toContain('<p>dois</p>');
  });

  it('usa o renderizador inline recebido', () => {
    const h = tagNota(1, '**b**', (s: string) => s.replace(/\*\*(.+)\*\*/, '<strong>$1</strong>'));
    expect(h).toContain('<strong>b</strong>');
  });

  it('escapa @ no texto mas não nas tags', () => {
    expect(escapaArroba('a @if <a href="x@y">b@c</a>')).toBe('a &#64;if <a href="x@y">b&#64;c</a>');
  });

  it('nota vazia devolve null', () => {
    expect(tagNota(1, '  \n ', ident)).toBeNull();
  });
});

describe('new-article --from com ```nota (ponta a ponta, --dry-run)', () => {
  const site = resolve(import.meta.dirname, '../..');

  function gerar(corpo: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'nota-'));
    try {
      const md = join(dir, 'teste-notas.md');
      writeFileSync(
        md,
        `# Teste\n\n**Slug:** \`teste-notas\`\n**Tags:** \`ARM\`\n**Reading time:** 5 min\n**Excerpt:** Resumo.\n\n---\n\n${corpo}\n`,
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

  it('numera em ordem, renderiza inline, escapa e importa Nota uma vez', () => {
    const out = gerar(
      [
        'Primeiro parágrafo.',
        '',
        '```nota',
        'Veja `r0` e **negrito**, *itálico*, [link](/artigos/aarch64) e `${x}` e {chave} e @if e crase \` solta.',
        '```',
        '',
        'Segundo.',
        '',
        '```nota',
        'Outra nota.',
        '```',
      ].join('\n'),
    );
    expect(out).toContain('<app-nota n="1">');
    expect(out).toContain('<app-nota n="2">Outra nota.</app-nota>');
    expect(out).toContain('<code>r0</code>');
    expect(out).toContain('<strong>negrito</strong>');
    expect(out).toContain('<em>itálico</em>');
    expect(out).toContain('<code>$&#123;x&#125;</code>');
    expect(out).toContain('&#64;if');
    expect(out).toContain(String.raw`crase \` solta`);
    expect(out).toContain('&#123;chave&#125;');
    expect(out.match(/import \{ Nota \}/g)).toHaveLength(1);
    expect(out).toContain('imports: [Nota]');
    expect(out).not.toMatch(/<p>\s*<app-nota/);
  });

  it('sem nota, não importa Nota', () => {
    const out = gerar('Só texto.');
    expect(out).not.toContain('import { Nota }');
    expect(out).not.toContain('imports:');
  });
});
