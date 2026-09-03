@ pcoffset.s — mostra o valor arquitetural de R15 (PC + 8 em estado ARM).
@   arm-none-eabi-as -march=armv7-a -o pcoffset.o pcoffset.s
@   arm-none-eabi-ld -Ttext=0x10000 -o pcoffset.elf pcoffset.o
    .syntax unified
    .arch armv7-a
    .arm
    .text
    .global _start
_start:
    mov     r0, pc             @ r0 = (endereço deste mov) + 8
    mov     r1, pc             @ r1 = (endereço deste mov) + 8
    sub     r2, r1, r0         @ r2 = 4 (distância entre os dois mov)
    mov     r0, #0
    mov     r7, #1
    svc     #0
