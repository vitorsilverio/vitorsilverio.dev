#ifndef TLV_H
#define TLV_H
#include <stddef.h>
#include <stdint.h>

typedef struct {
    char name_first;  /* primeiro byte do nome (registro 'N') */
    int  admin;       /* 1 se o registro 'R' concedeu o papel admin */
    int  probe;       /* valor lido da tabela pelo registro 'P' */
} tlv_result;

/* Formato: "TV" seguido de registros [tag:1][len:1][valor:len].
 * Retorna 0 em sucesso, negativo em erro de formato. */
int tlv_parse(const uint8_t *data, size_t size, tlv_result *out);

#endif
