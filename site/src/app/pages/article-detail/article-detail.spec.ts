import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { ArticleHelloArmbox } from './posts/hello-armbox';

@Component({
  imports: [ArticleHelloArmbox],
  template: `<app-article-hello-armbox />`,
})
class Host {}

describe('Syntax highlight (build-time)', () => {
  it('o código do artigo já vem com tokens do Prism no template', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideLocationMocks()],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();

    const asm = fixture.nativeElement.querySelector('code.language-armasm');
    const bash = fixture.nativeElement.querySelector('code.language-bash');

    expect(asm).toBeTruthy();
    expect(bash).toBeTruthy();
    expect(asm.querySelector('.token')).toBeTruthy();
    expect(bash.querySelector('.token')).toBeTruthy();
  });
});
