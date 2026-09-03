@ cpsr.s — lê o CPSR em tres momentos para ver N e Z mudarem.
@ Montar:  arm-none-eabi-as -march=armv7-a -o cpsr.o cpsr.s
@ Ligar:   arm-none-eabi-ld -Ttext=0x10000 -o cpsr.elf cpsr.o
@ Rodar:   java -cp ... dev.vitorsilverio.armbox.Main --gdb=3333 cpsr.elf
    .syntax unified
    .arch armv7-a
    .arm
    .text
    .global _start
_start:
    mrs     r0, cpsr           @ r0 = CPSR inicial
    movs    r1, #0             @ resultado 0  -> Z <- 1
    mrs     r2, cpsr           @ r2 = CPSR com Z setado
    subs    r3, r1, #1         @ 0 - 1        -> N <- 1, Z <- 0
    mrs     r4, cpsr           @ r4 = CPSR com N setado
    mov     r0, #0             @ exit code 0
    mov     r7, #1            @ NR_exit
    svc     #0
