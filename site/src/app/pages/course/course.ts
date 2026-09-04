import { Component, ElementRef, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { courseModules } from '../../data/course';
import { SeoService } from '../../shared/seo.service';

@Component({
  imports: [RouterLink],
  selector: 'app-course',
  templateUrl: './course.html',
  styleUrl: './course.css',
})
export class Course {
  private readonly seo = inject(SeoService);
  private readonly host = inject(ElementRef);

  protected readonly modules = courseModules;

  protected readonly resources = [
    { label: 'arm-jitter (código)', href: 'https://github.com/vitorsilverio/arm-jitter' },
    {
      label: 'arm-jitter (Javadoc)',
      href: 'https://javadoc.io/doc/dev.vitorsilverio/arm-jitter/latest/index.html',
    },
    { label: 'armbox', href: 'https://github.com/vitorsilverio/armbox' },
    { label: 'virtual-arm-box', href: 'https://github.com/vitorsilverio/virtual-arm-box' },
    { label: 'gbaemu', href: 'https://github.com/vitorsilverio/gbaemu' },
    { label: 'ndsemu', href: 'https://github.com/vitorsilverio/ndsemu' },
    { label: 'n3dsemu', href: 'https://github.com/vitorsilverio/n3dsemu' },
  ];

  // Exemplos de código da trilha, servidos em /curso-arm/exemplos/<file>
  // (espelho de DOCS/curso-arm/exemplos/ via scripts/gen-examples.mjs).
  // Cada .s tem o .elf pré-montado ao lado.
  protected readonly examples = [
    { file: 'cpsr.s', lesson: 'M1.1', desc: 'Lê o CPSR em três momentos — N e Z mudando.' },
    { file: 'anat.s', lesson: 'M1.3', desc: 'Dez instruções para ver a codificação no objdump.' },
    { file: 'pcoffset.s', lesson: 'M1.4', desc: 'Prova que R15 lê como "instrução + 8".' },
    { file: 'soma.c', lesson: 'M2.1', desc: 'Soma de 1 a n — compilada em -O0 e -O2.' },
    { file: 'thumb1.s', lesson: 'M2.3', desc: 'Laço Thumb de 16 bits para decodificar à mão.' },
    { file: 'fib.s', lesson: 'M3.1', desc: 'Fibonacci iterativo; retorno via exit code.' },
    { file: 'max.s', lesson: 'M3.1', desc: 'Máximo de dois números sem um único desvio.' },
    { file: 'user.ld', lesson: 'M3.2', desc: 'Linker script mínimo para os exemplos user-mode.' },
    { file: 'soma5.s', lesson: 'M3.2', desc: 'Soma de vetor; ligado com user.ld, extraído com objcopy.' },
    { file: 'java/TraceSoma.java', lesson: 'M3.4', desc: 'Embute o arm-jitter e traça o laço instrução a instrução.' },
    { file: 'svc.s', lesson: 'M4.1', desc: 'Duas instruções que disparam uma exceção SWI.' },
    { file: 'java/ExcecaoSwi.java', lesson: 'M4.1', desc: 'Mostra a entrada no vetor 0x08: troca de modo, SPSR, LR.' },
    { file: 'isa-v5te.s', lesson: 'M5.2', desc: 'Instruções novas do ARMv5TE (CLZ, BLX, DSP).' },
    { file: 'isa-v6k.s', lesson: 'M5.3', desc: 'ARMv6K: LDREX/STREX, SIMD paralelo, REV, SETEND.' },
    { file: 'isa-thumb2.s', lesson: 'M5.4', desc: 'Thumb-2: MOVW/MOVT, IT block, formas .W.' },
    { file: 'isa-v7a-vfp.s', lesson: 'M5.5', desc: 'ARMv7-A + VFPv2: bitfield, SDIV, RBIT, VADD.F64.' },
    { file: 'hello-cortexm.c', lesson: 'M5.6', desc: 'Firmware bare-metal Cortex-M com tabela de vetores.' },
    { file: 'ldrex.s', lesson: 'M7.2', desc: 'Incremento atômico com LDREX/STREX e retry.' },
  ];

  protected readonly total = computed(() =>
    this.modules.reduce((n, mod) => n + mod.lessons.length, 0),
  );
  protected readonly published = computed(() =>
    this.modules.reduce(
      (n, mod) => n + mod.lessons.filter((l) => l.status === 'published').length,
      0,
    ),
  );

  constructor() {
    this.seo.set({
      title: 'Curso de Arquitetura ARM',
      description:
        'Trilha prática de arquitetura ARM baseada em código real: o emulador arm-jitter e seus consumidores (armbox, gbaemu, ndsemu, n3dsemu, virtual-arm-box). Do ARMv4T ao AArch64.',
      url: '/curso-arm',
    });

    effect(() => {
      const host = this.host.nativeElement as HTMLElement;
      this.seo.setJsonLd(
        'ld-course',
        {
          '@context': 'https://schema.org',
          '@type': 'Course',
          name: 'Arquitetura ARM na prática',
          description:
            'Curso técnico baseado em código real (arm-jitter, armbox e emuladores de GBA/NDS/3DS): registradores e CPSR, leitura de binário ARM/Thumb, execução no arm-box, internos de um emulador e a evolução da arquitetura até o AArch64.',
          inLanguage: 'pt-BR',
          isAccessibleForFree: true,
          url: 'https://vitorsilverio.dev/curso-arm/',
          about: ['ARM architecture', 'Assembly language', 'CPU emulation', 'JIT compilation'],
          provider: {
            '@type': 'Person',
            name: 'Vítor Silvério',
            url: 'https://vitorsilverio.dev/',
          },
          hasPart: this.modules.flatMap((mod) =>
            mod.lessons
              .filter((l) => l.status === 'published')
              .map((l) => ({
                '@type': 'LearningResource',
                name: l.title,
                url: `https://vitorsilverio.dev/artigos/${l.slug}/`,
              })),
          ),
        },
        host,
      );
    });
  }
}
