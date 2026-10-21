@ manipulacao-bits-thumb.s - operacoes de bits em Thumb-2 (ARMv7-M), em linha reta.
@   arm-none-eabi-as -mcpu=cortex-m3 -o manipulacao-bits-thumb.o manipulacao-bits-thumb.s
@   arm-none-eabi-objcopy -O binary manipulacao-bits-thumb.o manipulacao-bits-thumb.bin
@   (o .bin e carregado em 0x0 por java/ManipulacaoBitsThumb.java)
    .syntax unified
    .cpu cortex-m3
    .thumb
    .text
    .thumb_func
    .global _start
_start:
    ldr     r1, =0x12345678     @ valor de partida
    ands    r0, r1, #0x0F       @ r0 = r1 & 0x0F        -> isola o nibble baixo
    orrs    r2, r1, #0x0F       @ r2 = r1 | 0x0F        -> liga os 4 bits baixos
    eors    r3, r1, #0x01       @ r3 = r1 ^ 0x01        -> inverte o bit 0
    bics    r4, r1, #0xF0       @ r4 = r1 & ~0xF0       -> zera o nibble 1
    mvn     r5, #0              @ r5 = ~0               -> 0xFFFFFFFF, sem mexer nas flags
    lsls    r6, r1, #3          @ r6 = r1 << 3          -> x8 (16 bits)
    asrs    r7, r6, #4          @ r7 = r6 >> 4 (com sinal)
    movs    r0, r1, ror #8      @ r0 = r1 rotacionado 8 bits a direita
    ubfx    r2, r1, #8, #8      @ r2 = r1[15:8]
    movs    r3, #0
    movs    r4, #7
    bfi     r3, r4, #4, #3      @ r3[6:4] = r4[2:0]
    bfc     r1, #4, #12         @ r1[15:4] = 0
    tst     r1, #0x08           @ so flags: r1 & 8
    tst     r1, #0x04           @ so flags: r1 & 4
done:
    b       done
    .ltorg
