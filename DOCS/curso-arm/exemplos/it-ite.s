@ it-ite.s — o mesmo if/else com um bloco ITE, sem nenhum desvio.
@   arm-none-eabi-as -march=armv7-a -mthumb -o it-ite.o it-ite.s
@   arm-none-eabi-ld -Ttext=0x8000 -o it-ite.elf it-ite.o
@ Sai com exit code = r0 (esperado: 0, porque 3 < 5).
    .syntax unified
    .arch armv7-a
    .thumb
    .text
    .global _start
    .thumb_func
_start:
    movs    r2, #3            @ valor a testar
    cmp     r2, #5
    ite     lt                @ as duas próximas: a 1ª se LT, a 2ª se GE
    movlt   r0, #0            @ "then": executa se r2 < 5
    movge   r0, #1            @ "else": executa se r2 >= 5
    movs    r7, #1            @ syscall exit
    svc     #0
