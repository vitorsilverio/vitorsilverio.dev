import javax.net.ssl.*;
import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.security.cert.*;
import java.util.*;

public class Cli {
    public static void main(String[] a) throws Exception {
        String host = a[0]; int port = Integer.parseInt(a[1]); String modo = a[2];
        // modo: padrao | ocsp | crl | soft
        CertificateFactory cf = CertificateFactory.getInstance("X.509");
        X509Certificate root;
        try (InputStream in = Files.newInputStream(Path.of("/lab/ca/root.pem"))) { root = (X509Certificate) cf.generateCertificate(in); }
        KeyStore ts = KeyStore.getInstance("PKCS12"); ts.load(null, null); ts.setCertificateEntry("raiz", root);
        TrustManagerFactory tmf = TrustManagerFactory.getInstance("PKIX");
        if (modo.equals("padrao")) {
            tmf.init(ts);
        } else {
            PKIXBuilderParameters p = new PKIXBuilderParameters(ts, new X509CertSelector());
            p.setRevocationEnabled(true);
            if (modo.equals("soft")) {
                CertPathBuilder cpb = CertPathBuilder.getInstance("PKIX");
                PKIXRevocationChecker rc = (PKIXRevocationChecker) cpb.getRevocationChecker();
                rc.setOptions(EnumSet.of(PKIXRevocationChecker.Option.SOFT_FAIL));
                p.addCertPathChecker(rc);
                p.setRevocationEnabled(false); // o checker acima faz a checagem
            }
            tmf.init(new CertPathTrustManagerParameters(p));
        }
        SSLContext ctx = SSLContext.getInstance("TLS"); ctx.init(null, tmf.getTrustManagers(), null);
        long t0 = System.nanoTime();
        try (SSLSocket s = (SSLSocket) ctx.getSocketFactory().createSocket()) {
            s.connect(new java.net.InetSocketAddress(host, port), 5000);
            s.setSoTimeout(60000);
            s.startHandshake();
            System.out.printf("ACEITOU  (%d ms)%n", (System.nanoTime()-t0)/1_000_000);
        } catch (Exception e) {
            Throwable c = e;
            while (c.getCause() != null) c = c.getCause();
            String m = String.valueOf(c.getMessage());
            System.out.printf("REJEITOU (%d ms) %s: %s%n", (System.nanoTime()-t0)/1_000_000, c.getClass().getSimpleName(), m.length() > 100 ? m.substring(0, 100) : m);
        }
    }
}
