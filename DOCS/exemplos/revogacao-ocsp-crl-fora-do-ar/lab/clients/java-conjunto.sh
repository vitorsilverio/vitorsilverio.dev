# Conjunto de casos Java; o orquestrador (cenarios.sh) muda o estado dos responders entre as chamadas.
J="sh /clients/java.sh"
P="-Djava.security.properties=/clients/p.props"
CR="-Dcom.sun.net.ssl.checkRevocation=true"
CDP="-Dcom.sun.security.enableCRLDP=true"
case "$1" in
 noar)
  $J "padrao, bom" srv-good.lab.invalid padrao
  $J "padrao, REVOGADO" srv-rev.lab.invalid padrao
  $J "checkRevocation sozinho, bom" srv-good.lab.invalid ocsp $CR
  $J "OCSP, bom" srv-good.lab.invalid ocsp $CR $P
  $J "OCSP, REVOGADO" srv-rev.lab.invalid ocsp $CR $P
  $J "CRL-DP, bom" srv-good.lab.invalid ocsp $CR $CDP
  $J "CRL-DP, REVOGADO" srv-rev.lab.invalid ocsp $CR $CDP
  $J "OCSP + CRL-DP, bom" srv-good.lab.invalid ocsp $CR $CDP $P
  $J "OCSP + CRL-DP, REVOGADO" srv-rev.lab.invalid ocsp $CR $CDP $P
  $J "SOFT_FAIL (OCSP + CRL-DP), bom" srv-good.lab.invalid soft $CDP $P
  $J "SOFT_FAIL (OCSP + CRL-DP), REVOGADO" srv-rev.lab.invalid soft $CDP $P
  ;;
 parado)   # responder OCSP e servidor de CRL parados: o DNS dos aliases some
  $J "OCSP, bom" srv-good.lab.invalid ocsp $CR $P
  $J "OCSP, REVOGADO" srv-rev.lab.invalid ocsp $CR $P
  $J "CRL-DP, bom" srv-good.lab.invalid ocsp $CR $CDP
  $J "CRL-DP, REVOGADO" srv-rev.lab.invalid ocsp $CR $CDP
  $J "OCSP + CRL-DP, bom" srv-good.lab.invalid ocsp $CR $CDP $P
  $J "OCSP + CRL-DP, REVOGADO" srv-rev.lab.invalid ocsp $CR $CDP $P
  $J "SOFT_FAIL (OCSP + CRL-DP), bom" srv-good.lab.invalid soft $CDP $P
  $J "SOFT_FAIL (OCSP + CRL-DP), REVOGADO" srv-rev.lab.invalid soft $CDP $P
  $J "padrao, bom" srv-good.lab.invalid padrao
  $J "padrao, REVOGADO" srv-rev.lab.invalid padrao
  ;;
 travado)  # responder OCSP pausado (a conexao abre, a resposta nunca vem); CRL no ar
  $J "OCSP, timeout padrao (15 s), bom" srv-good.lab.invalid ocsp $CR $P
  $J "OCSP, ocsp.timeout=2s, bom" srv-good.lab.invalid ocsp $CR $P -Dcom.sun.security.ocsp.timeout=2s
  $J "OCSP, ocsp.timeout=2s, REVOGADO" srv-rev.lab.invalid ocsp $CR $P -Dcom.sun.security.ocsp.timeout=2s
  $J "OCSP + CRL-DP, timeout=2s, bom" srv-good.lab.invalid ocsp $CR $CDP $P -Dcom.sun.security.ocsp.timeout=2s
  $J "OCSP + CRL-DP, timeout=2s, REVOGADO" srv-rev.lab.invalid ocsp $CR $CDP $P -Dcom.sun.security.ocsp.timeout=2s
  $J "SOFT_FAIL, timeout=2s, REVOGADO (CRL no ar)" srv-rev.lab.invalid soft $CDP $P -Dcom.sun.security.ocsp.timeout=2s
  ;;
 doistravados)  # OCSP e CRL travados (pause nos dois)
  T="-Dcom.sun.security.ocsp.timeout=2s -Dcom.sun.security.crl.timeout=2s -Dcom.sun.security.crl.readtimeout=2s"
  $J "OCSP + CRL-DP, timeouts padrao, bom" srv-good.lab.invalid ocsp $CR $CDP $P
  $J "SOFT_FAIL, timeouts padrao, REVOGADO" srv-rev.lab.invalid soft $CDP $P
  $J "OCSP + CRL-DP, timeouts=2s, bom" srv-good.lab.invalid ocsp $CR $CDP $P $T
  $J "SOFT_FAIL, timeouts=2s, bom" srv-good.lab.invalid soft $CDP $P $T
  $J "SOFT_FAIL, timeouts=2s, REVOGADO" srv-rev.lab.invalid soft $CDP $P $T
  ;;
 unidade)  # a pegadinha: 2000 NAO sao 2000 ms
  timeout 60 sh /clients/java.sh "OCSP, ocsp.timeout=2000 (limite de 60 s)" srv-good.lab.invalid ocsp $CR $P -Dcom.sun.security.ocsp.timeout=2000 || echo "(ainda sem resposta apos 60 s; processo interrompido pelo timeout externo)"
  $J "OCSP, ocsp.timeout=2000ms" srv-good.lab.invalid ocsp $CR $P -Dcom.sun.security.ocsp.timeout=2000ms
  ;;
esac
