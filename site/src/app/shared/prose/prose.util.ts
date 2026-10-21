/** Funções puras do enriquecimento do texto dos artigos (testáveis sem DOM). */

const LINGUAGENS: Readonly<Record<string, string>> = {
  armasm: 'ARM asm',
  asm: 'Assembly',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  c: 'C',
  cpp: 'C++',
  java: 'Java',
  json: 'JSON',
  typescript: 'TypeScript',
  ts: 'TypeScript',
  javascript: 'JavaScript',
  js: 'JavaScript',
  xml: 'XML',
  html: 'HTML',
  css: 'CSS',
  text: 'Texto',
  plaintext: 'Texto',
  ld: 'Linker script',
  makefile: 'Makefile',
  yaml: 'YAML',
  diff: 'Diff',
};

/** Rótulo legível da linguagem a partir da classe `language-xxx` do Prism. */
export function rotuloLinguagem(classes: string): string {
  const m = /(?:^|\s)language-([\w+-]+)/.exec(classes);
  if (!m) return 'Código';
  const id = m[1].toLowerCase();
  return LINGUAGENS[id] ?? id.toUpperCase();
}

/** Id de âncora estável: minúsculas, sem acento, hifenizado. */
export function slugificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/** Garante unicidade acrescentando -2, -3… quando o id já foi usado. */
export function idUnico(base: string, usados: Set<string>): string {
  const raiz = base || 'secao';
  let id = raiz;
  for (let n = 2; usados.has(id); n++) id = `${raiz}-${n}`;
  usados.add(id);
  return id;
}

/** Remove marcação markdown literal (`*ênfase*`, `_ênfase_`, crases) de um texto corrido. */
export function textoPuro(s: string): string {
  return s
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[\s(])[*_]([^*_\n]+?)[*_](?=$|[\s).,;:!?])/g, '$1$2')
    .replace(/\*/g, '');
}
