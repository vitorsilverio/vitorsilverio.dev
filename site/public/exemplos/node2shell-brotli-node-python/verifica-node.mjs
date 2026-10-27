// Inventário defensivo: o Node que está rodando tem a correção do CVE-2026-111497?
// Consulta a versão e uma constante do zlib.
import { constants } from 'node:zlib';

const v = process.versions;
const temConstante = typeof constants.BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH === 'number';

console.log(`node    ${process.version}`);
console.log(`brotli  ${v.brotli}   (texto informativo: NÃO prova que a build é vulnerável)`);
console.log(`undici  ${v.undici}`);
console.log(`constante BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH: ${typeof constants.BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH}`);
console.log(
  temConstante
    ? 'resultado: build com a correção (a constante foi exposta junto com ela)'
    : 'resultado: build SEM a correção. Atualize (22.23.4, 24.22.1 ou 26.12.1).',
);
process.exitCode = temConstante ? 0 : 1;
