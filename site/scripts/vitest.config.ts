import { defineConfig } from 'vitest/config';

// Mantém o cache do Vite/Vitest fora de scripts/ (o .gitignore só cobre /node_modules da raiz de site/).
export default defineConfig({
  cacheDir: '../node_modules/.vite-scripts',
});
