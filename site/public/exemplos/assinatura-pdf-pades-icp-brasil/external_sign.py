"""Assinatura 'deferred': o PDF e preparado aqui, so o hash dos atributos assinados
vai para o 'HSM' (aqui simulado com a chave em arquivo), e o CMS e montado de volta."""
import asyncio, io
from asn1crypto import pem, x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.sign import signers, fields
from pyhanko.sign.general import load_cert_from_pemder
from pyhanko_certvalidator.registry import SimpleCertificateStore

cert = load_cert_from_pemder("/work/pki/signer.pem")
ca = load_cert_from_pemder("/work/pki/ca.pem")
key = serialization.load_pem_private_key(open("/work/pki/signer.key", "rb").read(), None)

async def main():
    reg = SimpleCertificateStore(); reg.register(ca)
    ext = signers.ExternalSigner(signing_cert=cert, cert_registry=reg, signature_value=256)
    meta = signers.PdfSignatureMetadata(field_name="Sig1", subfilter=fields.SigSeedSubFilter.PADES)
    with open("/work/out/contrato.pdf", "rb") as fh:
        w = IncrementalPdfFileWriter(fh)
        fields.append_signature_field(w, fields.SigFieldSpec("Sig1"))
        pdf_signer = signers.PdfSigner(meta, signer=ext)
        prep, tbs, out = await pdf_signer.async_digest_doc_for_signing(w)
    # ---- lado do cliente: so isto vai ao HSM ----
    attrs = await ext.signed_attrs(prep.document_digest, "sha256", use_pades=True)
    to_sign = attrs.dump()
    print("bytes enviados ao 'HSM':", len(to_sign), "(nao e o PDF)")
    sig = key.sign(to_sign, padding.PKCS1v15(), hashes.SHA256())
    # ---- volta ao servidor ----
    ext2 = signers.ExternalSigner(signing_cert=cert, cert_registry=reg, signature_value=sig)
    cms = await ext2.async_sign_prescribed_attributes("sha256", signed_attrs=attrs)
    prep.fill_with_cms(out, cms)
    open("/work/out/externo.pdf", "wb").write(out.getbuffer() if hasattr(out, "getbuffer") else out.read())

asyncio.run(main())
