#!/bin/sh
# Constrói a imagem e roda tudo dentro de um contêiner (nada do host é usado).
# Monta DOCS/curso-arm/exemplos (a pasta acima desta) só para leitura; os binários gerados
# ficam em /tmp do contêiner e não sobrescrevem mmio-uart.bin nem mmio-uart.elf.
set -e
cd "$(dirname "$0")"
docker build -q -t mmio-lab:1.3.0 .
DIR=$(cd .. && (pwd -W 2>/dev/null || pwd))
MSYS_NO_PATHCONV=1 docker run --rm -v "$DIR":/lab:ro mmio-lab:1.3.0 sh -c '
  set -e
  mkdir -p /tmp/out && cd /tmp/out
  cp /lab/mmio-uart.s /lab/java/MmioUart.java /lab/java/Waitstates.java .
  arm-none-eabi-as -march=armv7-a -o mmio-uart.o mmio-uart.s
  arm-none-eabi-ld -Ttext=0x10000 -o mmio-uart.elf mmio-uart.o
  arm-none-eabi-objcopy -O binary mmio-uart.elf mmio-uart.bin
  arm-none-eabi-objdump -d mmio-uart.elf
  cmp mmio-uart.bin /lab/mmio-uart.bin && echo "mmio-uart.bin identico ao versionado"
  javac -cp /opt/arm-jitter-1.3.0.jar MmioUart.java Waitstates.java
  java -cp "/opt/arm-jitter-1.3.0.jar:." MmioUart mmio-uart.bin
  java -cp "/opt/arm-jitter-1.3.0.jar:." Waitstates mmio-uart.bin
'
