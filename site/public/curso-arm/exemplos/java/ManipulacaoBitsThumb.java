import dev.vitorsilverio.armjitter.arch.ArmArchitecture;
import dev.vitorsilverio.armjitter.core.ArmCore;
import dev.vitorsilverio.armjitter.core.ArmTraceListener;
import dev.vitorsilverio.armjitter.decoder.DecodedInstruction;
import dev.vitorsilverio.armjitter.decoder.InstructionSet;
import dev.vitorsilverio.armjitter.memory.AddressSpace;
import dev.vitorsilverio.armjitter.swi.SwiDispatcher;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Executa manipulacao-bits-thumb.bin (Thumb-2, ARMv7-M) passo a passo no arm-jitter
 * e imprime r0..r7 e as flags depois de cada instrucao.
 *
 *   javac -cp arm-jitter-1.4.0.jar ManipulacaoBitsThumb.java
 *   java  -cp arm-jitter-1.4.0.jar;. ManipulacaoBitsThumb ../manipulacao-bits-thumb.bin
 */
public final class ManipulacaoBitsThumb {

    public static void main(String[] args) throws Exception {
        byte[] image = Files.readAllBytes(Path.of(args[0]));

        AddressSpace ram = new AddressSpace() {
            @Override public int read8(int a)  { return a < image.length ? image[a] & 0xFF : 0; }
            @Override public int read16(int a) { return read8(a) | (read8(a + 1) << 8); }
            @Override public int read32(int a) { return read16(a) | (read16(a + 2) << 16); }
            @Override public void write8(int a, int v)  { }
            @Override public void write16(int a, int v) { }
            @Override public void write32(int a, int v) { }
        };

        ArmCore core = new ArmCore(ram, SwiDispatcher.empty(), ArmArchitecture.ARMV7M);
        core.setInstructionSet(InstructionSet.THUMB);
        core.setProgramCounter(0);

        core.setTraceListener(new ArmTraceListener() {
            @Override public void afterInstruction(ArmCore c, DecodedInstruction insn) {
                int f = c.cpsr().get();
                System.out.printf("%04X %-5s r0=%08X r2=%08X r3=%08X r4=%08X r5=%08X r6=%08X r7=%08X  N%d Z%d C%d V%d%n",
                        insn.address(), insn.kind(),
                        c.register(0), c.register(2), c.register(3), c.register(4),
                        c.register(5), c.register(6), c.register(7),
                        (f >>> 31) & 1, (f >>> 30) & 1, (f >>> 29) & 1, (f >>> 28) & 1);
            }
        });

        for (int i = 0; i < 16; i++) {
            core.step();
        }
        System.out.printf("r1 final = %08X%n", core.register(1));
    }
}
