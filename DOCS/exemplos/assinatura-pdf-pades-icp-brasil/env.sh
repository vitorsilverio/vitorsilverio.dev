# Variaveis comuns aos scripts (use com: . /lab/env.sh)
K="--key /work/pki/signer.key --cert /work/pki/signer.pem --no-pass"
T="--timestamp-url http://127.0.0.1:8318/"
TR="--trust /work/pki/ca.pem --trust-replace"
sobe_tsa() { python /lab/tsa_server.py 2>/work/out/tsa.log & TSA=$!; sleep 1; }
derruba_tsa() { kill "$TSA" 2>/dev/null || true; wait "$TSA" 2>/dev/null || true; }
