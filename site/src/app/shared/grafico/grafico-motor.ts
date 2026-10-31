import { InjectionToken } from '@angular/core';
import type { EChartsType } from 'echarts/core';

/** A parte da API do ECharts que o componente usa (facilita trocar por um dublê nos testes). */
export type Instancia = Pick<
  EChartsType,
  'setOption' | 'dispatchAction' | 'resize' | 'dispose' | 'on' | 'getOption' | 'renderToSVGString'
>;

export interface OpcoesInit {
  renderer: 'svg';
  /** Sem DOM (pré-render): exige `width` e `height`. */
  ssr?: boolean;
  width?: number;
  height?: number;
}

export interface Motor {
  criar(elemento: HTMLElement | null, opcoes: OpcoesInit): Instancia;
}

/**
 * Carregador do ECharts. O `import()` abaixo é o que mantém a biblioteca num chunk lazy; nos
 * testes, `provide: GRAFICO_MOTOR, useValue: () => Promise.resolve(dubla)` evita carregá-la.
 */
export const GRAFICO_MOTOR = new InjectionToken<() => Promise<Motor>>('GRAFICO_MOTOR', {
  providedIn: 'root',
  factory: () => () => import('./echarts-lazy').then((m) => m.motor),
});
