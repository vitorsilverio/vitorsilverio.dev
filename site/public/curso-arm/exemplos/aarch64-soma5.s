// aarch64-soma5.s — o laço soma5 da trilha (3+7+1+9+4 = 24) em AArch64 (A64),
// devolvendo a soma como exit code. Linux arm64 user-mode, syscalls cruas, sem libc.
//   aarch64-none-elf-gcc -nostdlib -static -Wl,-Ttext=0x400000 -o aarch64-soma5.elf aarch64-soma5.s
//   java -jar armbox.jar --arch=aarch64 aarch64-soma5.elf ; echo $?   -> 24
    .text
    .global _start
_start:
    adr     x1, nums            // x1 = endereço do vetor
    mov     w2, #5              // w2 = contador (escrever em w2 zera os 32 bits altos de x2)
    mov     x0, #0              // x0 = acumulador
1:  ldr     w3, [x1], #4        // w3 = *x1; depois x1 += 4 (pós-indexado)
    add     x0, x0, x3          // x0 += x3 (x3 já tem os 32 bits altos zerados)
    subs    w2, w2, #1          // w2 -= 1, atualizando as flags NZCV
    b.ne    1b                  // volta enquanto Z == 0
    mov     x8, #93             // __NR_exit no arm64 (x0 = código de saída)
    svc     #0
    .align  2
nums:
    .word   3, 7, 1, 9, 4
