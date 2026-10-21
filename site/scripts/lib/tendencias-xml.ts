// Leitor mínimo e tolerante de RSS 2.0 e Atom, só o que a ferramenta de tendências precisa
// (título, link, data, resumo, categorias). Não é um parser XML geral: entradas que não
// seguem o formato esperado são ignoradas em vez de derrubar a coleta.

export interface EntradaFeed {
  titulo: string;
  url: string;
  /** ISO 8601 ou null. */
  data: string | null;
  resumo: string;
  categorias: string[];
}

const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (inteiro, nome: string) => {
    if (nome.startsWith('#')) {
      const codigo =
        nome[1] === 'x' || nome[1] === 'X'
          ? parseInt(nome.slice(2), 16)
          : parseInt(nome.slice(1), 10);
      try {
        return String.fromCodePoint(codigo);
      } catch {
        return inteiro;
      }
    }
    return ENTIDADES[nome] ?? inteiro;
  });
}

/** Remove CDATA, decodifica entidades e tira tags HTML de um trecho de texto de feed. */
function limparTexto(bruto: string): string {
  const semCdata = bruto.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m, c: string) => c);
  const ehCdata = semCdata !== bruto;
  let texto = ehCdata ? semCdata : decodificarEntidades(bruto);
  // O resumo costuma ser HTML (escapado ou em CDATA): tira as tags e decodifica de novo.
  texto = texto.replace(/<[^>]+>/g, ' ');
  texto = decodificarEntidades(texto);
  return texto.replace(/\s+/g, ' ').trim();
}

function primeiroElemento(bloco: string, nome: string): string | null {
  const re = new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, 'i');
  const m = re.exec(bloco);
  return m ? (m[1] ?? null) : null;
}

function atributo(tag: string, nome: string): string | null {
  const m = new RegExp(`\\b${nome}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return m ? decodificarEntidades(m[2] ?? m[3] ?? '') : null;
}

function paraIso(texto: string | null): string | null {
  if (!texto) return null;
  const t = Date.parse(limparTexto(texto));
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function linkDoBloco(bloco: string): string | null {
  // Atom: <link rel="alternate" href="..."/> (ou sem rel).
  const tags = bloco.match(/<link\b[^>]*\/?>/gi) ?? [];
  for (const tag of tags) {
    const href = atributo(tag, 'href');
    const rel = atributo(tag, 'rel');
    if (href && (!rel || rel === 'alternate')) return href;
  }
  // RSS: <link>texto</link>.
  const texto = primeiroElemento(bloco, 'link');
  if (texto) {
    const url = limparTexto(texto);
    if (url) return url;
  }
  return null;
}

export function lerFeed(xml: string): EntradaFeed[] {
  const blocos = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  const entradas: EntradaFeed[] = [];
  for (const bloco of blocos) {
    const tituloBruto = primeiroElemento(bloco, 'title');
    const url = linkDoBloco(bloco);
    if (!tituloBruto || !url) continue;
    const titulo = limparTexto(tituloBruto);
    if (!titulo) continue;
    const dataBruta =
      primeiroElemento(bloco, 'pubDate') ??
      primeiroElemento(bloco, 'published') ??
      primeiroElemento(bloco, 'updated') ??
      primeiroElemento(bloco, 'dc:date');
    const resumoBruto =
      primeiroElemento(bloco, 'description') ??
      primeiroElemento(bloco, 'summary') ??
      primeiroElemento(bloco, 'content:encoded') ??
      '';
    const categorias: string[] = [];
    for (const m of bloco.matchAll(
      /<category\b([^>]*)>([\s\S]*?)<\/category>|<category\b([^>]*?)\/>/gi,
    )) {
      const valor = atributo(m[1] ?? m[3] ?? '', 'term') ?? limparTexto(m[2] ?? '');
      if (valor) categorias.push(valor);
    }
    entradas.push({
      titulo,
      url,
      data: paraIso(dataBruta),
      resumo: limparTexto(resumoBruto).slice(0, 500),
      categorias,
    });
  }
  return entradas;
}
