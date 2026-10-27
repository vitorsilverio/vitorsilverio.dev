"""Inventário defensivo: os pacotes Brotli/brotlicffi instalados têm a correção do CVE-2026-111497?

Só consulta metadados dos pacotes; não descomprime nada.
Corrigidos: Brotli >= 1.2.1 e brotlicffi >= 1.2.1.0.
"""
from importlib.metadata import PackageNotFoundError, version

CORRIGIDO = {"brotli": (1, 2, 1), "brotlicffi": (1, 2, 1, 0)}


def como_tupla(texto: str) -> tuple[int, ...]:
    partes = []
    for pedaco in texto.split("."):
        digitos = "".join(c for c in pedaco if c.isdigit())
        if not digitos:
            break
        partes.append(int(digitos))
    return tuple(partes)


status = 0
for nome, minimo in CORRIGIDO.items():
    try:
        instalada = version(nome)
    except PackageNotFoundError:
        print(f"{nome:<11} nao instalado")
        continue
    ok = como_tupla(instalada) >= minimo
    minimo_txt = ".".join(map(str, minimo))
    print(f"{nome:<11} {instalada:<8} {'corrigido' if ok else 'VULNERAVEL (atualize para >= ' + minimo_txt + ')'}")
    status |= 0 if ok else 1
raise SystemExit(status)
