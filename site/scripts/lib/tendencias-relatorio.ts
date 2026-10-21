// Saída do relatório: JSON estável e texto (Markdown) legível.

import type { Tema } from './tendencias-agregar.ts';
import type { Relatorio } from './tendencias-coleta.ts';
import type { Item, Metricas } from './tendencias-tipos.ts';

export function formatarJson(r: Relatorio): string {
  return `${JSON.stringify(r, null, 2)}\n`;
}

function metricasTexto(m: Metricas): string {
  const partes: string[] = [];
  if (m.pontos !== undefined) partes.push(`${m.pontos} pts`);
  if (m.comentarios !== undefined) partes.push(`${m.comentarios} coment.`);
  if (m.estrelas !== undefined) partes.push(`${m.estrelas} estrelas`);
  if (m.forks !== undefined) partes.push(`${m.forks} forks`);
  if (m.reacoes !== undefined) partes.push(`${m.reacoes} reações`);
  return partes.join(', ');
}

function linhaItem(i: Item): string {
  const data = i.data ? i.data.slice(0, 10) : 's/ data';
  const eng = metricasTexto(i.metricas);
  const meta = [i.fonte, i.idioma ?? '?', data, eng, `termo: ${i.termo}`]
    .filter(Boolean)
    .join(' | ');
  const disc = i.discussao && i.discussao !== i.url ? `\n    discussão: ${i.discussao}` : '';
  return `- ${i.titulo}\n    ${i.url}\n    ${meta}${disc}`;
}

function blocoTema(t: Tema): string {
  const s = t.sinais;
  const linhas: string[] = [`## ${t.nome} (${t.id})`];
  linhas.push(`Termos: ${t.termos.join(', ')}`);
  linhas.push(
    t.jaPublicado
      ? `Já coberto no site: ${t.artigosRelacionados.length} artigo(s), por exemplo ${t.artigosRelacionados
          .slice(0, 3)
          .map((a) => `${a.titulo} [${a.slug}]`)
          .join('; ')} (lista completa no --json)`
      : 'Já coberto no site: nenhum artigo casa com estes termos',
  );
  const porFonte = Object.entries(s.itensPorFonte)
    .map(([f, n]) => `${f}=${n}`)
    .join(', ');
  linhas.push(
    `Sinais: ${s.totalItens} itens em ${s.fontesIndependentes} fonte(s) (${porFonte || 'nenhuma'})`,
  );
  linhas.push(
    `  recência: mais recente ${s.recencia.maisRecente?.slice(0, 10) ?? 'n/d'}, ${s.recencia.itensUltimas48h} nas últimas 48 h, mediana ${s.recencia.idadeMedianaDias ?? 'n/d'} dia(s)`,
  );
  linhas.push(
    `  engajamento: ${s.engajamento.pontos} pontos, ${s.engajamento.comentarios} comentários, ${s.engajamento.estrelas} estrelas, ${s.engajamento.reacoes} reações`,
  );
  linhas.push(
    `  PT-BR: ${s.ptBR.itens} de ${s.totalItens} itens${s.ptBR.fontes.length ? ` (${s.ptBR.fontes.join(', ')})` : ''}`,
  );
  linhas.push('');
  if (t.itens.length === 0) linhas.push('(sem itens na janela)');
  for (const i of t.itens) linhas.push(linhaItem(i));
  if (t.itensOmitidos > 0) linhas.push(`... mais ${t.itensOmitidos} item(ns); aumente --limite`);
  return linhas.join('\n');
}

export function formatarTexto(r: Relatorio): string {
  const linhas: string[] = [];
  linhas.push(
    `# Tendências de tecnologia (coleta de ${r.coletadoEm.slice(0, 16).replace('T', ' ')} UTC)`,
  );
  linhas.push(`Janela: últimos ${r.janela.dias} dia(s), desde ${r.janela.desde.slice(0, 10)}.`);
  linhas.push('');
  linhas.push('## Fontes');
  for (const f of r.fontes) {
    const base = f.status === 'ok' ? `ok, ${f.itens} item(ns)` : `FALHOU: ${f.motivo}`;
    linhas.push(`- ${f.nome} [${f.id}]: ${base}`);
    for (const a of f.avisos) linhas.push(`    aviso: ${a}`);
  }
  for (const a of r.avisos) linhas.push(`- aviso: ${a}`);
  linhas.push('');
  for (const t of r.temas) {
    linhas.push(blocoTema(t));
    linhas.push('');
  }
  linhas.push(
    'Os números acima são sinais brutos de cada fonte, não uma nota. X.com e Reddit não têm rota gratuita e ficam de fora.',
  );
  return `${linhas.join('\n')}\n`;
}
