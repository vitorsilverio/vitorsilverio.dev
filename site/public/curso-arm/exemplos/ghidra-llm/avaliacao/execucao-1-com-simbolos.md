# Execucao 1 - cofre-O2.elf (COM simbolos)

Data: 2026-10-21. Modelo: claude-sonnet-5-5 (informado pelo proprio subagente), rodando como subagente do Claude Code,
com um cliente MCP caseiro (mcp_call.py) via Bash. Uma unica execucao. Texto abaixo = relatorio literal do modelo.
Chamadas MCP: get_program_info, list_functions, decompile_function_by_address + disassemble_function para cada uma das
7 funcoes, list_strings, list_data_items. Calculos locais declarados: ver (c).

(c) Calculos locais (python):
- 0xc003375e * 0x9e3779b1 mod 2^32 = 0x3096b5fe.
- -0x61c8864f mod 2^32 = 0x9e3779b1.
- Busca meet-in-the-middle por strings de 8 caracteres [a-z0-9] cujo "x" final (o valor antes da ultima multiplicacao) seja 0xc003375e. Resultado: 641 strings satisfazem, por exemplo v738aaak, 34q8ad55, ejraalis.
- Testei "cofre123" por palpite. Ele da x=0x21b75846, entao nao serve.

(d) RESPOSTAS
Dados do binario: cofre-O2.elf, ARM Thumb-2 (ARM:LE:32:v8), base 0x10000, compilado com devkitARM GCC 16.1.0. A tabela de simbolos tem os nomes originais (soma_ate, chave_ok, escreve, c_start, sai, mistura, MSG_OK, MSG_NEGA) e o arquivo-fonte "cofre.c". Eu li esses nomes no binario, nao os deduzi.

1. Fluxo geral:
- _start (0x10016) carrega argc de [sp] e argv em sp+4, chama c_start(argc, argv) e entra em loop infinito caso c_start retorne.
- c_start (0x100b0): se argc <= 1, ou se chave_ok(argv[1]) for falso, chama escreve(MSG_NEGA, 14) e depois sai(1). MSG_NEGA e "acesso negado\n". Caso contrario chama escreve(MSG_OK, 16) e depois sai(0). MSG_OK e "acesso liberado\n".
- chave_ok (0x10064) valida o argumento: precisa ter exatamente 8 caracteres e o hash deles precisa bater com uma constante.
- mistura (0x10038) e uma funcao de hash sobre (ptr, len). Ela esta no binario, mas ninguem a chama. O O2 fez inline dela dentro de chave_ok.
- soma_ate (0x10020) calcula 1+2+...+n, ou 0 se n <= 0. Ela tambem nao e chamada por ninguem (codigo morto).
- escreve (0x10000) e um wrapper do syscall write. sai (0x10010) e um wrapper do syscall exit.
- O decompilado de c_start tem lixo depois de sai(0). Isso e o Ghidra decodificando bytes de dados como codigo, porque sai nao retorna. Nao e codigo real.

2. chave_ok(0x10064) retorna verdadeiro se e somente se:
- o ponteiro nao e nulo e o primeiro byte nao e '\0';
- o comprimento da string e exatamente 8. O laco acha o ultimo caractere em p e exige p-7 == inicio;
- e, aplicando h=5381 e, para cada um dos 8 bytes, x = byte ^ rotl(h,5) e h = x * 0x9e3779b1, o x do ULTIMO byte e igual a 0xc003375e. Note que o teste usa x e nao h. O codigo faz subs, clz, lsr #5, que e a comparacao de igualdade (a == b) sem desvio.
- Caso contrario retorna 0.

3. mistura(0x10038) calcula um hash de bytes: h = 5381 (0x1505, a semente classica do djb2); para cada byte, h = ((byte ^ rotl(h,5)) * 0x9e3779b1) mod 2^32; retorna h (5381 se len <= 0). E um hash nao criptografico de 32 bits, do tipo rotacao-XOR-multiplicacao (semelhante ao FxHash/Fibonacci hashing com semente djb2). A constante -0x61c8864f e 0x9e3779b1 em complemento de dois, confirmado no calculo local. Ela e o inteiro de 32 bits mais proximo de 2^32/phi, onde phi e a razao aurea, usado como multiplicador no Fibonacci hashing (Knuth). O Ghidra a mostra como inteiro com sinal. O disassembly confirma: movw 0x79b1, movt 0x9e37.

4. Nao, 0xc003375e provavelmente NAO e o que esta no fonte. Justificativa:
- Em chave_ok o compilador comparou o x do ultimo passo (antes do mul), o que e uma transformacao do O2. Eu nao vejo o fonte, entao e inferencia.
- Provavelmente o fonte compara o hash FINAL com uma constante K, com h = x*M. Como M e impar, e invertivel mod 2^32, entao h == K equivale a x == K * M^-1. O compilador pode ter pre-calculado K * M^-1 e jogado fora o ultimo mul.
- Logo 0xc003375e seria K*M^-1, e o K do fonte seria 0xc003375e * 0x9e3779b1 mod 2^32 = 0x3096b5fe (calculo local). Nao posso provar que o fonte escreveu 0x3096b5fe. Mas, se o fonte chama mistura(arg,8) == K, esse e o valor esperado.
- Reforca a hipotese: mistura existe como funcao separada no binario (nao chamada), o que e coerente com ter sido inlined.

5. Nao da para determinar com certeza. O hash e de 32 bits e a entrada tem 64 bits, entao ha muitas colisoes. So em [a-z0-9] achei 641 strings que passam, entre elas v738aaak, 34q8ad55, ejraalis. Qualquer uma delas, pelo meu calculo, faz chave_ok retornar verdadeiro. Eu so verifiquei o x calculado em python para as 3 primeiras de uma lista. Nao executei o binario. A senha "pretendida" pelo autor nao e recuperavel so com o binario.

6. software_interrupt(0) e a instrucao svc 0 (EABI do Linux ARM, o numero do syscall vai em r7).
- escreve: r7=4 e write(fd=1 (stdout), buf=r0 do chamador (r1 da instrucao), count=r1 do chamador (r2)). Ou seja, write(1, msg, len). Retorna em r0 o resultado. O decompilado "CONCAT44(param_1,1)" e ruido do Ghidra.
- sai: r7=1 e exit(status) com o status em r0 (o r0 passado pelo chamador, 1 ou 0). Depois do svc ha um laco infinito de seguranca (b .). O Ghidra nao reconhece o argumento porque a assinatura esta sem parametro.

7. Nomes sugeridos:
- escreve -> sys_write_stdout (ou escreve_stdout)
- sai -> sys_exit
- _start -> _start (ponto de entrada; ok)
- c_start -> main (ou main_cofre)
- chave_ok -> verifica_senha (ou valida_chave)
- mistura -> hash_rotxor_mul (ou hash_bytes)
- soma_ate -> soma_1_ate_n (ou soma_triangular)
- DAT_000100e0 -> ptr_msg_negada
- MSG_OK/MSG_NEGA ja estao bons.

8. Bugs e vulnerabilidades:
- Nao ha overflow de buffer: chave_ok so le a string e nao escreve. O comprimento e verificado antes do hash.
- Chave fraca por design: a "senha" e verificada apenas por um hash de 32 bits nao criptografico, de modo que tem muitas colisoes (641 so no alfabeto [a-z0-9]) e e trivial de quebrar por forca bruta/meet-in-the-middle. Qualquer senha colidente abre o cofre. O cofre nao protege nada de verdade.
- A comparacao e feita direto com igualdade (sem tempo constante). Nao relevante num programa local desses.
- A semente e o multiplicador sao fixos e conhecidos, sem sal.
- soma_ate com n grande pode estourar int (overflow com sinal em 32 bits), por exemplo n >= 65536. Mas a funcao nunca e chamada, entao nao e alcancavel.
- Sem checagem de erro no write (o retorno e ignorado) e a mensagem de erro tem 14 bytes: "acesso negado\n" tem 14 caracteres, correto. "acesso liberado\n" tem 16, correto.
- O programa aceita so argv[1], o resto de argv e ignorado. Nao e bug.
- Nao sei se existe outro comportamento oculto alem do que o decompilado mostra. Nao testei execucao.
