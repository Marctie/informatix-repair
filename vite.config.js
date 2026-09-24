import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, existsSync } from 'fs';

// Pagine del blog generate da scripts/build-blog.mjs
const blogPages = existsSync('blog')
  ? Object.fromEntries(readdirSync('blog').filter((f) => f.endsWith('.html')).map((f) => ['blog_' + f.replace('.html', ''), resolve(__dirname, 'blog', f)]))
  : {};

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
        privacy: resolve(__dirname, 'privacy.html'),
        blog: resolve(__dirname, 'blog.html'),
        ...blogPages,
        notFound: resolve(__dirname, '404.html'),
      },
    },
  },
});