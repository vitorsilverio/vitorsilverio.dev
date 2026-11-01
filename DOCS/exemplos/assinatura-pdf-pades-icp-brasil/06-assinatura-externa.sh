#!/bin/sh
# Assinatura com a chave "remota": so o hash dos atributos assinados sai do servidor.
set -u
. /lab/env.sh
cd /work
sobe_tsa
python /lab/external_sign.py
python /lab/inspect_pdf.py out/externo.pdf
pyhanko sign validate --executive-summary $TR out/externo.pdf 2>&1 | tail -2 | cut -c1-200
derruba_tsa
