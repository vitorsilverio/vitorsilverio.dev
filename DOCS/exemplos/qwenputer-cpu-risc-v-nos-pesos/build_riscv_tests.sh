#!/bin/sh
# Compila o riscv-tests oficial (rv32ui, rv32um, rv32uzba) com o gcc do Debian, usando o
# ambiente (riscv_test.h) e o linker script do Qwenputer para enderecos que o qemu-user mapeia,
# e roda cada ELF no qemu-riscv32. Uso: build_riscv_tests.sh <dir-do-qwenputer-riscv> <saida>
set -eu
ENV="$1/chipformer/rv/env"
OUT="$2"
SRC=/tmp/riscv-tests
git clone -q https://github.com/riscv-software-src/riscv-tests "$SRC"
git -C "$SRC" checkout -q 3df703c
echo "riscv-tests: $(git -C "$SRC" log -1 --format='%h %cs')"
mkdir -p "$OUT"
pass=0; fail=0
for s in "$SRC"/isa/rv32ui/*.S "$SRC"/isa/rv32um/*.S "$SRC"/isa/rv32uzba/*.S; do
  n=$(basename "$s" .S)
  suite=$(basename "$(dirname "$s")")
  case " fence_i ma_data " in *" $n "*) continue;; esac
  elf="$OUT/$suite-$n.qemu.elf"
  riscv64-unknown-elf-gcc -march=rv32im_zba -mabi=ilp32 -nostdlib -nostartfiles -static \
    -I"$ENV" -I"$SRC/isa/macros/scalar" -T"$ENV/qemu.ld" -Wl,--no-warn-rwx-segments \
    -o "$elf" "$s"
  if qemu-riscv32 -cpu rv32,zba=true "$elf"; then pass=$((pass+1)); else fail=$((fail+1)); echo "FALHOU $suite-$n"; fi
done
echo "qemu-riscv32 $(qemu-riscv32 --version | head -1 | cut -d' ' -f3): $pass passaram, $fail falharam"
