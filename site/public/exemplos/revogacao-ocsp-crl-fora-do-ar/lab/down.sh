. "$(dirname "$0")/env.sh"
docker rm -f $(docker ps -aq --filter name=revlab-) >/dev/null 2>&1
docker network rm $NET >/dev/null 2>&1
docker volume rm $VOL >/dev/null 2>&1
echo "laboratorio removido"
