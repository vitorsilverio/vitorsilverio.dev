import dev.vitorsilverio.armjitter.arch.ArmArchitecture;
import dev.vitorsilverio.armjitter.core.*;
import dev.vitorsilverio.armjitter.decoder.InstructionSet;
import dev.vitorsilverio.armjitter.memory.AddressSpace;
import dev.vitorsilverio.armjitter.swi.SwiDispatcher;
import java.nio.file.*;

/**
 * Roda os MESMOS bytes (mov r1,#0x10000 ; clz r0,r1) em dois núcleos:
 * um com o preset ARMV4T e outro com ARMV5TE.
 *   javac -cp arm-jitter-1.3.0.jar Armv4tPresets.java
 *   java  -cp "arm-jitter-1.3.0.jar;." Armv4tPresets armv4t-clz.bin
 */
public final class Armv4tPresets {
    static final int BASE = 0x00010000;

    public static void main(String[] a) throws Exception {
        byte[] img = Files.readAllBytes(Path.of(a[0]));
        run("ARMV4T ", ArmArchitecture.ARMV4T, img);
        run("ARMV5TE", ArmArchitecture.ARMV5TE, img);
    }

    static void run(String label, ArmArchitecture arch, byte[] img) {
        AddressSpace ram = new AddressSpace() {
            int rd(int x) { return (x >= BASE && x - BASE < img.length) ? (img[x - BASE] & 0xFF) : 0; }
            public int read8(int x)  { return rd(x); }
            public int read16(int x) { return rd(x) | (rd(x + 1) << 8); }
            public int read32(int x) { return read16(x) | (read16(x + 2) << 16); }
            public void write8(int x, int v)  { notifyWrite(x); }
            public void write16(int x, int v) { notifyWrite(x); }
            public void write32(int x, int v) { notifyWrite(x); }
        };
        ArmCore core = new ArmCore(ram, SwiDispatcher.empty(), arch);
        core.configureExecutionState(BASE, CpuMode.SYSTEM, InstructionSet.ARM, false, false);
        core.step();   // mov r1, #0x10000
        core.step();   // clz r0, r1
        System.out.printf("%s  pc=%08X  modo=%-10s r0=%d%n",
                label, core.programCounter(), core.mode(), core.register(0));
    }
}
