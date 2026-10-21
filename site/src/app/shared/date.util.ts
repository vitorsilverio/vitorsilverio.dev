export function formatPtDate(
  iso: string,
  month: 'short' | 'long' = 'long',
): string {
  const [year, monthNum, day] = iso.split('-').map(Number);
  // Constrói em horário local para não sofrer o deslocamento de fuso do
  // `new Date('YYYY-MM-DD')`, que é interpretado como UTC e volta um dia
  // no cliente (ex.: GMT-3).
  const date = new Date(year, monthNum - 1, day);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month,
    year: 'numeric',
  }).format(date);
}

/**
 * Hora padrão de publicação usada nos dados estruturados (`datePublished`/`dateModified`) e no
 * RSS: 08:00 em Brasília (UTC-03:00; o Brasil não tem horário de verão desde 2019). O site só
 * guarda a data (`YYYY-MM-DD`); a hora é uma convenção, igual em `scripts/lib/articles-data.mjs`.
 */
export const HORA_PADRAO = '08:00:00-03:00';

/** `2026-10-21` -> `2026-10-21T08:00:00-03:00`. */
export function isoComHora(date: string): string {
  return `${date}T${HORA_PADRAO}`;
}
