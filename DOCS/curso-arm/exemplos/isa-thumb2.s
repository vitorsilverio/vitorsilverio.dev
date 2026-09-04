@ isa-thumb2.s — Thumb-2: instrucoes de 32 bits em estado Thumb.
@   arm-none-eabi-as -march=armv7-a -mthumb isa-thumb2.s -o isa-thumb2.o
    .syntax unified
    .arch armv7-a
    .arch_extension idiv
    .thumb
    .global _start
    .thumb_func
_start:
    movw    r0, #0x1234         @ imediato de 16 bits (nao cabia em Thumb-1)
    movt    r0, #0xABCD         @ metade alta
    cmp     r0, #0
    ite     eq                 @ IT: proxima instrucao se EQ, a seguinte se NE
    moveq   r1, #1
    movne   r1, #2
    ldrex   r0, [r1]           @ .W: forma de 32 bits
    sdiv    r3, r1, r2         @ divisao com sinal
