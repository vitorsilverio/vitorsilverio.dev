// Bloco ```grafico do rascunho -> <app-grafico …/>.
// O gerador valida e normaliza os dados; o componente (`src/app/shared/grafico/`) desenha o SVG
// no pré-render e carrega o ECharts só quando o leitor chega ao gráfico.
//
// Formato: a linha de abertura traz o tipo e, depois, o título (opcional). Antes da linha `---`
// ficam os metadados (`chave: valor`); depois dela, a tabela de dados, uma linha por categoria.
//
//   ```grafico barras-empilhadas Tempo por etapa
//   resumo: A etapa de ligação domina o tempo total em todas as versões.
//   unidade: ms
//   eixo-x: Versão
//   eixo-y: Tempo
//   fonte: Medição própria em container Docker
//   ---
//   Versão | Compilação | Ligação
//   1.0 | 120 | 340
//   1.1 | 110 | 280
//   ```
//
// Tipos: `barras`, `barras-empilhadas`, `linhas`. A primeira linha da tabela nomeia a coluna das
// categorias e as séries (até 6). Números aceitam ponto ou vírgula decimal, sem separador de
// milhar; célula vazia, `-` ou `—` é "sem dado". `resumo` é obrigatório: é o que o leitor de tela
// e quem está sem JavaScript leem em vez da figura.

export const TIPOS = ['barras', 'barras-empilhadas', 'linhas'];
export const MAX_SERIES = 6;
const CHAVES = ['resumo', 'unidade', 'eixo-x', 'eixo-y', 'fonte'];

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Converte uma célula em número (`null` = sem dado).
 * @param {string} cel @returns {number | null | undefined} undefined = inválida
 */
export function parseNumero(cel) {
  const t = cel.trim();
  if (t === '' || t === '-' || t === '—') return null;
  if (!/^-?\d+(?:[.,]\d+)?$/.test(t)) return undefined;
  return Number(t.replace(',', '.'));
}

/**
 * Separa a linha de abertura em tipo e título.
 * @param {string} legenda @returns {{ tipo: string, titulo: string }}
 */
export function parseAbertura(legenda) {
  const [tipo = '', ...resto] = legenda.trim().split(/\s+/);
  return { tipo: tipo.toLowerCase(), titulo: resto.join(' ') };
}

/**
 * Interpreta o corpo do bloco.
 * @param {string} texto
 * @returns {{ meta: Record<string, string>, categorias: string[], series: { nome: string, valores: (number | null)[] }[], erros: string[] }}
 */
export function parseCorpo(texto) {
  const erros = [];
  const linhas = texto.replace(/\r\n/g, '\n').split('\n');
  const corte = linhas.findIndex((l) => l.trim() === '---');
  const metaLinhas = corte === -1 ? [] : linhas.slice(0, corte);
  const dadosLinhas = corte === -1 ? linhas : linhas.slice(corte + 1);
  if (corte === -1) erros.push('falta a linha `---` entre os metadados e a tabela de dados');

  const meta = {};
  for (const bruta of metaLinhas) {
    const l = bruta.trim();
    if (!l) continue;
    const m = /^([a-zà-ú-]+)\s*:\s*(.*)$/i.exec(l);
    if (!m || !CHAVES.includes(m[1].toLowerCase())) {
      erros.push(`metadado desconhecido ou malformado "${l}" (ignorado; use ${CHAVES.join(', ')})`);
      continue;
    }
    meta[m[1].toLowerCase()] = m[2].trim();
  }

  const tabela = dadosLinhas.map((l) => l.trim()).filter(Boolean);
  const categorias = [];
  const series = [];
  if (tabela.length === 0) return { meta, categorias, series, erros };

  const cab = tabela[0].split('|').map((c) => c.trim());
  if (cab.length < 2) {
    erros.push('cabeçalho da tabela sem séries (use "Categoria | Série 1 | Série 2")');
    return { meta, categorias, series, erros };
  }
  meta['_coluna'] = cab[0];
  for (const nome of cab.slice(1)) series.push({ nome, valores: [] });
  if (series.some((s) => !s.nome)) erros.push('há série sem nome no cabeçalho da tabela');
  if (series.length > MAX_SERIES) {
    erros.push(`${series.length} séries; o máximo é ${MAX_SERIES} (as demais foram descartadas)`);
    series.length = MAX_SERIES;
  }

  tabela.slice(1).forEach((linha, i) => {
    const n = i + 2;
    const cels = linha.split('|').map((c) => c.trim());
    if (cels.length !== cab.length) {
      erros.push(
        `linha ${n} da tabela tem ${cels.length} colunas (o cabeçalho tem ${cab.length}): ${linha} (ignorada)`,
      );
      return;
    }
    if (!cels[0]) {
      erros.push(`linha ${n} da tabela sem nome de categoria (ignorada)`);
      return;
    }
    const valores = [];
    for (let c = 0; c < series.length; c++) {
      const v = parseNumero(cels[c + 1]);
      if (v === undefined) {
        erros.push(`linha ${n} da tabela: "${cels[c + 1]}" não é número (linha ignorada)`);
        return;
      }
      valores.push(v);
    }
    if (categorias.includes(cels[0])) erros.push(`categoria repetida "${cels[0]}" (linha ${n})`);
    categorias.push(cels[0]);
    series.forEach((s, c) => s.valores.push(valores[c]));
  });
  return { meta, categorias, series, erros };
}

/**
 * Atributo do template. Duas chaves abrindo num valor estático (mesmo escapadas como entidade)
 * viram interpolação do Angular; nesse caso o valor vai como literal de texto num binding.
 * @param {string} nome @param {string} valor
 */
export function atributo(nome, valor) {
  if (!valor.includes('{{')) return `${nome}="${esc(valor)}"`;
  const literal = valor.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `[${nome}]="'${esc(literal)}'"`;
}

/** Resumo mínimo gerado dos dados, só para a figura não ficar sem texto quando o autor esquece. */
function resumoPadrao(tipo, categorias, series) {
  const kind = tipo === 'linhas' ? 'linhas' : 'barras';
  return `Gráfico de ${kind} com ${categorias.length} categorias e ${series.length} série(s): ${series.map((s) => s.nome).join(', ')}.`;
}

/**
 * @param {string} legenda resto da linha de abertura (tipo + título)
 * @param {string} texto corpo do bloco
 * @returns {{ html: string | null, erros: string[] }}
 */
export function tagGrafico(legenda, texto) {
  const { tipo, titulo } = parseAbertura(legenda);
  const nome = titulo || '(sem título)';
  const erros = [];
  if (!TIPOS.includes(tipo)) {
    return {
      html: null,
      erros: [
        `gráfico "${nome}": tipo "${tipo}" desconhecido (use ${TIPOS.join(', ')}); bloco ignorado`,
      ],
    };
  }
  const { meta, categorias, series, erros: errosCorpo } = parseCorpo(texto);
  erros.push(...errosCorpo.map((e) => `gráfico "${nome}": ${e}`));
  if (series.length === 0 || categorias.length === 0) {
    erros.push(`gráfico "${nome}": sem dados válidos (ignorado)`);
    return { html: null, erros };
  }
  if (categorias.length < 2 && tipo === 'linhas') {
    erros.push(`gráfico "${nome}": linha com uma só categoria não desenha linha`);
  }
  let resumo = meta['resumo'] ?? '';
  if (!resumo) {
    erros.push(
      `gráfico "${nome}": falta \`resumo:\` (obrigatório: é o texto de quem não vê a figura); usei um resumo genérico, escreva o seu`,
    );
    resumo = resumoPadrao(tipo, categorias, series);
  }
  if (!titulo) erros.push(`gráfico "${nome}": sem título na linha de abertura`);

  const dados = { categorias, series, colunaCategoria: meta['_coluna'] ?? '' };
  const attrs = [
    ['tipo', tipo],
    ['titulo', titulo],
    ['resumo', resumo],
    ['unidade', meta['unidade']],
    ['eixoX', meta['eixo-x']],
    ['eixoY', meta['eixo-y']],
    ['fonte', meta['fonte']],
    ['dados', JSON.stringify(dados)],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `  ${atributo(k, v)}`)
    .join('\n');
  return { html: `<app-grafico\n${attrs}\n/>\n`, erros };
}
