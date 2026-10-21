@ it-flags.s — dentro de um bloco IT, as instruções de dados de 16 bits NÃO mexem nas flags.
@   arm-none-eabi-as -march=armv7-a -mthumb -o it-flags.o it-flags.s
@   arm-none-eabi-ld -Ttext=0x8000 -o it-flags.elf it-flags.o
@ Sai com exit code = (NZCV após o IT << 4) | (NZCV após o MOVS fora do IT). Esperado: 0x84 = 132.
    .syntax unified
    .arch armv7-a
    .thumb
    .text
    .global _start
    .thumb_func
_start:
    movs    r2, #3
    cmp     r2, #5            @ 3 - 5 < 0: N=1, Z=0, C=0, V=0
    ite     lt
    movlt   r0, #0            @ mesmos 16 bits de "movs r0, #0", mas dentro do IT: não toca nas flags
    movge   r0, #1            @ não executa
    mrs     r1, apsr
    lsrs    r4, r1, #28       @ r4 = NZCV (esperado 0b1000)
    lsls    r4, r4, #4

    movs    r0, #0            @ fora do IT: o mesmo MOVS zera N e liga Z
    mrs     r1, apsr
    lsrs    r1, r1, #28       @ r1 = NZCV (esperado 0b0100)
    orrs    r0, r4, r1        @ exit code = 0x84

    movs    r7, #1
    svc     #0
