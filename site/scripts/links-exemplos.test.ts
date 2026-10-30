import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = resolve(SITE_ROOT, 'src/app/pages/article-detail/posts');
const LINK = /(?:href|routerLink)="(\/(?:curso-arm\/)?exemplos\/[^"#?]*)"/g;

const links = readdirSync(POSTS_DIR)
  .filter((nome) => nome.endsWith('.ts') && !nome.endsWith('.spec.ts'))
  .flatMap((nome) =>
    [...readFileSync(resolve(POSTS_DIR, nome), 'utf8').matchAll(LINK)].map((m) => ({
      post: nome,
      caminho: m[1],
    })),
  );

describe('links para exemplos nos artigos', () => {
  it('encontra links para conferir', () => {
    expect(links.length).toBeGreaterThan(0);
  });

  // Em produção o site é estático: pasta sem index.html responde 404.
  it('nenhum aponta para uma pasta', () => {
    expect(links.filter((l) => l.caminho.endsWith('/'))).toEqual([]);
  });

  it('todo arquivo citado existe em public/', () => {
    const faltando = links.filter(
      (l) => !l.caminho.endsWith('/') && !existsSync(resolve(SITE_ROOT, 'public', `.${l.caminho}`)),
    );
    expect(faltando).toEqual([]);
  });
});
