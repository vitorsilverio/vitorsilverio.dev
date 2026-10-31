# Orquestra a matriz: muda o estado dos responders e roda os clientes. Uso: cenarios.sh <noar|parado|travado|doistravados|unidade|py|node|curl>  (staple vencido: bash staple-vencido.sh)
. "$(dirname "$0")/env.sh"
JV="docker run --rm --network $NET -v $VOL:/lab:ro -v $CLIENTS:/clients:ro $IMG_JAVA sh /clients/java-conjunto.sh"
case "$1" in
 noar)    $JV noar ;;
 parado)  docker stop revlab-ocsp revlab-crl >/dev/null; $JV parado; docker start revlab-ocsp revlab-crl >/dev/null; sleep 3 ;;
 travado) docker pause revlab-ocsp >/dev/null; $JV travado; docker unpause revlab-ocsp >/dev/null ;;
 doistravados) docker pause revlab-ocsp revlab-crl >/dev/null; $JV doistravados; docker unpause revlab-ocsp revlab-crl >/dev/null ;;
 unidade) docker pause revlab-ocsp >/dev/null; $JV unidade; docker unpause revlab-ocsp >/dev/null ;;
 py)      cl $IMG_PY python /clients/py.py ;;
 node)    cl $IMG_NODE node /clients/nd.js ;;
 curl)    docker run --rm --network $NET -v $VOL:/lab:ro -v "$CLIENTS":/clients:ro --entrypoint sh $IMG_CURL /clients/curl-matriz.sh ;;
esac
