"""Compara o modelo de referencia do Qwenputer (ref.Rv32) com o qemu-riscv32 ao vivo.

Para cada ELF *.qemu.elf: roda no qemu-riscv32 (processo real, nao o qemu.json do repo)
e na referencia em Python; compara codigo de saida e stdout. Imprime tambem o numero de
instrucoes que a referencia executou.
"""
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from chipformer.rv import elf, ref

if os.environ.get("MUTANTE"):
    # Controle negativo: estraga a referencia (SRA/SRAI passam a deslocar sem sinal)
    # para provar que a comparacao com o qemu enxerga um erro de verdade.
    _alu = ref.alu
    ref.alu = lambda op, a, b: _alu({"SRA": "SRL", "SRAI": "SRLI"}.get(op, op), a, b)

DATA = Path(os.environ.get("ELFS", "tests/data/rv"))
SKIP = {"c-sudoku", "c-fib"}  # 8,4M e 2,1M de instrucoes: lentos em Python puro


def run_ref(path):
    cpu = ref.Rv32()
    elf.load_into(cpu, path)
    cpu.x[2] = 0x7FFF0000  # sp, igual ao teste do repositorio
    while not cpu.halted and cpu.steps < 2 * 10**7:
        cpu.step()
    return cpu


def run_qemu(path):
    # o qemu-user recusa (Exec format error) ELF sem bit de execucao, e o repositorio os
    # guarda como 0644: copia para um diretorio temporario com chmod 755.
    with tempfile.TemporaryDirectory() as d:
        exe = Path(d) / "prog.elf"
        shutil.copy(path, exe)
        exe.chmod(0o755)
        r = subprocess.run(["qemu-riscv32", "-cpu", "rv32,zba=true", str(exe)],
                           capture_output=True, timeout=120)
    return r.returncode, r.stdout.decode("latin-1")


names = sorted(p.name[: -len(".qemu.elf")] for p in DATA.glob("*.qemu.elf"))
ok = bad = 0
total = 0
for n in names:
    if n in SKIP:
        print(f"{n:16} (pulado: longo)")
        continue
    p = DATA / f"{n}.qemu.elf"
    cpu = run_ref(p)
    qcode, qout = run_qemu(p)
    same = (cpu.exit_code & 0xFF) == qcode and cpu.out.decode("latin-1") == qout
    ok += same
    bad += not same
    total += cpu.steps
    print(f"{n:16} {'OK ' if same else 'DIFF'} exit={qcode:3d} instr={cpu.steps:8d}")
print(f"\n{ok} iguais, {bad} diferentes, {total} instrucoes na referencia")
sys.exit(1 if bad else 0)
