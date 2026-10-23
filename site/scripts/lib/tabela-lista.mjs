// Marcação das tabelas dos artigos para a apresentação "lista de definição" em telas
// estreitas (CSS em src/styles.css, bloco "Tabelas como lista").
//
// A estrutura continua sendo uma <table>. Como `display: block` nos elementos de tabela faz
// Chrome e Safari descartarem a semântica de tabela, cada elemento recebe o papel ARIA
// explícito (técnica de Adrian Roselli), e cada célula recebe `data-label` com o texto do
// cabeçalho da coluna, que o CSS exibe com `::before`.
//
// Funções puras, usadas pelo gerador (new-article.mjs) e pelo script de migração
// (tabelas-lista-posts.mjs).

export const CLASSE_LISTA = 'tabela-lista';
export const CLASSE_MATRIZ = 'tabela-matriz';

const TABELA = /<table(?:\s[^>]*)?>[\s\S]*?<\/table>/g;
const CELULA = /<(th|td)((?:\s[^>]*)?)>([\s\S]*?)<\/\1>/g;
const LINHA = /<tr((?:\s[^>]*)?)>([\s\S]*?)<\/tr>/g;

/** Texto do cabeçalho como valor de atributo: sem tags, sem chaves (Angular), aspas em entidade. */
export function rotuloDeCabecalho(htmlCelula) {
  return htmlCelula
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/"/g, '&quot;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

function temClasse(attrs, nome) {
  const m = /\sclass="([^"]*)"/.exec(attrs);
  return !!m && m[1].split(/\s+/).includes(nome);
}

function addClasse(attrs, nome) {
  if (/\sclass="/.test(attrs)) return attrs.replace(/\sclass="([^"]*)"/, ` class="$1 ${nome}"`);
  return ` class="${nome}"${attrs}`;
}

function comAtributos(attrs, extras) {
  let out = attrs;
  for (const [k, v] of extras) {
    if (v == null) continue;
    if (new RegExp(`\\s${k}=`).test(out)) continue; // não sobrescreve o que o autor pôs
    out += ` ${k}="${v}"`;
  }
  return out;
}

/**
 * Marca uma tabela. `tabela` é o HTML de um único `<table …>…</table>`.
 * Devolve `{ html, status }`; status: 'marcada', 'ja-marcada', 'matriz' (opt-out) ou
 * 'ignorada' (estrutura sem cabeçalho simples; `motivo` explica).
 */
export function marcarTabela(tabela) {
  const m = /^<table((?:\s[^>]*)?)>([\s\S]*)<\/table>$/.exec(tabela.trim());
  if (!m) return { html: tabela, status: 'ignorada', motivo: 'não é uma <table>' };
  const [, attrs, miolo] = m;
  if (temClasse(attrs, CLASSE_MATRIZ)) return { html: tabela, status: 'matriz' };
  if (temClasse(attrs, CLASSE_LISTA)) return { html: tabela, status: 'ja-marcada' };
  if (/\s(?:colspan|rowspan)=/.test(miolo)) {
    return { html: tabela, status: 'ignorada', motivo: 'colspan/rowspan' };
  }

  const thead = /<thead((?:\s[^>]*)?)>([\s\S]*?)<\/thead>/.exec(miolo);
  const tbody = /<tbody((?:\s[^>]*)?)>([\s\S]*?)<\/tbody>/.exec(miolo);
  if (!thead || !tbody) return { html: tabela, status: 'ignorada', motivo: 'sem thead/tbody' };

  const linhasCab = [...thead[2].matchAll(LINHA)];
  if (linhasCab.length !== 1) {
    return { html: tabela, status: 'ignorada', motivo: 'cabeçalho com mais de uma linha' };
  }
  const rotulos = [...linhasCab[0][2].matchAll(CELULA)].map((c) => rotuloDeCabecalho(c[3]));
  if (!rotulos.length) return { html: tabela, status: 'ignorada', motivo: 'cabeçalho vazio' };

  let incoerente = false;
  const novoThead = thead[2].replace(
    LINHA,
    (_, a, conteudo) =>
      `<tr${comAtributos(a, [['role', 'row']])}>` +
      conteudo.replace(
        CELULA,
        (__, tag, ca, c) => `<${tag}${comAtributos(ca, [['role', 'columnheader']])}>${c}</${tag}>`,
      ) +
      '</tr>',
  );
  const novoTbody = tbody[2].replace(LINHA, (_, a, conteudo) => {
    let i = 0;
    const celulas = conteudo.replace(CELULA, (original, tag, ca, c) => {
      const rotulo = rotulos[i++];
      if (rotulo === undefined) return original;
      return `<${tag}${comAtributos(ca, [
        ['role', tag === 'th' ? 'rowheader' : 'cell'],
        ['data-label', rotulo || null],
      ])}>${c}</${tag}>`;
    });
    if (i !== rotulos.length) incoerente = true;
    return `<tr${comAtributos(a, [['role', 'row']])}>${celulas}</tr>`;
  });
  if (incoerente) {
    return {
      html: tabela,
      status: 'ignorada',
      motivo: 'linhas com número de células diferente do cabeçalho',
    };
  }

  const novoMiolo = miolo
    .replace(
      thead[0],
      () => `<thead${comAtributos(thead[1], [['role', 'rowgroup']])}>${novoThead}</thead>`,
    )
    .replace(
      tbody[0],
      () => `<tbody${comAtributos(tbody[1], [['role', 'rowgroup']])}>${novoTbody}</tbody>`,
    );
  const novaAttrs = comAtributos(addClasse(attrs, CLASSE_LISTA), [['role', 'table']]);
  return { html: `<table${novaAttrs}>${novoMiolo}</table>`, status: 'marcada' };
}

/** Opt-out explícito: a tabela continua tabela (com rolagem) em qualquer largura. */
export function marcarMatriz(tabela) {
  return tabela.replace(/^<table((?:\s[^>]*)?)>/, (_, a) =>
    temClasse(a, CLASSE_MATRIZ) ? `<table${a}>` : `<table${addClasse(a, CLASSE_MATRIZ)}>`,
  );
}

/** Marca todas as tabelas de um trecho de HTML. */
export function marcarTabelasEmHtml(html) {
  const contagem = { marcadas: 0, jaMarcadas: 0, matrizes: 0, ignoradas: [] };
  const saida = html.replace(TABELA, (tabela) => {
    const r = marcarTabela(tabela);
    if (r.status === 'marcada') contagem.marcadas++;
    else if (r.status === 'ja-marcada') contagem.jaMarcadas++;
    else if (r.status === 'matriz') contagem.matrizes++;
    else contagem.ignoradas.push(r.motivo);
    return r.html;
  });
  return { html: saida, ...contagem };
}
