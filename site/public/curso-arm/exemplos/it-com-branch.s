@ it-com-branch.s — o "if/else" do Thumb-1: comparar e desviar (sem bloco IT).
@   arm-none-eabi-as -march=armv7-a -mthumb -o it-com-branch.o it-com-branch.s
@   arm-none-eabi-ld -Ttext=0x8000 -o it-com-branch.elf it-com-branch.o
@ Sai com exit code = r0 (esperado: 0, porque 3 < 5).
    .syntax unified
    .arch armv7-a
    .thumb
    .text
    .global _start
    .thumb_func
_start:
    movs    r2, #3            @ valor a testar
    cmp     r2, #5
    blt     menor             @ se r2 < 5, pula
    movs    r0, #1            @ caminho "else": r2 >= 5
    b       fim
menor:
    movs    r0, #0            @ caminho "then": r2 < 5
fim:
    movs    r7, #1            @ syscall exit
    svc     #0
