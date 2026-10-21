@ escrevendo-um-ir-pass-movs.s — um bloco com MOVs "inuteis" e parecidos que NAO sao
@ inuteis, para testar o RedundantMoveEliminationPass (ver IrPassDemo.java).
@   arm-none-eabi-as -march=armv5te -o escrevendo-um-ir-pass-movs.o escrevendo-um-ir-pass-movs.s
@   arm-none-eabi-ld -Ttext=0x10000 -o escrevendo-um-ir-pass-movs.elf escrevendo-um-ir-pass-movs.o
@   arm-none-eabi-objcopy -O binary escrevendo-um-ir-pass-movs.elf escrevendo-um-ir-pass-movs.bin
    .syntax unified
    .arch armv5te
    .arm
    .global _start
_start:
    mov     r1, r1          @ nop de verdade: o passe remove
    add     r0, r0, #5      @ trabalho real
    movs    r2, r2          @ NAO e nop: atualiza N e Z a partir de r2
    moveq   r3, r3          @ nop, mas condicional: o passe (conservador) mantem
    mov     r4, r5          @ copia de verdade: mantem
    mov     r6, r6          @ nop de verdade: o passe remove
    b       _start          @ fim do bloco
