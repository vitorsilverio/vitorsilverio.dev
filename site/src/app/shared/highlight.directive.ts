import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';
import Prism from 'prismjs';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-armasm';
import 'prismjs/components/prism-typescript';

@Directive({
  selector: '[appHighlight]',
})
export class HighlightDirective implements AfterViewInit {
  private readonly host = inject(ElementRef);

  ngAfterViewInit(): void {
    Prism.highlightAllUnder(this.host.nativeElement);
  }
}
