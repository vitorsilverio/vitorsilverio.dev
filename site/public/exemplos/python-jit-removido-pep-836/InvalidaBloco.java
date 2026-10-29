import dev.vitorsilverio.armjitter.decoder.InstructionSet;
import dev.vitorsilverio.armjitter.jit.BlockCache;
import dev.vitorsilverio.armjitter.jit.BlockKey;
import dev.vitorsilverio.armjitter.jit.CompiledBlock;

/** Mostra a invalidação do cache de blocos do arm-jitter 1.5.0 por escrita em memória. */
public class InvalidaBloco {
    public static void main(String[] args) {
        BlockCache cache = new BlockCache(16);
        CompiledBlock bloco = core -> 0; // corpo irrelevante: só o cache importa aqui

        // Bloco ARM cobrindo [0x1000, 0x1010).
        BlockKey arm = new BlockKey(0x1000, InstructionSet.ARM);
        cache.put(arm, bloco, 0x1000, 0x1010);
        // Bloco Thumb de uma instrução (2 bytes) no meio de uma word: [0x2002, 0x2004).
        BlockKey thumb = new BlockKey(0x2002, InstructionSet.THUMB);
        cache.put(thumb, bloco, 0x2002, 0x2004);
        System.out.printf("inicio:                 blocos=%d geracao=%d%n", cache.size(), cache.generation());

        cache.invalidate(0x3000, 4);   // escrita em região sem código
        System.out.printf("escrita em 0x3000:      blocos=%d geracao=%d%n", cache.size(), cache.generation());

        cache.invalidate(0x1008, 4);   // escrita de 32 bits dentro do bloco ARM
        System.out.printf("escrita em 0x1008 (4B): blocos=%d geracao=%d%n", cache.size(), cache.generation());

        cache.invalidate(0x2000, 4);   // word em 0x2000 cobre [0x2000, 0x2004): pega o Thumb em 0x2002
        System.out.printf("escrita em 0x2000 (4B): blocos=%d geracao=%d%n", cache.size(), cache.generation());

        System.out.println("bloco ARM ainda no cache? " + cache.get(arm).isPresent());
    }
}
