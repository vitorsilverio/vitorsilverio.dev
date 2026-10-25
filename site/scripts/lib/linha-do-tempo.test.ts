import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseData, parseEvento, tagLinhaDoTempo } from './linha-do-tempo.mjs';

const ident = (s: string) => s;

describe('parseData', () => {
  it('formata em pt-BR', () => {
    expect(parseData('2025')).toEqual({ iso: '2025', texto: '2025' });
    expect(parseData('2026-09')).toEqual({ iso: '2026-09', texto: 'set. 2026' });
    expect(parseData('2026-09-16')).toEqual({ iso: '2026-09-16', texto: '16 set. 2026' });
    expect(parseData('2026-09-06')!.texto).toBe('6 set. 2026');
  });
  it('rejeita datas inválidas', () => {
    for (const d of ['26-09', '2026-13', '2026-02-30', 'ontem', '2026-9', '']) {
      expect(parseData(d), d).toBeNull();
    }
  });
});

describe('parseEvento', () => {
  it('lê data, título, descrição e link', () => {
    expect(parseEvento('2025-11 | T | Desc | https://a.b/c')).toEqual({
      data: '2025-11',
      titulo: 'T',
      descricao: 'Desc',
      link: 'https://a.b/c',
    });
  });
  it('aceita link vazio (barra final) e ausência do campo', () => {
    expect(parseEvento('2026 | T | Desc |')).toMatchObject({ descricao: 'Desc', link: '' });
    expect(parseEvento('2026 | T | Desc')).toMatchObject({ descricao: 'Desc', link: '' });
  });
  it('mantém "|" dentro da descrição', () => {
    expect(parseEvento('2026 | T | a `x | y` b | https://a.b')).toMatchObject({
      descricao: 'a `x | y` b',
      link: 'https://a.b',
    });
  });
  it('erros', () => {
    expect(parseEvento('sem barras')).toHaveProperty('erro');
    expect(parseEvento('2026-13 | T | d')).toHaveProperty('erro');
    expect(parseEvento('2026 |  | d')).toHaveProperty('erro');
    expect(parseEvento('2026 | T | https://a.b')).toHaveProperty('erro');
  });
});

describe('tagLinhaDoTempo', () => {
  it('gera <ol> semântico com <time>, título e link acessível', () => {
    const { html, erros } = tagLinhaDoTempo(
      'Versões',
      '2025-11 | Um | Desc | https://a.b/?x=1&y=2\n2026 | Dois | D2 |',
      ident,
    );
    expect(erros).toEqual([]);
    expect(html).toContain('<app-linha-do-tempo titulo="Versões">');
    expect(html).toContain('<ol role="list">');
    expect(html).toContain('<time class="lt-data" datetime="2025-11">nov. 2025</time>');
    expect(html).toContain('href="https://a.b/?x=1&amp;y=2" target="_blank" rel="noopener"');
    expect(html).toContain('(abre em nova aba)');
    expect(html!.match(/<li>/g)).toHaveLength(2);
    expect(html!.match(/lt-fonte/g)).toHaveLength(1);
  });
  it('escapa @ e usa o renderizador inline', () => {
    const { html } = tagLinhaDoTempo('', '2026 | **T** @if | x', (s: string) =>
      s.replace(/\*\*(.+)\*\*/, '<strong>$1</strong>'),
    );
    expect(html).toContain('<strong>T</strong> &#64;if');
    expect(html).not.toContain('titulo=');
  });
  it('ignora linhas malformadas com aviso e avisa fora de ordem', () => {
    const { html, erros } = tagLinhaDoTempo('X', 'lixo\n2026-05 | A | a\n2025-01 | B | b', ident);
    expect(html!.match(/<li>/g)).toHaveLength(2);
    expect(erros).toHaveLength(2);
    expect(erros[1]).toContain('fora de ordem');
  });
  it('sem eventos válidos devolve null', () => {
    const r = tagLinhaDoTempo('X', 'lixo', ident);
    expect(r.html).toBeNull();
    expect(r.erros.length).toBeGreaterThan(0);
  });
});

describe('tagLinhaDoTempo: bordas', () => {
  it('aceita 29 de fevereiro só em ano bissexto', () => {
    expect(parseData('2024-02-29')!.texto).toBe('29 fev. 2024');
    expect(parseData('2026-02-29')).toBeNull();
    expect(parseData('2026-00')).toBeNull();
  });
  it('escapa aspas e sinais de menor no título e na URL do atributo', () => {
    const { html } = tagLinhaDoTempo(
      'A "b" <c> & d',
      '2026-01 | T | d | https://a.b/?x=1&y="2"',
      ident,
    );
    expect(html).toContain('titulo="A &quot;b&quot; &lt;c&gt; &amp; d"');
    expect(html).toContain('href="https://a.b/?x=1&amp;y=&quot;2&quot;"');
    expect(html).not.toContain('<c>');
  });
  it('aceita fim de linha CRLF', () => {
    const { html, erros } = tagLinhaDoTempo('', '2026-01 | A | a\r\n2026-02 | B | b\r\n', ident);
    expect(erros).toEqual([]);
    expect(html!.match(/<li>/g)).toHaveLength(2);
    expect(html).not.toContain('\r');
  });
  it('compara datas de granularidades diferentes só pelo prefixo comum', () => {
    const ok = tagLinhaDoTempo('', '2026-05 | A | a\n2026-05-10 | B | b\n2026-05 | C | c', ident);
    expect(ok.erros).toEqual([]);
    const fora = tagLinhaDoTempo('', '2026-05-10 | A | a\n2026-04 | B | b', ident);
    expect(fora.erros).toHaveLength(1);
    expect(fora.erros[0]).toContain('fora de ordem');
  });
  it('não aceita esquemas que não sejam http(s) como link', () => {
    const { html } = tagLinhaDoTempo('', '2026 | T | d | javascript:alert(1)', ident);
    expect(html).not.toContain('lt-fonte');
    expect(html).not.toContain('href=');
  });
  it('nome acessível do link usa só o texto puro do título', () => {
    const { html } = tagLinhaDoTempo(
      '',
      '2026 | **Negrito** e [link](https://x.y) | d | https://a.b',
      (s: string) => s.replace(/\*\*(.+?)\*\*/, '<strong>$1</strong>'),
    );
    expect(html).toContain(
      '<span class="visually-hidden"> de Negrito e link (abre em nova aba)</span>',
    );
  });
});

describe('new-article --from com ```linha-do-tempo (ponta a ponta, --dry-run)', () => {
  const site = resolve(import.meta.dirname, '../..');

  function gerar(corpo: string) {
    const dir = mkdtempSync(join(tmpdir(), 'lt-'));
    try {
      const md = join(dir, 'teste-lt.md');
      writeFileSync(
        md,
        `# Teste\n\n**Slug:** \`teste-lt\`\n**Tags:** \`ARM\`\n**Reading time:** 5 min\n**Excerpt:** Resumo.\n\n---\n\n${corpo}\n`,
      );
      const r = spawnSync(
        process.execPath,
        ['scripts/new-article.mjs', '--from', md, '--dry-run', '--print'],
        { cwd: site, encoding: 'utf8' },
      );
      expect(r.status).toBe(0);
      return r.stdout + r.stderr;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('converte, escapa, importa LinhaDoTempo uma vez e avisa de linha ruim', () => {
    const out = gerar(
      [
        'Antes.',
        '',
        '```linha-do-tempo Versões',
        '2025-11 | Um | Veja `${x}` e {a} e @if e **negrito**. | https://a.b/c',
        'quebrada',
        '```',
        '',
        '```linha-do-tempo',
        '2026 | Dois | Outra. |',
        '```',
      ].join('\n'),
    );
    expect(out).toContain('<app-linha-do-tempo titulo="Versões">');
    expect(out).toContain('<time class="lt-data" datetime="2025-11">nov. 2025</time>');
    expect(out).toContain('<strong>negrito</strong>');
    expect(out).toContain('$&#123;x&#125;');
    expect(out).toContain('&#64;if');
    expect(out).toContain('problema(s) com linhas do tempo');
    expect(out.match(/import \{ LinhaDoTempo \}/g)).toHaveLength(1);
    expect(out).not.toMatch(/<p>\s*<app-linha-do-tempo/);
  });

  it('sem cerca, não importa o componente', () => {
    expect(gerar('Só texto.')).not.toContain('LinhaDoTempo');
  });
});
