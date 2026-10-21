import dev.vitorsilverio.armjitter.arch.ArmArchitecture;
import dev.vitorsilverio.armjitter.core.*;
import dev.vitorsilverio.armjitter.memory.AddressSpace;
import dev.vitorsilverio.armjitter.memory.mmu.Cp15VmsaCoprocessor;
import dev.vitorsilverio.armjitter.memory.mmu.MemoryTranslationException;
import dev.vitorsilverio.armjitter.memory.mmu.TranslatingAddressSpace;
import dev.vitorsilverio.armjitter.swi.SwiDispatcher;
import java.nio.file.*;

/**
 * Roda mmu-e-paginacao-cp15-abort.bin com MMU de verdade: TranslatingAddressSpace por cima
 * de 1 MiB de RAM fisica e o CP15 VMSA ligado ao ArmCore.
 *   javac -cp arm-jitter-1.3.0.jar MmuAbort.java
 *   java  -cp "arm-jitter-1.3.0.jar;." MmuAbort ../../mmu-e-paginacao-cp15-abort.bin
 */
public final class MmuAbort {
    public static void main(String[] args) throws Exception {
        byte[] ram = new byte[1 << 20];                       // 1 MiB fisico em 0x00000000
        byte[] img = Files.readAllBytes(Path.of(args[0]));
        System.arraycopy(img, 0, ram, 0, img.length);

        AddressSpace physical = new AddressSpace() {
            @Override public int read8(int a)  { return ram[a] & 0xFF; }
            @Override public int read16(int a) { return read8(a) | (read8(a + 1) << 8); }
            @Override public int read32(int a) { return read16(a) | (read16(a + 2) << 16); }
            @Override public void write8(int a, int v)  { ram[a] = (byte) v; notifyWrite(a); }
            @Override public void write16(int a, int v) { write8(a, v); write8(a + 1, v >> 8); }
            @Override public void write32(int a, int v) { write16(a, v); write16(a + 2, v >> 16); }
        };
        TranslatingAddressSpace mmu = new TranslatingAddressSpace(physical);

        ArmCore core = new ArmCore(mmu, SwiDispatcher.empty(), ArmArchitecture.ARMV6K);
        Cp15VmsaCoprocessor cp15 = new Cp15VmsaCoprocessor(mmu, core);  // nasce com a MMU desligada
        core.setCoprocessorBus(cp15);        // MCR/MRC p15 chegam aqui
        core.setMemoryAbortListener(cp15);   // abort preenche DFSR/DFAR
        core.setModeChangeListener(cp15);    // modo privilegiado x usuario para os bits AP

        core.setTraceListener(new ArmTraceListener() {
            @Override public void onMemoryAbort(ArmCore c, int pc, MemoryTranslationException f) {
                System.out.printf("abort: instrucao %08X, VA %08X, %s, %s%n",
                        pc, f.virtualAddress(), f.accessType(), f.faultStatus());
            }
        });

        // o reset comeca em 0x00000000; o tratador de abort termina num "b ." em 0x5C
        for (int i = 0; i < 100 && core.programCounter() != 0x5C; i++) {
            core.step();
        }
        System.out.printf("r6 (lido via VA 0x80000100) = %08X%n", core.register(6));
        System.out.printf("modo agora = %s%n", core.mode());
        System.out.printf("r5 (instrucao que falhou)  = %08X%n", core.register(5));
        System.out.printf("r4 (DFAR)                  = %08X%n", core.register(4));
        System.out.printf("r3 (DFSR)                  = %08X%n", core.register(3));
        System.out.printf("page walks feitos          = %d%n", mmu.pageWalkCount());
    }
}
