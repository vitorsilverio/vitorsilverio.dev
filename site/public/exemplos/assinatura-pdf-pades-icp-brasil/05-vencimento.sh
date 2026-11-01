#!/bin/sh
# Certificado de vida curta (20 s): assina em B-T e B-LT, espera vencer, desliga TSA/CRL e valida.
set -u
. /lab/env.sh
cd /work/pki
sobe_tsa
NB=$(date -u -d '-1 hour' +%Y%m%d%H%M%SZ); NA=$(date -u -d '+20 seconds' +%Y%m%d%H%M%SZ)
openssl req -newkey rsa:2048 -nodes -keyout curto.key -out curto.csr -subj "/C=BR/O=Laboratorio PAdES/CN=Cert de vida curta" 2>/dev/null
openssl x509 -req -in curto.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out curto.pem -sha256 -extfile signer.ext -not_before $NB -not_after $NA 2>&1 | tail -1
openssl x509 -in curto.pem -noout -dates
cd /work
KC="--key /work/pki/curto.key --cert /work/pki/curto.pem --no-pass"
pyhanko sign addsig --field Sig1 --use-pades $T pemder $KC out/contrato.pdf out/curto_bt.pdf
pyhanko sign addsig --field Sig1 --use-pades $T --with-validation-info $TR pemder $KC out/contrato.pdf out/curto_blt.pdf
echo "assinado em: $(date -u)"; sleep 60; derruba_tsa
echo "agora:       $(date -u) (certificado do signatario ja venceu; TSA e CRL desligadas)"
for f in curto_bt curto_blt; do echo "######## $f"; pyhanko sign adesverify $TR out/$f.pdf 2>&1 | grep -v '^$' | cut -c1-230 | tail -8; done
echo "######## de novo, agora com a CRL e a TSA de volta ao ar"
sobe_tsa
for f in curto_bt curto_blt; do
  echo "--- $f: sign validate (valida 'agora')"; pyhanko sign validate --executive-summary $TR out/$f.pdf 2>&1 | tail -2 | cut -c1-230
  echo "--- $f: adesverify (valida no instante provado)"; pyhanko sign adesverify $TR out/$f.pdf 2>&1 | tail -2 | cut -c1-230
done
derruba_tsa
