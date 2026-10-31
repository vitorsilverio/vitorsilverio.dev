# Staple com validade de 1 minuto; o curl testa antes, 30 s depois e ~5 min depois do nextUpdate.
. "$(dirname "$0")/env.sh"
docker rm -f revlab-st-stale >/dev/null 2>&1
T0=$(docker run --rm -v $VOL:/lab $IMG_ALPINE sh -c 'apk add --no-cache openssl >/dev/null; cd /lab/ca
  openssl ocsp -issuer root.pem -cert srv-good.pem -reqout stale.req >/dev/null 2>&1
  openssl ocsp -index index.txt -rsigner root.pem -rkey root.key -CA root.pem -reqin stale.req -respout stale.resp -nmin 1 >/dev/null 2>&1
  date +%s')
docker run -d --name revlab-st-stale --network $NET --network-alias st-stale.lab.invalid -v $VOL:/lab:ro $IMG_ALPINE \
  sh -c "apk add --no-cache openssl >/dev/null; cd /lab/ca; exec openssl s_server -www -accept 9443 -cert srv-good.pem -key srv-good.key -cert_chain root.pem -status_file /lab/ca/stale.resp" >/dev/null
t() { # segundos apos o nextUpdate (nextUpdate = T0 + 60)
  alvo=$((T0 + 60 + $1)); agora=$(date +%s); [ $alvo -gt $agora ] && sleep $((alvo - agora))
  d=$(( $(date +%s) - T0 - 60 ))
  printf 'nextUpdate %+5d s  ' $d
  docker run --rm --network $NET -v $VOL:/lab:ro -v "$CLIENTS":/clients:ro --entrypoint sh $IMG_CURL /clients/curl.sh "--cert-status" st-stale --cert-status
}
t -20; t 30; t 330
docker rm -f revlab-st-stale >/dev/null
