import { Component, inject, ElementRef, effect } from '@angular/core';
import { SeoService } from '../../shared/seo.service';

interface ExperienceItem {
  readonly role: string;
  readonly company: string;
  readonly period: string;
  readonly description: string;
}

interface SkillGroup {
  readonly area: string;
  readonly items: readonly string[];
}

interface EducationItem {
  readonly course: string;
  readonly school: string;
  readonly period: string;
}

interface CertificationItem {
  readonly title: string;
  readonly issuer: string;
  readonly year: string;
}

@Component({
  selector: 'app-resume',
  templateUrl: './resume.html',
  styleUrl: './resume.css',
})
export class Resume {
  private readonly seo = inject(SeoService);
  private readonly host = inject(ElementRef);

  protected readonly name = 'Vítor Silvério Rodrigues';
  protected readonly headline = 'Analista Programador · Software Developer';
  protected readonly location = 'São Paulo, Brasil';

  protected readonly summary =
    'Analista Programador com trajetória em desenvolvimento de software voltado à produção acadêmica e sistemas institucionais. Experiência sólida com Java, Oracle e Delphi, e atualmente estudando Angular e TypeScript para construir este site e novos projetos web.';

  protected readonly experience: readonly ExperienceItem[] = [
    {
      role: 'Analista Programador',
      company: 'Fundunesp',
      period: 'Set 2022 — Atual',
      description:
        'Desenvolvimento de sistemas para Universidade Estadual Paulista (Unesp). Princpais Projetos: Portal Docentes Unesp, Repositório Institucional Unesp, SIGAD, Evoto - modulo de inscrições e  Assina Unesp.',
    },
    {
      role: 'Professor',
      company: 'Fatec de São Roque',
      period: 'Out 2025 — Jul 2026',
      description: 'Ministrou aulas na graduação de Sistemas para Internet. Disciplinas: Padrões de Projeto de Sítios de Internet I e II, e Desenvolvimento Mobile e Arquitetura Orientada a Serviços.',
    },
    {
      role: 'Analista Programador',
      company: 'Fundunesp — Coordenadoria Geral de Bibliotecas',
      period: 'Fev 2014 — Ago 2022',
      description:
        'Desenvolveu o Portal Docentes Unesp, o Repositório Institucional Unesp e a Biblioteca Digital da Unesp.',
    },
    {
      role: 'Analista de Sistemas / Desenvolvedor Java',
      company: 'EB Soluções em Informática',
      period: 'Nov 2012 — Jan 2014',
      description:
        'Análise de requisitos, desenvolvimento Java Desktop com Swing e Oracle Forms, ERP em Java e banco de dados Oracle.',
    },
    {
      role: 'Analista de Sistemas / Programador Delphi',
      company: 'Kely Cristina Bertin',
      period: 'Mar 2012 — Nov 2012',
      description: 'Desenvolvimento e manutenção de ERP feito em Delphi.',
    },
    {
      role: 'Estagiário',
      company: 'EFAP — Rede do Saber',
      period: 'Jul 2011 — Mar 2012',
      description: 'Suporte a videoconferências com Tandberg.',
    },
  ];

  protected readonly education: readonly EducationItem[] = [
    {
      course: 'Tecnologia em Análise e Desenvolvimento de Sistemas',
      school: 'Faculdade de Tecnologia de Sorocaba (FATEC)',
      period: '2009 — 2012',
    },
    {
      course: 'Especialização em Cyber Security',
      school: 'DARYUS Consultoria e Treinamento',
      period: '2017 — 2019',
    },
  ];

  protected readonly skills: readonly SkillGroup[] = [
    {
      area: 'Linguagens',
      items: ['Java', 'TypeScript', 'Python'],
    },
    {
      area: 'Backend & Dados',
      items: ['Oracle', 'Postgres', 'Spring Boot', 'JSF', 'Pandas', 'Docker', 'REST APIs'],
    },
    {
      area: 'Frontend & Web',
      items: ['Angular', 'Swing', 'HTML & CSS', 'Acessibilidade (WCAG)'],
    },
  ];

  protected readonly languages: readonly string[] = ['Português (nativo)', 'Inglês', 'Japonês'];

  protected readonly certifications: readonly CertificationItem[] = [
    {
      title: 'Linux LPI Essentials',
      issuer: 'Alura',
      year: '2018',
    },
    {
      title: 'Java e JSF I: sua aplicação web com JSF2',
      issuer: 'Alura',
      year: '2013',
    },
  ];

  protected readonly contacts = [
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/vitorsilverio/' },
    { label: 'GitHub', href: 'https://github.com/vitorsilverio' },
    { label: 'ORCID', href: 'https://orcid.org/0000-0002-0977-7196' },
    { label: 'Google Scholar', href: 'https://scholar.google.com/citations?user=Ry3UMIoAAAAJ' },
    { label: 'Lattes', href: 'https://lattes.cnpq.br/0431947295963541' },
  ];

  constructor() {
    this.seo.set({
      title: 'Currículo',
      description:
        'Currículo de Vítor Silvério Rodrigues: experiência em desenvolvimento de software, formação em Análise e Desenvolvimento de Sistemas e projetos com ARM e Angular.',
      url: '/curriculo',
    });

    // Marca /curriculo como página de autor (E-E-A-T): ProfilePage -> Person.
    effect(() => {
      const host = this.host.nativeElement as HTMLElement;
      this.seo.setJsonLd(
        'ld-author',
        {
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          mainEntity: {
            '@type': 'Person',
            name: this.name,
            url: 'https://vitorsilverio.dev/',
            sameAs: [
              'https://www.linkedin.com/in/vitorsilverio/',
              'https://github.com/vitorsilverio',
              'https://orcid.org/0000-0002-0977-7196',
              'https://scholar.google.com/citations?user=Ry3UMIoAAAAJ',
              'https://lattes.cnpq.br/0431947295963541',
            ],
            jobTitle: this.headline,
            description: this.summary,
          },
        },
        host,
      );
    });
  }
}
