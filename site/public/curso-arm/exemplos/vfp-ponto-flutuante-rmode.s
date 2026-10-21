@ vfp-ponto-flutuante-rmode.s — divide 1.0f por 3.0f com RMODE = 10
@ (arredondar para -infinito) e devolve o byte baixo do resultado no exit code:
@   170 (0xAA) = 0x3EAAAAAA, arredondado para -infinito (correto para RMODE=10)
@   171 (0xAB) = 0x3EAAAAAB, arredondado para o mais proximo (RMODE ignorado)
@   arm-none-eabi-as -march=armv7-a -mfpu=vfpv2 -o vfp-ponto-flutuante-rmode.o vfp-ponto-flutuante-rmode.s
@   arm-none-eabi-ld -Ttext=0x10000 -o vfp-ponto-flutuante-rmode.elf vfp-ponto-flutuante-rmode.o
    .syntax unified
    .arch armv7-a
    .fpu vfpv2
    .arm
    .global _start
_start:
    ldr     r0, =0x00800000   @ FPSCR com RMODE (bits 23:22) = 10
    vmsr    fpscr, r0
    adr     r1, consts
    vldr    s0, [r1]          @ s0 = 1.0f
    vldr    s1, [r1, #4]      @ s1 = 3.0f
    mov     r4, #10           @ repete a divisao: o JIT so compila blocos "quentes"
1:  vdiv.f32 s2, s0, s1       @ s2 = 1/3, arredondado conforme o FPSCR
    subs    r4, r4, #1
    bne     1b
    vmov    r0, s2            @ bits crus do resultado
    and     r0, r0, #0xFF     @ o exit code so carrega 8 bits
    mov     r7, #1            @ exit
    svc     #0
    .align 2
consts:
    .float  1.0, 3.0
