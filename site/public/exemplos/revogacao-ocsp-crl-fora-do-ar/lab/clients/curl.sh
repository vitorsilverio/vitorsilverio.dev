# uso: curl.sh <rotulo> <host> [opcoes do curl...]
L=$1; H=$2; shift 2
printf '%-52s ' "$L"
out=$(curl -sS -m 20 --cacert /lab/ca/root.pem --connect-to servidor.lab.invalid:9443:$H.lab.invalid:9443 "$@" https://servidor.lab.invalid:9443/ -o /dev/null -w 'HTTP %{http_code}' 2>&1 | tr '\n' ' ')
echo "$out" | cut -c1-120
