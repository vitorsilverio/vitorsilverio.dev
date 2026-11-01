"""Mostra o texto cru dos objetos de assinatura e do /DSS de um PDF, com o hex de /Contents abreviado,
e onde terminam as revisoes (cada '%%EOF' fecha uma revisao)."""
import re, sys

data = open(sys.argv[1], "rb").read()
eofs = [m.end() for m in re.finditer(rb"%%EOF\r?\n?", data)]
print("revisoes terminam nos bytes:", eofs, f"(arquivo tem {len(data)} bytes)")

def abrevia(b):
    b = re.sub(rb"/Contents\s*<([0-9A-Fa-f]+)>",
               lambda m: b"/Contents <" + m.group(1)[:16] + b"... (" + str(len(m.group(1)) // 2).encode() + b" bytes) >", b)
    return b.decode("latin-1")

def objeto_com(marca):
    for m in re.finditer(marca, data):
        ini = data.rfind(b" obj", 0, m.start())
        ini = data.rfind(b"\n", 0, ini) + 1
        fim = data.find(b"endobj", m.start()) + 6
        yield ini, data[ini:fim]

for marca, rotulo in ((rb"/ByteRange", "assinatura / carimbo"), (rb"/DSS", "referencia ao /DSS no catalogo"), (rb"/VRI", "dicionario /DSS")):
    for ini, obj in objeto_com(marca):
        if b"stream" in obj[:200] and marca != rb"/ByteRange":
            continue
        print(f"\n--- {rotulo} (objeto no byte {ini}) ---")
        print(abrevia(obj).strip())
