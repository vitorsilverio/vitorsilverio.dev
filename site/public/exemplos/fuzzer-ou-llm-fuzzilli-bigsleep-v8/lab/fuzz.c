#include "tlv.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef ORACLE
/* Oraculo de propriedade: "admin" so pode ser concedido se o texto
 * "admin" aparece de fato na entrada. */
static int contains(const uint8_t *d, size_t n, const char *s) {
    size_t m = strlen(s);
    for (size_t i = 0; i + m <= n; i++)
        if (memcmp(d + i, s, m) == 0) return 1;
    return 0;
}
#endif

int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
    tlv_result r = {0};
    tlv_parse(data, size, &r);
#ifdef ORACLE
    if (r.admin && !contains(data, size, "admin")) {
        fprintf(stderr, "PROPRIEDADE VIOLADA: admin concedido sem a palavra admin\n");
        abort();
    }
#endif
    return 0;
}
