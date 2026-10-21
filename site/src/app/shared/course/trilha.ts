import { courseModules, type CourseLesson, type CourseModule } from '../../data/course';

export interface PosicaoNaTrilha {
  /** Número da lição na trilha, a partir de 1. */
  readonly numero: number;
  readonly total: number;
  readonly modulo: CourseModule;
  readonly licao: CourseLesson;
  /** Próxima lição da trilha (publicada ou ainda planejada), se houver. */
  readonly proxima?: CourseLesson;
  readonly moduloProxima?: CourseModule;
}

/**
 * Onde um artigo está na trilha "Arquitetura ARM na prática". `undefined` para
 * artigos que não fazem parte da trilha (ex.: Angular, boas-vindas).
 */
export function posicaoNaTrilha(
  slug: string | undefined,
  modulos: readonly CourseModule[] = courseModules,
): PosicaoNaTrilha | undefined {
  if (!slug) return undefined;
  const plana = modulos.flatMap((modulo) => modulo.lessons.map((licao) => ({ modulo, licao })));
  const i = plana.findIndex((p) => p.licao.slug === slug && p.licao.status === 'published');
  if (i < 0) return undefined;
  const prox = plana[i + 1];
  return {
    numero: i + 1,
    total: plana.length,
    modulo: plana[i].modulo,
    licao: plana[i].licao,
    proxima: prox?.licao,
    moduloProxima: prox?.modulo,
  };
}

/** Resumo da trilha para a home e para a página do curso. */
export function resumoDaTrilha(modulos: readonly CourseModule[] = courseModules): {
  publicadas: number;
  total: number;
  primeira?: CourseLesson;
  ultima?: CourseLesson;
} {
  const todas = modulos.flatMap((m) => m.lessons);
  const publicadas = todas.filter((l) => l.status === 'published');
  return {
    publicadas: publicadas.length,
    total: todas.length,
    primeira: publicadas[0],
    ultima: publicadas[publicadas.length - 1],
  };
}
