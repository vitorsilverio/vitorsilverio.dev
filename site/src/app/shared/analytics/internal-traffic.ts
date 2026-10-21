// Marca o navegador do autor como "tráfego interno" para o GA4 poder excluí-lo.
//
// Abrir qualquer página com ?interno=1 grava um flag no localStorage; ?interno=0 remove.
// Com o flag, todo evento GA4 leva o parâmetro traffic_type = 'internal', que é o que a
// regra "Internal traffic" dos filtros de dados do GA4 lê (Administrador > Configurações
// de dados > Filtros de dados). Não depende de IP.

export const INTERNAL_STORAGE_KEY = 'trafego-interno';
export const INTERNAL_PARAM = 'interno';
export const INTERNAL_TRAFFIC_TYPE = 'internal';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** true para ?interno=1, false para ?interno=0, null quando o parâmetro não existe ou é outro valor. */
export function readInternalParam(search: string): boolean | null {
  const value = new URLSearchParams(search).get(INTERNAL_PARAM);
  if (value === '1') return true;
  if (value === '0') return false;
  return null;
}

/**
 * Aplica o parâmetro da URL ao armazenamento e devolve se este navegador é interno.
 * Sem parâmetro, vale o que já estava salvo. Storage indisponível (modo privado, bloqueado)
 * nunca lança: ?interno=1 ainda vale para esta página, só não persiste.
 */
export function syncInternalFlag(search: string, storage: StorageLike | null): boolean {
  const param = readInternalParam(search);
  try {
    if (param === true) storage?.setItem(INTERNAL_STORAGE_KEY, '1');
    else if (param === false) storage?.removeItem(INTERNAL_STORAGE_KEY);
    else return storage?.getItem(INTERNAL_STORAGE_KEY) === '1';
  } catch {
    /* ignore */
  }
  return param === true;
}
