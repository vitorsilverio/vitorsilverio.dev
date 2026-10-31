# Imagens fixadas por tag e digest (conferidas em 29/10/2026).
export MSYS_NO_PATHCONV=1   # Git Bash no Windows: nao reescrever caminhos do -v
export IMG_ALPINE=alpine:3.22.7@sha256:2e0b81d60597f449baa56dc25d355367869d2dca4cd57e866f1e2b52af3eb55f
export IMG_PY=python:3.13.18-slim@sha256:76baad6037690d6e8c4397fbcaef17bca6f19eecef822b708fe8fa3417d30bb5
export IMG_JAVA=eclipse-temurin:21.0.13_9-jdk@sha256:ebfbb18d11ff163ee83b21258acf12248af48d22a0fdfdc68fa1a1516c05976a
export IMG_NODE=node:24.22.2-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85
export IMG_CURL=curlimages/curl:8.13.0@sha256:d43bdb28bae0be0998f3be83199bfb2b81e0a30b034b6d7586ce7e05de34c3fd
export NET=revlab
export VOL=revlab-data
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && (pwd -W 2>/dev/null || pwd))"
export CLIENTS="$HERE/clients"
# atalho: executa um cliente na rede do laboratorio, com o volume e os clientes montados
cl() { img=$1; shift; docker run --rm --network $NET -v $VOL:/lab:ro -v "$CLIENTS":/clients:ro "$img" "$@"; }
