import dev.vitorsilverio.armjitter.arch.ArmArchitecture;
import dev.vitorsilverio.armjitter.core.*;
import dev.vitorsilverio.armjitter.decoder.InstructionSet;
import dev.vitorsilverio.armjitter.memory.AddressSpace;
import dev.vitorsilverio.armjitter.swi.SwiDispatcher;

/**
 * Register banking no ArmCore: o mesmo r13 (SP) tem valores diferentes por modo.
 *   javac -cp arm-jitter-1.4.0.jar RegistradoresBanking.java
 *   java  -cp "arm-jitter-1.4.0.jar;." RegistradoresBanking      (Linux/macOS: use ":" no lugar de ";")
 */
public final class RegistradoresBanking {
    public static void main(String[] args) {
        // Nenhuma instrução será executada: uma memória vazia basta.
        AddressSpace vazia = new AddressSpace() {
            public int read8(int x)  { return 0; }
            public int read16(int x) { return 0; }
            public int read32(int x) { return 0; }
            public void write8(int x, int v)  { }
            public void write16(int x, int v) { }
            public void write32(int x, int v) { }
        };
        ArmCore core = new ArmCore(vazia, SwiDispatcher.empty(), ArmArchitecture.ARMV7A);
        core.configureExecutionState(0x10000, CpuMode.SYSTEM, InstructionSet.ARM, false, false);

        core.setRegister(13, 0x8000);                 // SP do programa (modo System)
        core.setRegister(0, 0x1234);                  // r0 nunca é bancado
        int cpsrAntes = core.cpsr().get();

        core.switchMode(CpuMode.IRQ);                 // passa a enxergar o banco do IRQ
        core.setRegister(13, 0x9000);                 // SP_irq
        core.setSpsr(CpuMode.IRQ, cpsrAntes);         // o que o hardware faria ao entrar na exceção

        System.out.printf("modo=%-9s r13=%08x r0=%04x%n", core.mode(), core.register(13), core.register(0));
        System.out.printf("banco System visto de fora: r13=%08x%n", core.bankedRegister(CpuMode.SYSTEM, 13));
        System.out.printf("SPSR_irq=%08x  CPSR=%08x%n", core.spsr(CpuMode.IRQ), core.cpsr().get());

        core.switchMode(CpuMode.SYSTEM);
        System.out.printf("modo=%-9s r13=%08x r0=%04x%n", core.mode(), core.register(13), core.register(0));
        System.out.printf("banco IRQ visto de fora:    r13=%08x%n", core.bankedRegister(CpuMode.IRQ, 13));
    }
}
