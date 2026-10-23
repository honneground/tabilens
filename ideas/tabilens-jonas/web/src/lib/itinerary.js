// Step 2: turn a plan (plus the topics saved in step 1) into a trip document.
// TripDoc renders it for screen and print; buildMarkdown makes the .md download.
import { buildDirectionsUrl } from '../components/MapView.jsx';
import { dayLabel, fmtTemp } from '../components/WeatherCard.jsx';

export function tripWeather(plan) {
  const days = plan.weather?.days ?? [];
  const day = days.find((d) => d.date === plan.tripDate);
  if (day) return { day };
  const last = days[days.length - 1]?.date;
  if (plan.tripDate && last && plan.tripDate > last) return { tooFar: true };
  return null;
}

export const legLine = (l) =>
  [
    `${l.depart ?? '?'} → ${l.arrive ?? '?'}`,
    `${l.type === 'bus' ? 'Bus' : 'Train'}: ${l.service}`,
    `${l.from} → ${l.to}`,
    l.platform && `platform ${l.platform}`,
    l.stop && l.stop,
    l.reserved && 'reserved seats',
  ]
    .filter(Boolean)
    .join(' · ');

export const longDate = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00+09:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Tokyo',
      })
    : 'Date to be decided';

// "Arakawa_River_(Kantō)" would end a Markdown link at the first ")".
const mdUrl = (u) => String(u).replace(/\(/g, '%28').replace(/\)/g, '%29');

export function buildMarkdown(plan, saved = []) {
  const { spot = {}, transit = {} } = plan;
  const w = tripWeather(plan);
  const maps = buildDirectionsUrl(plan.places ?? []);
  const c = spot.citation ?? {};
  const out = [];
  const add = (...lines) => out.push(...lines);

  add(`# Day trip: ${spot.name}`, '', `**${longDate(plan.tripDate)}** · from ${plan.origin} · ${spot.area}`, '');

  add('## Overview', '');
  const stats = [
    spot.difficulty && `Level: ${spot.difficulty}`,
    spot.distanceKm && `Distance: ${spot.distanceKm} km`,
    spot.elevationGainM && `Elevation: +${spot.elevationGainM} m`,
    spot.durationHrs && `Time: ${spot.durationHrs} h`,
  ].filter(Boolean);
  if (stats.length) add(stats.join(' · '), '');
  if (spot.summary) add(spot.summary, '');
  if (spot.season) add(`Best season: ${spot.season}`, '');

  add('## Weather', '');
  if (w?.day) add(`${dayLabel(w.day.date, true)}: high ${fmtTemp(w.day.maxC)}, ${w.day.rainPct ?? '–'}% chance of rain (Open-Meteo)`, '');
  else if (w?.tooFar) add('Too far ahead to forecast. Check again about two weeks before the trip.', '');
  else add('No forecast available.', '');

  add('## Getting there', '');
  if (transit.outbound?.length) add('**Outbound**', '', ...transit.outbound.map((l) => `- ${legLine(l)}`), '');
  if (transit.return?.length) add('**Return**', '', ...transit.return.map((l) => `- ${legLine(l)}`), '');
  for (const n of transit.notes ?? []) add(`_${n}_`, '');
  if (maps) add(`[Open the route in Google Maps](${mdUrl(maps)})`, '');

  if (spot.gear?.length) add('## Bring', '', ...spot.gear.map((g) => `- [ ] ${g}`), '');

  const h = spot.history;
  if (h?.summary || h?.timeline?.length) {
    add('## A little history', '');
    if (h.summary) add(h.summary, '');
    for (const t of h.timeline ?? []) add(`- **${t.when}**: ${t.text}`);
    if (h.timeline?.length) add('');
    if (h.source?.url) add(`_From [${h.source.title}](${mdUrl(h.source.url)}) on ${h.source.name}._`, '');
  }

  if (saved.length) {
    add('## Research notes', '');
    for (const s of saved) add(`### ${s.title}`, '', s.summary, '', `[Read on Wikipedia](${mdUrl(s.url)})`, '');
  }

  add('## Sources', '');
  add(`- Spot: ${[c.magazine, c.publisher].filter(Boolean).join(', ')}${c.issue ? `, ${c.issue}` : ''}${c.url ? ` (${c.url})` : ''}`);
  add('- Weather: Open-Meteo (open-meteo.com)');
  if (saved.length || h?.source?.name === 'Wikipedia')
    add('- Wikipedia text is available under CC BY-SA 4.0 (creativecommons.org/licenses/by-sa/4.0)');
  add('', `_Made with TabiLens on ${longDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }))}._`, '');

  return out.join('\n');
}

export function downloadMarkdown(plan, saved) {
  const blob = new Blob([buildMarkdown(plan, saved)], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const slug = (plan.spot?.name ?? 'trip').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  a.download = `tabilens-${plan.tripDate ?? 'trip'}-${slug}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}
