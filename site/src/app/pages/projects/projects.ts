import { Component, computed, inject } from '@angular/core';
import { projects, type Project } from '../../data/projects';
import { SeoService } from '../../shared/seo.service';

@Component({
  selector: 'app-projects',
  templateUrl: './projects.html',
  styleUrl: './projects.css',
})
export class Projects {
  private readonly seo = inject(SeoService);
  protected readonly projects: readonly Project[] = projects;

  protected readonly featured = computed(() =>
    this.projects.filter((p) => p.featured),
  );

  protected readonly others = computed(() =>
    this.projects.filter((p) => !p.featured),
  );

  constructor() {
    this.seo.set({
      title: 'Projetos',
      description:
        'Projetos de Vítor Silvério: arm-jitter (emulador ARM de código aberto), arm-box e outras iniciativas de engenharia de software.',
      url: '/projetos',
    });
  }
}
