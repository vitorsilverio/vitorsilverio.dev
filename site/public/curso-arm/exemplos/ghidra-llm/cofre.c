/* cofre.c - programa de teste do artigo "Ghidra + LLM".
 * Quatro funcoes pequenas, todas com resposta conhecida:
 *   soma_ate  - a funcao do artigo "Do C ao binario ARM"
 *   mistura   - hash de 32 bits (rotacao + XOR + multiplicacao)
 *   chave_ok  - valida uma chave de 8 caracteres
 *   c_start   - ponto de entrada em C: le argv[1] e imprime o veredito
 */

#define SEMENTE 0x1505u
#define ALVO    0x3096b5feu

static const char MSG_OK[]   = "acesso liberado\n";
static const char MSG_NEGA[] = "acesso negado\n";

int soma_ate(int n) {
    int acc = 0;
    for (int i = 1; i <= n; i++) {
        acc += i;
    }
    return acc;
}

unsigned mistura(const char *s, int len) {
    unsigned h = SEMENTE;
    for (int i = 0; i < len; i++) {
        h = ((h << 5) | (h >> 27)) ^ (unsigned char)s[i];
        h *= 0x9e3779b1u;
    }
    return h;
}

int chave_ok(const char *chave) {
    int n = 0;
    while (chave[n] != '\0') {
        n++;
    }
    if (n != 8) {
        return 0;
    }
    return mistura(chave, n) == ALVO;
}

/* Em Thumb o gcc usa r7 como frame pointer e nao deixa um asm inline escrever nele;
   por isso as duas syscalls ficam em assembly, no bloco __asm__ no fim do arquivo. */
void escreve(const char *s, int n);
void sai(int codigo) __attribute__((noreturn));

void c_start(int argc, char **argv) {
    if (argc > 1 && chave_ok(argv[1])) {
        escreve(MSG_OK, sizeof MSG_OK - 1);
        sai(0);
    }
    escreve(MSG_NEGA, sizeof MSG_NEGA - 1);
    sai(1);
}

__asm__(
    ".thumb\n"
    ".global escreve\n"
    ".thumb_func\n"
    "escreve:\n"
    "    push {r7}\n"
    "    mov r2, r1\n"
    "    mov r1, r0\n"
    "    movs r0, #1\n"
    "    movs r7, #4\n"
    "    svc 0\n"
    "    pop {r7}\n"
    "    bx lr\n"
    ".global sai\n"
    ".thumb_func\n"
    "sai:\n"
    "    movs r7, #1\n"
    "    svc 0\n"
    "1:  b 1b\n"
    ".global _start\n"
    ".thumb_func\n"
    "_start:\n"
    "    ldr r0, [sp]\n"
    "    add r1, sp, #4\n"
    "    bl c_start\n"
    "2:  b 2b\n"
);
