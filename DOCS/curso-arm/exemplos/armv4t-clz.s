@ armv4t-clz.s — duas instruções: carrega um valor e aplica CLZ (ARMv5TE+).
@   arm-none-eabi-as -march=armv5te -o armv4t-clz.o armv4t-clz.s
@   arm-none-eabi-ld -Ttext=0x10000 -o armv4t-clz.elf armv4t-clz.o
@   arm-none-eabi-objcopy -O binary armv4t-clz.elf armv4t-clz.bin
@ Usado por java/Armv4tPresets.java para rodar os MESMOS bytes num núcleo
@ ARMv4T e num ARMv5TE.
    .syntax unified
    .arch armv5te
    .arm
    .text
    .global _start
_start:
    mov     r1, #0x00010000
    clz     r0, r1
