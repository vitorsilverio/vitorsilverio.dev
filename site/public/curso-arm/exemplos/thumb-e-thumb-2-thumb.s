@ thumb-e-thumb-2-thumb.s — a mesma soma 3 + 4, agora em estado Thumb (16 bits, BL de 32).
@ Montar:  arm-none-eabi-as -march=armv7-a -o thumb-e-thumb-2-thumb.o thumb-e-thumb-2-thumb.s
@ Ligar:   arm-none-eabi-ld -Ttext=0x10000 -o thumb-e-thumb-2-thumb.elf thumb-e-thumb-2-thumb.o
@ Rodar:   java -jar armbox.jar --arch=thumb2 thumb-e-thumb-2-thumb.elf ; echo $?   (saída: 7)
    .syntax unified
    .arch armv7-a
    .thumb
    .text
    .global _start
    .thumb_func
_start:
    movs    r0, #3
    movs    r1, #4
    bl      add_thumb
    movs    r7, #1             @ NR_exit
    svc     #0                 @ exit(r0)

    .thumb_func
add_thumb:
    adds    r0, r0, r1
    bx      lr
