import { TestBed } from '@angular/core/testing';
import { provideRouter, Routes } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { ArticleDetail } from './article-detail';

const routes: Routes = [{ path: 'artigos/:slug', component: ArticleDetail }];

describe('ArticleDetail (integração)', () => {
  it('renderiza o artigo e aplica highlight nos blocos de código', () => {
    TestBed.configureTestingModule({
      imports: [ArticleDetail],
      providers: [provideRouter(routes), provideLocationMocks()],
    });

    const fixture = TestBed.createComponent(ArticleDetail);
    fixture.componentRef.setInput('slug', 'hello-armbox');
    fixture.detectChanges();

    const asm = fixture.nativeElement.querySelector('code.language-armasm');
    const bash = fixture.nativeElement.querySelector('code.language-bash');

    expect(asm).toBeTruthy();
    expect(bash).toBeTruthy();
    expect(asm.querySelector('.token')).toBeTruthy();
    expect(bash.querySelector('.token')).toBeTruthy();
  });
});
