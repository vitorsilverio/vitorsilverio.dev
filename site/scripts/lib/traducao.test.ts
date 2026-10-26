import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Marked } from 'marked';
import { describe, expect, it } from 'vitest';

import { desescapar, extensaoTraducao, preservarEspacos, usaTraducao } from './traducao.mjs';

function md(src: string) {
  const m = new Marked({ gfm: true });
  m.use({ extensions: [extensaoTraducao()] });
  return (m.parse(src, { async: false }) as string).trim();
}

describe(':en[original]{tradução}', () => {
  it('gera o componente com o original em lang="en"', () => {
    expect(md('Ele disse :en[Hello, world!]{Olá, mundo!} e saiu.')).toBe(
      '<p>Ele disse <app-traducao><span lang="en">Hello, world!</span>' +
        '<span data-traducao>Olá, mundo!</span></app-traducao> e saiu.</p>',
    );
  });

  it('aceita aspas, pontuação, Markdown inline e escapes', () => {
    const h = md(
      `x :en[It's a "test" [sic\\]; *very* \`code\`]{É um "teste": **muito** \\} fim} y`,
    );
    expect(h).toContain(
      '<span lang="en">It&#39;s a &quot;test&quot; [sic]; <em>very</em> <code>code</code></span>',
    );
    expect(h).toContain(
      '<span data-traducao>É um &quot;teste&quot;: <strong>muito</strong> } fim</span>',
    );
  });

  it('escapa @ para o Angular', () => {
    expect(md(':en[use @if]{use @if}')).not.toMatch(/@/);
  });

  it('funciona em célula de tabela, sem colidir com a barra', () => {
    const h = md('| a | b |\n|---|---|\n| :en[Hi]{Oi} | x |');
    expect(h).toContain('<td><app-traducao>');
  });

  it('não colide com links nem com código', () => {
    expect(md('[:en[Hi]{Oi}](https://a.b)')).toContain('<a href="https://a.b"><app-traducao>');
    expect(md('`:en[Hi]{Oi}`')).toBe('<p><code>:en[Hi]{Oi}</code></p>');
  });
});

describe(':en[original] (só idioma)', () => {
  it('gera apenas <span lang="en">', () => {
    expect(md('Veja :en[The Pragmatic Programmer] hoje.')).toBe(
      '<p>Veja <span lang="en">The Pragmatic Programmer</span> hoje.</p>',
    );
  });

  it('ignora sintaxe vazia ou sem fechar', () => {
    expect(md('a :en[] b')).toContain(':en[]');
    expect(md('a :en[sem fim b')).toContain(':en[sem fim');
  });
});

describe('preservarEspacos / usaTraducao / desescapar', () => {
  it('mantém o espaço entre trechos vizinhos', () => {
    const h = preservarEspacos(md(':en[A]{a} :en[B]{b} e :en[C]'));
    expect(h).toContain('</app-traducao>&ngsp;<app-traducao>');
    expect(h).toContain('</app-traducao> e <span lang="en">C</span>');
    expect(preservarEspacos('<span lang="en">A</span> <span lang="en">B</span>')).toContain(
      '&ngsp;',
    );
  });
  it('detecta o componente', () => {
    expect(usaTraducao(md(':en[A]{a}'))).toBe(true);
    expect(usaTraducao(md(':en[A]'))).toBe(false);
  });
  it('desescapa', () => {
    expect(desescapar('a\\]b\\}c\\\\')).toBe('a]b}c\\');
  });
});

describe('new-article --from com :en[...] (ponta a ponta, --dry-run)', () => {
  const site = resolve(import.meta.dirname, '../..');
  function gerar(corpo: string) {
    const dir = mkdtempSync(join(tmpdir(), 'tr-'));
    try {
      const f = join(dir, 'teste-tr.md');
      writeFileSync(
        f,
        `# Teste\n\n**Slug:** \`teste-tr\`\n**Tags:** \`ARM\`\n**Reading time:** 5 min\n**Excerpt:** Resumo.\n\n---\n\n${corpo}\n`,
      );
      const r = spawnSync(
        process.execPath,
        ['scripts/new-article.mjs', '--from', f, '--dry-run', '--print'],
        {
          cwd: site,
          encoding: 'utf8',
        },
      );
      expect(r.status).toBe(0);
      return r.stdout + r.stderr;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  it('importa Traducao só quando há tradução', () => {
    const out = gerar('Fala :en[Hi]{Oi} e :en[Book]. Outra :en[Yo]{Ei}.');
    expect(out.match(/import \{ Traducao \}/g)).toHaveLength(1);
    expect(out).toContain('<span lang="en">Book</span>');
    expect(gerar('Só :en[Book].')).not.toContain('Traducao');
  });
});
