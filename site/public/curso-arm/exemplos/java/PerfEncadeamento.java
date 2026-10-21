import dev.vitorsilverio.armjitter.arch.ArmArchitecture;
import dev.vitorsilverio.armjitter.core.ArmCore;
import dev.vitorsilverio.armjitter.jit.JitRuntime;
import dev.vitorsilverio.armjitter.jit.JitRuntimeFactory;
import dev.vitorsilverio.armjitter.memory.AddressSpace;
import dev.vitorsilverio.armjitter.swi.SwiDispatcher;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Roda perf-laco.bin pelo JitRuntime com e sem encadeamento de blocos e
 * mostra os contadores do inline cache e do encadeamento.
 * Usa o runtime interpretado (sem compilacao em segundo plano), para que
 * os numeros sejam deterministicos.
 *
 *   javac -cp arm-jitter-1.3.0.jar PerfEncadeamento.java
 *   java  -cp "arm-jitter-1.3.0.jar;." PerfEncadeamento perf-laco.bin
 */
public final class PerfEncadeamento {
    static final int BASE = 0x00010000;
    static final int DONE = 0x0001000C;

    public static void main(String[] args) throws Exception {
        byte[] img = Files.readAllBytes(Path.of(args[0]));
        for (int budget : new int[] {0, 96}) {
            rodar(img, budget);
        }
    }

    static void rodar(byte[] img, int budget) {
        AddressSpace mem = new AddressSpace() {
            int rd(int a) { return (a >= BASE && a - BASE < img.length) ? img[a - BASE] & 0xFF : 0; }
            @Override public int read8(int a)  { return rd(a); }
            @Override public int read16(int a) { return rd(a) | (rd(a + 1) << 8); }
            @Override public int read32(int a) { return read16(a) | (read16(a + 2) << 16); }
            @Override public void write8(int a, int v)  { }
            @Override public void write16(int a, int v) { }
            @Override public void write32(int a, int v) { }
        };
        ArmCore core = new ArmCore(mem, SwiDispatcher.empty());
        core.setProgramCounter(BASE);

        JitRuntime rt = JitRuntimeFactory.interpretedArmThumb(1024, 3, ArmArchitecture.ARMV7A);
        rt.setChainCycleBudget(budget);

        int chamadas = 0;
        long ciclos = 0;
        while (core.programCounter() != DONE) {
            ciclos += core.runBlock(rt);
            chamadas++;
        }
        System.out.printf("budget=%-3d r0=%d chamadas de execute=%-5d ciclos=%d icHits=%d icMisses=%d encadeados=%d%n",
                budget, core.register(0), chamadas, ciclos, rt.icHits, rt.icMisses, rt.chainedBlocks);
    }
}
