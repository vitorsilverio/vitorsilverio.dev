import {
  ehGenerico,
  ocorrencias,
  prioridadeDoTermo,
  regexDoTermo,
  seguidoDeDefinicao,
  variantesDoTermo,
} from './glossario.util';

describe('variantesDoTermo', () => {
  it('separa variantes por " / " e descarta termos curtos demais', () => {
    expect(variantesDoTermo('N / Z / C / V')).toEqual([]);
    expect(variantesDoTermo('arm-jitter / arm-box')).toEqual(['arm-jitter', 'arm-box']);
    expect(variantesDoTermo('  Complemento   de dois ')).toEqual(['Complemento de dois']);
  });

  it('tira aspas das pontas', () => {
    expect(variantesDoTermo('“Borrow”')).toEqual(['Borrow']);
  });
});

describe('regexDoTermo / ocorrencias', () => {
  const acha = (termo: string, texto: string) => ocorrencias(texto, regexDoTermo(termo)!);

  it('casa palavra inteira, sem diferenciar maiúsculas, com plural simples', () => {
    expect(acha('flag', 'as Flags do CPSR')).toEqual([{ indice: 3, tamanho: 5 }]);
    expect(acha('flag', 'uma flag.')).toEqual([{ indice: 4, tamanho: 4 }]);
    expect(acha('flag', 'flagship')).toEqual([]);
    expect(acha('flag', 'superflag')).toEqual([]);
  });

  it('acha todas as ocorrências, inclusive no começo do texto', () => {
    expect(acha('cpsr', 'CPSR e cpsr')).toEqual([
      { indice: 0, tamanho: 4 },
      { indice: 7, tamanho: 4 },
    ]);
  });

  it('trata hífen como parte da palavra e escapa metacaracteres', () => {
    expect(acha('arm-jitter', 'o arm-jitter roda')).toHaveLength(1);
    expect(acha('arm-jitter', 'arm-jitter-1.3.0')).toEqual([]);
    expect(acha('a+b', 'veja a+b aqui')).toHaveLength(1);
  });

  it('não casa um termo curto dentro de uma palavra maior', () => {
    expect(acha('cond', 'condicional')).toEqual([]);
  });

  it('não usa lookbehind (Safari < 16.4 lança SyntaxError)', () => {
    expect(regexDoTermo('flag')!.source).not.toContain('(?<');
  });
});

describe('seguidoDeDefinicao', () => {
  it('detecta a definição entre parênteses logo depois do termo', () => {
    expect(seguidoDeDefinicao(' (Current Program Status Register, o registrador)')).toBe(true);
    expect(seguidoDeDefinicao('(um registrador de status)')).toBe(true);
  });

  it('ignora parênteses curtos, de uma palavra ou que não começam por letra', () => {
    expect(seguidoDeDefinicao(' (S = 1)')).toBe(false);
    expect(seguidoDeDefinicao(' (bge)')).toBe(false);
    expect(seguidoDeDefinicao(' (0x8000 e depois 0x9000)')).toBe(false);
    expect(seguidoDeDefinicao(', e depois (algo assim mesmo)')).toBe(false);
  });
});

describe('termos genéricos e prioridade', () => {
  it('reconhece palavras comuns demais', () => {
    expect(ehGenerico('ARM')).toBe(true);
    expect(ehGenerico('Modo')).toBe(true);
    expect(ehGenerico('CPSR')).toBe(false);
  });

  it('siglas, números e código pesam mais', () => {
    expect(prioridadeDoTermo('CPSR', false)).toBe(2);
    expect(prioridadeDoTermo('r13', false)).toBe(2);
    expect(prioridadeDoTermo('breakpoint', true)).toBe(2);
    expect(prioridadeDoTermo('breakpoint', false)).toBe(1);
  });
});
