import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type ViteDevServer} from 'vite';
import geminiHandler from './api/gemini-chat';

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), 'GEMINI_');
  for (const key of ['GEMINI_API_KEY', 'GEMINI_MODEL']) {
    if (!process.env[key] && serverEnv[key]) process.env[key] = serverEnv[key];
  }
  const geminiApi = {
    name: 'local-gemini-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/gemini-chat', async (req, res) => {
        const response = {
          setHeader: (name: string, value: string) => res.setHeader(name, value),
          status(code: number) { res.statusCode = code; return this; },
          json(body: unknown) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); },
        };
        if (req.method !== 'POST') return geminiHandler(req, response);
        try {
          let body = '';
          for await (const chunk of req) {
            body += chunk.toString();
            if (Buffer.byteLength(body, 'utf8') > 1100000) return response.status(413).json({ error: '분석 자료가 너무 큽니다.' });
          }
          let parsed: unknown;
          try { parsed = JSON.parse(body); } catch { return response.status(400).json({ error: '올바른 JSON 요청이 필요합니다.' }); }
          await geminiHandler({ method: req.method, body: parsed }, response);
        } catch {
          if (!res.writableEnded) response.status(500).json({ error: 'AI 서버 요청을 처리하지 못했습니다.' });
        }
      });
    },
  };
  return {
    plugins: [react(), tailwindcss(), geminiApi],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
