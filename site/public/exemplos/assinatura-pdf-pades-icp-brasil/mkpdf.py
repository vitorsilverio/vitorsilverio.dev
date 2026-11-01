from reportlab.pdfgen import canvas
c = canvas.Canvas("/work/out/contrato.pdf")
c.drawString(72, 750, "Contrato de teste (laboratorio PAdES)")
c.drawString(72, 730, "Valor: R$ 1.000,00")
c.save()
