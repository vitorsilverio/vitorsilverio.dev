import dev.vitorsilverio.armjitter.arch.ArmArchitecture;
import dev.vitorsilverio.armjitter.decoder.ArmDecoder;
import dev.vitorsilverio.armjitter.decoder.DecodedInstruction;
import dev.vitorsilverio.armjitter.memory.AddressSpace;

/**
 * Decodifica palavras ARM de 32 bits com o ArmDecoder e mostra os campos extraídos.
 *   javac -cp arm-jitter-1.4.0.jar AnatomiaDecoder.java
 *   java  -cp "arm-jitter-1.4.0.jar;." AnatomiaDecoder      (Linux/macOS: use ":" no lugar de ";")
 */
public final class AnatomiaDecoder {
    public static void main(String[] args) {
        int[] palavras = {
            0xE0810002,   // add   r0, r1, r2
            0xE2810C3F,   // add   r0, r1, #0x3F00
            0x00810002,   // addeq r0, r1, r2
            0xE0910002,   // adds  r0, r1, r2
            0xE5B10004,   // ldr   r0, [r1, #4]!
            0xE4910004,   // ldr   r0, [r1], #4
        };
        ArmDecoder decoder = new ArmDecoder(ArmArchitecture.ARMV7A);
        for (int i = 0; i < palavras.length; i++) {
            final int base = i * 4;
            final int palavra = palavras[i];
            AddressSpace memoria = new AddressSpace() {
                public int read8(int x)  { return 0; }
                public int read16(int x) { return 0; }
                public int read32(int x) { return x == base ? palavra : 0; }
                public void write8(int x, int v)  { }
                public void write16(int x, int v) { }
                public void write32(int x, int v) { }
            };
            DecodedInstruction d = decoder.decode(memoria, base);
            System.out.printf("%08x  cond=%-2s kind=%-12s rd=%2d rn=%2d rm=%2d imm=%-6s immOp=%-5b S=%-5b wb=%-5b post=%-5b%n",
                    d.raw(), d.condition(), d.kind(), d.destinationRegister(), d.sourceRegister(),
                    d.secondSourceRegister(), d.immediateOperand() ? "0x" + Integer.toHexString(d.immediate()) : "-", d.immediateOperand(), d.setFlags(),
                    d.writeback(), d.postIndexed());
        }
    }
}
