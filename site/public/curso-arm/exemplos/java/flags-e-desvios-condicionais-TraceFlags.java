import dev.vitorsilverio.armjitter.core.ArmCore;
import dev.vitorsilverio.armjitter.core.ArmTraceListener;
import dev.vitorsilverio.armjitter.decoder.DecodedInstruction;
import dev.vitorsilverio.armjitter.memory.AddressSpace;
import dev.vitorsilverio.armjitter.swi.SwiDispatcher;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Mostra as flags N/Z/C/V depois de cada CMP do laco de soma e se o BGE desviou.
 * Carrega a imagem binaria do ELF de decodificando-instrucoes-arm-objdump.s
 * (arm-none-eabi-objcopy -O binary ... sum.bin) a partir de 0x8000.
 *
 *   javac -cp arm-jitter-1.3.0.jar flags-e-desvios-condicionais-TraceFlags.java
 *   java  -cp arm-jitter-1.3.0.jar;. TraceFlags sum.bin      (use ':' em vez de ';' no Linux/macOS)
 */
class TraceFlags {

    static final int BASE = 0x00008000;
    static final int SVC_ADDRESS = 0x8038;

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
                int cpsr = c.cpsr().get();
                switch (insn.address()) {
                    case 0x8010 -> System.out.printf("cmp r2=%d, r3=%d -> N=%d Z=%d C=%d V=%d%n",
                            c.register(2), c.register(3),
                            cpsr >>> 31, (cpsr >>> 30) & 1, (cpsr >>> 29) & 1, (cpsr >>> 28) & 1);
                    case 0x8014 -> System.out.println("  bge done -> " + (c.register(15) == 0x8028 ? "desviou (saiu do laco)" : "nao desviou"));
                    default -> { }
                }
            }
        });

        while (core.register(15) != SVC_ADDRESS) {
            core.step();
        }
        System.out.println("r1 (soma) = " + core.register(1));
    }
}
