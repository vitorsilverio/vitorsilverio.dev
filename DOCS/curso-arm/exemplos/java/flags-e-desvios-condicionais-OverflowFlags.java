import dev.vitorsilverio.armjitter.core.ArmCore;
import dev.vitorsilverio.armjitter.memory.AddressSpace;
import dev.vitorsilverio.armjitter.swi.SwiDispatcher;

/**
 * Executa uma unica instrucao "cmp r0, r1" (e1500001) com operandos que provocam
 * overflow com sinal e mostra as flags N/Z/C/V resultantes.
 *
 *   javac -cp arm-jitter-1.3.0.jar flags-e-desvios-condicionais-OverflowFlags.java
 *   java  -cp arm-jitter-1.3.0.jar;. OverflowFlags      (use ':' em vez de ';' no Linux/macOS)
 */
class OverflowFlags {

    static final int BASE = 0x00008000;

    public static void main(String[] args) {
        cmp(0x7FFFFFFF, -1);
        cmp(0x80000000, 1);
        cmp(7, 3);
    }

    static void cmp(int r0, int r1) {
        byte[] image = {0x01, 0x00, 0x50, (byte) 0xE1}; // cmp r0, r1 = 0xe1500001 (little-endian)
        AddressSpace ram = new AddressSpace() {
            @Override public int read8(int a)  { return image[a - BASE] & 0xFF; }
            @Override public int read16(int a) { return read8(a) | (read8(a + 1) << 8); }
            @Override public int read32(int a) { return read16(a) | (read16(a + 2) << 16); }
            @Override public void write8(int a, int v)  { image[a - BASE] = (byte) v; notifyWrite(a); }
            @Override public void write16(int a, int v) { write8(a, v); write8(a + 1, v >> 8); }
            @Override public void write32(int a, int v) { write16(a, v); write16(a + 2, v >> 16); }
        };
        ArmCore core = new ArmCore(ram, SwiDispatcher.empty());
        core.setProgramCounter(BASE);
        core.setRegister(0, r0);
        core.setRegister(1, r1);
        core.step();
        int cpsr = core.cpsr().get();
        int n = cpsr >>> 31, z = (cpsr >>> 30) & 1, c = (cpsr >>> 29) & 1, v = (cpsr >>> 28) & 1;
        System.out.printf("cmp r0=%d, r1=%d -> N=%d Z=%d C=%d V=%d | GE=%b LT=%b HS=%b LO=%b%n",
                r0, r1, n, z, c, v, n == v, n != v, c == 1, c == 0);
    }
}
