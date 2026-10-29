set -e
python3 -m venv /tmp/v >/dev/null && /tmp/v/bin/pip install -q pyperformance 2>&1 | tail -1 || true
for m in 0 1; do PYTHON_JIT=$m /tmp/v/bin/pyperformance run --python=/opt/py/bin/python3 --inherit-environ=PYTHON_JIT --fast -b richards,nbody,spectral_norm -o /tmp/j$m.json > /tmp/run$m.log 2>&1 || { tail -5 /tmp/run$m.log; exit 1; }; done
/tmp/v/bin/python -m pyperf compare_to /tmp/j0.json /tmp/j1.json --table
/tmp/v/bin/pyperformance --version 2>&1 | head -1; /tmp/v/bin/pip list 2>/dev/null | grep -i "pyperf"
