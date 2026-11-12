import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, existsSync } from 'fs';

// Pagine del blog generate da scripts/build-blog.mjs
const blogPages = existsSync('blog')
  ? Object.fromEntries(readdirSync('blog').filter((f) => f.endsWith('.html')).map((f) => ['blog_' + f.replace('.html', ''), resolve(__dirname, 'blog', f)]))
  : {};

// In locale (npm run dev / preview) serve /servizi come servizi.html, come fa Cloudflare Pages online.
const cleanUrls = () => {
  const rewrite = (root) => (req, _res, next) => {
    const [path, query = ''] = req.url.split('?');
    if (path !== '/' && !/\.[a-z0-9]+$/i.test(path) && existsSync(resolve(root, '.' + path + '.html'))) {
      req.url = path + '.html' + (query ? '?' + query : '');
    }
    next();
  };
  return {
    name: 'clean-urls',
    configureServer: (s) => void s.middlewares.use(rewrite(__dirname)),
    configurePreviewServer: (s) => void s.middlewares.use(rewrite(resolve(__dirname, 'dist'))),
  };
};

export default defineConfig({
  base: '/',
  plugins: [cleanUrls()],
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
        usati: resolve(__dirname, 'usati.html'),
        segui: resolve(__dirname, 'segui-riparazione.html'),
        ...blogPages,
        notFound: resolve(__dirname, '404.html'),
      },
    },
  },
});