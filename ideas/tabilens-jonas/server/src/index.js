import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, isLive } from './config.js';
import { planTrip, confirmPending } from './orchestrator.js';
import { redpine } from './redpine.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  const out = { ok: true, mode: config.mode };
  if (isLive()) {
    try {
      out.balance = await redpine.getBalance();
    } catch (e) {
      out.ok = false;
      out.error = String(e.message || e);
    }
  }
  res.json(out);
});

app.post('/api/plan', async (req, res) => {
  const { query, origin } = req.body || {};
  if (!query) return res.status(400).json({ error: 'query is required' });
  try {
    res.json(await planTrip({ query, origin }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Manual unlock for searches above MAX_AUTO_CONFIRM_USD.
app.post('/api/confirm', async (req, res) => {
  try {
    res.json(await confirmPending(req.body || {}));
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Dev helper: explore the per-account catalog at the venue.
app.get('/api/tools', async (req, res) => {
  if (!isLive()) return res.json({ mode: 'mock', note: 'Set TABILENS_MODE=live to query the catalog.' });
  try {
    res.json(await redpine.findTools(req.query.q ? { query: req.query.q } : {}));
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Serve the built frontend in production (npm run build && npm start).
const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
app.use(express.static(webDist));
app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));

app.listen(config.port, () => {
  console.log(`TabiLens API on http://localhost:${config.port}  [mode: ${config.mode}]`);
});
