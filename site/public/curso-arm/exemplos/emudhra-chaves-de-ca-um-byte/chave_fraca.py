"""Detecta chaves públicas EC (P-256/P-384) cuja chave privada é um inteiro pequeno.

Uso:
    python chave_fraca.py certificado.pem [...]    # certificados avulsos
    python chave_fraca.py --bundle cacert.pem      # todos os certificados de um bundle PEM

Imprime só se a chave é fraca; nunca o valor de d.
"""
import sys
import time

from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import ec

LIMITE_PADRAO = 2**16

# Parâmetros públicos das curvas NIST (FIPS 186-4, D.1.2): corpo primo p, ordem n e a = -3.
CURVAS = {
    "secp256r1": (ec.SECP256R1(),
                  0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF,
                  0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551),
    "secp384r1": (ec.SECP384R1(),
                  0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFFFF0000000000000000FFFFFFFF,
                  0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFC7634D81F4372DDF581A0DB248B0A77AECEC196ACCC52973),
}


def _somar(P, Q, p):
    """Soma de pontos afins P + Q (P != +-Q), na curva y^2 = x^3 - 3x + b."""
    lam = (Q[1] - P[1]) * pow(Q[0] - P[0], -1, p) % p
    x = (lam * lam - P[0] - Q[0]) % p
    return x, (lam * (P[0] - x) - P[1]) % p


def _dobrar(P, p):
    lam = (3 * P[0] * P[0] - 3) * pow(2 * P[1], -1, p) % p
    x = (lam * lam - 2 * P[0]) % p
    return x, (lam * (P[0] - x) - P[1]) % p


_tabelas = {}


def tabela(nome_curva, limite=LIMITE_PADRAO):
    """{x de d*G: d} para d = 1..limite. Calculada uma vez por curva (cerca de 1 s)."""
    chave = (nome_curva, limite)
    if chave not in _tabelas:
        curva, p, _ = CURVAS[nome_curva]
        g = ec.derive_private_key(1, curva).public_key().public_numbers()
        G = (g.x, g.y)
        P, tab = G, {G[0]: 1}
        for d in range(2, limite + 1):
            P = _dobrar(P, p) if d == 2 else _somar(P, G, p)
            tab[P[0]] = d
        _tabelas[chave] = tab
    return _tabelas[chave]


def escalar_fraco(chave_publica, limite=LIMITE_PADRAO):
    """Devolve o d (menor que `limite`, ou n - d) tal que d*G == chave pública; ou None.

    -d*G tem o mesmo x que d*G e o y espelhado, então testar o x cobre também
    os escalares "quase n", que são tão fracos quanto os pequenos.
    """
    nums = chave_publica.public_numbers()
    nome = chave_publica.curve.name
    d = tabela(nome, limite).get(nums.x)
    if d is None:
        return None
    curva, p, n = CURVAS[nome]
    esperado = ec.derive_private_key(d, curva).public_key().public_numbers()
    return d if esperado.y == nums.y else n - d


def verificar(cert, limite=LIMITE_PADRAO):
    """(fraca?, descrição) para um certificado."""
    chave = cert.public_key()
    if not isinstance(chave, ec.EllipticCurvePublicKey) or chave.curve.name not in CURVAS:
        return False, None
    d = escalar_fraco(chave, limite)
    if d is None:
        return False, chave.curve.name
    return True, f"{chave.curve.name}; escalar <= {limite}"


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    certs, rotulos = [], []
    for caminho in (argv[2:] if argv[1] == "--bundle" else argv[1:]):
        lidos = x509.load_pem_x509_certificates(open(caminho, "rb").read())
        certs += lidos
        rotulos += [c.subject.rfc4514_string()[:70] for c in lidos] if argv[1] == "--bundle" else [caminho] * len(lidos)
    ini = time.perf_counter()
    com_ec = fracos = 0
    for cert, rotulo in zip(certs, rotulos):
        fraca, info = verificar(cert)
        com_ec += info is not None
        if fraca:
            fracos += 1
            print(f"FRACA  {rotulo}  ({info})")
        elif info is not None and argv[1] != "--bundle":
            print(f"ok     {rotulo}  ({info}; nenhum escalar <= {LIMITE_PADRAO})")
    print(f"{len(certs)} certificado(s), {com_ec} com chave EC P-256/P-384, {fracos} fraca(s); "
          f"{time.perf_counter() - ini:.1f} s")
    return 1 if fracos else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
