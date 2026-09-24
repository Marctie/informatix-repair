import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        chiSiamo: resolve(__dirname, 'chi-siamo.html'),
        servizi: resolve(__dirname, 'servizi.html'),
        portfolio: resolve(__dirname, 'portfolio.html'),
        contatti: resolve(__dirname, 'contatti.html'),
        notFound: resolve(__dirname, '404.html'),
      },
    },
  },
});