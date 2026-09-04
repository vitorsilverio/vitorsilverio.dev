@ isa-v7a-vfp.s — ARMv7-A: bitfield, divisao, barreiras + VFPv2 (ponto flutuante).
@   arm-none-eabi-as -march=armv7-a -mfpu=vfpv2 isa-v7a-vfp.s -o isa-v7a-vfp.o
    .syntax unified
    .arch armv7-a
    .arch_extension idiv
    .fpu vfpv2
    .arm
    .global _start
_start:
    movw     r0, #0xBEEF
    movt     r0, #0xDEAD        @ carrega 0xDEADBEEF em 2 instrucoes
    ubfx     r0, r1, #4, #8     @ extrai 8 bits a partir do bit 4
    sdiv     r3, r1, r2
    rbit     r0, r1            @ inverte a ordem dos 32 bits
    vadd.f64 d0, d1, d2        @ soma double no banco VFP
    vmov.f32 s0, s1
    vmrs     r0, fpscr         @ le o registrador de status FP
    dmb      ish               @ data memory barrier
