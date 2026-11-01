import dev.vitorsilverio.armjitter.core.ArmCore;
import dev.vitorsilverio.armjitter.memory.AddressSpace;
import dev.vitorsilverio.armjitter.memory.PagedAddressSpace;
import dev.vitorsilverio.armjitter.swi.SwiDispatcher;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Roda mmio-uart.bin tres vezes e compara os ciclos:
 *   1. sem setWaitstates;
 *   2. setWaitstates ANTES de criar o ArmCore;
 *   3. setWaitstates DEPOIS de criar o ArmCore (ignorado).
 *
 *   javac -cp arm-jitter-1.3.0.jar Waitstates.java
 *   java  -cp "arm-jitter-1.3.0.jar;." Waitstates mmio-uart.bin
 */
public final class Waitstates {

    static final int PROGRAM = 0x00010000;
    static final int UART_BASE = 0x10000000;

    static final AddressSpace SILENCIOSO = new AddressSpace() {
        @Override public int read8(int a)  { return 0; }
        @Override public int read16(int a) { return 0; }
        @Override public int read32(int a) { return 0; }
        @Override public void write8(int a, int v)  { }
        @Override public void write16(int a, int v) { }
        @Override public void write32(int a, int v) { }
    };

    static long rodar(byte[] programa, boolean antes, boolean depois) {
        byte[] ram = new byte[0x20000];
        System.arraycopy(programa, 0, ram, PROGRAM, programa.length);
        PagedAddressSpace bus = new PagedAddressSpace(12, SILENCIOSO);
        bus.mapRam(0, ram);
        bus.mapHandler(UART_BASE, bus.pageSize(), SILENCIOSO);
        if (antes) {
            bus.setWaitstates(0, ram.length, 1);
        }
        ArmCore core = new ArmCore(bus, SwiDispatcher.empty());
        if (depois) {
            bus.setWaitstates(0, ram.length, 1);
        }
        core.setProgramCounter(PROGRAM);
        int passos = 0;
        while (core.programCounter() != 0x0001001C && passos < 1000) {
            core.step();
            passos++;
        }
        return core.cycles();
    }

    public static void main(String[] args) throws Exception {
        byte[] programa = Files.readAllBytes(Path.of(args[0]));
        System.out.println("sem setWaitstates:                 " + rodar(programa, false, false) + " ciclos");
        System.out.println("setWaitstates antes do ArmCore:    " + rodar(programa, true, false) + " ciclos");
        System.out.println("setWaitstates depois do ArmCore:   " + rodar(programa, false, true) + " ciclos");
    }
}
