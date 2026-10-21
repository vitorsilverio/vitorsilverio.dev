@ thumb-e-thumb-2-arm.s — soma 3 + 4 em estado ARM (instruções de 32 bits).
@ Montar:  arm-none-eabi-as -march=armv7-a -o thumb-e-thumb-2-arm.o thumb-e-thumb-2-arm.s
@ Ligar:   arm-none-eabi-ld -Ttext=0x10000 -o thumb-e-thumb-2-arm.elf thumb-e-thumb-2-arm.o
@ Rodar:   java -jar armbox.jar --arch=armv7a thumb-e-thumb-2-arm.elf ; echo $?   (saída: 7)
    .syntax unified
    .arch armv7-a
    .arm
    .text
    .global _start
_start:
    mov     r0, #3
    mov     r1, #4
    bl      add_arm
    mov     r7, #1             @ NR_exit
    svc     #0                 @ exit(r0)

add_arm:
    add     r0, r0, r1
    bx      lr
