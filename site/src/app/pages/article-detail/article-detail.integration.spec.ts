import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { ArticleDetail } from './article-detail';
import { routes } from '../../app.routes';

describe('ArticleDetail (integração, rota lazy)', () => {
  it('renderiza o artigo via rota lazy e aplica highlight nos blocos de código', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideLocationMocks()],
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/artigos/hello-armbox', ArticleDetail);

    const el = harness.routeNativeElement!;
    const asm = el.querySelector('code.language-armasm');
    const bash = el.querySelector('code.language-bash');

    expect(asm).toBeTruthy();
    expect(bash).toBeTruthy();
    expect(asm!.querySelector('.token')).toBeTruthy();
    expect(bash!.querySelector('.token')).toBeTruthy();
  });
});
