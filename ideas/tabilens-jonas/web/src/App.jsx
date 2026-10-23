import { useEffect, useState } from 'react';
import { api } from './api.js';
import QueryInput from './components/QueryInput.jsx';
import SpotCard from './components/SpotCard.jsx';
import TimetableWidget from './components/TimetableWidget.jsx';
import AudioPlayer from './components/AudioPlayer.jsx';
import PipelineTrace from './components/PipelineTrace.jsx';
import MapView from './components/MapView.jsx';

export default function App() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ ok: false }));
  }, []);

  async function run(query, origin) {
    setLoading(true);
    setError(null);
    try {
      setPlan(await api.plan(query, origin));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-2xl font-bold text-moss-dark">TabiLens</h1>
            <span className="text-sm text-ink/60">旅レンズ · editorial day-trip copilot</span>
          </div>
          <ModeBadge health={health} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <QueryInput onSubmit={run} loading={loading} />

        {error && (
          <p className="mt-6 rounded-lg border border-maple/40 bg-maple/10 px-4 py-3 text-sm text-maple">{error}</p>
        )}

        {plan && (
          <div className="mt-8 grid gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-3">
              <SpotCard spot={plan.spot} />
              <MapView places={plan.places} />
            </div>
            <div className="space-y-6 lg:col-span-2">
              <TimetableWidget transit={plan.transit} />
              <AudioPlayer audio={plan.audio} />
              <PipelineTrace trace={plan.trace} billing={plan.billing} mode={plan.mode} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ModeBadge({ health }) {
  if (!health) return null;
  const live = health.mode === 'live';
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        !health.ok ? 'bg-maple/15 text-maple' : live ? 'bg-moss/15 text-moss' : 'bg-ink/10 text-ink/70'
      }`}
    >
      {!health.ok ? 'API offline' : live ? '● Live · Redpine MCP' : 'Mock mode'}
    </span>
  );
}
