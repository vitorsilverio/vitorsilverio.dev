// DecompilaTudo.java - script do Ghidra (headless): lista as funcoes e imprime o C do decompilador.
// @category Artigo
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;

public class DecompilaTudo extends GhidraScript {
    @Override
    public void run() throws Exception {
        println("Linguagem: " + currentProgram.getLanguageID()
                + " | compilador: " + currentProgram.getCompilerSpec().getCompilerSpecID());
        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);
        FunctionIterator it = currentProgram.getFunctionManager().getFunctions(true);
        while (it.hasNext()) {
            Function f = it.next();
            ghidra.program.model.lang.Register tmode = currentProgram.getRegister("TMode");
            java.math.BigInteger t = currentProgram.getProgramContext().getValue(tmode, f.getEntryPoint(), false);
            println("==== " + f.getName() + " @ " + f.getEntryPoint() + " (TMode=" + t + ") ====");
            DecompileResults r = decomp.decompileFunction(f, 60, monitor);
            if (r.decompileCompleted()) {
                println(r.getDecompiledFunction().getC());
            } else {
                println("falhou: " + r.getErrorMessage());
            }
        }
        decomp.dispose();
    }
}
