@ mmu-e-paginacao-cp15-abort.s — liga a MMU, le por um endereco virtual mapeado
@ e depois por um nao mapeado, provocando um data abort preciso (ver MmuAbort.java).
@ Carregado no endereco FISICO 0x00000000 (a tabela de vetores fica ali).
@   arm-none-eabi-as -march=armv6k -o mmu-e-paginacao-cp15-abort.o mmu-e-paginacao-cp15-abort.s
@   arm-none-eabi-ld -Ttext=0x0 -o mmu-e-paginacao-cp15-abort.elf mmu-e-paginacao-cp15-abort.o
@   arm-none-eabi-objcopy -O binary mmu-e-paginacao-cp15-abort.elf mmu-e-paginacao-cp15-abort.bin
    .syntax unified
    .arch armv6k
    .arm
    .text
    .global _start
_start:                             @ tabela de vetores em 0x00
    b       reset                   @ 0x00 reset
    b       .                       @ 0x04 instrucao indefinida
    b       .                       @ 0x08 SVC
    b       .                       @ 0x0C prefetch abort
    b       data_abort              @ 0x10 data abort
    b       .                       @ 0x14 (reservado)
    b       .                       @ 0x18 IRQ
    b       .                       @ 0x1C FIQ

reset:
    ldr     r0, =l1_table
    mcr     p15, 0, r0, c2, c0, 0   @ TTBR0 = endereco fisico da tabela L1
    mov     r0, #1
    mcr     p15, 0, r0, c3, c0, 0   @ DACR: dominio 0 = "client" (01), confere os bits AP
    mrc     p15, 0, r0, c1, c0, 0
    orr     r0, r0, #1
    mcr     p15, 0, r0, c1, c0, 0   @ SCTLR.M = 1: MMU ligada a partir daqui

    ldr     r1, =0x80000100         @ VA na secao 0x800 -> PA 0x00000100
    ldr     r6, [r1]                @ le a palavra fisica 0x100 (o marcador abaixo)
    ldr     r1, =0x90000000         @ VA na secao 0x900: entrada L1 vazia (fault)
falha:
    ldr     r2, [r1]                @ -> data abort, vetor 0x10
    b       .                       @ nunca chega aqui

data_abort:
    mrc     p15, 0, r3, c5, c0, 0   @ r3 = DFSR (por que falhou)
    mrc     p15, 0, r4, c6, c0, 0   @ r4 = DFAR (endereco virtual que falhou)
    sub     r5, lr, #8              @ r5 = endereco da instrucao que falhou
    b       .                       @ fim: o hospedeiro le os registradores

    .ltorg

    .org    0x100
marcador:
    .word   0xCAFEF00D

    .org    0x4000                  @ tabela L1: alinhada a 16 KiB, 4096 entradas
l1_table:
    .word   0x00000C02              @ VA 0x000xxxxx -> PA 0x000xxxxx (secao, AP=11, dominio 0)
    .fill   0x7FF, 4, 0             @ entradas 0x001..0x7FF: fault
    .word   0x00000C02              @ VA 0x800xxxxx -> PA 0x000xxxxx (mesma memoria, outro VA)
    .fill   0x7FF, 4, 0             @ entradas 0x801..0xFFF: fault (inclui 0x900)
