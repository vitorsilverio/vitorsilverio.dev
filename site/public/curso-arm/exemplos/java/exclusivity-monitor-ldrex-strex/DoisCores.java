import dev.vitorsilverio.armjitter.arch.ArmArchitecture;
import dev.vitorsilverio.armjitter.core.*;
import dev.vitorsilverio.armjitter.decoder.InstructionSet;
import dev.vitorsilverio.armjitter.memory.AddressSpace;
import dev.vitorsilverio.armjitter.swi.SwiDispatcher;
import java.nio.file.*;

/**
 * Dois ArmCore dividindo a mesma RAM e o mesmo ExclusiveMonitor: o nucleo A faz
 * LDREX no contador, o nucleo B escreve nele com um STR comum, e o STREX de A falha.
 *   javac -cp arm-jitter-1.3.0.jar DoisCores.java
 *   java  -cp "arm-jitter-1.3.0.jar;." DoisCores ../../exclusivity-monitor-ldrex-strex-dois-cores.bin
 */
public final class DoisCores {
    static final int BASE = 0x00010000;
    static final int CONTADOR = 0x00010030;

    public static void main(String[] args) throws Exception {
        rodar(Files.readAllBytes(Path.of(args[0])), false);
        rodar(Files.readAllBytes(Path.of(args[0])), true);
    }

    static void rodar(byte[] ram, boolean comInterferencia) {
        AddressSpace mem = new AddressSpace() {
            @Override public int read8(int a)  { return ram[a - BASE] & 0xFF; }
            @Override public int read16(int a) { return read8(a) | (read8(a + 1) << 8); }
            @Override public int read32(int a) { return read16(a) | (read16(a + 2) << 16); }
            @Override public void write8(int a, int v)  { ram[a - BASE] = (byte) v; notifyWrite(a); }
            @Override public void write16(int a, int v) { write8(a, v); write8(a + 1, v >> 8); }
            @Override public void write32(int a, int v) { write16(a, v); write16(a + 2, v >> 16); }
        };
        ExclusiveMonitor monitor = new ExclusiveMonitor();   // um monitor para os dois nucleos

        ArmCore a = new ArmCore(mem, SwiDispatcher.empty(), ArmArchitecture.ARMV6K);
        a.setExclusiveMonitor(monitor);
        a.configureExecutionState(0x00010000, CpuMode.SYSTEM, InstructionSet.ARM, false, false);

        ArmCore b = new ArmCore(mem, SwiDispatcher.empty(), ArmArchitecture.ARMV6K);
        b.setExclusiveMonitor(monitor);
        b.configureExecutionState(0x00010020, CpuMode.SYSTEM, InstructionSet.ARM, false, false);

        a.step();                       // A: adr r1, contador
        a.step();                       // A: ldrex r0, [r1]   -> reserva o contador
        System.out.printf("%s%n", comInterferencia ? "com o nucleo B no meio:" : "so o nucleo A:");
        System.out.printf("  depois do LDREX: reserva de A em %08X%n", a.exclusiveMonitorAddress());
        if (comInterferencia) {
            b.step(); b.step(); b.step();   // B: adr, mov r3,#100, str r3,[r1]
            System.out.printf("  depois do STR de B: reserva de A = %d (aberta)%n", a.exclusiveMonitorAddress());
        }
        a.step();                       // A: add r0, r0, #1
        a.step();                       // A: strex r2, r0, [r1]
        System.out.printf("  STREX de A: r2 = %d   contador = %d%n", a.register(2), mem.read32(CONTADOR));
    }
}
