import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  marcarMatriz,
  marcarTabela,
  marcarTabelasEmHtml,
  rotuloDeCabecalho,
} from './tabela-lista.mjs';

const SITE = resolve(import.meta.dirname, '../..');

const TABELA = `<table>
    <caption>Comandos</caption><thead>
      <tr><th scope="col">Comando</th><th scope="col">O que faz</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row"><code>php -v</code></th><td>Mostra a <em>versão</em>.</td></tr>
      <tr><th scope="row">b</th><td>c</td></tr>
    </tbody>
  </table>`;

describe('rotuloDeCabecalho', () => {
  it('tira tags e espaços, escapa aspas e chaves', () => {
    expect(rotuloDeCabecalho('  <code>a</code>\n  "b" {c}  ')).toBe(
      'a &quot;b&quot; &#123;c&#125;',
    );
  });
});

describe('marcarTabela', () => {
  it('põe classe, roles ARIA e data-label vindo do cabeçalho', () => {
    const { html, status } = marcarTabela(TABELA);
    expect(status).toBe('marcada');
    expect(html).toContain('<table class="tabela-lista" role="table">');
    expect(html).toContain('<thead role="rowgroup">');
    expect(html).toContain('<tbody role="rowgroup">');
    expect(html).toContain('<tr role="row"><th scope="col" role="columnheader">Comando</th>');
    expect(html).toContain(
      '<th scope="row" role="rowheader" data-label="Comando"><code>php -v</code></th>',
    );
    expect(html).toContain('<td role="cell" data-label="O que faz">Mostra a <em>versão</em>.</td>');
  });

  it('preserva o texto: sem as marcações, o HTML é idêntico', () => {
    const { html } = marcarTabela(TABELA);
    const limpo = html
      .replace(/ class="tabela-lista"/, '')
      .replace(/ role="[a-z]+"/g, '')
      .replace(/ data-label="[^"]*"/g, '');
    expect(limpo).toBe(TABELA);
  });

  it('é idempotente', () => {
    const uma = marcarTabela(TABELA);
    const duas = marcarTabela(uma.html);
    expect(duas.status).toBe('ja-marcada');
    expect(duas.html).toBe(uma.html);
  });

  it('respeita o opt-out tabela-matriz', () => {
    const matriz = marcarMatriz(TABELA);
    expect(matriz).toContain('<table class="tabela-matriz">');
    const r = marcarTabela(matriz);
    expect(r.status).toBe('matriz');
    expect(r.html).toBe(matriz);
    expect(marcarMatriz(matriz)).toBe(matriz);
  });

  it('acrescenta a classe a uma tabela que já tem class', () => {
    expect(marcarTabela(TABELA.replace('<table>', '<table class="x">')).html).toContain(
      '<table class="x tabela-lista" role="table">',
    );
  });

  it('ignora (sem alterar) tabela com colspan, sem thead ou com linha incompleta', () => {
    const colspan = TABELA.replace('<td>c</td>', '<td colspan="2">c</td>');
    expect(marcarTabela(colspan)).toMatchObject({ status: 'ignorada', html: colspan });
    const semHead = '<table><tbody><tr><td>a</td></tr></tbody></table>';
    expect(marcarTabela(semHead)).toMatchObject({ status: 'ignorada', html: semHead });
    const curta = TABELA.replace('<td>c</td>', '');
    expect(marcarTabela(curta)).toMatchObject({ status: 'ignorada', html: curta });
  });

  it('não gera data-label para cabeçalho vazio (canto da matriz)', () => {
    const t = TABELA.replace('>Comando</th>', '></th>');
    const { html } = marcarTabela(t);
    expect(html).toContain('<th scope="row" role="rowheader"><code>php -v</code></th>');
  });

  it('aceita células td na primeira coluna (sem rowheader)', () => {
    const t = TABELA.replace(/<th scope="row">([^<]*)<\/th>/, '<td>$1</td>');
    const { html, status } = marcarTabela(t);
    expect(status).toBe('marcada');
    expect(html).toContain('<td role="cell" data-label="Comando">b</td>');
  });
});

describe('marcarTabelasEmHtml', () => {
  it('conta marcadas, já marcadas, matrizes e ignoradas, e mexe só nas tabelas', () => {
    const matriz = marcarMatriz(TABELA);
    const primeira = marcarTabelasEmHtml(`<p>x {{ y }}</p>${TABELA}<p>z</p>`);
    expect(primeira).toMatchObject({ marcadas: 1, jaMarcadas: 0 });
    expect(primeira.html.startsWith('<p>x {{ y }}</p><table class=')).toBe(true);
    expect(primeira.html.endsWith('</table><p>z</p>')).toBe(true);

    const segunda = marcarTabelasEmHtml(
      `${primeira.html}${matriz}${TABELA.replace('<td>c</td>', '')}`,
    );
    expect(segunda).toMatchObject({ marcadas: 0, jaMarcadas: 1, matrizes: 1 });
    expect(segunda.ignoradas).toHaveLength(1);
  });
});

describe('script tabelas-lista-posts', () => {
  it('altera só as tabelas, é idempotente e respeita --dry-run e o filtro de arquivos', () => {
    // Roda o script real sobre uma cópia, apontando POSTS_DIR para a cópia do script.
    const dir = mkdtempSync(join(tmpdir(), 'tabelas-'));
    try {
      const raiz = join(dir, 'site');
      const posts = join(raiz, 'src/app/pages/article-detail/posts');
      const scripts = join(raiz, 'scripts');
      const lib = join(scripts, 'lib');
      for (const d of [posts, lib]) {
        spawnSync(process.execPath, [
          '-e',
          `require('fs').mkdirSync(${JSON.stringify(d)},{recursive:true})`,
        ]);
      }
      copyFileSync(
        join(SITE, 'scripts/tabelas-lista-posts.mjs'),
        join(scripts, 'tabelas-lista-posts.mjs'),
      );
      copyFileSync(join(SITE, 'scripts/lib/tabela-lista.mjs'), join(lib, 'tabela-lista.mjs'));
      writeFileSync(join(scripts, 'package.json'), '{"type":"module"}');
      const original = `export class A {}\n// template: \`<div class="scroll-x">${TABELA}</div>\`\n`;
      writeFileSync(join(posts, 'a.ts'), original);
      writeFileSync(join(posts, 'b.ts'), original);
      const rodar = (...a: string[]) =>
        spawnSync(process.execPath, [join(scripts, 'tabelas-lista-posts.mjs'), ...a], {
          encoding: 'utf8',
        });

      const seco = rodar('--dry-run');
      expect(seco.stdout).toContain('2 tabela(s) em 2 arquivo(s)');
      expect(readFileSync(join(posts, 'a.ts'), 'utf8')).toBe(original);

      const so = rodar('a.ts');
      expect(so.stdout).toContain('1 tabela(s) em 1 arquivo(s)');
      expect(readFileSync(join(posts, 'b.ts'), 'utf8')).toBe(original);
      const depois = readFileSync(join(posts, 'a.ts'), 'utf8');
      expect(depois).toContain('class="tabela-lista"');

      const todos = rodar();
      expect(todos.stdout).toContain('1 tabela(s) em 1 arquivo(s)');
      expect(readdirSync(posts)).toEqual(['a.ts', 'b.ts']);
      expect(readFileSync(join(posts, 'a.ts'), 'utf8')).toBe(depois);
      expect(rodar().stdout).toContain('0 tabela(s) em 0 arquivo(s)');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('gerador (new-article.mjs)', () => {
  function gerar(corpoMd: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'tabela-gen-'));
    try {
      const md = join(dir, 'a.md');
      writeFileSync(
        md,
        `# Teste\n\n**Slug:** \`teste-tabela\`\n**Tags:** \`ARM\`\n**Reading time:** 5 min\n**Excerpt:** Resumo.\n\n---\n\n${corpoMd}\n`,
      );
      const r = spawnSync(
        process.execPath,
        ['scripts/new-article.mjs', '--from', md, '--dry-run', '--print'],
        { cwd: SITE, encoding: 'utf8' },
      );
      expect(r.status).toBe(0);
      return r.stdout;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  const md = '| Comando | O que faz |\n|---|---|\n| `php -v` | Versão |\n';

  it('emite tabela em modo lista por padrão, com legenda e foco no wrapper', () => {
    const out = gerar(`Tabela: Comandos\n${md}`);
    expect(out).toContain(
      '<div class="scroll-x" tabindex="0" role="group" aria-label="Comandos (rolável)">',
    );
    expect(out).toContain('<table class="tabela-lista" role="table">');
    expect(out).toContain(
      '<th scope="row" role="rowheader" data-label="Comando"><code>php -v</code></th>',
    );
    expect(out).toContain('<td role="cell" data-label="O que faz">Versão</td>');
  });

  it('"Tabela (matriz):" mantém a tabela como tabela (opt-out)', () => {
    const out = gerar(`Tabela (matriz): Valores\n${md}`);
    expect(out).toContain('<table class="tabela-matriz">');
    expect(out).toContain('<caption>Valores</caption>');
    expect(out).not.toContain('tabela-lista');
    expect(out).not.toContain('data-label');
  });

  it('tabela sem legenda também sai marcada', () => {
    const out = gerar(`## Seção\n\n${md}`);
    expect(out).toContain('class="tabela-lista"');
  });
});
