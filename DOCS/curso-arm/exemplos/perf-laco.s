@ perf-laco.s — laco de 1000 voltas que chama uma sub-rotina: um ciclo de 3 blocos.
@   arm-none-eabi-as -march=armv7-a -o perf-laco.o perf-laco.s
@   arm-none-eabi-ld -Ttext=0x10000 -o perf-laco.elf perf-laco.o
@   arm-none-eabi-objcopy -O binary perf-laco.elf perf-laco.bin
    .syntax unified
    .arch armv7-a
    .arm
    .text
    .global _start
_start:
    ldr     r0, =1000         @ contador
loop:
    bl      dec               @ bloco 1 termina aqui (desvio)
    bne     loop              @ bloco 3: volta enquanto r0 != 0
done:
    b       done              @ o hospedeiro para quando o PC chega aqui
dec:
    subs    r0, r0, #1        @ bloco 2: decrementa e atualiza as flags
    bx      lr                @ volta (flags preservadas)
    .ltorg
