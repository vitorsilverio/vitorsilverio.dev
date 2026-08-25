import { Component, computed, input, signal } from '@angular/core';

@Component({
  selector: 'app-share-buttons',
  templateUrl: './share-buttons.html',
  styleUrl: './share-buttons.css',
})
export class ShareButtons {
  readonly url = input.required<string>();
  readonly title = input<string>('');

  protected readonly copied = signal(false);

  protected readonly links = computed(() => {
    const u = encodeURIComponent(this.url());
    const t = encodeURIComponent(this.title());
    return {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      x: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
      whatsapp: `https://wa.me/?text=${t}%20${u}`,
    };
  });

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.copied.set(false);
    }
  }
}
