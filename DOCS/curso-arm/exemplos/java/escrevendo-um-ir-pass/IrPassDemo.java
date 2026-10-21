import dev.vitorsilverio.armjitter.arch.ArmArchitecture;
import dev.vitorsilverio.armjitter.codegen.InterpretedCodeEmitter;
import dev.vitorsilverio.armjitter.codegen.equivalence.CpuSnapshot;
import dev.vitorsilverio.armjitter.core.*;
import dev.vitorsilverio.armjitter.decoder.ArmDecoder;
import dev.vitorsilverio.armjitter.decoder.InstructionSet;
import dev.vitorsilverio.armjitter.ir.*;
import dev.vitorsilverio.armjitter.ir.opt.IrOptimizer;
import dev.vitorsilverio.armjitter.ir.opt.StandardIrOptimizer;
import dev.vitorsilverio.armjitter.memory.AddressSpace;
import dev.vitorsilverio.armjitter.swi.SwiDispatcher;
import java.nio.file.*;

/**
 * Eleva um bloco ARM para a IR, aplica o pipeline padrao com e sem o passe novo,
 * e executa os dois blocos no interpretador de IR para provar que o estado final e igual.
 *   javac -cp arm-jitter-1.3.0.jar RedundantMoveEliminationPass.java IrPassDemo.java
 *   java  -cp "arm-jitter-1.3.0.jar;." IrPassDemo ../../escrevendo-um-ir-pass-movs.bin
 */
public final class IrPassDemo {
    static final int BASE = 0x00010000;

    public static void main(String[] args) throws Exception {
        byte[] img = Files.readAllBytes(Path.of(args[0]));
        AddressSpace mem = new AddressSpace() {
            int rd(int x) { return (x >= BASE && x - BASE < img.length) ? (img[x - BASE] & 0xFF) : 0; }
            @Override public int read8(int a)  { return rd(a); }
            @Override public int read16(int a) { return rd(a) | (rd(a + 1) << 8); }
            @Override public int read32(int a) { return read16(a) | (read16(a + 2) << 16); }
            @Override public void write8(int a, int v)  { }
            @Override public void write16(int a, int v) { }
            @Override public void write32(int a, int v) { }
        };

        IrBlockLifter lifter = new StandardIrBlockLifter(new ArmDecoder(), new StandardIrBuilder());
        IrBlock lifted = lifter.lift(mem, BASE, 32);

        IrOptimizer padrao = StandardIrOptimizer.gba();
        IrOptimizer comPasse = padrao.then(new RedundantMoveEliminationPass());
        IrBlock antes = padrao.optimize(lifted);
        IrBlock depois = comPasse.optimize(lifted);

        System.out.println("Alu no bloco (pipeline padrao):");
        imprimirAlus(antes);
        System.out.println("Alu no bloco (padrao + RedundantMoveEliminationPass):");
        imprimirAlus(depois);
        System.out.printf("ops: %d -> %d%n", antes.operations().size(), depois.operations().size());

        CpuSnapshot a = executar(antes, mem);
        int ciclosAntes = ultimosCiclos;
        CpuSnapshot b = executar(depois, mem);
        int ciclosDepois = ultimosCiclos;
        a.assertEqualTo(b, "estado final");   // lanca excecao se qualquer campo divergir
        System.out.printf("estado final igual: r0=%d r2=%d r4=%d cpsr=%08X%n",
                a.registers()[0], a.registers()[2], a.registers()[4], a.cpsr());
        System.out.printf("ciclos internos: %d -> %d%n", ciclosAntes, ciclosDepois);
    }

    static void imprimirAlus(IrBlock block) {
        for (IrOp op : block.operations()) {
            if (op instanceof IrOp.Alu alu) {
                System.out.printf("  %-4s r%d <- %s  flags=%b cond=%s%n",
                        alu.opcode(), alu.dst(), alu.src2(), alu.setFlags(), alu.condition());
            }
        }
    }

    static int ultimosCiclos;

    static CpuSnapshot executar(IrBlock block, AddressSpace mem) {
        ArmCore core = new ArmCore(mem, SwiDispatcher.empty());
        core.configureExecutionState(BASE, CpuMode.SYSTEM, InstructionSet.ARM, true, true);
        core.setRegister(0, 37);
        core.setRegister(2, 0);       // movs r2, r2 com r2 = 0 liga o Z...
        core.setRegister(3, 99);
        core.setRegister(5, 1234);
        ultimosCiclos = new InterpretedCodeEmitter().execute(block, core);
        return CpuSnapshot.capture(core);
    }
}
