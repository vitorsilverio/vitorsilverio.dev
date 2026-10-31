import socket, ssl, sys, time

def tentar(rotulo, host, crl=None, flags=0):
    ctx = ssl.create_default_context(cafile="/lab/ca/root.pem")
    if crl:
        ctx.load_verify_locations(cafile=f"/lab/ca/{crl}.crl")
    ctx.verify_flags |= flags
    try:
        with socket.create_connection((host, 9443), timeout=10) as s:
            with ctx.wrap_socket(s, server_hostname="servidor.lab.invalid"):
                print(f"{rotulo:52} ACEITOU")
    except ssl.SSLError as e:
        print(f"{rotulo:52} REJEITOU {e.reason}: {str(e).split('] ')[-1][:70]}")

print("Python", sys.version.split()[0], ssl.OPENSSL_VERSION)
print("verify_flags do contexto padrao:", ssl.create_default_context().verify_flags)
L = ssl.VERIFY_CRL_CHECK_LEAF
tentar("padrao, certificado bom", "srv-good.lab.invalid")
tentar("padrao, certificado REVOGADO", "srv-rev.lab.invalid")
tentar("CRL_CHECK_LEAF + CRL atual, bom", "srv-good.lab.invalid", "ca", L)
tentar("CRL_CHECK_LEAF + CRL atual, REVOGADO", "srv-rev.lab.invalid", "ca", L)
tentar("CRL_CHECK_LEAF sem nenhuma CRL carregada, bom", "srv-good.lab.invalid", None, L)
tentar("CRL_CHECK_LEAF + CRL antiga, REVOGADO", "srv-rev.lab.invalid", "ca-antiga", L)
tentar("CRL_CHECK_LEAF + CRL expirada, bom", "srv-good.lab.invalid", "ca-expirada", L)
