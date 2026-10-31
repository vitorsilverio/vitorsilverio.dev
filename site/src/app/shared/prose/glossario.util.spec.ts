import {
  Aparicao,
  ehGenerico,
  maximoDeTermos,
  ocorrencias,
  planejarReaparicoes,
  prioridadeDoTermo,
  regexDoTermo,
  seguidoDeDefinicao,
  terminaEmVariante,
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

describe('variantesDoTermo com parênteses no cabeçalho', () => {
  it('"X (Y)" gera o nome e a sigla', () => {
    expect(variantesDoTermo('AddressSanitizer (ASan)')).toEqual(['AddressSanitizer', 'ASan']);
    expect(variantesDoTermo('Registrador em banco / banked')).toEqual([
      'Registrador em banco',
      'banked',
    ]);
    // tamanho mínimo: a sigla de 2 letras cai e só a outra forma vale
    expect(variantesDoTermo('CA (autoridade certificadora)')).toEqual(['autoridade certificadora']);
    expect(variantesDoTermo('lr (r14)')).toEqual(['r14']);
    expect(variantesDoTermo('JIT (just-in-time)')).toEqual(['JIT', 'just-in-time']);
    expect(variantesDoTermo('LLM (Large Language Model)')).toEqual(['LLM', 'Large Language Model']);
  });

  it('combina com " / " e continua descartando termos curtos', () => {
    expect(variantesDoTermo('arm-box (ABX) / arm-jitter')).toEqual([
      'arm-box',
      'ABX',
      'arm-jitter',
    ]);
    expect(variantesDoTermo('Registrador (R)')).toEqual(['Registrador']);
  });

  it('cabeçalho de comando fica inteiro, sem separar o parêntese', () => {
    expect(variantesDoTermo('x/i $pc (GDB)')).toEqual(['x/i $pc (GDB)']);
    expect(variantesDoTermo('mov r0, #1 (ARM)')).toEqual(['mov r0, #1 (ARM)']);
  });
});

describe('maximoDeTermos', () => {
  it('é 8 até 4000 palavras e cresce uma vaga a cada 500', () => {
    expect(maximoDeTermos(0)).toBe(8);
    expect(maximoDeTermos(2000)).toBe(8);
    expect(maximoDeTermos(4000)).toBe(8);
    expect(maximoDeTermos(4001)).toBe(9);
    expect(maximoDeTermos(4500)).toBe(9);
    expect(maximoDeTermos(4501)).toBe(10);
    expect(maximoDeTermos(7744)).toBe(16);
  });
});

describe('planejarReaparicoes', () => {
  const marca = (linha: string, posicao: number, secao = 0): Aparicao => ({
    linha,
    posicao,
    secao,
    marcada: true,
  });
  const ocorre = (linha: string, posicao: number, secao = 0): Aparicao => ({
    linha,
    posicao,
    secao,
    marcada: false,
  });

  it('só marca a partir de 2500 palavras depois da última marca', () => {
    expect(planejarReaparicoes([marca('a', 100), ocorre('a', 2599, 1)])).toEqual([]);
    expect(planejarReaparicoes([marca('a', 100), ocorre('a', 2600, 1)])).toHaveLength(1);
  });

  it('conta a lacuna desde a última marca, inclusive a de reaparição', () => {
    const plano = planejarReaparicoes([
      marca('a', 0),
      ocorre('a', 2500, 1),
      ocorre('a', 4000, 2),
      ocorre('a', 5000, 3),
    ]);
    expect(plano.map((a) => a.posicao)).toEqual([2500, 5000]);
  });

  it('ignora ocorrência de termo sem marca principal', () => {
    expect(planejarReaparicoes([ocorre('a', 9000, 3)])).toEqual([]);
  });

  it('aceita no máximo uma reaparição por seção', () => {
    const plano = planejarReaparicoes([
      marca('a', 0),
      marca('b', 0),
      ocorre('a', 3000, 1),
      ocorre('b', 3100, 1),
      ocorre('b', 3200, 2),
    ]);
    expect(plano.map((a) => [a.linha, a.posicao])).toEqual([
      ['a', 3000],
      ['b', 3200],
    ]);
  });

  it('aceita no máximo 6 por artigo, contando as marcas que já existem', () => {
    const todas = [marca('a', 0)];
    for (let i = 1; i <= 9; i++) todas.push(ocorre('a', i * 2600, i));
    expect(planejarReaparicoes(todas)).toHaveLength(6);
    const jaMarcadas = [marca('a', 0), marca('a', 2600, 1), marca('a', 5200, 2)];
    for (let i = 3; i <= 9; i++) jaMarcadas.push(ocorre('a', i * 2600, i));
    expect(planejarReaparicoes(jaMarcadas)).toHaveLength(4);
  });

  it('é estável: não depende da ordem em que as ocorrências chegam', () => {
    const todas = [
      marca('a', 0),
      marca('b', 50),
      ocorre('a', 2600, 1),
      ocorre('b', 2700, 1),
      ocorre('a', 5300, 2),
      ocorre('b', 5400, 3),
    ];
    const embaralhadas = [todas[5], todas[2], todas[0], todas[4], todas[1], todas[3]];
    const chave = (l: Aparicao[]) => l.map((a) => `${a.linha}@${a.posicao}`);
    expect(chave(planejarReaparicoes(embaralhadas))).toEqual(chave(planejarReaparicoes(todas)));
    expect(chave(planejarReaparicoes(todas))).toEqual(['a@2600', 'a@5300', 'b@5400']);
  });
});

describe('variantesDoTermo: só nome ou expansão vira variante, qualificador não', () => {
  it.each([
    ['AddressSanitizer (ASan)', ['AddressSanitizer', 'ASan']],
    ['JIT (just-in-time)', ['JIT', 'just-in-time']],
    ['LLM (Large Language Model)', ['LLM', 'Large Language Model']],
    ['TLV (Tag-Length-Value)', ['TLV', 'Tag-Length-Value']],
    ['CA (autoridade certificadora)', ['autoridade certificadora']],
    ['Código automodificável (SMC)', ['Código automodificável', 'SMC']],
    ['lr (r14)', ['r14']],
  ])('%s', (cabecalho, esperado) => {
    expect(variantesDoTermo(cabecalho)).toEqual(esperado);
  });

  it.each([
    ['Estrelas (GitHub)', ['Estrelas']],
    ['Agente (de IA)', ['Agente']],
    ['Agente (de programação)', ['Agente']],
    ['Oráculo (de testes)', ['Oráculo']],
    ['Endianness (bit E)', ['Endianness']],
    ['stepi (ou si)', ['stepi']],
    ['continue (no GDB)', ['continue']],
    ['delete N (GDB)', ['delete N']],
  ])('%s fica só com o nome', (cabecalho, esperado) => {
    expect(variantesDoTermo(cabecalho)).toEqual(esperado);
  });
});

describe('terminaEmVariante', () => {
  it('reconhece a forma da linha seguida de abre-parêntese', () => {
    const v = ['JIT', 'just-in-time'];
    expect(terminaEmVariante('O JIT (', v)).toBe(true);
    expect(terminaEmVariante('o jit  (', v)).toBe(true);
    expect(terminaEmVariante('O JIT ', v)).toBe(false);
    expect(terminaEmVariante('O XJIT (', v)).toBe(false);
    expect(terminaEmVariante('a compilação (', v)).toBe(false);
  });
});
