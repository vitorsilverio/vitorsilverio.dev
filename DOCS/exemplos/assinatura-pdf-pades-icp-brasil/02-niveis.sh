#!/bin/sh
# Assina o mesmo PDF nos quatro niveis PAdES e mostra o que ha dentro de cada um.
set -eu
. /lab/env.sh
mkdir -p /work/out && cd /work
python /lab/mkpdf.py
sobe_tsa
pyhanko sign addsig --field Sig1 --use-pades pemder $K out/contrato.pdf out/bb.pdf
pyhanko sign addsig --field Sig1 --use-pades $T pemder $K out/contrato.pdf out/bt.pdf
pyhanko sign addsig --field Sig1 --use-pades $T --with-validation-info $TR pemder $K out/contrato.pdf out/blt.pdf
cp out/blt.pdf out/blta.pdf
pyhanko sign ltaupdate $T $TR out/blta.pdf
pyhanko sign addsig --field Sig1 --use-pades-lta $T $TR pemder $K out/contrato.pdf out/blta_direto.pdf
derruba_tsa
for f in bb bt blt blta blta_direto; do python /lab/inspect_pdf.py out/$f.pdf; done
