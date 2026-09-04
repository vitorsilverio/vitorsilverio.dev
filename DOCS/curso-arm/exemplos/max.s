@ max.s — maximo de dois numeros SEM desvio, usando execucao condicional.
@   arm-none-eabi-as -march=armv7-a -o max.o max.s
@   arm-none-eabi-ld -Ttext=0x10000 -o max.elf max.o
@   java -jar target/armbox.jar --arch=armv7a max.elf ; echo $?   -> 42
    .syntax unified
    .arch armv7-a
    .arm
    .text
    .global _start
_start:
    mov     r0, #17
    mov     r1, #42
    bl      max
    mov     r7, #1
    svc     #0

@ max(a, b): r0 = a, r1 = b  ->  r0 = maior
max:
    cmp     r0, r1
    movlt   r0, r1            @ se a < b, r0 = b   (senao mantem a)
    bx      lr
