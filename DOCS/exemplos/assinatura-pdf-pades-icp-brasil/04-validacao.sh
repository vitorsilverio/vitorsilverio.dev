#!/bin/sh
# Valida os quatro niveis: com CRL disponivel (sign validate) e offline com analise LTV (adesverify).
set -u
. /lab/env.sh
cd /work
sobe_tsa
for f in bb bt blt blta; do echo "######## $f (sign validate, CRL online)"; pyhanko sign validate --executive-summary $TR out/$f.pdf 2>&1 | tail -3 | cut -c1-230; done
derruba_tsa
for f in bb bt blt blta; do echo "######## $f (adesverify, tudo offline)"; pyhanko sign adesverify $TR out/$f.pdf 2>&1 | grep -v '^$' | cut -c1-230 | tail -14; done
