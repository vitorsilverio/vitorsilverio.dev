import dev.vitorsilverio.armjitter.decoder.ArmDecoder;
import dev.vitorsilverio.armjitter.decoder.DecodedInstruction;
import dev.vitorsilverio.armjitter.ir.IrBlock;
import dev.vitorsilverio.armjitter.ir.IrOp;
import dev.vitorsilverio.armjitter.ir.IrOperand;
import dev.vitorsilverio.armjitter.ir.StandardIrBlockLifter;
import dev.vitorsilverio.armjitter.ir.StandardIrBuilder;
import dev.vitorsilverio.armjitter.ir.opt.ConstantFoldPass;
import dev.vitorsilverio.armjitter.ir.opt.DeadCodeEliminationPass;
import dev.vitorsilverio.armjitter.ir.opt.FlagMergePass;
import dev.vitorsilverio.armjitter.memory.AddressSpace;

/**
 * Decodifica uma palavra ARM, eleva blocos pequenos para IR e roda os tres passes
 * do otimizador padrao (constant fold, DCE, flag merge) um a um, mostrando o bloco
 * apos cada estagio que mudou alguma coisa.
 *
 *   javac -cp arm-jitter-1.3.0.jar decoder-do-arm-jitter-DecodeELift.java
 *   java  -cp arm-jitter-1.3.0.jar;. DecodeELift      (use ':' em vez de ';' no Linux/macOS)
 */
class DecodeELift {

    /** Memoria minima: as palavras ARM de 'words' a partir do endereco 0. */
    static AddressSpace memoryOf(int... words) {
        byte[] image = new byte[words.length * 4];
        for (int i = 0; i < words.length; i++) {
            for (int b = 0; b < 4; b++) {
                image[i * 4 + b] = (byte) (words[i] >>> (8 * b));
            }
        }
        return new AddressSpace() {
            @Override public int read8(int a)  { return image[a] & 0xFF; }
            @Override public int read16(int a) { return read8(a) | (read8(a + 1) << 8); }
            @Override public int read32(int a) { return read16(a) | (read16(a + 2) << 16); }
            @Override public void write8(int a, int v)  { image[a] = (byte) v; }
            @Override public void write16(int a, int v) { write8(a, v); write8(a + 1, v >> 8); }
            @Override public void write32(int a, int v) { write16(a, v); write16(a + 2, v >> 16); }
        };
    }

    static String operand(IrOperand o) {
        return switch (o) {
            case IrOperand.Register r -> "r" + r.index();
            case IrOperand.Immediate i -> "#" + i.value();
            case IrOperand.ShiftedRegister s -> "r" + s.index() + " (deslocado)";
        };
    }

    static String format(IrOp op) {
        if (op instanceof IrOp.Alu a) {
            String src1 = a.src1ValueOverride() >= 0 ? "#" + a.src1ValueOverride() + " (valor conhecido)" : a.src1() >= 0 ? "r" + a.src1() : "-";
            return "Alu " + a.opcode() + " dst=r" + a.dst() + " src1=" + src1
                    + " src2=" + operand(a.src2()) + " setFlags=" + a.setFlags() + " cond=" + a.condition();
        }
        return op.toString();
    }

    static void print(String title, IrBlock block) {
        System.out.println(title);
        for (IrOp op : block.operations()) {
            System.out.println("  " + format(op));
        }
    }

    static void pipeline(String name, int... words) {
        System.out.println("=== " + name);
        var lifter = new StandardIrBlockLifter(new ArmDecoder(), new StandardIrBuilder());
        IrBlock block = lifter.lift(memoryOf(words), 0, words.length);
        print("lift:", block);
        record Pass(String name, java.util.function.UnaryOperator<IrBlock> run) { }
        for (Pass pass : new Pass[] {
                new Pass("ConstantFoldPass", new ConstantFoldPass()::optimize),
                new Pass("DeadCodeEliminationPass", new DeadCodeEliminationPass()::optimize),
                new Pass("FlagMergePass", new FlagMergePass()::optimize)}) {
            IrBlock next = pass.run().apply(block);
            if (!next.operations().equals(block.operations())) {
                print("depois do " + pass.name() + ":", next);
            }
            block = next;
        }
    }

    public static void main(String[] args) {
        DecodedInstruction decoded = new ArmDecoder().decode(memoryOf(0xe0810002), 0);
        System.out.println("decode(0xe0810002) = " + decoded);

        pipeline("add r0, r1, r2", 0xe0810002);
        pipeline("addne r0, r1, r2 (condicional)", 0x10810002);
        pipeline("mov r0, #2 ; add r0, r0, #3 (nada a dobrar)", 0xe3a00002, 0xe2800003);
        pipeline("add r0, pc, #4 (constant fold)", 0xe28f0004);
        pipeline("mov r0, #2 ; mov r0, #5 ; bx lr (DCE)", 0xe3a00002, 0xe3a00005, 0xe12fff1e);
        pipeline("subs r2, r0, #1 ; cmp r1, #0 ; bx lr (flag merge)", 0xe2502001, 0xe3510000, 0xe12fff1e);
    }
}
