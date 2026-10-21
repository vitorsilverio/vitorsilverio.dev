@ mmio-uart.s — escreve uma mensagem byte a byte numa "UART" mapeada em memória.
@   arm-none-eabi-as -march=armv7-a -o mmio-uart.o mmio-uart.s
@   arm-none-eabi-ld -Ttext=0x10000 -o mmio-uart.elf mmio-uart.o
@   arm-none-eabi-objcopy -O binary mmio-uart.elf mmio-uart.bin
    .syntax unified
    .arch armv7-a
    .arm
    .text
    .global _start
_start:
    ldr     r1, =0x10000000   @ endereço do registrador de dados da UART
    adr     r2, msg           @ r2 = ponteiro para a mensagem
loop:
    ldrb    r0, [r2], #1      @ r0 = próximo byte; r2 += 1
    cmp     r0, #0            @ fim da string?
    beq     done
    strb    r0, [r1]          @ escrever na UART = "transmitir" o byte
    b       loop
done:
    b       done              @ laço infinito: o hospedeiro para aqui
    .ltorg
msg:
    .asciz  "Oi, MMIO!\n"
