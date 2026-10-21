@ carga-e-armazenamento-arm-sum.s — soma um vetor com LDR pós-indexado e guarda a soma com STR.
@   arm-none-eabi-as -march=armv5te -o sum.o carga-e-armazenamento-arm-sum.s
@   arm-none-eabi-ld -static -o sum.elf sum.o
@   java -jar target/armbox.jar --check sum.elf ; echo $?   -> 24
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
    mov   r2, #0           @ r2 = índice i
    ldr   r3, =len         @ r3 = total de elementos

loop:
    cmp   r2, r3           @ i == len?
    bge   done             @ sim -> termina
    ldr   r4, [r0], #4     @ r4 = nums[i]; r0 += 4 (próximo)
    add   r1, r1, r4       @ soma += nums[i]
    add   r2, r2, #1       @ i++
    b     loop             @ volta

done:
    ldr   r5, =result
    str   r1, [r5]         @ armazena a soma na memória (STR!)
    mov   r0, r1           @ código de saída = soma
    mov   r7, #1           @ syscall 1 = exit
    svc   #0
