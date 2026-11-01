"""Anatomia de um PDF assinado: revisoes, ByteRange, /Contents e conferencia do digest.

Lê os bytes do arquivo, refaz o hash dos trechos cobertos pelo /ByteRange e compara com o
valor que está dentro da assinatura (message-digest no CMS, ou messageImprint no carimbo)."""
import hashlib, io, sys
from asn1crypto import cms, parser, tsp
from pyhanko.pdf_utils.reader import PdfFileReader

path = sys.argv[1]
data = open(path, "rb").read()
r = PdfFileReader(io.BytesIO(data))
print(f"== {path}: {len(data)} bytes, {data.count(b'%%EOF')} revisao(oes) (marcas %%EOF)")
if r.root.get("/DSS") is not None:
    print(f"   /DSS presente (primeiro '/DSS' no byte {data.find(b'/DSS')})")

for emb in r.embedded_signatures:
    sd = emb.sig_object
    a, b, c, d = (int(x) for x in sd["/ByteRange"])
    gap = data[b:c]                       # "<hex...>" : o valor de /Contents, com os delimitadores
    raw = bytes(sd["/Contents"])          # CMS DER + zeros de preenchimento
    _, _, _, hdr, body, trailer = parser.parse(raw)
    cms_len = len(hdr) + len(body) + len(trailer)
    kind = "DocTimeStamp" if str(sd.get("/Type")) == "/DocTimeStamp" else "Assinatura"
    info = cms.ContentInfo.load(raw[:cms_len])
    sdata = info["content"]
    algo = sdata["digest_algorithms"][0]["algorithm"].native
    covered = data[a:a + b] + data[c:c + d]
    calc = hashlib.new(algo, covered).digest()
    if kind == "DocTimeStamp":
        tst = sdata["encap_content_info"]["content"].parsed
        stored = tst["message_imprint"]["hashed_message"].native
        quem = "messageImprint do TSTInfo"
    else:
        si = sdata["signer_infos"][0]
        stored = next(x["values"][0].native for x in si["signed_attrs"] if x["type"].native == "message_digest")
        quem = "atributo message-digest"
    print(f"-- {emb.field_name} [{kind}] SubFilter={sd['/SubFilter']}")
    print(f"   ByteRange=[{a}, {b}, {c}, {d}]")
    print(f"   parte 1: bytes {a}..{a + b - 1} ({b} bytes) | lacuna: bytes {b}..{c - 1} ({c - b} bytes, '<'+hex+'>') | parte 2: bytes {c}..{c + d - 1} ({d} bytes)")
    print(f"   /Contents: {(c - b - 2) // 2} bytes reservados, {cms_len} bytes de CMS DER, resto zeros")
    print(f"   cobre ate o fim do arquivo: {c + d == len(data)} (ate o byte {c + d} de {len(data)})")
    print(f"   hash {algo} das duas partes == {quem}: {calc == stored}")
    # Chave do /VRI: SHA-1 do valor de /Contents, em hexadecimal maiusculo (com e sem o preenchimento de zeros)
    print(f"   SHA-1 de /Contents: {hashlib.sha1(raw).hexdigest().upper()} (inteiro) | {hashlib.sha1(raw[:cms_len]).hexdigest().upper()} (so o CMS)")
