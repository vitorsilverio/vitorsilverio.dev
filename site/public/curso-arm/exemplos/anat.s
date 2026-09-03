@ anat.s — instrucoes de exemplo para ver a codificacao no objdump.
@   arm-none-eabi-as -march=armv7-a -o anat.o anat.s
@   arm-none-eabi-ld -Ttext=0x10000 -o anat.elf anat.o
@   arm-none-eabi-objdump -d anat.elf
    .syntax unified
    .arch armv7-a
    .arm
    .text
    .global _start
_start:
    add   r0, r1, r2
    add   r0, r1, #255
    add   r0, r1, #0x3F00
    add   r0, r1, r2, lsl #3
    addeq r0, r1, r2
    adds  r0, r1, r2
    ldr   r0, [r1, #4]
    ldr   r0, [r1, #4]!
    ldr   r0, [r1], #4
    ldrb  r0, [r1]
