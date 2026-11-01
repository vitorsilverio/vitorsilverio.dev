FROM python:3.12.16-slim
RUN pip install --no-cache-dir "pyhanko[requests,async-http]==0.38.0" "pyhanko-cli==0.6.0" "reportlab==4.2.5"
# Os scripts ficam em /lab (somente leitura); chaves, certificados e PDFs gerados ficam em /work.
WORKDIR /work
