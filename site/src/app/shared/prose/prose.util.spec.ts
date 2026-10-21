import { idUnico, rotuloLinguagem, slugificar, textoPuro } from './prose.util';

describe('prose.util', () => {
  describe('rotuloLinguagem', () => {
    it('traduz a classe do Prism para um rótulo legível', () => {
      expect(rotuloLinguagem('language-armasm')).toBe('ARM asm');
      expect(rotuloLinguagem('language-bash')).toBe('Bash');
      expect(rotuloLinguagem('language-text')).toBe('Texto');
    });

    it('usa o identificador em maiúsculas quando não há tradução', () => {
      expect(rotuloLinguagem('language-zig')).toBe('ZIG');
    });

    it('cai em "Código" quando não há linguagem', () => {
      expect(rotuloLinguagem('')).toBe('Código');
      expect(rotuloLinguagem('token comment')).toBe('Código');
    });
  });

  describe('slugificar', () => {
    it('tira acentos e pontuação', () => {
      expect(slugificar('Instruções condicionais: o que é "IT"?')).toBe(
        'instrucoes-condicionais-o-que-e-it',
      );
    });

    it('limita o tamanho sem deixar hífen no fim', () => {
      const s = slugificar('a'.repeat(58) + ' bbbb');
      expect(s.length).toBeLessThanOrEqual(60);
      expect(s.endsWith('-')).toBe(false);
    });

    it('devolve vazio para texto sem letras', () => {
      expect(slugificar('???')).toBe('');
    });
  });

  describe('idUnico', () => {
    it('numera repetidos e registra o id', () => {
      const usados = new Set<string>();
      expect(idUnico('resumo', usados)).toBe('resumo');
      expect(idUnico('resumo', usados)).toBe('resumo-2');
      expect(idUnico('resumo', usados)).toBe('resumo-3');
    });

    it('usa um id padrão quando a base é vazia', () => {
      expect(idUnico('', new Set())).toBe('secao');
    });
  });

  describe('textoPuro', () => {
    it('remove ênfase e crases', () => {
      expect(textoPuro('provado pelo *exit code*. Com `objcopy` e **negrito**.')).toBe(
        'provado pelo exit code. Com objcopy e negrito.',
      );
    });

    it('preserva sublinhados dentro de identificadores', () => {
      expect(textoPuro('a função arm_jitter_run e o campo r_0')).toBe(
        'a função arm_jitter_run e o campo r_0',
      );
    });

    it('não altera texto limpo', () => {
      expect(textoPuro('Texto simples, sem marcação.')).toBe('Texto simples, sem marcação.');
    });
  });
});
