import { INTERNAL_STORAGE_KEY, readInternalParam, syncInternalFlag } from './internal-traffic';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe('readInternalParam', () => {
  it('lê interno=1 e interno=0', () => {
    expect(readInternalParam('?interno=1')).toBe(true);
    expect(readInternalParam('?x=2&interno=0')).toBe(false);
  });
  it('ignora ausência e outros valores', () => {
    expect(readInternalParam('')).toBeNull();
    expect(readInternalParam('?interno=sim')).toBeNull();
    expect(readInternalParam('?internos=1')).toBeNull();
  });
});

describe('syncInternalFlag', () => {
  it('?interno=1 grava o flag e devolve true', () => {
    const s = memoryStorage();
    expect(syncInternalFlag('?interno=1', s)).toBe(true);
    expect(s.data.get(INTERNAL_STORAGE_KEY)).toBe('1');
  });
  it('?interno=0 remove o flag e devolve false', () => {
    const s = memoryStorage({ [INTERNAL_STORAGE_KEY]: '1' });
    expect(syncInternalFlag('?interno=0', s)).toBe(false);
    expect(s.data.has(INTERNAL_STORAGE_KEY)).toBe(false);
  });
  it('sem parâmetro, vale o flag salvo', () => {
    expect(syncInternalFlag('', memoryStorage({ [INTERNAL_STORAGE_KEY]: '1' }))).toBe(true);
    expect(syncInternalFlag('', memoryStorage())).toBe(false);
  });
  it('storage nulo ou que lança não derruba; ?interno=1 vale na página', () => {
    expect(syncInternalFlag('?interno=1', null)).toBe(true);
    expect(syncInternalFlag('', null)).toBe(false);
    const quebrado = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(syncInternalFlag('?interno=1', quebrado)).toBe(true);
    expect(syncInternalFlag('', quebrado)).toBe(false);
  });
});
