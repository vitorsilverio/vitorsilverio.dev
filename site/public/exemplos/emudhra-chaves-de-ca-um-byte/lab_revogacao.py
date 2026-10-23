"""Laboratório local: um cliente TLS consulta revogação por padrão?

Monta, em memória e num diretório temporário, uma hierarquia FICTÍCIA
(raiz -> intermediária -> servidor.lab.invalid), todas com chaves aleatórias
normais, revoga a intermediária numa CRL da raiz e sobe um servidor TLS em
127.0.0.1. Depois conecta com um cliente Python padrão e com um configurado
para checar a CRL. Nada aqui usa domínio real nem chave fraca.

Uso:
    python lab_revogacao.py              # roda o teste Python e termina
    python lab_revogacao.py --servir DIR # grava os arquivos em DIR e serve até Ctrl+C
"""
import datetime
import socket
import ssl
import sys
import tempfile
import threading
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

NOME = "servidor.lab.invalid"      # .invalid é reservado (RFC 2606): nunca resolve na internet
HOJE = datetime.datetime(2026, 10, 1, tzinfo=datetime.timezone.utc)


def nome(cn):
    return x509.Name([x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Laboratorio Ficticio"),
                      x509.NameAttribute(NameOID.COMMON_NAME, cn)])


def emitir(sujeito, chave_sujeito, emissor, chave_emissor, ca, dias=90):
    b = (x509.CertificateBuilder().subject_name(sujeito).issuer_name(emissor)
         .public_key(chave_sujeito.public_key()).serial_number(x509.random_serial_number())
         .not_valid_before(HOJE).not_valid_after(HOJE + datetime.timedelta(days=dias)))
    if ca:
        b = b.add_extension(x509.BasicConstraints(ca=True, path_length=None if emissor == sujeito else 0), True)
        b = b.add_extension(x509.KeyUsage(False, False, False, False, False, True, True, False, False), True)
    else:
        b = b.add_extension(x509.BasicConstraints(ca=False, path_length=None), True)
        b = b.add_extension(x509.SubjectAlternativeName([x509.DNSName(NOME)]), False)
        b = b.add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), False)
    return b.sign(chave_emissor, hashes.SHA384())


def montar(destino: Path):
    k_raiz, k_int, k_folha = (ec.generate_private_key(ec.SECP384R1()) for _ in range(3))
    raiz = emitir(nome("Raiz de Laboratorio"), k_raiz, nome("Raiz de Laboratorio"), k_raiz, True)
    inter = emitir(nome("Intermediaria de Laboratorio"), k_int, raiz.subject, k_raiz, True)
    folha = emitir(nome(NOME), k_folha, inter.subject, k_int, False)
    crl = (x509.CertificateRevocationListBuilder().issuer_name(raiz.subject)
           .last_update(HOJE).next_update(HOJE + datetime.timedelta(days=365))
           .add_revoked_certificate(x509.RevokedCertificateBuilder()
               .serial_number(inter.serial_number).revocation_date(HOJE)
               .add_extension(x509.CRLReason(x509.ReasonFlags.ca_compromise), False).build())
           .sign(k_raiz, hashes.SHA384()))
    crl_int = (x509.CertificateRevocationListBuilder().issuer_name(inter.subject)
               .last_update(HOJE).next_update(HOJE + datetime.timedelta(days=365))
               .sign(k_int, hashes.SHA384()))      # vazia: o servidor não foi revogado
    pem = serialization.Encoding.PEM
    (destino / "raiz.pem").write_bytes(raiz.public_bytes(pem))
    (destino / "cadeia.pem").write_bytes(folha.public_bytes(pem) + inter.public_bytes(pem))
    # a checagem de cadeia exige uma CRL para CADA emissor; por isso são duas, num só arquivo
    (destino / "crls.pem").write_bytes(crl.public_bytes(pem) + crl_int.public_bytes(pem))
    (destino / "folha.key").write_bytes(k_folha.private_bytes(
        pem, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    return destino


def servidor(destino: Path, porta=0):
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(destino / "cadeia.pem", destino / "folha.key")
    s = socket.socket()
    s.bind(("127.0.0.1", porta))
    s.listen()

    def laco():
        while True:
            try:
                c, _ = s.accept()
                with ctx.wrap_socket(c, server_side=True) as t:
                    t.recv(1024)
                    t.sendall(b"HTTP/1.0 200 OK\r\nContent-Length: 31\r\n\r\n"
                              b"ola do servidor de laboratorio\n")
                    t.unwrap()
            except (ssl.SSLError, OSError):
                pass
    threading.Thread(target=laco, daemon=True).start()
    return s.getsockname()[1]


def cliente(destino: Path, porta, checar_crl):
    ctx = ssl.create_default_context(cafile=str(destino / "raiz.pem"))
    if checar_crl:
        ctx.load_verify_locations(cafile=str(destino / "crls.pem"))
        ctx.verify_flags |= ssl.VERIFY_CRL_CHECK_CHAIN
    try:
        with socket.create_connection(("127.0.0.1", porta)) as c, \
                ctx.wrap_socket(c, server_hostname=NOME) as t:
            t.sendall(b"GET / HTTP/1.0\r\n\r\n")
            return "ACEITOU  " + t.recv(100).decode().splitlines()[0]
    except ssl.SSLCertVerificationError as e:
        return "REJEITOU " + e.verify_message


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--servir":
        d = Path(sys.argv[2]); d.mkdir(parents=True, exist_ok=True)
        montar(d)
        p = servidor(d, 8443)
        print(f"servindo {NOME} em 127.0.0.1:{p}; arquivos em {d}", flush=True)
        threading.Event().wait()
    with tempfile.TemporaryDirectory() as tmp:
        d = montar(Path(tmp))
        p = servidor(d)
        print("cliente Python padrão          :", cliente(d, p, False))
        print("cliente Python com as CRLs     :", cliente(d, p, True))
