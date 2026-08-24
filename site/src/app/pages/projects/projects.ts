import { Component, computed } from '@angular/core';
import { projects, type Project } from '../../data/projects';

@Component({
  selector: 'app-projects',
  templateUrl: './projects.html',
  styleUrl: './projects.css',
})
export class Projects {
  protected readonly projects: readonly Project[] = projects;

  protected readonly featured = computed(() =>
    this.projects.filter((p) => p.featured),
  );

  protected readonly others = computed(() =>
    this.projects.filter((p) => !p.featured),
  );
}
