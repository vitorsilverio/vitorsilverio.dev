// Tipos compartilhados da ferramenta `npm run tendencias` (ver scripts/tendencias.ts).

export const FONTES = [
  'hn',
  'lobsters',
  'github',
  'devto',
  'tabnews',
  'gnoticias',
  'blogs',
] as const;
export type FonteId = (typeof FONTES)[number];

export type Idioma = 'pt' | 'en';

/** Engajamento reportado pela própria fonte. Cada fonte só preenche o que tem. */
export interface Metricas {
  /** HN points, Lobsters score, TabNews tabcoins. */
  pontos?: number;
  comentarios?: number;
  /** GitHub stargazers. */
  estrelas?: number;
  forks?: number;
  /** dev.to public_reactions_count. */
  reacoes?: number;
}

export interface Item {
  titulo: string;
  url: string;
  fonte: FonteId;
  /** ISO 8601 ou null quando a fonte não informa. */
  data: string | null;
  idioma: Idioma | null;
  metricas: Metricas;
  /** Termo (ou tag, como "tag:java") que trouxe o item. */
  termo: string;
  temaId: string;
  /** Página de discussão (HN, Lobsters), quando difere de `url`. */
  discussao: string | null;
}

export interface Termo {
  texto: string;
  temaId: string;
  /** Primeiro termo do tema: usado por fontes de cota baixa. */
  principal: boolean;
}

export interface TemaConfig {
  id: string;
  nome: string;
  termos: string[];
  lobstersTags: string[];
  devtoTags: string[];
}

export interface BlogConfig {
  id: string;
  nome: string;
  url: string;
  /** Tema ao qual os posts do blog são atribuídos (id de um tema da config). */
  tema: string;
}

export interface Config {
  temas: TemaConfig[];
  blogs: BlogConfig[];
}

/** Tema efetivo da coleta (config + termos de --termo). */
export interface TemaAlvo {
  id: string;
  nome: string;
  termos: string[];
  lobstersTags: string[];
  devtoTags: string[];
}

export interface ResultadoFonte {
  itens: Item[];
  /** Falhas parciais (um termo que falhou, limite de requisições...). */
  avisos: string[];
}

export interface ContextoFonte {
  termos: Termo[];
  temas: TemaAlvo[];
  blogs: BlogConfig[];
  dias: number;
  agora: Date;
  fetch: typeof fetch;
  userAgent: string;
  /** Aborta a fonte inteira. */
  sinal: AbortSignal;
  /** Timeout de cada requisição, em ms. */
  timeoutReqMs: number;
}

export interface ArtigoPublicado {
  slug: string;
  title: string;
  date: string;
  tags: readonly string[];
}

export class ErroFonte extends Error {
  readonly status: number | null;
  constructor(mensagem: string, status: number | null = null) {
    super(mensagem);
    this.name = 'ErroFonte';
    this.status = status;
  }
}

export class ErroUso extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroUso';
  }
}

export class ErroConfig extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroConfig';
  }
}
