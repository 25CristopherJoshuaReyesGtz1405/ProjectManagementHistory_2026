import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8', // Motor de cobertura ultra rápido
      reporter: ['text', 'html', 'json-summary'], // Genera un reporte visual en HTML
      thresholds: {
        lines: 20,      // Línea base actual: 20.3%
        functions: 35,  // Línea base actual: 38.52%
        branches: 12,   // Línea base actual: 12.82%
        statements: 20  // Línea base actual: 20.22%
      },
      exclude: ['node_modules/', 'dist/', '**/*.module.ts', 'main.ts'] // Ignoramos archivos de configuración pura
    }
  },
  plugins: [
    swc.vite({ module: { type: 'es6' } }) // Para que compile TypeScript a velocidad de la luz
  ]
});