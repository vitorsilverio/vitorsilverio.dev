import dev.vitorsilverio.armjitter.core.ArmCore;
import dev.vitorsilverio.armjitter.core.ArmTraceListener;
import dev.vitorsilverio.armjitter.decoder.DecodedInstruction;
import dev.vitorsilverio.armjitter.memory.AddressSpace;
import dev.vitorsilverio.armjitter.swi.SwiDispatcher;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Usa o arm-jitter direto pela API Java: carrega soma5.bin num AddressSpace
 * de RAM, instala um trace listener e anda instrucao a instrucao.
 *
 *   javac -cp arm-jitter-1.3.0.jar TraceSoma.java
 *   java  -cp arm-jitter-1.3.0.jar;. TraceSoma ../soma5.bin
 */
public final class TraceSoma {

    static final int BASE = 0x00010000;

    public static void main(String[] args) throws Exception {
        byte[] image = Files.readAllBytes(Path.of(args[0]));

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

        core.setTraceListener(new ArmTraceListener() {
            @Override public void afterInstruction(ArmCore c, DecodedInstruction insn) {
                System.out.printf("pc=%08X  %-18s r0=%2d r2=%d cpsr=%08X%n",
                        insn.address(), insn.kind(),
                        c.register(0), c.register(2), c.cpsr().get());
            }
        });

        for (int i = 0; i < 23; i++) {
            core.step();
        }
        System.out.println("--- r0 final = " + core.register(0));
    }
}
