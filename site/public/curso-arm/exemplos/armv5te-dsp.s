@ armv5te-dsp.s — as instruções "E" (DSP) do ARMv5TE lado a lado com o jeito antigo.
@   arm-none-eabi-as -march=armv5te -o armv5te-dsp.o armv5te-dsp.s
@   arm-none-eabi-ld -Ttext=0x10000 -o armv5te-dsp.elf armv5te-dsp.o
@ Sai com exit code = r8 (esperado: 108).
    .syntax unified
    .arch armv5te
    .arm
    .text
    .global _start
_start:
    mvn     r1, #0x80000000   @ r1 = 0x7FFFFFFF (INT_MAX)
    mov     r2, #1
    add     r3, r1, r2        @ soma comum: 0x80000000 — "dá a volta" e vira negativo
    qadd    r4, r1, r2        @ soma saturada: para em 0x7FFFFFFF e liga o flag Q
    ldr     r5, =0x00030002   @ duas metades de 16 bits: alta = 3, baixa = 2
    ldr     r6, =0x00050004   @ alta = 5, baixa = 4
    mov     r7, #100          @ acumulador
    smlabb  r8, r5, r6, r7    @ baixa*baixa + acc = 2*4 + 100 = 108
    smlatt  r9, r5, r6, r7    @ alta*alta  + acc = 3*5 + 100 = 115
    clz     r10, r4           @ zeros à esquerda de 0x7FFFFFFF = 1
    mov     r0, r8
    mov     r7, #1            @ syscall exit
    svc     #0
