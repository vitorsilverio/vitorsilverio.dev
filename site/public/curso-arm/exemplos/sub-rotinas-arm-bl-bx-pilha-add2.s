@ sub-rotinas-arm-bl-bx-pilha-add2.s — add2(a, b) chamada por BL, com PUSH/POP de r4 e lr.
@   arm-none-eabi-as -march=armv5te -o add2.o sub-rotinas-arm-bl-bx-pilha-add2.s
@   arm-none-eabi-ld -o add2.elf add2.o
@   java -jar target/armbox.jar add2.elf ; echo $?   -> 7
    .syntax unified
    .text
    .global _start

add2:                          @ r0 = a, r1 = b  ->  r0 = a + b
    push    {r4, lr}           @ salva r4 (callee-saved) e lr
    mov     r4, r0
    add     r4, r4, r1
    mov     r0, r4
    pop     {r4, lr}           @ restaura
    bx      lr                 @ volta para quem chamou

_start:
    mov     r0, #3
    mov     r1, #4
    bl      add2
    mov     r7, #1             @ exit(r0)
    svc     #0
