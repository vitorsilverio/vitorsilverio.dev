// Orquestra as fontes (isoladas, em paralelo, cada uma com seu timeout) e monta o relatório.

import { agregar, type Tema } from './tendencias-agregar.ts';
import { termosDosTemas } from './tendencias-config.ts';
import { REGISTRO, type FonteInfo } from './tendencias-fontes.ts';
import {
  ErroFonte,
  type ArtigoPublicado,
  type BlogConfig,
  type ContextoFonte,
  type FonteId,
  type Item,
  type TemaAlvo,
} from './tendencias-tipos.ts';

export const VERSAO_ESQUEMA = 1;

export interface StatusFonte {
  id: FonteId;
  nome: string;
  status: 'ok' | 'falhou';
  itens: number;
  /** Só quando falhou. */
  motivo: string | null;
  avisos: string[];
}

export interface Relatorio {
  versaoEsquema: number;
  coletadoEm: string;
  janela: { dias: number; desde: string };
  parametros: {
    termos: { texto: string; temaId: string }[];
    fontesSolicitadas: FonteId[];
    limitePorTema: number;
  };
  fontes: StatusFonte[];
  fontesConsultadas: FonteId[];
  fontesComFalha: { id: FonteId; motivo: string }[];
  temas: Tema[];
  avisos: string[];
}

export interface ParametrosColeta {
  temas: TemaAlvo[];
  blogs: BlogConfig[];
  fontes: readonly FonteId[];
  dias: number;
  limite: number;
  agora: Date;
  fetch: typeof fetch;
  userAgent: string;
  timeoutFonteMs: number;
  timeoutReqMs: number;
  artigos: readonly ArtigoPublicado[];
  registro?: readonly FonteInfo[];
}

const DIA_MS = 86_400_000;

export async function coletar(p: ParametrosColeta): Promise<Relatorio> {
  const registro = (p.registro ?? REGISTRO).filter((f) => p.fontes.includes(f.id));
  const termos = termosDosTemas(p.temas);
  const desde = p.agora.getTime() - p.dias * DIA_MS;

  const resultados = await Promise.all(
    registro.map(async (f): Promise<{ info: StatusFonte; itens: Item[] }> => {
      const ctx: ContextoFonte = {
        termos,
        temas: p.temas,
        blogs: p.blogs,
        dias: p.dias,
        agora: p.agora,
        fetch: p.fetch,
        userAgent: p.userAgent,
        sinal: AbortSignal.timeout(p.timeoutFonteMs),
        timeoutReqMs: p.timeoutReqMs,
      };
      try {
        const r = await f.buscar(ctx);
        // Janela central: itens datados fora dela saem (itens sem data ficam).
        const itens = r.itens.filter((i) => {
          const t = i.data ? Date.parse(i.data) : NaN;
          return Number.isNaN(t) || t >= desde;
        });
        return {
          info: {
            id: f.id,
            nome: f.nome,
            status: 'ok',
            itens: itens.length,
            motivo: null,
            avisos: r.avisos,
          },
          itens,
        };
      } catch (e) {
        const motivo =
          e instanceof ErroFonte
            ? e.message
            : `erro inesperado: ${e instanceof Error ? e.message : String(e)}`;
        return {
          info: { id: f.id, nome: f.nome, status: 'falhou', itens: 0, motivo, avisos: [] },
          itens: [],
        };
      }
    }),
  );

  const itens = resultados.flatMap((r) => r.itens);
  const fontes = resultados.map((r) => r.info);
  const avisos: string[] = [];
  for (const b of p.blogs) {
    if (!p.temas.some((t) => t.id === b.tema)) {
      avisos.push(
        `feed "${b.nome}": tema "${b.tema}" não está ativo; posts só entram se casarem com algum termo`,
      );
    }
  }
  return {
    versaoEsquema: VERSAO_ESQUEMA,
    coletadoEm: p.agora.toISOString(),
    janela: { dias: p.dias, desde: new Date(desde).toISOString() },
    parametros: {
      termos: termos.map((t) => ({ texto: t.texto, temaId: t.temaId })),
      fontesSolicitadas: [...p.fontes],
      limitePorTema: p.limite,
    },
    fontes,
    fontesConsultadas: fontes.filter((f) => f.status === 'ok').map((f) => f.id),
    fontesComFalha: fontes
      .filter((f) => f.status === 'falhou')
      .map((f) => ({ id: f.id, motivo: f.motivo ?? 'desconhecido' })),
    temas: agregar(itens, p.temas, p.artigos, p.agora, p.limite),
    avisos,
  };
}
