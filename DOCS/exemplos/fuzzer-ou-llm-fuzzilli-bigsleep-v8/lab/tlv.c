#include "tlv.h"
#include <stdlib.h>
#include <string.h>

/* Cada bug e ligado por uma macro (-DBUG_NAME=1 ...). Sem a macro, o
 * ramo seguro e compilado. */
#ifndef BUG_NAME
#define BUG_NAME 0
#endif
#ifndef BUG_PROBE
#define BUG_PROBE 0
#endif
#ifndef BUG_UAF
#define BUG_UAF 0
#endif
#ifndef BUG_VAULT
#define BUG_VAULT 0
#endif
#ifndef BUG_ROLE
#define BUG_ROLE 0
#endif

#define BUF_CAP 64

static const int table[16] = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15};

static uint32_t fnv1a(const uint8_t *p, size_t n) {
    uint32_t h = 2166136261u;
    while (n--) { h ^= *p++; h *= 16777619u; }
    return h;
}

int tlv_parse(const uint8_t *d, size_t n, tlv_result *out) {
    if (n < 2 || d[0] != 'T' || d[1] != 'V') return -1;

    uint8_t *buf = NULL;   /* alocado por 'O', liberado por 'X' */
    int open = 0;
    int checked = 0;       /* 'S' valida o checksum do que veio antes */
    int unlocked = 0;      /* 'K' confere o hash de uma senha de 6 bytes */
    int rc = 0;
    size_t i = 2;

    while (i + 2 <= n) {
        uint8_t tag = d[i], len = d[i + 1];
        const uint8_t *v = d + i + 2;
        if ((size_t)i + 2 + len > n) { rc = -2; break; }

        switch (tag) {
        case 'N': {                          /* nome */
            char name[16] = {0};
#if BUG_NAME
            memcpy(name, v, len);            /* BUG 1: len ate 255 num buffer de 16 */
#else
            memcpy(name, v, len < sizeof name ? len : sizeof name);
#endif
            out->name_first = name[0];
            break;
        }
        case 'R':                            /* papel */
#if BUG_ROLE
            /* BUG 4: compara so len bytes; com len == 0 todo mundo vira admin */
            if (memcmp(v, "admin", len < 5 ? len : 5) == 0) out->admin = 1;
#else
            if (len == 5 && memcmp(v, "admin", 5) == 0) out->admin = 1;
#endif
            break;
        case 'O':                            /* abre o buffer */
            if (open) free(buf);
            buf = malloc(BUF_CAP);
            open = 1;
            break;
        case 'W':                            /* escreve no buffer */
            if (buf && len) memcpy(buf, v, len < BUF_CAP ? len : BUF_CAP);
            break;
        case 'X':                            /* fecha o buffer */
            if (open) free(buf);
            open = 0;
#if !BUG_UAF
            buf = NULL;                      /* BUG 3 (se faltar): ponteiro solto */
#endif
            break;
        case 'S':                            /* checksum FNV-1a de tudo que veio antes */
            if (len == 4) {
                uint32_t want = (uint32_t)v[0] | (uint32_t)v[1] << 8 |
                                (uint32_t)v[2] << 16 | (uint32_t)v[3] << 24;
                checked = (want == fnv1a(d, i));
            }
            break;
        case 'P':                            /* sonda na tabela, so depois de 'S' valido */
            if (checked && len >= 1) {
#if BUG_PROBE
                out->probe = table[v[0]];    /* BUG 2: indice sem checagem (tabela tem 16) */
#else
                out->probe = table[v[0] & 15];
#endif
            }
            break;
        case 'K':                            /* "cofre": so abre com a senha certa */
            if (len == 6 && fnv1a(v, 6) == 0xb68bf01bu) unlocked = 1;
            break;
        case 'Z':                            /* campo extra, so depois do 'K' valido */
            if (unlocked) {
                char z[8];
#if BUG_VAULT
                memcpy(z, v, len);           /* BUG 5: len ate 255 num buffer de 8 */
#else
                memcpy(z, v, len < sizeof z ? len : sizeof z);
#endif
                out->name_first = z[0];
            }
            break;
        default:
            break;
        }
        i += 2 + len;
    }
    if (open) free(buf);
    return rc;
}
