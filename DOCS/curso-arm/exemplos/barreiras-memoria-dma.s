@ barreiras-memoria-dma.s — o padrão "preenche o buffer, barreira, toca a campainha" num Cortex-M3.
@ Não há controlador de DMA de verdade: a "campainha" é uma palavra na RAM. O objetivo é ver
@ as barreiras montadas e executadas; no arm-box elas não mudam nenhum registrador ou byte.
@   arm-none-eabi-as -mcpu=cortex-m3 -o barreiras-memoria-dma.o barreiras-memoria-dma.s
@   arm-none-eabi-ld -T flash.ld -o barreiras-memoria-dma.elf barreiras-memoria-dma.o
@   java -jar armbox.jar --machine=cortex-m --arch=armv7m barreiras-memoria-dma.elf
    .syntax unified
    .cpu cortex-m3
    .thumb

    .section .isr_vector, "a"
    .word   0x20010000              @ [0x00] MSP inicial
    .word   reset + 1               @ [0x04] Reset_Handler (bit 0 = 1: Thumb)

    .text
    .thumb_func
reset:
    ldr     r0, =0x20000000         @ r0 = buffer na RAM (o "descritor de DMA")
    movs    r1, #0x2A
    str     r1, [r0]                @ 1) preenche o buffer (memória Normal)
    dmb     sy                      @ 2) a escrita do buffer fica ordenada antes da próxima
    ldr     r2, =0x20000100         @ r2 = "campainha" do periférico
    movs    r3, #1
    str     r3, [r2]                @ 3) avisa o periférico: "buffer pronto"
    dsb     sy                      @ 4) espera os acessos terminarem...
    isb     sy                      @    ...e esvazia o pipeline

    ldr     r1, [r0]                @ confere: o buffer continua com 0x2A
    cmp     r1, #0x2A
    ite     eq
    ldreq   r1, =msg_ok
    ldrne   r1, =msg_fail
    movs    r0, #0x04               @ SYS_WRITE0
    bkpt    0xAB
    movs    r0, #0x18               @ SYS_EXIT
    movs    r1, #0
    bkpt    0xAB
1:  b       1b

msg_ok:   .asciz "barreiras executadas, buffer = 0x2A\n"
msg_fail: .asciz "buffer corrompido\n"
    .align  2
