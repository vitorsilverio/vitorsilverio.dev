@ isa-v6k.s — instrucoes novas do ARMv6K (ARM11 / 3DS).
@   arm-none-eabi-as -march=armv6k isa-v6k.s -o isa-v6k.o
    .syntax unified
    .arch armv6k
    .arm
    .global _start
_start:
    uadd8   r0, r1, r2          @ 4 somas de byte em paralelo (SIMD)
    pkhbt   r0, r1, r2, lsl #4  @ pack halfword bottom+top
    usad8   r0, r1, r2          @ soma das diferencas absolutas (video)
    ldrex   r0, [r1]            @ load exclusivo (lock-free)
    strex   r0, r2, [r1]        @ store exclusivo; r0 = 0 se sucesso
    rev     r0, r1             @ inverte a ordem dos bytes
    setend  be                 @ troca a endianness de dados
