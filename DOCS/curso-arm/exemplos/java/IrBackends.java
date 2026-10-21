import dev.vitorsilverio.armjitter.arch.ArmArchitecture;
import dev.vitorsilverio.armjitter.codegen.AsmCodeEmitter;
import dev.vitorsilverio.armjitter.codegen.AsmFallbackPolicy;
import dev.vitorsilverio.armjitter.codegen.InterpretedCodeEmitter;
import dev.vitorsilverio.armjitter.codegen.equivalence.BlockEquivalenceHarness;
import dev.vitorsilverio.armjitter.codegen.equivalence.CpuSnapshot;
import dev.vitorsilverio.armjitter.core.ArmCore;
import dev.vitorsilverio.armjitter.decoder.ArmDecoder;
import dev.vitorsilverio.armjitter.ir.IrBlock;
import dev.vitorsilverio.armjitter.ir.IrOp;
import dev.vitorsilverio.armjitter.ir.StandardIrBlockLifter;
import dev.vitorsilverio.armjitter.ir.StandardIrBuilder;
import dev.vitorsilverio.armjitter.ir.opt.StandardIrOptimizer;
import dev.vitorsilverio.armjitter.memory.AddressSpace;
import dev.vitorsilverio.armjitter.swi.SwiDispatcher;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Eleva o primeiro bloco de soma5.bin para IR, mostra a IR antes e depois
 * do otimizador e executa o bloco pelo interpretador de IR e pelo backend
 * de bytecode JVM, comparando o estado final da CPU.
 *
 *   javac -cp arm-jitter-1.3.0.jar IrBackends.java
 *   java  -cp "arm-jitter-1.3.0.jar;." IrBackends soma5.bin
 */
public final class IrBackends {
    static final int BASE = 0x00010000;
    static final ArmArchitecture ARCH = ArmArchitecture.ARMV7A;

    public static void main(String[] args) throws Exception {
        byte[] img = Files.readAllBytes(Path.of(args[0]));
        AddressSpace mem = new AddressSpace() {
            int rd(int a) { return (a >= BASE && a - BASE < img.length) ? img[a - BASE] & 0xFF : 0; }
            @Override public int read8(int a)  { return rd(a); }
            @Override public int read16(int a) { return rd(a) | (rd(a + 1) << 8); }
            @Override public int read32(int a) { return read16(a) | (read16(a + 2) << 16); }
            @Override public void write8(int a, int v)  { }
            @Override public void write16(int a, int v) { }
            @Override public void write32(int a, int v) { }
        };

        // 1. Decodificar e elevar (lift) um bloco: para no primeiro desvio.
        var lifter = new StandardIrBlockLifter(new ArmDecoder(ARCH), new StandardIrBuilder());
        IrBlock block = lifter.lift(mem, BASE, 32);
        System.out.printf("bloco [%08X, %08X): %d ops%n", block.startPc(), block.endPc(), block.operations().size());
        for (IrOp op : block.operations()) System.out.println("  " + op);

        // 2. O mesmo bloco depois do otimizador usado pelo backend JVM.
        IrBlock otimizado = StandardIrOptimizer.gba().optimize(block);
        System.out.printf("otimizado: %d ops%n", otimizado.operations().size());
        for (IrOp op : otimizado.operations()) System.out.println("  " + op);

        // 3. Executar pelos dois backends, cada um num core novo com o mesmo estado inicial.
        var harness = new BlockEquivalenceHarness();
        var interpretado = harness.run(new InterpretedCodeEmitter(ARCH), block, novoCore(mem));
        var asm = new AsmCodeEmitter(ARCH, AsmFallbackPolicy.PER_OP, StandardIrOptimizer.gba());
        var jvm = harness.run(asm, block, novoCore(mem));

        imprime("INTERPRETED_IR", interpretado.snapshot(), interpretado.internalCycles());
        imprime("JVM_BYTECODE  ", jvm.snapshot(), jvm.internalCycles());
        interpretado.snapshot().assertEqualTo(jvm.snapshot(), "CPU state");  // lança se divergir
        System.out.println("estados iguais; blocos nativos no ASM: " + asm.nativeBlockCount()
                + ", ops em fallback PER_OP: " + asm.perOpFallbackOpCount());
    }

    static ArmCore novoCore(AddressSpace mem) {
        ArmCore core = new ArmCore(mem, SwiDispatcher.empty());
        core.setProgramCounter(BASE);
        return core;
    }

    static void imprime(String nome, CpuSnapshot s, int ciclos) {
        int[] r = s.registers();
        System.out.printf("%s r0=%d r1=%08X r2=%d r3=%d pc=%08X cpsr=%08X ciclos=%d%n",
                nome, r[0], r[1], r[2], r[3], r[15], s.cpsr(), ciclos);
    }
}
