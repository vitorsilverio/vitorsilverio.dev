// Regressão: a legenda de tabela pertence à tabela imediatamente seguinte, não à próxima da fila.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(import.meta.dirname, 'new-article.mjs');

function gerar(corpo: string) {
  const dir = mkdtempSync(join(tmpdir(), 'legendas-'));
  try {
    const md = join(dir, 'teste-legendas-tabelas.md');
    writeFileSync(
      md,
      `# Teste\n\n**Slug:** \`teste-legendas-tabelas\`\n**Tags:** \`Teste\`\n\n---\n\n${corpo}\n`,
    );
    const r = spawnSync(process.execPath, [script, '--from', md, '--dry-run', '--print'], {
      encoding: 'utf8',
    });
    return { saida: r.stdout, erro: r.stderr, status: r.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const tabela = (c: string) => `| ${c} | x |\n|---|---|\n| a | b |`;

/** Blocos <div class="scroll-x"> na ordem em que aparecem. */
const blocos = (html: string) => html.split('<div class="scroll-x"').slice(1);

describe('legendas de tabela no gerador de artigos', () => {
  it('tabela sem legenda não rouba a legenda da seguinte', () => {
    const { saida, status } = gerar(
      [
        tabela('Sem legenda'),
        `Tabela (matriz): A\n${tabela('Com A')}`,
        `Tabela (matriz): B\n${tabela('Com B')}`,
      ].join('\n\nTexto entre tabelas.\n\n'),
    );
    expect(status).toBe(0);
    const [t1, t2, t3] = blocos(saida);
    expect(t1).not.toContain('<caption>');
    expect(t1).not.toContain('tabela-matriz');
    expect(t2).toContain('<caption>A</caption>');
    expect(t2).toContain('tabela-matriz');
    expect(t3).toContain('<caption>B</caption>');
    expect(t3).toContain('tabela-matriz');
  });

  it('legendas em ordem normal continuam funcionando', () => {
    const { saida } = gerar(`Tabela: Primeira\n${tabela('P')}\n\nTabela: Segunda\n${tabela('S')}`);
    const [t1, t2] = blocos(saida);
    expect(t1).toContain('<caption>Primeira</caption>');
    expect(t2).toContain('<caption>Segunda</caption>');
  });

  it('legenda sem tabela logo a seguir gera aviso e não vaza para a próxima', () => {
    const { saida, erro } = gerar(
      `Tabela: Órfã\n| só uma linha sem separador |\n\n${tabela('Depois')}`,
    );
    expect(erro).toContain('sem tabela logo a seguir');
    expect(erro).toContain('Órfã');
    for (const b of blocos(saida)) expect(b).not.toContain('<caption>Órfã');
  });
});
