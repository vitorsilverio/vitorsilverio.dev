#!/bin/sh
# ByteRange, /Contents e conferencia do hash, nos niveis B-B e B-LTA.
set -eu
cd /work
for f in bb blta; do python /lab/anatomia.py out/$f.pdf; done
python /lab/dicionarios.py out/blta.pdf
