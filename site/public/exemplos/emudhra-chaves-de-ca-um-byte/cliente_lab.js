// Cliente Node do laboratório. Uso: node cliente_lab.js DIR [crl]
// Sem "crl": tls.connect só com a raiz de confiança (padrão). Com "crl": passa também as CRLs.
const tls = require('tls');
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const crl = process.argv[3] === 'crl' ? fs.readFileSync(path.join(dir, 'crls.pem')) : undefined;
const s = tls.connect({
  host: '127.0.0.1', port: 8443, servername: 'servidor.lab.invalid',
  ca: fs.readFileSync(path.join(dir, 'raiz.pem')), crl,
}, () => {
  console.log('authorized:', s.authorized, 'authorizationError:', s.authorizationError);
  s.end();
});
s.on('error', (e) => console.log('erro:', e.code, e.message));
