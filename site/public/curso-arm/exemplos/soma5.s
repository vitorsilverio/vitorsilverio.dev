@ soma5.s — soma um vetor de 5 palavras e devolve a soma via exit code.
@   arm-none-eabi-as -march=armv7-a -o soma5.o soma5.s
@   arm-none-eabi-ld -T user.ld -o soma5.elf soma5.o
    .syntax unified
    .arch armv7-a
    .arm
    .text
    .global _start
_start:
    adr     r1, nums          @ ponteiro para o vetor
    mov     r2, #5            @ contador
    mov     r0, #0            @ acumulador
1:  ldr     r3, [r1], #4       @ carrega e avanca (post-index)
    add     r0, r0, r3
    subs    r2, r2, #1
    bne     1b
    mov     r7, #1
    svc     #0
    .align 2
nums:
    .word   3, 7, 1, 9, 4       @ soma = 24
