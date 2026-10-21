// Testes de ponta a ponta do CLI (processo real do Node, sem rede).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('./ga-metricas.ts', import.meta.url));

function rodar(args: string[], env: Record<string, string> = {}) {
  const r = spawnSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', SCRIPT, ...args],
    {
      encoding: 'utf8',
      env: { ...process.env, ...env },
    },
  );
  return { codigo: r.status, saida: r.stdout, erro: r.stderr };
}

describe('ga-metricas (CLI)', () => {
  it('--exemplo --json gera JSON v2 a partir da fixture', () => {
    const r = rodar(['--exemplo', '--json', '--limite', '3']);
    expect(r.codigo).toBe(0);
    const json = JSON.parse(r.saida) as {
      versaoEsquema: number;
      fonte: string;
      artigos: unknown[];
    };
    expect(json.versaoEsquema).toBe(2);
    expect(json.fonte).toBe('exemplo');
    expect(json.artigos).toHaveLength(3);
  });

  it('--exemplo gera Markdown', () => {
    const r = rodar(['--exemplo', '--sem-comparacao']);
    expect(r.codigo).toBe(0);
    expect(r.saida).toMatch(/^# Métricas do vitorsilverio\.dev \(GA4\)/);
  });

  it('argumento inválido sai com código 2 e mostra o uso', () => {
    const r = rodar(['--dias', 'zero']);
    expect(r.codigo).toBe(2);
    expect(r.erro).toContain('Uso: npm run metricas');
  });

  it('configuração inválida sai com código 1, explica o que configurar e não imprime o token', () => {
    const r = rodar([], {
      GA4_PROPERTY_ID: 'G-EG8H3V1H6C',
      GA4_ACCESS_TOKEN: 'token-secreto-de-teste',
    });
    expect(r.codigo).toBe(1);
    expect(r.saida).toBe('');
    expect(r.erro).toContain('GA4_PROPERTY_ID parece ser o ID de métricas');
    expect(r.erro + r.saida).not.toContain('token-secreto-de-teste');
  });

  it('--exemplo com --host sai com código 2 e explica', () => {
    const r = rodar(['--exemplo', '--host', 'outro.dev']);
    expect(r.codigo).toBe(2);
    expect(r.erro).toContain('--exemplo usa dados fixos');
  });
});
