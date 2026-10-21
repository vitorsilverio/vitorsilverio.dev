@ thumb-2-switch.s — Thumb-2: constante de 32 bits sem literal pool, switch com TBB
@ e um bloco IT, tudo no estado Thumb.
@   arm-none-eabi-as -march=armv7-a -mthumb -o thumb-2-switch.o thumb-2-switch.s
@   arm-none-eabi-ld -Ttext=0x10000 -o thumb-2-switch.elf thumb-2-switch.o
@ Sai com exit code = r2 + r3 (esperado: 31).
    .syntax unified
    .arch armv7-a
    .thumb
    .text
    .global _start
    .thumb_func
_start:
    movw    r0, #0x5678       @ 16 bits baixos
    movt    r0, #0x1234       @ 16 bits altos: r0 = 0x12345678, sem literal pool
    movs    r1, #2            @ o "case" escolhido
    tbb     [pc, r1]          @ switch: lê table[r1] e desvia PC + 2*table[r1]
table:
    .byte   (case0 - table) / 2
    .byte   (case1 - table) / 2
    .byte   (case2 - table) / 2
    .align  1
case0:
    movs    r2, #10
    b       join
case1:
    movs    r2, #20
    b       join
case2:
    movs    r2, #30
join:
    cmp     r2, #30
    ite     eq                @ as duas próximas instruções são condicionais
    moveq   r3, #1            @ executa se r2 == 30
    movne   r3, #0            @ executa se r2 != 30
    adds    r0, r2, r3        @ exit code = 30 + 1
    movs    r7, #1            @ syscall exit
    svc     #0
