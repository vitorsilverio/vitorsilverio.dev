#!/bin/sh
# Compila cofre.c em -O0 e -O2 (Thumb-2, ARMv7-A, sem libc) e roda cada binario no armbox.
export PATH=/c/devkitPro/devkitARM/bin:$PATH
F="-g0 -mcpu=cortex-a8 -mthumb -nostdlib -static -ffreestanding -fno-tree-loop-distribute-patterns -T user.ld"
for O in O0 O2; do arm-none-eabi-gcc -$O $F cofre.c -o cofre-$O.elf || exit 1; done
