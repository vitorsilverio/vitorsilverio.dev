@ montar-e-ligar-arm-reloc.s — mostra uma relocation: o .word ptr guarda o endereço de
@ `valor`, que fica em outra seção (.data) e só ganha endereço final na ligação.
@   arm-none-eabi-as -march=armv7-a -o reloc.o montar-e-ligar-arm-reloc.s
@   arm-none-eabi-ld -T user.ld -o reloc.elf reloc.o
@   java -jar target/armbox.jar reloc.elf ; echo $?   -> 7
    .syntax unified
    .arch armv7-a
    .arm
    .text
    .global _start
_start:
    ldr     r1, ptr           @ r1 = endereço de valor (preenchido pelo linker)
    ldr     r0, [r1]          @ r0 = *r1 = 7
    mov     r7, #1
    svc     #0
ptr:
    .word   valor             @ endereço absoluto: precisa de relocation

    .data
valor:
    .word   7
