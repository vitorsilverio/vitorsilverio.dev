import dev.vitorsilverio.armjitter.core.Condition;
import dev.vitorsilverio.armjitter.ir.IrBlock;
import dev.vitorsilverio.armjitter.ir.IrOp;
import dev.vitorsilverio.armjitter.ir.IrOpCode;
import dev.vitorsilverio.armjitter.ir.IrOperand;
import dev.vitorsilverio.armjitter.ir.opt.IrOptimizer;
import java.util.ArrayList;
import java.util.List;

/** Remove `MOV Rd, Rd` (mesmo registrador, sem flags, condicao AL). */
public final class RedundantMoveEliminationPass implements IrOptimizer {

    @Override
    public IrBlock optimize(IrBlock block) {
        List<IrOp> ops = block.operations();
        List<IrOp> result = new ArrayList<>(ops.size());
        boolean changed = false;

        for (IrOp op : ops) {
            if (isNop(op)) {
                changed = true;          // simplesmente nao copia para o resultado
            } else {
                result.add(op);
            }
        }
        return changed
                ? new IrBlock(block.startPc(), block.endPc(), result)
                : block;                 // sem mudanca: devolve o mesmo objeto
    }

    private static boolean isNop(IrOp op) {
        return op instanceof IrOp.Alu alu
                && alu.opcode() == IrOpCode.MOV
                && alu.condition() == Condition.AL
                && !alu.setFlags()
                && alu.dst() != 15
                && alu.src2() instanceof IrOperand.Register reg
                && reg.valueOverride() < 0
                && reg.index() == alu.dst();
    }
}
