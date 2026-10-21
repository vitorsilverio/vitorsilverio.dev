@ semihosting-cortexm.s - "ola" por semihosting num Cortex-M (ARMv7-M).
@   arm-none-eabi-as -mcpu=cortex-m3 -o semihosting-cortexm.o semihosting-cortexm.s
@   arm-none-eabi-ld -T flash.ld -o semihosting-cortexm.elf semihosting-cortexm.o
@   java -jar armbox.jar --arch=armv7m --machine=cortex-m semihosting-cortexm.elf
    .syntax unified
    .cpu cortex-m3
    .thumb

    .section .isr_vector, "a"
    .word   0x20010000          @ vetor 0: valor inicial do SP (MSP)
    .word   _start + 1          @ vetor 1: Reset (bit 0 = 1: Thumb)

    .text
    .thumb_func
    .global _start
_start:
    movs    r0, #0x04           @ SYS_WRITE0: escreve string terminada em NUL
    ldr     r1, =msg            @ r1 = endereco da string (registrador de parametro)
    bkpt    0xAB                @ entrada do semihosting no perfil M
    movs    r0, #0x03           @ SYS_WRITEC: escreve UM caractere
    ldr     r1, =nl             @ r1 = endereco do byte do caractere, nao o valor
    bkpt    0xAB
    movs    r0, #0x18           @ SYS_EXIT
    movs    r1, #7              @ r1 = "codigo": o arm-box o devolve como status
    bkpt    0xAB
    b       .                   @ nunca chega aqui

    .ltorg
msg:
    .asciz  "ola, semihosting"
nl:
    .byte   10
