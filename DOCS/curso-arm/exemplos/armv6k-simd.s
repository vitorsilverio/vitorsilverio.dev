@ armv6k-simd.s — SIMD paralelo, byte-swap e incremento atômico (ARMv6K).
@   arm-none-eabi-as -march=armv6k -o armv6k-simd.o armv6k-simd.s
@   arm-none-eabi-ld -Ttext=0x10000 -o armv6k-simd.elf armv6k-simd.o
@ Sai com exit code = valor do contador depois do incremento atômico (esperado: 1).
    .syntax unified
    .arch armv6k
    .arm
    .text
    .global _start
_start:
    ldr     r1, =0x10FF7F01   @ quatro bytes: 0x10, 0xFF, 0x7F, 0x01
    ldr     r2, =0x01010101   @ somar 1 a cada byte
    add     r3, r1, r2        @ soma de 32 bits: o "vai um" atravessa os bytes
    uadd8   r4, r1, r2        @ 4 somas de 8 bits independentes; liga GE[n] onde houve estouro
    uqadd8  r5, r1, r2        @ idem, mas cada byte satura em 0xFF
    rev     r6, r1            @ inverte a ordem dos bytes
    mov     r0, #0
    str     r0, [sp, #-4]!    @ contador = 0, na pilha
1:  ldrex   r0, [sp]          @ lê o contador e marca o endereço no monitor
    add     r0, r0, #1
    strex   r10, r0, [sp]     @ tenta gravar; r10 = 0 se a marca sobreviveu
    cmp     r10, #0
    bne     1b                @ falhou: alguém mexeu no endereço, tenta de novo
    ldr     r0, [sp], #4      @ r0 = contador (desempilha)
    mov     r7, #1            @ syscall exit
    svc     #0
