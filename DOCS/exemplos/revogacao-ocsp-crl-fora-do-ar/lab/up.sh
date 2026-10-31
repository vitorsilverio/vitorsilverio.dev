# Sobe rede, responder OCSP, servidor de CRL e os servidores TLS (staple bom, revogado, vencido, ausente).
. "$(dirname "$0")/env.sh"
docker network inspect $NET >/dev/null 2>&1 || docker network create $NET >/dev/null
docker volume inspect $VOL >/dev/null 2>&1 || docker volume create $VOL >/dev/null
docker rm -f revlab-ocsp revlab-crl revlab-srv-good revlab-srv-rev revlab-st-good revlab-st-rev revlab-st-stale >/dev/null 2>&1
docker run --rm -v $VOL:/lab -v "$HERE/gen.sh":/gen.sh:ro $IMG_ALPINE sh /gen.sh
# responder OCSP (openssl ocsp), CRL por HTTP e servidores TLS
docker run -d --name revlab-ocsp --network $NET --network-alias ocsp.lab.invalid -v $VOL:/lab:ro $IMG_ALPINE \
  sh -c 'apk add --no-cache openssl >/dev/null; cd /lab/ca; exec openssl ocsp -index index.txt -port 2560 -rsigner root.pem -rkey root.key -CA root.pem -ndays 1' >/dev/null
docker run -d --name revlab-crl --network $NET --network-alias crl.lab.invalid -v $VOL:/lab:ro $IMG_PY \
  sh -c 'cd /lab/ca; exec python -m http.server 8080' >/dev/null
tls() { # nome cert [arquivo-staple]
  extra=""; [ -n "$3" ] && extra="-status_file /lab/ca/$3"
  docker run -d --name revlab-$1 --network $NET --network-alias $1.lab.invalid -v $VOL:/lab:ro $IMG_ALPINE \
    sh -c "apk add --no-cache openssl >/dev/null; cd /lab/ca; exec openssl s_server -www -accept 9443 -cert $2.pem -key $2.key -cert_chain root.pem $extra" >/dev/null
}
tls srv-good srv-good
tls srv-rev srv-revoked
tls st-good srv-good good.resp
tls st-rev srv-revoked revoked.resp
sleep 6
docker ps --filter name=revlab- --format '{{.Names}}\t{{.Status}}'
