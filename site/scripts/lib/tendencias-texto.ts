// Normalização e casamento de termos, puros.

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Palavras (letras e dígitos) de um texto, normalizadas. "C++" vira ["c"]; "RISC-V" vira ["risc","v"]. */
export function palavras(texto: string): string[] {
  return normalizar(texto).match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Verdadeiro se TODAS as palavras do termo aparecem como palavras inteiras no texto. */
export function casaTermo(texto: string, termo: string): boolean {
  const alvo = palavras(termo);
  if (alvo.length === 0) return false;
  const presentes = new Set(palavras(texto));
  return alvo.every((p) => presentes.has(p));
}

export function urlCanonica(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.hostname = u.hostname.replace(/^www\./, '');
    const caminho = u.pathname.replace(/\/+$/, '');
    for (const p of [...u.searchParams.keys()]) {
      if (p.startsWith('utm_')) u.searchParams.delete(p);
    }
    return `${u.hostname}${caminho}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
