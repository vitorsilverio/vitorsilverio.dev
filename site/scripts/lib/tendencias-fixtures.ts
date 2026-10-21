import { readFileSync } from 'node:fs';

/** Lê uma fixture de scripts/fixtures/tendencias/ (usada só pelos testes). */
export function fixture(nome: string): string {
  return readFileSync(new URL(`../fixtures/tendencias/${nome}`, import.meta.url), 'utf8');
}
