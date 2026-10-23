"""Gera dois certificados autoassinados de laboratório (nome fictício, nenhum domínio real).

lab-fraca.pem   : P-384 com escalar privado d = 7        (propositalmente fraca)
lab-normal.pem  : P-384 com chave aleatória de verdade    (o que deveria ser)
"""
import datetime

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID


def autoassinado(chave, nome):
    sujeito = x509.Name([
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Laboratorio Ficticio"),
        x509.NameAttribute(NameOID.COMMON_NAME, nome),
    ])
    agora = datetime.datetime(2026, 10, 22, tzinfo=datetime.timezone.utc)
    return (
        x509.CertificateBuilder()
        .subject_name(sujeito).issuer_name(sujeito)
        .public_key(chave.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(agora).not_valid_after(agora + datetime.timedelta(days=30))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .add_extension(x509.KeyUsage(True, False, False, False, False, True, True, False, False), critical=True)
        .sign(chave, hashes.SHA384())
    )


def salvar(cert, caminho):
    with open(caminho, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))


salvar(autoassinado(ec.derive_private_key(7, ec.SECP384R1()), "CA de Laboratorio Fraca"), "lab-fraca.pem")
salvar(autoassinado(ec.generate_private_key(ec.SECP384R1()), "CA de Laboratorio Normal"), "lab-normal.pem")
print("gerados: lab-fraca.pem, lab-normal.pem")
