import java.io.*;
import java.nio.file.*;
import java.security.KeyStore;
import java.security.cert.*;
import java.util.*;
import javax.net.ssl.*;

/** Cliente Java do laboratório. Uso: java ClienteLab.java DIR [crl]
 *  Sem "crl": TrustManagerFactory.init(KeyStore), o caminho padrão (revogação desligada).
 *  Com "crl": PKIX com revogação ligada e as CRLs do laboratório. */
public class ClienteLab {
    public static void main(String[] a) throws Exception {
        Path dir = Path.of(a[0]);
        CertificateFactory cf = CertificateFactory.getInstance("X.509");
        KeyStore ts = KeyStore.getInstance(KeyStore.getDefaultType());
        ts.load(null, null);
        try (InputStream in = Files.newInputStream(dir.resolve("raiz.pem"))) {
            ts.setCertificateEntry("raiz-lab", cf.generateCertificate(in));
        }
        TrustManagerFactory tmf = TrustManagerFactory.getInstance("PKIX");
        if (a.length > 1 && a[1].equals("crl")) {
            Collection<? extends CRL> crls;
            try (InputStream in = Files.newInputStream(dir.resolve("crls.pem"))) { crls = cf.generateCRLs(in); }
            PKIXBuilderParameters p = new PKIXBuilderParameters(ts, new X509CertSelector());
            p.setRevocationEnabled(true);
            p.addCertStore(CertStore.getInstance("Collection", new CollectionCertStoreParameters(crls)));
            tmf.init(new CertPathTrustManagerParameters(p));
        } else {
            tmf.init(ts);
        }
        SSLContext ctx = SSLContext.getInstance("TLS");
        ctx.init(null, tmf.getTrustManagers(), null);
        try (SSLSocket s = (SSLSocket) ctx.getSocketFactory().createSocket("127.0.0.1", 8443)) {
            SSLParameters sp = s.getSSLParameters();
            sp.setServerNames(List.of(new SNIHostName("servidor.lab.invalid")));
            sp.setEndpointIdentificationAlgorithm("HTTPS");
            s.setSSLParameters(sp);
            s.startHandshake();
            System.out.println("ACEITOU  " + s.getSession().getPeerPrincipal());
        } catch (SSLHandshakeException e) {
            Throwable c = e; while (c.getCause() != null) c = c.getCause();
            System.out.println("REJEITOU " + c.getMessage());
        }
    }
}
