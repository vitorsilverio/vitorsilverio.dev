#!/bin/sh
# Roda DENTRO do container (silkeh/clang:22), sem rede.
# uso: run.sh <nome> "<flags -D...>" [segundos] [arquivo.dict]
set -eu
name="$1"; defs="$2"; secs="${3:-60}"; dict="${4:-}"
extra=""; [ -n "$dict" ] && extra="-dict=$dict"
mkdir -p /tmp/o /tmp/c-"$name"
clang -g -O1 -fno-omit-frame-pointer -fsanitize=fuzzer,address $defs \
      fuzz.c tlv.c -o /tmp/o/fuzz-"$name"
echo "== $name ($defs), ate ${secs}s, seed=${SEED:-1}"
t0=$(date +%s)
/tmp/o/fuzz-"$name" -seed="${SEED:-1}" -max_total_time="$secs" -artifact_prefix=/tmp/c-"$name"/ $extra \
      /tmp/c-"$name" > /tmp/log-"$name" 2>&1 || true
t1=$(date +%s)
grep -E "ERROR|PROPRIEDADE|SUMMARY" /tmp/log-"$name" || echo "sem crash"
grep -E "^#[0-9]+" /tmp/log-"$name" | tail -n 1 | sed 's/REDUCE//;s/NEW //'
crash=$(ls /tmp/c-"$name"/crash-* 2>/dev/null | head -n 1 || true)
if [ -n "$crash" ]; then
  /tmp/o/fuzz-"$name" -minimize_crash=1 -runs=20000 -exact_artifact_path=/tmp/min-"$name" "$crash" >/dev/null 2>&1 || true
  printf "entrada minima: "; od -An -tx1 /tmp/min-"$name" | tr -s ' \n' ' '; echo
fi
echo "tempo ate o fim: $((t1 - t0))s"
