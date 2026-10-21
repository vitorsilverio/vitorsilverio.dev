@ fundamentos-arm-flags.s — ADDS/SUBS e as flags N e Z no CPSR.
@ Montar:  arm-none-eabi-as -march=armv7-a -o fundamentos-arm-flags.o fundamentos-arm-flags.s
@ Ligar:   arm-none-eabi-ld -Ttext=0x10000 -o fundamentos-arm-flags.elf fundamentos-arm-flags.o
@ Rodar:   java -jar armbox.jar --arch=armv7a --gdb=3333 fundamentos-arm-flags.elf
    .syntax unified
    .arch armv7-a
    .arm
    .text
    .global _start
_start:
    mov   r0, #10          @ r0 = 10
    mov   r1, #3           @ r1 = 3
    adds  r2, r0, r1       @ r2 = 13: N=0 Z=0 C=0 V=0
    subs  r3, r1, r1       @ r3 = 0:  Z=1, C=1 (sem borrow)
    subs  r4, r0, #20      @ r4 = -10: N=1, C=0 (houve borrow)
    mov   r0, #0           @ código de saída
    mov   r7, #1           @ NR_exit
    svc   #0
