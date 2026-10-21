// Testes de ponta a ponta do CLI (processo real do Node, sem rede).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('./tendencias.ts', import.meta.url));

function rodar(args: string[]) {
  const r = spawnSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', SCRIPT, ...args],
    { encoding: 'utf8' },
  );
  return { codigo: r.status, saida: r.stdout, erro: r.stderr };
}

describe('tendencias (CLI)', () => {
  it('--help mostra o uso e sai com 0', () => {
    const r = rodar(['--help']);
    expect(r.codigo).toBe(0);
    expect(r.saida).toContain('Uso: npm run -s tendencias');
  });

  it('argumento inválido sai com 2 e mostra o uso em stderr', () => {
    const r = rodar(['--fonte', 'reddit']);
    expect(r.codigo).toBe(2);
    expect(r.erro).toContain('fonte desconhecida: reddit');
    expect(r.erro).toContain('Uso:');
    expect(r.saida).toBe('');
  });

  it('configuração inexistente sai com 1 e mensagem útil', () => {
    const r = rodar(['--config', 'nao-existe.json']);
    expect(r.codigo).toBe(1);
    expect(r.erro).toContain('configuração não encontrada');
  });

  it('tema desconhecido sai com 1', () => {
    const r = rodar(['--tema', 'xyz']);
    expect(r.codigo).toBe(1);
    expect(r.erro).toContain('tema(s) desconhecido(s): xyz');
  });
});
