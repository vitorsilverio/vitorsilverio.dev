@ irq-demo.s — tabela de vetores propria, uma excecao de instrucao indefinida
@ e tres interrupcoes (IRQ) acordando a CPU de um WFI.
@   arm-none-eabi-as -march=armv7-a -o irq-demo.o irq-demo.s
@   arm-none-eabi-ld -Ttext=0x0 -o irq-demo.elf irq-demo.o
@   arm-none-eabi-objcopy -O binary irq-demo.elf irq-demo.bin
    .syntax unified
    .arch armv7-a
    .arm
    .text
    .global _start
_start:                         @ tabela de vetores em 0x00
    b       reset               @ 0x00 reset
    b       undef_handler       @ 0x04 instrucao indefinida
    b       .                   @ 0x08 SVC (nao usado)
    b       .                   @ 0x0C prefetch abort
    b       .                   @ 0x10 data abort
    b       .                   @ 0x14 reservado
    b       irq_handler         @ 0x18 IRQ
    b       .                   @ 0x1C FIQ
reset:
    mov     r4, #0              @ r4 = quantas IRQs foram atendidas
    udf     #0                  @ instrucao indefinida -> vetor 0x04
    cpsie   i                   @ liga as IRQs (bit I do CPSR = 0)
loop:
    wfi                         @ dorme ate a linha de IRQ subir
    cmp     r4, #3
    bne     loop
done:
    b       done                @ o hospedeiro para aqui

undef_handler:
    mov     r5, #0x55           @ marca que o tratador rodou
    movs    pc, lr              @ volta para a instrucao seguinte ao udf

irq_handler:
    add     r4, r4, #1          @ conta a interrupcao
    ldr     r0, =0x10000000     @ registrador do periferico
    str     r0, [r0]            @ "reconhece" a IRQ: o periferico baixa a linha
    subs    pc, lr, #4          @ volta para a instrucao interrompida
    .ltorg
