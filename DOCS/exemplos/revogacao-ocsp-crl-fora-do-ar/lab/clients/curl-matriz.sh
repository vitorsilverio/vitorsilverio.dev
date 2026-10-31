curl --version | head -1
S="sh /clients/curl.sh"
$S "padrao, bom" srv-good
$S "padrao, REVOGADO" srv-rev
$S "--crlfile CRL atual, bom" srv-good --crlfile /lab/ca/ca.crl
$S "--crlfile CRL atual, REVOGADO" srv-rev --crlfile /lab/ca/ca.crl
$S "--crlfile CRL antiga, REVOGADO" srv-rev --crlfile /lab/ca/ca-antiga.crl
$S "--crlfile CRL expirada, bom" srv-good --crlfile /lab/ca/ca-expirada.crl
$S "--cert-status, staple bom" st-good --cert-status
$S "--cert-status, staple 'revoked'" st-rev --cert-status
$S "--cert-status, sem staple" srv-good --cert-status
