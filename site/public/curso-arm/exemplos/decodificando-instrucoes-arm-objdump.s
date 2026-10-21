@ decodificando-instrucoes-arm-objdump.s - soma 3+7+1+9+4 com cmp/bge e devolve 24 como codigo de saida.
@   arm-none-eabi-as -march=armv5te decodificando-instrucoes-arm-objdump.s -o sum.o
@   arm-none-eabi-ld -static -o sum.elf sum.o
    .syntax unified
    .text
    .global _start

    .data
nums:
    .word 3, 7, 1, 9, 4
len = (. - nums) / 4
result:
    .word 0

    .text
_start:
    ldr   r0, =nums        @ r0 = ponteiro para o vetor
    mov   r1, #0           @ r1 = soma acumulada
    mov   r2, #0           @ r2 = indice i
    ldr   r3, =len         @ r3 = total de elementos

loop:
    cmp   r2, r3           @ i == len?
    bge   done             @ sim -> termina
    ldr   r4, [r0], #4     @ r4 = nums[i]; r0 += 4 (proximo)
    add   r1, r1, r4       @ soma += nums[i]
    add   r2, r2, #1       @ i++
    b     loop             @ volta

done:
    ldr   r5, =result
    str   r1, [r5]         @ armazena a soma na memoria
    mov   r0, r1           @ codigo de saida = soma
    mov   r7, #1           @ syscall 1 = exit
    svc   #0
