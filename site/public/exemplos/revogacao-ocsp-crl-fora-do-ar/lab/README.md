# Laboratório: revogação com o responder no ar, parado e travado

Tudo roda em contêiner Docker (rede `revlab`, volume `revlab-data`); nada é instalado na sua máquina.
Os nomes `*.lab.invalid` usam o sufixo reservado `.invalid` e só resolvem dentro da rede do laboratório.
Imagens fixadas por tag e digest em `env.sh`.

```
bash up.sh                      # CA de teste, responder OCSP, servidor de CRL, servidores TLS
bash cenarios.sh noar           # Java com tudo no ar
bash cenarios.sh parado         # Java com OCSP e CRL parados (docker stop)
bash cenarios.sh travado        # Java com o OCSP travado (docker pause)
bash cenarios.sh unidade        # a pegadinha da unidade de com.sun.security.ocsp.timeout
bash cenarios.sh py             # Python 3.13: CRL_CHECK_LEAF, CRL atual, antiga, expirada
bash cenarios.sh node           # Node 24: crl e requestOCSP
bash cenarios.sh curl           # curl 8.13: --crlfile e --cert-status
bash staple-vencido.sh          # staple vencido (leva ~7 minutos)
bash down.sh                    # remove tudo
```

Em Linux/macOS funciona sem ajustes; no Git Bash (Windows), `env.sh` já define `MSYS_NO_PATHCONV=1`.
