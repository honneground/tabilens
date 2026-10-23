import { useState } from 'react';

const ORIGINS = ['Asakusa', 'Tokyo Skytree', 'Kita-Senju', 'Ikebukuro'];
const EXAMPLES = [
  'Beginner hike with scenic lake views and onsen',
  'Easy autumn leaves walk near Nikko',
  'Riverside cycling along Arakawa',
];

export default function QueryInput({ onSubmit, loading }) {
  const [query, setQuery] = useState(EXAMPLES[0]);
  const [origin, setOrigin] = useState(ORIGINS[0]);

  const submit = (e) => {
    e.preventDefault();
    if (query.trim()) onSubmit(query.trim(), origin);
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-white/70 p-5 shadow-sm">
      <label className="mb-2 block font-display text-lg text-moss-dark">Where does your mood want to go today?</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Scenic autumn hike near Nikko"
          className="flex-1 rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-moss"
        />
        <select
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          className="rounded-xl border border-line bg-white px-3 py-3"
          aria-label="Origin station"
        >
          {ORIGINS.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <button
          disabled={loading}
          className="rounded-xl bg-moss px-6 py-3 font-medium text-white transition hover:bg-moss-dark disabled:opacity-50"
        >
          {loading ? 'Planning…' : 'Plan my escape'}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            type="button"
            key={ex}
            onClick={() => setQuery(ex)}
            className="rounded-full border border-line px-3 py-1 text-xs text-ink/70 hover:border-moss hover:text-moss"
          >
            {ex}
          </button>
        ))}
      </div>
    </form>
  );
}
