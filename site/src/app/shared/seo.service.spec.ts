import { TestBed } from '@angular/core/testing';
import { SeoService } from './seo.service';

const meta = (sel: string): string | null =>
  document.head.querySelector(sel)?.getAttribute('content') ?? null;

describe('SeoService', () => {
  let seo: SeoService;

  beforeEach(() => {
    seo = TestBed.inject(SeoService);
  });

  it('usa summary_large_image e permite miniatura grande', () => {
    seo.set({ title: 'X', image: '/assets/covers/x.png' });
    expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(meta('meta[name="twitter:image"]')).toBe(
      'https://vitorsilverio.dev/assets/covers/x.png',
    );
    expect(meta('meta[name="robots"]')).toBe('max-image-preview:large');
  });

  it('noindex mantém follow e a miniatura grande, e volta ao normal na página seguinte', () => {
    seo.set({ title: 'Fina', noindex: true });
    expect(meta('meta[name="robots"]')).toBe('noindex, follow, max-image-preview:large');
    seo.set({ title: 'Normal' });
    expect(meta('meta[name="robots"]')).toBe('max-image-preview:large');
  });

  it('canonical e og:url levam barra final', () => {
    seo.set({ title: 'Tag', url: '/tags/arm' });
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://vitorsilverio.dev/tags/arm/',
    );
    expect(meta('meta[property="og:url"]')).toBe('https://vitorsilverio.dev/tags/arm/');
  });
});
