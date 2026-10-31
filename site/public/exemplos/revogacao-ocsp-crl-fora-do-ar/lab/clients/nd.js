const tls = require('tls'), fs = require('fs');
console.log('Node', process.version, 'OpenSSL', process.versions.openssl);
const raiz = fs.readFileSync('/lab/ca/root.pem');
function tentar(rotulo, host, opts) {
  return new Promise(res => {
    const s = tls.connect({ host, port: 9443, servername: 'servidor.lab.invalid', ca: raiz, ...opts }, () => {
      console.log(rotulo.padEnd(46), s.authorized ? 'ACEITOU' : 'REJEITOU ' + s.authorizationError);
      s.end(); res();
    });
    s.on('OCSPResponse', r => console.log('   evento OCSPResponse:', r ? r.length + ' bytes' : 'vazio', '(o Node entrega o buffer e nao valida)'));
    s.on('error', e => { console.log(rotulo.padEnd(46), 'REJEITOU', e.code || e.message); res(); });
  });
}
(async () => {
  const crl = fs.readFileSync('/lab/ca/ca.crl');
  await tentar('padrao, certificado REVOGADO', 'srv-rev.lab.invalid', {});
  await tentar('crl: + CRL atual, bom', 'srv-good.lab.invalid', { crl });
  await tentar('crl: + CRL atual, REVOGADO', 'srv-rev.lab.invalid', { crl });
  await tentar('requestOCSP:true, staple "revoked"', 'st-rev.lab.invalid', { requestOCSP: true });
})();
