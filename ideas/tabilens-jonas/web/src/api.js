async function req(path, opts) {
  const res = await fetch(path, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

const qs = (params) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();

export const api = {
  health: () => req('/api/health'),
  explore: ({ title, name, area, lat, lng }) => req(`/api/explore?${qs({ title, name, area, lat, lng })}`),
  nearby: (lat, lng) => req(`/api/nearby?${qs({ lat, lng })}`),
  plan: (query, origin) =>
    req('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, origin }),
    }),
};
