import { posicaoNaTrilha, resumoDaTrilha } from './trilha';
import type { CourseModule } from '../../data/course';

const modulos: readonly CourseModule[] = [
  {
    code: 'M0',
    name: 'Introdução',
    summary: '',
    lessons: [
      { code: 'M0.1', title: 'A', slug: 'a', status: 'published', blurb: '' },
      { code: 'M0.2', title: 'B', slug: 'b', status: 'published', blurb: '' },
    ],
  },
  {
    code: 'M1',
    name: 'Fundamentos',
    summary: '',
    lessons: [
      { code: 'M1.1', title: 'C', slug: 'c', status: 'published', blurb: '' },
      { code: 'M1.2', title: 'D', slug: 'd', status: 'planned', blurb: '' },
    ],
  },
];

describe('trilha', () => {
  it('numera a lição na ordem da trilha e informa o módulo', () => {
    const p = posicaoNaTrilha('c', modulos);
    expect(p?.numero).toBe(3);
    expect(p?.total).toBe(4);
    expect(p?.modulo.code).toBe('M1');
  });

  it('aponta a próxima lição, mesmo em outro módulo', () => {
    const p = posicaoNaTrilha('b', modulos);
    expect(p?.proxima?.slug).toBe('c');
    expect(p?.moduloProxima?.code).toBe('M1');
  });

  it('a próxima pode ainda estar planejada', () => {
    expect(posicaoNaTrilha('c', modulos)?.proxima?.status).toBe('planned');
  });

  it('é indefinida para artigo fora da trilha ou lição não publicada', () => {
    expect(posicaoNaTrilha('boas-vindas', modulos)).toBeUndefined();
    expect(posicaoNaTrilha('d', modulos)).toBeUndefined();
    expect(posicaoNaTrilha(undefined, modulos)).toBeUndefined();
  });

  it('resume publicadas e total', () => {
    const r = resumoDaTrilha(modulos);
    expect(r.publicadas).toBe(3);
    expect(r.total).toBe(4);
    expect(r.primeira?.slug).toBe('a');
  });
});
