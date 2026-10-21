// Leitura e validação de scripts/tendencias.config.json e montagem dos temas efetivos.

import { palavras } from './tendencias-texto.ts';
import {
  ErroConfig,
  type BlogConfig,
  type Config,
  type TemaAlvo,
  type TemaConfig,
  type Termo,
} from './tendencias-tipos.ts';

type Obj = Record<string, unknown>;

function ehObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function listaTextos(v: unknown, onde: string, obrigatoria: boolean): string[] {
  if (v === undefined && !obrigatoria) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || x.trim() === '')) {
    throw new ErroConfig(`${onde} deve ser uma lista de textos não vazios`);
  }
  if (obrigatoria && v.length === 0) throw new ErroConfig(`${onde} não pode ser vazia`);
  return (v as string[]).map((x) => x.trim());
}

function textoObrigatorio(o: Obj, campo: string, onde: string): string {
  const v = o[campo];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new ErroConfig(`${onde}: "${campo}" é obrigatório`);
  }
  return v.trim();
}

export function lerConfig(json: unknown): Config {
  if (!ehObj(json) || !Array.isArray(json['temas'])) {
    throw new ErroConfig('configuração inválida: esperado um objeto com a lista "temas"');
  }
  const ids = new Set<string>();
  const temas: TemaConfig[] = (json['temas'] as unknown[]).map((t, i) => {
    const onde = `temas[${i}]`;
    if (!ehObj(t)) throw new ErroConfig(`${onde} deve ser um objeto`);
    const id = textoObrigatorio(t, 'id', onde);
    if (ids.has(id)) throw new ErroConfig(`${onde}: id "${id}" repetido`);
    ids.add(id);
    return {
      id,
      nome: textoObrigatorio(t, 'nome', onde),
      termos: listaTextos(t['termos'], `${onde}.termos`, true),
      lobstersTags: listaTextos(t['lobstersTags'], `${onde}.lobstersTags`, false),
      devtoTags: listaTextos(t['devtoTags'], `${onde}.devtoTags`, false),
    };
  });
  if (temas.length === 0) throw new ErroConfig('"temas" não pode ser vazio');
  const brutosBlogs = json['blogs'] ?? [];
  if (!Array.isArray(brutosBlogs)) throw new ErroConfig('"blogs" deve ser uma lista');
  const blogs: BlogConfig[] = (brutosBlogs as unknown[]).map((b, i) => {
    const onde = `blogs[${i}]`;
    if (!ehObj(b)) throw new ErroConfig(`${onde} deve ser um objeto`);
    const url = textoObrigatorio(b, 'url', onde);
    if (!/^https:\/\//.test(url)) throw new ErroConfig(`${onde}: "url" deve começar com https://`);
    return {
      id: textoObrigatorio(b, 'id', onde),
      nome: textoObrigatorio(b, 'nome', onde),
      url,
      tema: textoObrigatorio(b, 'tema', onde),
    };
  });
  return { temas, blogs };
}

function slug(termo: string): string {
  return palavras(termo).join('-') || 'termo';
}

export interface SelecaoTemas {
  /** Restringe aos temas da config com estes ids (vazio = todos). */
  temasIds: string[];
  /** Termos de --termo; cada um vira um tema próprio. */
  termosExtras: string[];
  /** Ignora os temas da config e usa só os termos extras. */
  semPadrao: boolean;
}

export function montarTemas(config: Config, sel: SelecaoTemas): TemaAlvo[] {
  const desconhecidos = sel.temasIds.filter((id) => !config.temas.some((t) => t.id === id));
  if (desconhecidos.length > 0) {
    throw new ErroConfig(
      `tema(s) desconhecido(s): ${desconhecidos.join(', ')}. Disponíveis: ${config.temas.map((t) => t.id).join(', ')}`,
    );
  }
  const base: TemaAlvo[] = sel.semPadrao
    ? []
    : config.temas.filter((t) => sel.temasIds.length === 0 || sel.temasIds.includes(t.id));
  const usados = new Set(base.map((t) => t.id));
  const extras: TemaAlvo[] = [];
  for (const termo of sel.termosExtras) {
    let id = slug(termo);
    for (let n = 2; usados.has(id); n++) id = `${slug(termo)}-${n}`;
    usados.add(id);
    extras.push({ id, nome: termo, termos: [termo], lobstersTags: [], devtoTags: [] });
  }
  const todos = [...base, ...extras];
  if (todos.length === 0) {
    throw new ErroConfig('nenhum tema para consultar (use --termo ou remova --sem-padrao)');
  }
  return todos;
}

export function termosDosTemas(temas: readonly TemaAlvo[]): Termo[] {
  const vistos = new Set<string>();
  const saida: Termo[] = [];
  for (const t of temas) {
    t.termos.forEach((texto, i) => {
      const chave = `${t.id}|${texto.toLowerCase()}`;
      if (vistos.has(chave)) return;
      vistos.add(chave);
      saida.push({ texto, temaId: t.id, principal: i === 0 });
    });
  }
  return saida;
}
