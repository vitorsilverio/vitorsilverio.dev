@ exclusivity-monitor-ldrex-strex-dois-cores.s — dois trechos para dois nucleos
@ que dividem a mesma memoria (ver DoisCores.java):
@   nucleo A (_start): tenta incrementar o contador com LDREX/STREX
@   nucleo B (outro):  escreve 100 no mesmo contador com um STR comum
@   arm-none-eabi-as -march=armv6k -o exclusivity-monitor-ldrex-strex-dois-cores.o exclusivity-monitor-ldrex-strex-dois-cores.s
@   arm-none-eabi-ld -Ttext=0x10000 -o exclusivity-monitor-ldrex-strex-dois-cores.elf exclusivity-monitor-ldrex-strex-dois-cores.o
@   arm-none-eabi-objcopy -O binary exclusivity-monitor-ldrex-strex-dois-cores.elf exclusivity-monitor-ldrex-strex-dois-cores.bin
    .syntax unified
    .arch armv6k
    .arm
    .text
    .global _start
_start:                         @ nucleo A, em 0x10000
    adr     r1, contador
    ldrex   r0, [r1]            @ le o contador e reserva o endereco
    add     r0, r0, #1
    strex   r2, r0, [r1]        @ r2 = 0 se escreveu, 1 se a reserva foi perdida
    b       .                   @ para aqui

    .org    0x20
outro:                          @ nucleo B, em 0x10020
    adr     r1, contador
    mov     r3, #100
    str     r3, [r1]            @ escrita comum no endereco reservado por A
    b       .

    .align 2
contador:
    .word   0
