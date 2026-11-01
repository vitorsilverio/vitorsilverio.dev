# TSA de teste (RFC 3161 sobre HTTP) + distribuicao da CRL da CA de teste.
import subprocess, sys
from http.server import BaseHTTPRequestHandler, HTTPServer

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/ca.crl":
            data = open("/work/pki/ca.crl", "rb").read()
            self.send_response(200)
            self.send_header("Content-Type", "application/pkix-crl")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers(); self.wfile.write(data)
        else:
            self.send_error(404)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        tsq = self.rfile.read(n)
        r = subprocess.run(
            ["openssl", "ts", "-reply", "-config", "/work/pki/tsa.cnf",
             "-section", "tsa_config", "-queryfile", "/dev/stdin"],
            input=tsq, capture_output=True)
        if r.returncode:
            sys.stderr.write(r.stderr.decode()); self.send_error(500); return
        self.send_response(200)
        self.send_header("Content-Type", "application/timestamp-reply")
        self.send_header("Content-Length", str(len(r.stdout)))
        self.end_headers(); self.wfile.write(r.stdout)

HTTPServer(("127.0.0.1", 8318), H).serve_forever()
