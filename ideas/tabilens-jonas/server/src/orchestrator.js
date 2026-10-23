// The 3-step pipeline from the proposal:
//   1. Editorial spot extraction (ADDIX via Redpine, include_figures)
//   2. Zero-hallucination transit routing (tobu--* tools)
//   3. Commute audio (Chronicle via Redpine, include_audio)
import { config, isLive } from './config.js';
import { redpine, previewThenConfirm } from './redpine.js';
import { parseIntent } from './intent.js';
import { mockItinerary } from './mock.js';
import * as norm from './normalize.js';

async function timed(trace, step, fn) {
  const t0 = Date.now();
  try {
    const out = await fn();
    trace.push({ step, status: 'ok', ms: Date.now() - t0 });
    return out;
  } catch (e) {
    trace.push({ step, status: 'error', ms: Date.now() - t0, error: String(e.message || e) });
    return null;
  }
}

export async function planTrip({ query, origin = 'Asakusa' }) {
  if (!isLive()) return mockItinerary({ query, origin });

  const trace = [];
  const billing = { spentUsd: 0, items: [], pending: [] };
  const intent = parseIntent(query);
  trace.push({ step: 'intent', status: 'ok', ms: 0 });

  // ---- 1. Editorial spot -------------------------------------------------
  const spotRes = await timed(trace, 'redpine.preview→confirm(magazines)', () =>
    previewThenConfirm(
      config.tools.magazineSearch,
      { query: intent.searchSentence, top_k: 5 },
      { include_figures: true }
    )
  );
  trackBilling(billing, 'ADDIX magazines', spotRes);
  const spot = norm.spotFrom(spotRes?.unlocked ?? spotRes?.preview, intent);

  // ---- 2. Transit ------------------------------------------------------------
  const destName = spot?.nearestStation || intent.destinationStation || 'Tobu-Nikko';

  const [originStop, destStop] = await Promise.all([
    timed(trace, 'tobu.find_stop(origin)', () => redpine.callTool(config.tools.findStop, { query: origin })),
    timed(trace, 'tobu.find_stop(dest)', () => redpine.callTool(config.tools.findStop, { query: destName })),
  ]);
  const fromId = norm.stopId(originStop) ?? origin;
  const toId = norm.stopId(destStop) ?? destName;

  const [departures, busLinks] = await Promise.all([
    timed(trace, 'tobu.rail_departures', () =>
      redpine.callTool(config.tools.railDepartures, { from: fromId, to: toId })
    ),
    timed(trace, 'tobu.station_bus_links', () =>
      redpine.callTool(config.tools.busLinks, { station: toId })
    ),
  ]);
  const transit = norm.transitFrom({ departures, busLinks, origin, destName });

  // ---- 3. Commute audio --------------------------------------------------------
  const rideMinutes = norm.rideMinutes(transit) ?? 110;
  const audioRes = await timed(trace, 'redpine.preview→confirm(audio)', () =>
    previewThenConfirm(
      config.tools.audioSearch,
      { query: `${spot?.area || destName} travel, nature and local culture`, top_k: 3 },
      { include_audio: true }
    )
  );
  trackBilling(billing, 'Chronicle audio', audioRes);
  const audio = norm.audioFrom(audioRes?.unlocked ?? audioRes?.preview, rideMinutes);

  const places = norm.placesFrom({
    origin,
    originStop,
    destName,
    destStop,
    transit,
    spot,
    spotRaw: spotRes?.unlocked ?? spotRes?.preview,
  });

  return { mode: 'live', query, origin, intent, spot, transit, places, audio, billing, trace };
}

function trackBilling(billing, label, res) {
  if (!res) return;
  if (res.autoConfirmed) {
    billing.spentUsd += res.costUsd;
    billing.items.push({ label, usd: res.costUsd });
  } else if (res.queryId) {
    // Over the auto-confirm limit: surface to UI so the presenter can unlock manually.
    billing.pending.push({ label, usd: res.costUsd, queryId: res.queryId });
  }
}

export async function confirmPending({ queryId, include_figures, include_audio }) {
  if (!isLive()) return { mode: 'mock', ok: true };
  return redpine.confirm(queryId, { include_figures, include_audio });
}
