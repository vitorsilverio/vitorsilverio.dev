import dev.vitorsilverio.armjitter.core.ArmCore;
import dev.vitorsilverio.armjitter.memory.AddressSpace;
import dev.vitorsilverio.armjitter.memory.PagedAddressSpace;
import dev.vitorsilverio.armjitter.swi.SwiDispatcher;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Monta um barramento com PagedAddressSpace: RAM, uma "UART" de MMIO,
 * um espelho da RAM e waitstates. Roda mmio-uart.bin ate o laco final.
 *
 *   javac -cp arm-jitter-1.3.0.jar MmioUart.java
 *   java  -cp "arm-jitter-1.3.0.jar;." MmioUart mmio-uart.bin
 */
public final class MmioUart {

    static final int RAM_BASE    = 0x00000000;
    static final int RAM_SIZE    = 0x00020000;   // 128 KiB
    static final int MIRROR_BASE = 0x00020000;   // a mesma RAM, vista de novo logo acima
    static final int UART_BASE   = 0x10000000;
    static final int PROGRAM     = 0x00010000;

    /** Um periferico minimo: escrever no endereco base "transmite" um caractere. */
    static final class Uart implements AddressSpace {
        int bytesTransmitidos;
        @Override public int read8(int a)  { return 0; }
        @Override public int read16(int a) { return 0; }
        @Override public int read32(int a) { return 0; }
        @Override public void write8(int a, int v) {
            if (a == UART_BASE) {
                System.out.print((char) (v & 0xFF));
                bytesTransmitidos++;
            }
        }
        @Override public void write16(int a, int v) { write8(a, v); }
        @Override public void write32(int a, int v) { write8(a, v); }
    }

    /** Barramento aberto: le 0, ignora escritas. */
    static final AddressSpace OPEN_BUS = new AddressSpace() {
        @Override public int read8(int a)  { return 0; }
        @Override public int read16(int a) { return 0; }
        @Override public int read32(int a) { return 0; }
        @Override public void write8(int a, int v)  { }
        @Override public void write16(int a, int v) { }
        @Override public void write32(int a, int v) { }
    };

    public static void main(String[] args) throws Exception {
        byte[] ram = new byte[RAM_SIZE];
        byte[] programa = Files.readAllBytes(Path.of(args[0]));
        System.arraycopy(programa, 0, ram, PROGRAM - RAM_BASE, programa.length);

        Uart uart = new Uart();
        PagedAddressSpace bus = new PagedAddressSpace(12, OPEN_BUS);   // paginas de 4 KiB
        bus.mapRam(RAM_BASE, ram);                                      // copia o array
        bus.mapHandler(UART_BASE, bus.pageSize(), uart);                // MMIO
        bus.mapMirror(MIRROR_BASE, RAM_BASE, RAM_SIZE);                 // espelho
        bus.setWaitstates(RAM_BASE, RAM_SIZE, 1);                       // 1 ciclo extra por acesso

        ArmCore core = new ArmCore(bus, SwiDispatcher.empty());
        core.setProgramCounter(PROGRAM);

        int passos = 0;
        while (core.programCounter() != 0x0001001C && passos < 1000) {  // 0x1001C = "done"
            core.step();
            passos++;
        }

        System.out.println("--- passos: " + passos + ", bytes na UART: " + uart.bytesTransmitidos
                + ", ciclos: " + core.cycles());

        // O espelho e a RAM sao o mesmo armazenamento:
        bus.write32(MIRROR_BASE + 0x100, 0xCAFEBABE);
        System.out.printf("RAM[0x100] lida pela janela original = %08X%n", bus.read32(RAM_BASE + 0x100));
        // mapRam copiou o array: o byte[] original nao ve a escrita.
        System.out.printf("array original ram[0x100] = %02X%n", ram[0x100] & 0xFF);
    }
}
