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
