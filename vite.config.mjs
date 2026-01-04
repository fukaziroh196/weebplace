import { svelte } from '@sveltejs/vite-plugin-svelte';

/** @type {import('vite').UserConfig} */
export default {
  plugins: [
    svelte(),
    // SPA fallback - redirect all non-file requests to index.html
    {
      name: 'spa-fallback',
      configureServer(server) {
        return () => {
          server.middlewares.use((req, res, next) => {
            const url = req.url || '';
            // Skip files with extensions, API routes, and proxy
            if (url.includes('.') || url.startsWith('/api') || url.startsWith('/proxy')) {
              return next();
            }
            // Rewrite to index.html for SPA routing
            req.url = '/index.html';
            next();
          });
        };
      }
    },
    // Lightweight dev-only proxy to bypass CORS when running in the browser
    {
      name: 'dev-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          try {
            const url = req.url || '';
            if (!url.startsWith('/proxy')) return next();
            const u = new URL(url, 'http://localhost');
            const target = u.searchParams.get('url');
            if (!target) {
              res.statusCode = 400;
              res.end('Missing url');
              return;
            }
            // Prefer Node's http/https to avoid missing fetch in older Node
            const dest = new URL(target);
            const isHttps = dest.protocol === 'https:';
            const mod = await import(isHttps ? 'node:https' : 'node:http');
            const headers = {
              'accept': req.headers['accept'] || '*/*',
              'user-agent': req.headers['user-agent'] || 'Mozilla/5.0',
            };
            const options = {
              protocol: dest.protocol,
              hostname: dest.hostname,
              port: dest.port || (isHttps ? 443 : 80),
              path: dest.pathname + dest.search,
              method: 'GET',
              headers
            };
            const upstreamReq = mod.request(options, (upstreamRes) => {
              res.statusCode = upstreamRes.statusCode || 502;
              const allowed = new Set(['content-type', 'cache-control', 'expires', 'last-modified']);
              Object.entries(upstreamRes.headers || {}).forEach(([k, v]) => {
                if (allowed.has(String(k).toLowerCase()) && v) res.setHeader(k, v);
              });
              res.setHeader('Access-Control-Allow-Origin', '*');
              upstreamRes.on('error', () => {});
              upstreamRes.pipe(res);
            });
            upstreamReq.on('error', (err) => {
              res.statusCode = 502;
              res.end('Upstream error: ' + (err?.message || 'error'));
            });
            upstreamReq.end();
          } catch (e) {
            res.statusCode = 500;
            res.end('Proxy error: ' + (e?.message || 'unknown'));
          }
        });
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    open: false
  }
};