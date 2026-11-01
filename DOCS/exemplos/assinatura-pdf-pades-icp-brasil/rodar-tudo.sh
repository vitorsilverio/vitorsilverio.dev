#!/bin/sh
# Executa o laboratorio inteiro dentro do contêiner. Uso (desta pasta):
#   docker build -t lab-pades:2 .
#   docker run --rm -v "$PWD":/lab:ro -v lab-work:/work lab-pades:2 sh /lab/rodar-tudo.sh
set -eu
rm -rf /work/pki /work/out; mkdir -p /work/out
sh /lab/pki.sh >/dev/null 2>&1
for s in 02-niveis 03-anatomia 04-validacao 05-vencimento 06-assinatura-externa 07-multiplas; do
  echo; echo "################ $s"; sh /lab/$s.sh
done
