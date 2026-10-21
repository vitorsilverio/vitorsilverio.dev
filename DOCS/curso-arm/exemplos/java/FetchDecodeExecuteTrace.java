import dev.vitorsilverio.armjitter.arch.ArmArchitecture;
import dev.vitorsilverio.armjitter.core.*;
import dev.vitorsilverio.armjitter.decoder.DecodedInstruction;
import dev.vitorsilverio.armjitter.decoder.InstructionSet;
import dev.vitorsilverio.armjitter.memory.AddressSpace;
import dev.vitorsilverio.armjitter.swi.SwiDispatcher;

/**
 * Roda as três primeiras instruções de pcoffset.s no ArmCore.step() com um ArmTraceListener
 * e mostra o PC antes de cada passo e o valor que mov rX, pc grava.
 *   javac -cp arm-jitter-1.4.0.jar FetchDecodeExecuteTrace.java
 *   java  -cp "arm-jitter-1.4.0.jar;." FetchDecodeExecuteTrace      (Linux/macOS: use ":" no lugar de ";")
 */
public final class FetchDecodeExecuteTrace {
    static final int BASE = 0x10000;
    // mov r0, pc ; mov r1, pc ; sub r2, r1, r0   (bytes de pcoffset.elf)
    static final int[] CODIGO = { 0xE1A0000F, 0xE1A0100F, 0xE0412000 };

    public static void main(String[] args) {
        AddressSpace memoria = new AddressSpace() {
            public int read8(int x)  { return (read32(x & ~3) >>> (8 * (x & 3))) & 0xFF; }
            public int read16(int x) { return (read32(x & ~3) >>> (8 * (x & 2))) & 0xFFFF; }
            public int read32(int x) {
                int i = (x - BASE) / 4;
                return (x >= BASE && i < CODIGO.length) ? CODIGO[i] : 0;
            }
            public void write8(int x, int v)  { }
            public void write16(int x, int v) { }
            public void write32(int x, int v) { }
        };
        ArmCore core = new ArmCore(memoria, SwiDispatcher.empty(), ArmArchitecture.ARMV7A);
        core.configureExecutionState(BASE, CpuMode.SYSTEM, InstructionSet.ARM, false, false);

        core.setTraceListener(new ArmTraceListener() {
            @Override
            public void beforeInstruction(ArmCore c, int pc, InstructionSet set) {
                System.out.printf("antes : pc=%05x (%s)%n", pc, set);
            }
            @Override
            public void afterInstruction(ArmCore c, DecodedInstruction i) {
                System.out.printf("depois: pc=%05x  %-3s raw=%08x  r0=%05x r1=%05x r2=%x%n",
                        c.programCounter(), i.kind(), i.raw(), c.register(0), c.register(1), c.register(2));
            }
        });
        core.step(3);
    }
}
