import dev.vitorsilverio.armjitter.arch.ArmArchitecture;
import dev.vitorsilverio.armjitter.core.ArmCore;
import dev.vitorsilverio.armjitter.core.CpuMode;
import dev.vitorsilverio.armjitter.core.CpuSleepState;
import dev.vitorsilverio.armjitter.memory.AddressSpace;
import dev.vitorsilverio.armjitter.swi.SwiDispatcher;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Roda irq-demo.bin (vetores em 0x00) com um "temporizador" simulado no
 * hospedeiro: sempre que a CPU dorme (WFI), ele sobe a linha de IRQ alguns
 * passos depois. O tratador reconhece a IRQ escrevendo no periferico em
 * 0x10000000, que baixa a linha.
 *
 *   javac -cp arm-jitter-1.3.0.jar IrqDemo.java
 *   java  -cp "arm-jitter-1.3.0.jar;." IrqDemo irq-demo.bin
 */
public final class IrqDemo {
    static final int DEVICE = 0x10000000;
    static final int DONE = 0x38;
    static ArmCore core;

    public static void main(String[] args) throws Exception {
        byte[] ram = new byte[4096];
        byte[] img = Files.readAllBytes(Path.of(args[0]));
        System.arraycopy(img, 0, ram, 0, img.length);

        AddressSpace bus = new AddressSpace() {
            @Override public int read8(int a)  { return a >= 0 && a < ram.length ? ram[a] & 0xFF : 0; }
            @Override public int read16(int a) { return read8(a) | (read8(a + 1) << 8); }
            @Override public int read32(int a) { return read16(a) | (read16(a + 2) << 16); }
            @Override public void write8(int a, int v) {
                if (a >= 0 && a < ram.length) ram[a] = (byte) v;
            }
            @Override public void write16(int a, int v) { write8(a, v); write8(a + 1, v >> 8); }
            @Override public void write32(int a, int v) {
                if (a == DEVICE) {                      // periferico: reconhecimento da IRQ
                    core.setInterruptLine(false);
                    System.out.println("        periferico reconhecido: linha de IRQ baixa");
                    return;
                }
                write16(a, v); write16(a + 2, v >> 16);
            }
        };

        core = new ArmCore(bus, SwiDispatcher.empty(), ArmArchitecture.ARMV7A);
        core.setProgramCounter(0x20);                   // pula o vetor de reset: comeca em "reset"

        CpuMode modo = core.mode();
        CpuSleepState sono = core.sleepState();
        int passosDormindo = 0;
        for (int passo = 1; passo <= 200 && core.programCounter() != DONE; passo++) {
            core.step();

            if (core.sleepState() == CpuSleepState.HALTED && ++passosDormindo == 3) {
                System.out.printf("passo %3d: temporizador dispara -> linha de IRQ sobe%n", passo);
                core.setInterruptLine(true);            // acorda a CPU
                passosDormindo = 0;
            }
            if (core.mode() != modo || core.sleepState() != sono) {
                System.out.printf("passo %3d: pc=%08X modo=%-10s cpsr=%08X %s r4=%d%n",
                        passo, core.programCounter(), core.mode(), core.cpsr().get(),
                        core.sleepState(), core.register(4));
                if (core.mode() == CpuMode.UNDEFINED || core.mode() == CpuMode.IRQ) {
                    System.out.printf("           LR=%08X SPSR=%08X%n",
                            core.register(14), core.spsr(core.mode()));
                }
                modo = core.mode();
                sono = core.sleepState();
            }
        }
        System.out.printf("fim: pc=%08X r4=%d r5=0x%X modo=%s%n",
                core.programCounter(), core.register(4), core.register(5), core.mode());
    }
}
