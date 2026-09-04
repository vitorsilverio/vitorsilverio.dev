@ fib.s — fibonacci(n) iterativo. n em r0 na entrada; devolve fib(n) via exit code.
@   arm-none-eabi-as -march=armv7-a -o fib.o fib.s
@   arm-none-eabi-ld -Ttext=0x10000 -o fib.elf fib.o
@   java -jar target/armbox.jar --arch=armv7a fib.elf ; echo $?   -> 55 para n=10
    .syntax unified
    .arch armv7-a
    .arm
    .text
    .global _start
_start:
    mov     r0, #10            @ n = 10
    bl      fib
    mov     r7, #1            @ NR_exit  (r0 ja tem o resultado)
    svc     #0

@ fib(n): r0 = n  ->  r0 = fib(n)
fib:
    cmp     r0, #1
    bxle    lr                @ fib(0)=0, fib(1)=1: ja estao "certos" p/ n<=1? (n=0 -> 0, n=1 -> 1)
    mov     r1, #0            @ a = fib(0)
    mov     r2, #1            @ b = fib(1)
    mov     r3, r0            @ contador = n
1:  add     r12, r1, r2       @ next = a + b
    mov     r1, r2            @ a = b
    mov     r2, r12           @ b = next
    subs    r3, r3, #1
    bne     1b
    mov     r0, r1            @ resultado = a (fib(n))
    bx      lr
