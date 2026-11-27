import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  handleCheckRevision,
  handleCoachFeedback,
  handleHealth,
} from './src/server/coachHandlers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (req, res) => {
    void handleHealth(req, res);
  });

  app.post('/api/coach/feedback', (req, res) => {
    void handleCoachFeedback(req, res);
  });

  app.post('/api/coach/check-revision', (req, res) => {
    void handleCheckRevision(req, res);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pick & Write! server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
