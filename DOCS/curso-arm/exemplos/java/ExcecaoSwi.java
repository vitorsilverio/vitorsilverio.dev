import dev.vitorsilverio.armjitter.core.*;
import dev.vitorsilverio.armjitter.decoder.InstructionSet;
import dev.vitorsilverio.armjitter.memory.AddressSpace;
import dev.vitorsilverio.armjitter.swi.SwiDispatcher;
import java.nio.file.*;

/**
 * Dispara uma excecao SWI e mostra a entrada no vetor 0x08:
 * troca de modo, SPSR salvo, LR de retorno, mascara de IRQ.
 *   javac -cp arm-jitter-1.3.0.jar ExcecaoSwi.java
 *   java  -cp "arm-jitter-1.3.0.jar;." ExcecaoSwi svc.bin
 */
public final class ExcecaoSwi {
    static final int BASE = 0x00010000;
    public static void main(String[] a) throws Exception {
        byte[] img = Files.readAllBytes(Path.of(a[0]));
        AddressSpace ram = new AddressSpace() {
            int rd(int x){ return (x>=BASE && x-BASE<img.length) ? (img[x-BASE]&0xFF) : 0; }
            public int read8(int x){ return rd(x); }
            public int read16(int x){ return rd(x)|(rd(x+1)<<8); }
            public int read32(int x){ return read16(x)|(read16(x+2)<<16); }
            public void write8(int x,int v){ notifyWrite(x); }
            public void write16(int x,int v){ notifyWrite(x); }
            public void write32(int x,int v){ notifyWrite(x); }
        };
        ArmCore core = new ArmCore(ram, SwiDispatcher.empty());
        core.configureExecutionState(BASE, CpuMode.SYSTEM, InstructionSet.ARM, false, false);
        System.out.printf("antes:  pc=%08X  modo=%-11s cpsr=%08X  (I=%d)%n",
            core.programCounter(), core.mode(), core.cpsr().get(), core.cpsr().irqDisabled()?1:0);
        core.step();  // mov r0,#0x2A
        core.step();  // svc #0  -> excecao
        System.out.printf("depois: pc=%08X  modo=%-11s cpsr=%08X  (I=%d)%n",
            core.programCounter(), core.mode(), core.cpsr().get(), core.cpsr().irqDisabled()?1:0);
        System.out.printf("        LR_svc  =%08X  (endereco de retorno)%n", core.bankedRegister(CpuMode.SUPERVISOR, 14));
        System.out.printf("        SPSR_svc=%08X  (CPSR de antes, para o RFE/MOVS pc,lr)%n", core.spsr(CpuMode.SUPERVISOR));
    }
}
