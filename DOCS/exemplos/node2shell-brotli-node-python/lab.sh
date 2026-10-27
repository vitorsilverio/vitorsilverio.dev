#!/usr/bin/env sh
# Laboratório defensivo do CVE-2026-111497. Tudo roda em contêineres descartáveis;
# nada é instalado no host.
# Uso (na pasta deste arquivo): sh lab.sh
set -u
EX="$(pwd)"
[ -n "${MSYS_NO_PATHCONV+x}" ] || export MSYS_NO_PATHCONV=1
command -v pwd >/dev/null && EX="$( (pwd -W 2>/dev/null) || pwd )"

for tag in 24.22.0-slim 24.22.1-slim; do
  echo "=== node:$tag"
  docker run --rm -v "$EX:/ex:ro" "node:$tag" node /ex/verifica-node.mjs
  echo "rc=$?"
done

echo "=== node:24.22.1-slim: npm ls em projeto vazio"
docker run --rm node:24.22.1-slim sh -c 'cd /tmp && echo "{\"name\":\"x\",\"version\":\"1.0.0\"}" > package.json && npm ls --all; npm ls --all | grep -i -E "brotli|body-parser|express|undici"; echo "grep rc=$?"; node -p "process.versions.brotli"'

echo "=== python:3.12-slim sem brotli (so urllib3)"
docker run --rm python:3.12-slim sh -c 'pip install -q --root-user-action=ignore urllib3 >/dev/null 2>&1; python -V; python -c "import urllib3.util.request as r; print(r.ACCEPT_ENCODING)"'

echo "=== python:3.12-slim com brotli==1.2.0"
docker run --rm -v "$EX:/ex:ro" python:3.12-slim sh -c 'pip install -q --root-user-action=ignore urllib3 "brotli==1.2.0" >/dev/null 2>&1; pip list 2>/dev/null | grep -i -E "urllib3|brotli"; python /ex/verifica_python.py; echo "rc=$?"; python -c "import urllib3.util.request as r; print(r.ACCEPT_ENCODING)"'

echo "=== python:3.12-slim com brotli>=1.2.1"
docker run --rm -v "$EX:/ex:ro" python:3.12-slim sh -c 'pip install -q --root-user-action=ignore urllib3 "brotli>=1.2.1" >/dev/null 2>&1; pip list 2>/dev/null | grep -i -E "urllib3|brotli"; python /ex/verifica_python.py; echo "rc=$?"'
