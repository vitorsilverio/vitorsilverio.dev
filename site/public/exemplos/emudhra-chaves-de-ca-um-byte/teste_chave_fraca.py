"""Confere a tabela e escalar_fraco contra derive_private_key da biblioteca."""
from cryptography.hazmat.primitives.asymmetric import ec

import chave_fraca as cf

for nome, (curva, p, n) in cf.CURVAS.items():
    for d in (1, 2, 3, 7, 255, 256, 65535, 65536, n - 7, 65537, 2**200 + 12345):
        pub = ec.derive_private_key(d, curva).public_key()
        achado = cf.escalar_fraco(pub)
        esperado = d if d <= 65536 or d >= n - 65536 else None
        assert achado == esperado, (nome, d, achado, esperado)
    # chaves aleatórias nunca são fracas
    for _ in range(20):
        assert cf.escalar_fraco(ec.generate_private_key(curva).public_key()) is None
print("ok: tabela confere com derive_private_key em P-256 e P-384")
