# Roda DENTRO do alpine (volume em /lab): CA de teste, certificados, CRLs e respostas OCSP.
set -e
apk add --no-cache openssl >/dev/null
openssl version
cd /lab
rm -rf ca && mkdir -p ca/newcerts && cd ca
touch index.txt; echo 1000 > serial; echo 1000 > crlnumber
cat > openssl.cnf <<CNF
[ca]
default_ca = CA_default
[CA_default]
dir = /lab/ca
database = \$dir/index.txt
new_certs_dir = \$dir/newcerts
serial = \$dir/serial
crlnumber = \$dir/crlnumber
default_md = sha256
default_days = 30
default_crl_days = 7
policy = pol
unique_subject = no
[pol]
commonName = supplied
[req]
distinguished_name = dn
prompt = no
[dn]
CN = Raiz de Laboratorio
[v3_ca]
basicConstraints = critical,CA:TRUE
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
[v3_srv]
basicConstraints = CA:FALSE
keyUsage = digitalSignature
extendedKeyUsage = serverAuth
subjectAltName = DNS:servidor.lab.invalid
authorityInfoAccess = OCSP;URI:http://ocsp.lab.invalid:2560
crlDistributionPoints = URI:http://crl.lab.invalid:8080/ca.crl
CNF
CA="-batch -config openssl.cnf -cert root.pem -keyfile root.key"
openssl ecparam -name prime256v1 -genkey -noout -out root.key
openssl req -new -x509 -key root.key -out root.pem -days 30 -config openssl.cnf -extensions v3_ca
for n in srv-good srv-revoked; do
  openssl ecparam -name prime256v1 -genkey -noout -out $n.key
  openssl req -new -key $n.key -out $n.csr -subj "/CN=servidor.lab.invalid" -config openssl.cnf
  openssl ca $CA -in $n.csr -out $n.pem -extensions v3_srv -notext 2>/dev/null
done
# CRL "antiga": gerada antes de revogar o segundo certificado
openssl ca $CA -gencrl -out ca-antiga.crl 2>/dev/null
# revoga o segundo certificado e gera a CRL atual
openssl ca $CA -revoke srv-revoked.pem -crl_reason keyCompromise 2>/dev/null
openssl ca $CA -gencrl -out ca.crl 2>/dev/null
# CRL expirada (nextUpdate no passado)
cp index.txt index.real
openssl ca $CA -gencrl -crl_lastupdate 20260901000000Z -crl_nextupdate 20261001000000Z -out ca-expirada.crl 2>/dev/null
echo "--- index.txt (V = valido, R = revogado)"; cat index.txt
for f in ca-antiga ca ca-expirada; do
  echo "--- $f.crl"; openssl crl -in $f.crl -noout -lastupdate -nextupdate
  echo "entradas revogadas: $(openssl crl -in $f.crl -noout -text | grep -c 'Serial Number')"
done
# respostas OCSP prontas para grampear (staple)
mk(){ openssl ocsp -issuer root.pem -cert $2.pem -reqout $1.req >/dev/null 2>&1
      openssl ocsp -index index.txt -rsigner root.pem -rkey root.key -CA root.pem -reqin $1.req -respout $1.resp $3 $4 >/dev/null 2>&1; }
mk good srv-good -ndays 1
mk revoked srv-revoked -ndays 1
echo "ca/ pronta"
