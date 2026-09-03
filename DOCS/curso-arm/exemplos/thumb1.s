@ thumb1.s — instrucoes Thumb de 16 bits para decodificar a mao.
@   arm-none-eabi-as -march=armv4t -mthumb -o thumb1.o thumb1.s
@   arm-none-eabi-ld -Ttext=0x10000 -o thumb1.elf thumb1.o
@   arm-none-eabi-objdump -d thumb1.elf
    .syntax unified
    .arch armv4t
    .thumb
    .text
    .global _start
    .thumb_func
_start:
    movs    r0, #10          @ mov imediato de 8 bits
    movs    r1, #0           @ acumulador
loop:
    adds    r1, r1, r0       @ add de 3 registradores
    subs    r0, r0, #1       @ sub imediato de 3 bits
    bne     loop             @ desvio condicional de 8 bits
    lsls    r2, r1, #2       @ shift por imediato
    bx      lr               @ hi-register op / troca de estado
