import { init, use } from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type { Motor } from './grafico-motor';

/**
 * Único arquivo que importa o ECharts em tempo de execução. É carregado por `import()` dinâmico
 * (ver `grafico-motor.ts`), então o esbuild o separa num chunk lazy: o ECharts nunca entra no
 * bundle inicial nem no chunk de um artigo sem gráfico. Import parcial: só barras, linhas, grade,
 * dica, legenda (sem desenho próprio, só o estado de série oculta) e zoom, com o renderizador SVG.
 */
use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  SVGRenderer,
]);

export const motor: Motor = {
  criar: (el, opcoes) => init(el, null, opcoes),
};
