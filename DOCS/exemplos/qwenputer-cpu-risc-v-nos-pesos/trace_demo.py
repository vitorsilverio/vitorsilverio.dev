"""Mostra o rastro (trace) de tokens do modelo de referencia do Qwenputer.

Para um programa pequeno do repositorio, imprime, por instrucao: o PC (que NAO e guardado,
e reconstruido como ROM_BASE + 4*(ancora + n)), os tokens emitidos e o estado (ancora, n).
Ao fim, as estatisticas de tokens por instrucao.
"""
import sys

from chipformer.rv import ref
from chipformer.rv import spec as S
from chipformer.rv.programs import ALL, program

nome = sys.argv[1] if len(sys.argv) > 1 else "call"
m = ref.Machine.from_program(program(nome))
print(f"programa: {nome}   ROM_BASE={S.ROM_BASE:#x}   RAM={4 * S.RAM_WORDS // 1024} KB")
print(f"{'pc':>9} {'ancora':>6} {'n':>3}  tokens")
todos = [S.tok("GO")]
while not m.halted:
    pc, anc, n = m.pc, m.anchor, m.n
    toks = m.record()
    todos += toks
    fam = " ".join(f"{S.family(t)[0]}({S.family(t)[1]})" for t in toks)
    print(f"{pc:#9x} {anc:6d} {n:3d}  {fam}")
st = ref.trace_stats(todos)
print(f"\ntokens={st['tokens']} instrucoes={st['instructions']} "
      f"tokens/instrucao={st['tokens_per_instruction']:.2f} saida={bytes(m.out)!r} exit={m.exit_code}")
