import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          // в dev-режиме обслуживает /api/* так же, как Vercel в проде
          name: 'api-dev',
          configureServer(server) {
            // серверные секреты (DATABASE_URL, AUTH_SECRET, GEMINI_API_KEY) остаются только в процессе dev-сервера
            for (const [key, value] of Object.entries(env)) process.env[key] ??= value;
            server.middlewares.use('/api', async (req, res, next) => {
              const name = (req.url || '').split('?')[0].replace(/^\/+|\/+$/g, '');
              if (!/^[a-z]+$/.test(name)) return next();
              try {
                const { default: handler } = await server.ssrLoadModule(`/api/${name}.ts`);
                await handler(req, res);
              } catch (e) {
                server.ssrFixStacktrace(e as Error);
                console.error(e);
                res.statusCode = 404;
                res.end(JSON.stringify({ status: 'error', message: 'Not found' }));
              }
            });
          }
        }
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
