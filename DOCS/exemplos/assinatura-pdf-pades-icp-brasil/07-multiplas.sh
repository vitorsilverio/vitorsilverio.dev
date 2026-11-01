#!/bin/sh
# Duas assinaturas em sequencia (a segunda sobre a primeira) e uma certificacao (DocMDP).
set -u
. /lab/env.sh
cd /work
sobe_tsa
pyhanko sign addsig --field Sig2 --use-pades pemder $K out/bb.pdf out/duas.pdf
python /lab/inspect_pdf.py out/duas.pdf
pyhanko sign validate --executive-summary $TR out/duas.pdf 2>&1 | tail -3 | cut -c1-200
pyhanko sign addsig --field Cert1 --use-pades --certify pemder $K out/contrato.pdf out/certificado.pdf
pyhanko sign validate --pretty-print $TR out/certificado.pdf 2>&1 | sed -n '/Modifications/,$p'
derruba_tsa
