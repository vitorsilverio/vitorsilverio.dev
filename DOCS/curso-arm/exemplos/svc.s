@ svc.s — dispara uma excecao SWI para observar a entrada no vetor 0x08.
    .syntax unified
    .arch armv7-a
    .arm
    .global _start
_start:
    mov     r0, #0x2A
    svc     #0
