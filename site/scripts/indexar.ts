// Avisa os buscadores de uma página nova do vitorsilverio.dev, DEPOIS do deploy.
//
// O que faz, nesta ordem (para cada slug/URL informado):
//   1. Resolve o slug para https://vitorsilverio.dev/artigos/<slug>/ (confere em articles.ts) e faz
//      GET em produção. Se alguma URL não responder 200 (artigo ainda não deployado), PARA sem enviar nada.
//   2. Reenvia o sitemap (https://vitorsilverio.dev/sitemap.xml) ao Search Console (sitemaps.submit).
//   3. IndexNow (Bing, Yandex e outros; o Google NÃO participa): POST em api.indexnow.org.
//   4. Consulta a Inspeção de URL (urlInspection.index.inspect) e imprime o status de cada URL.
//   5. Imprime o link para a Inspeção de URL: o botão "Solicitar indexação" NÃO tem API e é manual.
// Não usa a Indexing API do Google: ela só vale para páginas JobPosting/BroadcastEvent.
//
// USO (em site/)
//   npm run indexar -- emudhra-chaves-de-ca-um-byte          slug (ou a URL completa)
//   npm run indexar -- slug-a slug-b                         vários de uma vez
//   npm run indexar -- <slug> --dry-run                      só o GET de verificação; mostra o plano
//   npm run indexar -- <slug> --so-status                    só o passo 4 (e o link do passo 5)
//   npm run indexar -- --gerar-chave-indexnow [--dry-run]    cria site/public/<chave>.txt
//   (direto: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/indexar.ts ...)
//
// CONFIGURAÇÃO (site/.env, modelo em site/.env.example; o ambiente tem precedência)
//   GOOGLE_APPLICATION_CREDENTIALS  caminho da chave JSON da conta de serviço, FORA do repositório
//   GSC_SITE_URL                    propriedade do Search Console ("sc-domain:vitorsilverio.dev")
//   Permissão no Search Console: o envio de sitemap exige "Completa" para a conta de serviço
//   (Configurações > Usuários e permissões); a consulta de status funciona com "Restrita".
//   Escopos pedidos: webmasters (envio completo) ou webmasters.readonly (--so-status).
//
// INDEXNOW: exige o arquivo site/public/<chave>.txt (conteúdo = a própria chave; é público por
//   design) servido em https://vitorsilverio.dev/<chave>.txt. `--gerar-chave-indexnow` cria o
//   arquivo; commit e deploy ficam com você. Sem o arquivo local, ou antes de ele estar no ar, o
//   passo 3 é pulado com aviso (o IndexNow responderia 403).
//   Protocolo: https://www.indexnow.org/documentation
//
// SAÍDA: 0 = ok; 1 = configuração, rede, API ou URL fora do ar; 2 = argumentos inválidos.
// Segredos nunca são impressos.

import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { articles } from '../src/app/data/articles.ts';
import {
  ErroApi,
  ErroConfig,
  dentroDe,
  lerContaServico,
  mesclarEnv,
  obterToken,
} from './lib/ga4-acesso.ts';
import { VAR_GSC, lerSiteGsc } from './lib/gsc.ts';
import {
  ESCOPO_ESCRITA,
  ESCOPO_LEITURA,
  ErroUso,
  ORIGEM,
  URL_SITEMAP,
  acharChave,
  enviarIndexNow,
  enviarSitemap,
  formatarStatus,
  gerarChaveIndexNow,
  inspecionar,
  lerOpcoes,
  linkInspecao,
  montarIndexNow,
  resolverUrl,
  statusProducao,
  type Opcoes,
  type StatusIndexacao,
} from './lib/indexar.ts';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(AQUI, '..');
const RAIZ_REPO = resolve(SITE, '..');
const CAMINHO_ENV = resolve(SITE, '.env');
const PUBLIC = resolve(SITE, 'public');

const AJUDA = `Uso: npm run indexar -- <slug-ou-url> [...] [--dry-run] [--so-status]
     npm run indexar -- --gerar-chave-indexnow [--dry-run]
Detalhes e configuração no topo de scripts/indexar.ts.`;

async function chaveLocal(): Promise<string | null> {
  const nomes = (await readdir(PUBLIC)).filter((n) => /^[A-Za-z0-9-]{8,128}\.txt$/.test(n));
  const arquivos = await Promise.all(
    nomes.map(async (nome) => ({ nome, conteudo: await readFile(resolve(PUBLIC, nome), 'utf8') })),
  );
  return acharChave(arquivos);
}

async function gerarChave(dryRun: boolean): Promise<void> {
  const existente = await chaveLocal();
  if (existente) {
    console.log(`Já existe a chave IndexNow: site/public/${existente}.txt (nada a fazer).`);
    return;
  }
  const chave = gerarChaveIndexNow();
  const destino = resolve(PUBLIC, `${chave}.txt`);
  if (dryRun) {
    console.log(`[dry-run] criaria site/public/${chave}.txt com a própria chave como conteúdo.`);
    return;
  }
  await writeFile(destino, `${chave}\n`, 'utf8');
  console.log(`Criado site/public/${chave}.txt.`);
  console.log(`Falta: commit e deploy, para que ${ORIGEM}/${chave}.txt responda 200.`);
}

async function lerCredencial(
  env: Record<string, string>,
  escopo: string,
): Promise<{ site: string; token: string }> {
  const site = lerSiteGsc(env);
  if (site === null) {
    throw new ErroConfig(
      `${VAR_GSC} não definido em site/.env (ex.: sc-domain:vitorsilverio.dev).`,
    );
  }
  const cred = env['GOOGLE_APPLICATION_CREDENTIALS']?.trim();
  if (!cred) {
    throw new ErroConfig(
      'GOOGLE_APPLICATION_CREDENTIALS não definido: caminho da chave JSON da conta de serviço (fora do repositório).',
    );
  }
  const caminho = resolve(SITE, cred);
  if (dentroDe(RAIZ_REPO, caminho)) {
    throw new ErroConfig(
      'GOOGLE_APPLICATION_CREDENTIALS aponta para dentro do repositório; mova a chave para fora.',
    );
  }
  let bruto: unknown;
  try {
    bruto = JSON.parse(await readFile(caminho, 'utf8')) as unknown;
  } catch (e) {
    throw new ErroConfig(
      `Não foi possível ler a chave da conta de serviço em ${caminho}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const conta = lerContaServico(bruto, caminho);
  const token = await obterToken(conta, fetch, Math.floor(Date.now() / 1000), undefined, escopo);
  return { site, token };
}

async function executar(op: Opcoes): Promise<void> {
  if (op.gerarChave) {
    await gerarChave(op.dryRun);
    return;
  }
  const slugs = new Set(articles.map((a) => a.slug));
  const urls = [...new Set(op.alvos.map((a) => resolverUrl(a, slugs)))];

  // 1. Produção precisa responder 200 antes de qualquer envio.
  const fora: string[] = [];
  for (const url of urls) {
    const status = await statusProducao(url, fetch);
    console.log(`${status === 200 ? 'OK ' : 'FORA'} ${status} ${url}`);
    if (status !== 200) fora.push(url);
  }
  if (fora.length > 0) {
    console.error(
      '\nAviso: a(s) URL(s) acima não responde(m) 200 em produção (artigo ainda não deployado?). Nada foi enviado.',
    );
    process.exitCode = 1;
    return;
  }

  const env = mesclarEnv(
    process.env,
    existsSync(CAMINHO_ENV) ? await readFile(CAMINHO_ENV, 'utf8') : null,
  );
  const chave = op.soStatus ? null : await chaveLocal();

  if (op.dryRun) {
    console.log('\n[dry-run] faria, sem enviar nada:');
    if (!op.soStatus) {
      console.log(`  2. PUT sitemaps.submit ${URL_SITEMAP} (escopo webmasters)`);
      console.log(
        chave
          ? `  3. POST IndexNow com ${urls.length} URL(s), chave ${chave}.txt`
          : '  3. IndexNow PULADO: sem arquivo de chave em site/public (rode --gerar-chave-indexnow)',
      );
    }
    console.log(`  4. urlInspection.index.inspect de ${urls.length} URL(s)`);
    console.log('  5. imprimiria o link da Inspeção de URL');
    return;
  }

  const { site, token } = await lerCredencial(env, op.soStatus ? ESCOPO_LEITURA : ESCOPO_ESCRITA);
  let falhas = 0;

  if (!op.soStatus) {
    // 2. Sitemap
    try {
      await enviarSitemap(site, URL_SITEMAP, token, fetch);
      console.log(`\nSitemap enviado ao Search Console: ${URL_SITEMAP}`);
    } catch (e) {
      if (!(e instanceof ErroApi)) throw e;
      falhas++;
      console.error(`\nSitemap NÃO enviado: ${e.message}`);
    }
    // 3. IndexNow
    if (!chave) {
      console.log(
        '\nIndexNow pulado: sem arquivo de chave em site/public (rode --gerar-chave-indexnow).',
      );
    } else if ((await statusProducao(`${ORIGEM}/${chave}.txt`, fetch)) !== 200) {
      console.log(
        `\nIndexNow pulado: ${ORIGEM}/${chave}.txt ainda não responde 200 (faça o deploy do arquivo).`,
      );
    } else {
      try {
        const r = await enviarIndexNow(montarIndexNow(chave, urls), fetch);
        console.log(
          `\nIndexNow: HTTP ${r.status}${r.pendente ? ' (chave em validação)' : ''}, ${urls.length} URL(s).`,
        );
      } catch (e) {
        if (!(e instanceof ErroApi)) throw e;
        falhas++;
        console.error(`\nIndexNow falhou: ${e.message}`);
      }
    }
  }

  // 4. Status
  console.log('\nStatus no Google (Inspeção de URL):');
  const status: StatusIndexacao[] = [];
  for (const url of urls) {
    try {
      const s = await inspecionar(url, site, token, fetch);
      status.push(s);
      console.log(formatarStatus(s));
    } catch (e) {
      if (!(e instanceof ErroApi)) throw e;
      falhas++;
      console.error(`  ${url}\n    ${e.message.replaceAll('\n', '\n    ')}`);
    }
  }

  // 5. Link manual
  console.log(
    `\nFalta o passo manual (sem API): abra a Inspeção de URL, cole a URL e clique em "Solicitar indexação":\n  ${linkInspecao(site, status[0]?.link ?? null)}`,
  );
  if (falhas > 0) process.exitCode = 1;
}

async function main(): Promise<void> {
  try {
    const op = lerOpcoes(process.argv.slice(2));
    if (op.ajuda) {
      console.log(AJUDA);
      return;
    }
    await executar(op);
  } catch (e) {
    if (e instanceof ErroUso) {
      console.error(`Erro: ${e.message}\n\n${AJUDA}`);
      process.exitCode = 2;
    } else if (e instanceof ErroConfig || e instanceof ErroApi) {
      console.error(`Erro: ${e.message}`);
      process.exitCode = 1;
    } else {
      throw e;
    }
  }
}

await main();
