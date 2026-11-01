set -eu
mkdir -p /work/pki && cd /work/pki
# CA raiz de teste
openssl req -x509 -newkey rsa:3072 -nodes -keyout ca.key -out ca.pem -days 3650 -sha256 \
  -subj "/C=BR/O=Laboratorio PAdES/CN=CA Raiz de Teste" \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign"
# certificado do signatario
openssl req -newkey rsa:2048 -nodes -keyout signer.key -out signer.csr -subj "/C=BR/O=Laboratorio PAdES/CN=Fulano de Tal (teste)"
printf "basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature,nonRepudiation
extendedKeyUsage=emailProtection
crlDistributionPoints=URI:http://127.0.0.1:8318/ca.crl
" > signer.ext
openssl x509 -req -in signer.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out signer.pem -days 365 -sha256 -extfile signer.ext
# certificado da TSA (EKU timeStamping critica, exigida pela RFC 3161)
openssl req -newkey rsa:2048 -nodes -keyout tsa.key -out tsa.csr -subj "/C=BR/O=Laboratorio PAdES/CN=TSA de Teste"
printf "basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature
extendedKeyUsage=critical,timeStamping
crlDistributionPoints=URI:http://127.0.0.1:8318/ca.crl
" > tsa.ext
openssl x509 -req -in tsa.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out tsa.pem -days 365 -sha256 -extfile tsa.ext
cat > tsa.cnf <<'CNF'
[tsa]
default_tsa = tsa_config
[tsa_config]
dir = /work/pki
serial = $dir/tsa.serial
signer_cert = $dir/tsa.pem
signer_key = $dir/tsa.key
certs = $dir/ca.pem
signer_digest = sha256
default_policy = 1.2.3.4.1
digests = sha256, sha512
accuracy = secs:1
ordering = no
tsa_name = yes
ess_cert_id_chain = no
ess_cert_id_alg = sha256
CNF
echo 01 > tsa.serial
# CRL vazia da CA de teste (openssl ca -gencrl precisa de um "banco" minimo)
: > index.txt; echo 01 > crlnumber
cat > ca.cnf <<'CNF'
[ca]
default_ca = CA_default
[CA_default]
database = /work/pki/index.txt
crlnumber = /work/pki/crlnumber
default_md = sha256
default_crl_days = 30
CNF
openssl ca -config ca.cnf -gencrl -keyfile ca.key -cert ca.pem -out ca.crl.pem
openssl crl -in ca.crl.pem -outform DER -out ca.crl
ls
