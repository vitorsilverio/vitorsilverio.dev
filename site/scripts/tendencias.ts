// Busca de tendências de tecnologia para a skill `pesquisa-temas-e-tendencias-tecnologicas`
// (agente `pesquisador-olheiro`). Consulta fontes públicas SEM chave de API, agrupa por tema
// e expõe sinais objetivos (fontes independentes, volume, recência, engajamento, presença em
// PT-BR) e quais temas o site já cobre. NÃO calcula nota de "tendência": quem ranqueia é o
// olheiro, pelos critérios da skill. A coleta é o ponto de partida; WebSearch/WebFetch seguem
// valendo para aprofundar.
//
// USO (em site/)
//   npm run -s tendencias                         texto legível, temas de scripts/tendencias.config.json
//   npm run -s tendencias -- --json               JSON estável (esquema abaixo), para outro agente
//   npm run -s tendencias -- --termo "Rust" --termo "WebAssembly"     soma termos aos padrões
//   npm run -s tendencias -- --sem-padrao --termo "Rust"              só os termos dados
//   npm run -s tendencias -- --tema java-jvm --fonte hn,tabnews --dias 14 --limite 5
//   (direto: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/tendencias.ts ...)
//
// OPÇÕES
//   --termo T         termo extra (repetível); cada um vira um tema próprio
//   --sem-padrao      ignora os temas da config e usa só --termo
//   --tema a,b        restringe aos temas da config com estes ids
//   --fonte a,b       fontes: hn, lobsters, github, devto, tabnews, gnoticias, blogs (padrão: todas)
//   --dias N          janela em dias (padrão 7; 1 a 90)
//   --limite N        itens por tema na saída (padrão 8; 0 = todos). Os sinais usam TODOS os itens
//   --timeout S       tempo máximo por fonte, em segundos (padrão 30)
//   --config ARQ      outro arquivo de configuração (padrão scripts/tendencias.config.json)
//   --json            JSON em vez de texto
//   -h, --help
//
// CONFIGURAÇÃO: scripts/tendencias.config.json (versionado, editável): temas, termos de busca,
// tags do Lobsters e do dev.to, feeds de blogs oficiais. Não há segredo nem variável de ambiente.
//
// FONTES (todas gratuitas e sem chave; consulta leve, poucas requisições, User-Agent identificado)
//   hn         Hacker News via Algolia: busca de histórias pelo TÍTULO, na janela. pontos, comentários.
//   lobsters   lobste.rs/t/<tag>.json (tags da config). pontos (score), comentários.
//   github     API de busca de repositórios CRIADOS na janela, por estrelas, só com o termo principal
//              de cada tema (cota sem token: 10 buscas/min; 403/429 vira aviso). Não é o
//              github.com/trending (HTML), que mostra repositórios antigos ganhando estrelas.
//   devto      API do dev.to por tag (config), top da janela. reações, comentários.
//   tabnews    API da TabNews: os 100 conteúdos mais relevantes, filtrados pelos termos no título
//              (a API não tem busca). Mede presença em PT-BR. pontos (tabcoins), comentários.
//   gnoticias  RSS do Google Notícias, pt-BR e en-US, por termo ("when:Nd"), 15 mais relevantes por busca. Sem métricas; o link é
//              um redirecionamento do Google. Uso pessoal e leve, como os termos do feed permitem.
//   blogs      Feeds RSS/Atom de blogs oficiais da config (Angular Blog, Inside Java).
//
// AVALIADAS E FORA: Reddit (403 sem OAuth), X.com (sem rota gratuita; use WebSearch com site:x.com),
// Blog da Arm (hosts sem resposta no teste), Stack Exchange (contagem de tags não indica tendência;
// perguntas novas são ruído para este uso), Wikipedia pageviews e npm downloads (séries por
// artigo/pacote, formato diferente de "item" e exigem mapa termo-artigo/pacote; ficam para uma
// segunda versão), Maven Central (sem estatística de downloads), GitHub Trending em HTML (sem API;
// o parse quebra com qualquer mudança de layout).
//
// SAÍDA: código 0 = coleta feita (mesmo com fontes falhando; veja "fontes" no relatório);
// 1 = configuração inválida ou TODAS as fontes falharam; 2 = argumentos inválidos.
// Relatório em stdout; erros em stderr.
//
// ESQUEMA JSON (versaoEsquema: 1). Datas ISO 8601.
//   versaoEsquema: 1
//   coletadoEm: string
//   janela: { dias, desde }
//   parametros: { termos: [{texto, temaId}], fontesSolicitadas: FonteId[], limitePorTema }
//   fontes: [{ id, nome, status: "ok" | "falhou", itens, motivo: string | null, avisos: string[] }]
//   fontesConsultadas: FonteId[]            as que responderam
//   fontesComFalha: [{ id, motivo }]
//   temas: [{
//     id, nome, termos: string[],
//     jaPublicado: boolean,                 true se algum artigo de articles.ts casa com um termo
//     artigosRelacionados: [{ slug, titulo, data, termo }],
//     sinais: {
//       totalItens, fontesIndependentes, fontes: FonteId[], itensPorFonte: { [fonte]: n },
//       recencia: { maisRecente, itensUltimas48h, idadeMedianaDias, itensSemData },
//       engajamento: { pontos, comentarios, estrelas, reacoes },   somas por tipo de métrica
//       ptBR: { itens, fontes: FonteId[], proporcao: 0..1 | null } },
//     itens: [{ titulo, url, fonte, data, idioma: "pt" | "en" | null,
//               metricas: { pontos?, comentarios?, estrelas?, forks?, reacoes? },
//               termo, temaId, discussao: string | null }],        por engajamento, até --limite
//     itensOmitidos: number }]
//   avisos: string[]
//   FonteId: "hn" | "lobsters" | "github" | "devto" | "tabnews" | "gnoticias" | "blogs"
//   Itens repetidos (mesma URL na mesma fonte; mesmo título no Google Notícias) são unidos.
//   "Já publicado" compara as palavras de cada termo com título, tags e slug dos artigos.

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { articles } from '../src/app/data/articles.ts';
import { coletar } from './lib/tendencias-coleta.ts';
import { lerConfig, montarTemas } from './lib/tendencias-config.ts';
import { lerOpcoes, type Opcoes } from './lib/tendencias-opcoes.ts';
import { formatarJson, formatarTexto } from './lib/tendencias-relatorio.ts';
import { ErroConfig, ErroUso } from './lib/tendencias-tipos.ts';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const CONFIG_PADRAO = resolve(SCRIPTS, 'tendencias.config.json');
const USER_AGENT =
  'vitorsilverio.dev-tendencias/1.0 (+https://vitorsilverio.dev; pesquisa editorial leve, poucas requisicoes)';

const AJUDA = `Uso: npm run -s tendencias -- [--termo T]... [--sem-padrao] [--tema a,b] [--fonte a,b]
       [--dias N] [--limite N] [--timeout S] [--config ARQ] [--json]

Busca tendências de tecnologia em fontes públicas sem chave (Hacker News, Lobsters, GitHub,
dev.to, TabNews, Google Notícias, blogs oficiais) e agrupa por tema. Detalhes, fontes e
esquema JSON no topo de scripts/tendencias.ts.`;

async function lerArquivoConfig(caminho: string): Promise<unknown> {
  let texto: string;
  try {
    texto = await readFile(caminho, 'utf8');
  } catch (e) {
    const code = (e as { code?: unknown }).code;
    throw new ErroConfig(
      code === 'ENOENT'
        ? `configuração não encontrada: ${caminho}`
        : `não foi possível ler a configuração (${caminho}): ${String(code ?? e)}`,
    );
  }
  try {
    return JSON.parse(texto.replace(/^﻿/, '')) as unknown;
  } catch {
    throw new ErroConfig(`a configuração não é JSON válido: ${caminho}`);
  }
}

async function main(): Promise<void> {
  let op: Opcoes;
  try {
    op = lerOpcoes(process.argv.slice(2));
  } catch (e) {
    if (e instanceof ErroUso) {
      console.error(`Erro: ${e.message}\n\n${AJUDA}`);
      process.exitCode = 2;
      return;
    }
    throw e;
  }
  if (op.ajuda) {
    console.log(AJUDA);
    return;
  }

  try {
    const config = lerConfig(
      await lerArquivoConfig(op.config ? resolve(process.cwd(), op.config) : CONFIG_PADRAO),
    );
    const temas = montarTemas(config, {
      temasIds: op.temas,
      termosExtras: op.termos,
      semPadrao: op.semPadrao,
    });
    const relatorio = await coletar({
      temas,
      blogs: config.blogs,
      fontes: op.fontes,
      dias: op.dias,
      limite: op.limite,
      agora: new Date(),
      fetch,
      userAgent: USER_AGENT,
      timeoutFonteMs: op.timeoutSeg * 1000,
      timeoutReqMs: Math.min(op.timeoutSeg * 1000, 15_000),
      artigos: articles,
    });
    process.stdout.write(
      op.formato === 'json' ? formatarJson(relatorio) : formatarTexto(relatorio),
    );
    if (relatorio.fontesConsultadas.length === 0) {
      console.error('Erro: todas as fontes falharam (veja "fontes" no relatório).');
      process.exitCode = 1;
    }
  } catch (e) {
    console.error(
      `Erro: ${e instanceof ErroConfig ? e.message : `inesperado: ${e instanceof Error ? e.message : String(e)}`}`,
    );
    process.exitCode = 1;
  }
}

await main();
