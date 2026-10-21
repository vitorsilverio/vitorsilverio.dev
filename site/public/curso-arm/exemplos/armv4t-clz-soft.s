@ armv4t-clz-soft.s — conta os zeros à esquerda SEM a instrução CLZ (ARMv4T puro).
@   arm-none-eabi-as -march=armv4t -o armv4t-clz-soft.o armv4t-clz-soft.s
@   arm-none-eabi-ld -Ttext=0x10000 -o armv4t-clz-soft.elf armv4t-clz-soft.o
@ Sai com exit code = número de zeros à esquerda de 0x00010000 (esperado: 15).
    .syntax unified
    .arch armv4t
    .arm
    .text
    .global _start
_start:
    mov     r1, #0x00010000   @ valor a analisar
    mov     r0, #0            @ contador de zeros
    cmp     r1, #0
    moveq   r0, #32           @ caso especial: zero tem 32 zeros à esquerda
    beq     done
loop:
    tst     r1, #0x80000000   @ bit 31 ligado?
    bne     done              @ sim: acabou
    add     r0, r0, #1        @ não: mais um zero
    lsl     r1, r1, #1        @ desloca e testa o próximo bit
    b       loop
done:
    mov     r7, #1            @ syscall exit (Linux ARM EABI)
    svc     #0                @ exit(r0)
