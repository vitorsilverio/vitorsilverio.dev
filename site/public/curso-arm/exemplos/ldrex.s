@ ldrex.s — incremento atomico de um contador com LDREX/STREX (ARMv6+).
@   arm-none-eabi-as -march=armv6k ldrex.s -o ldrex.o
@   arm-none-eabi-ld -Ttext=0x10000 ldrex.o -o ldrex.elf
@   java -jar target/armbox.jar --arch=armv6k ldrex.elf ; echo $?   -> 7
    .syntax unified
    .arch armv6k
    .arm
    .text
    .global _start
_start:
    adr     r1, contador       @ endereco do contador
    mov     r4, #7             @ quantas vezes incrementar
1:
2:  ldrex   r0, [r1]           @ le e RESERVA o endereco
    add     r0, r0, #1
    strex   r2, r0, [r1]       @ escreve SE a reserva sobreviveu; r2 = 0 ok, 1 falha
    cmp     r2, #0
    bne     2b                @ reserva perdida: tenta de novo
    subs    r4, r4, #1
    bne     1b
    ldr     r0, [r1]          @ r0 = valor final
    mov     r7, #1
    svc     #0
    .align 2
contador:
    .word   0
