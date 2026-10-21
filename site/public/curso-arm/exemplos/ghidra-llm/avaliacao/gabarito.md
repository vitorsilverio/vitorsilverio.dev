# Gabarito (extraido de cofre.c)

1. _start -> c_start(argc, argv). c_start: se argc>1 e chave_ok(argv[1]) escreve "acesso liberado\n" (16 bytes), exit(0);
   senao "acesso negado\n" (14 bytes), exit(1). soma_ate nao e chamada por ninguem; mistura so e chamada por chave_ok
   (no -O2 o compilador a incorpora, e a copia fica no binario sem chamadores).
2. chave_ok: conta o comprimento; exige exatamente 8; retorna mistura(chave, 8) == ALVO, com ALVO = 0x3096b5fe.
   (Sem verificacao de ponteiro nulo: e pre-condicao, nao teste.)
3. mistura: h = 0x1505; para cada byte: h = ((h << 5) | (h >> 27)) ^ byte; h *= 0x9e3779b1. Retorna h.
   0x9e3779b1 e uma variante da constante classica 0x9e3779b9 (= round(2^32 / phi)); o autor mudou o ultimo digito.
4. Nao. O fonte escreve ALVO = 0x3096b5fe. No -O2 o gcc comparou o valor ANTES da ultima multiplicacao com
   0xc003375e = ALVO * inverso(0x9e3779b1) mod 2^32. Conferencia: 0xc003375e * 0x9e3779b1 mod 2^32 = 0x3096b5fe.
5. A chave planejada e "ARM-2026". Como o hash tem 32 bits e a chave 64, existem muitas colisoes: qualquer string de 8
   caracteres com o mesmo hash tambem libera (conferido no armbox: v738aaak, 34q8ad55, ejraalis).
6. svc 0 no Linux ARM EABI: r7 = numero da syscall. escreve: r7=4 write(1, s, n). sai: r7=1 exit(codigo).
   O decompilador nao mostra r7.
7. Nomes originais: escreve, sai, _start, c_start, chave_ok, mistura, soma_ate (qualquer nome equivalente vale).
8. Nao ha bug de memoria. Fraqueza de projeto: verificacao por hash de 32 bits sem sal (colisoes, forca bruta).
   soma_ate tem overflow de int com sinal para n >= 65536 (65536*65537/2 > 2^31 - 1), mas nunca e chamada.
