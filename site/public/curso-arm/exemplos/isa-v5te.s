@ isa-v5te.s — instrucoes novas do ARMv5TE (ARM9E / Nintendo DS).
@   arm-none-eabi-as -march=armv5te isa-v5te.s -o isa-v5te.o
    .syntax unified
    .arch armv5te
    .arm
    .global _start
_start:
    clz     r0, r1              @ conta zeros a esquerda
    blx     r2                  @ branch + troca de estado por registrador
    qadd    r0, r1, r2          @ soma com saturacao (DSP)
    smlabb  r0, r1, r2, r3      @ multiply-accumulate 16x16 (DSP)
    ldrd    r0, r1, [r4]        @ carrega par de 64 bits
