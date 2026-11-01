"""Mostra o que ha dentro de cada assinatura de um PDF (nivel PAdES aproximado)."""
import sys
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.sign.validation import pdf_embedded
from asn1crypto import cms

with open(sys.argv[1], "rb") as fh:
    r = PdfFileReader(fh)
    root = r.root
    dss = root.get("/DSS")
    print("== arquivo:", sys.argv[1])
    for emb in r.embedded_signatures:
        sd = emb.sig_object
        br = list(sd["/ByteRange"])
        sub = str(sd["/SubFilter"])
        contents = sd["/Contents"]
        si = emb.signer_info
        signed = {a["type"].native for a in si["signed_attrs"]}
        unsigned = {a["type"].native for a in (si["unsigned_attrs"] or [])}
        kind = "DocTimeStamp" if sd.get("/Type") == "/DocTimeStamp" else "Sig"
        print(f"- {emb.field_name} [{kind}] SubFilter={sub} ByteRange={br}")
        print(f"  /Contents={len(contents)} bytes (CMS DER + padding)")
        if kind == "Sig":
            print(f"  signed attrs: {sorted(signed)}")
            print(f"  unsigned attrs: {sorted(unsigned)}")
    if dss is not None:
        d = dss.get_object() if hasattr(dss, "get_object") else dss
        print("DSS keys:", sorted(k for k in d.keys()))
        for k in ("/Certs", "/CRLs", "/OCSPs"):
            if k in d:
                print(f"  {k}: {len(d[k])} item(s)")
        if "/VRI" in d:
            print("  /VRI entries:", len(d["/VRI"]))
    else:
        print("sem /DSS")
