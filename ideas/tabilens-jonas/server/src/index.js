import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, isLive } from './config.js';
import { planTrip, confirmPending } from './orchestrator.js';
import { redpine } from './redpine.js';
import { wikiExplore, wikiNearby, placeQueries } from './wikipedia.js';

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

// Topic explorer (Wikipedia): ?title=Lake Chūzenji, or ?name=<spot name>&area=<spot area> to find one.
// Optional ?lat=&lng= searches "nearby" around that point instead of the article's own coordinates.
app.get('/api/explore', async (req, res) => {
  const { title, name, area } = req.query;
  const queries = placeQueries({ name, area });
  if (!title && !queries.length) return res.status(400).json({ error: 'title or name is required' });
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const near = Number.isFinite(lat) && Number.isFinite(lng) && req.query.lat ? { lat, lng } : undefined;
    const node = await wikiExplore({ title, queries, near });
    if (!node) return res.status(404).json({ error: 'No Wikipedia article found' });
    res.json(node);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

// Articles near a point, e.g. the traveler's current location.
app.get('/api/nearby', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'lat and lng are required' });
  try {
    res.json({ nearby: await wikiNearby({ lat, lng }) });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
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
