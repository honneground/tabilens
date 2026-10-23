import { useState } from 'react'
import { FIRST_DAY, TRIP_DRAG_TYPE, itemDay, mapLinks, type TravelMode } from './trip'
import { KIND_EMOJI, Trains } from './SpotCard'
import { MagazineBadge } from './Results'
import type { PlanItem, SearchEntry, Spot } from './types'

interface Props {
  items: PlanItem[]
  days: string[]
  activeDay: string
  onSelectDay: (id: string) => void
  onAddDay: (afterId?: string) => void
  onRemoveDay: (id: string) => void
  onDropItem: (id: string, dayId: string, beforeId?: string) => void
  cachedSearches: Set<string>
  busy: boolean
  storageWarning: boolean
  onUpdate: (id: string, note: string) => void
  onRemove: (id: string) => void
  onShowSpot: (s: Spot) => void
  searches: SearchEntry[]
  onEditSearch: (id: string, text: string) => void
  onDeleteSearch: (id: string) => void
  onRunSearch: (text: string) => void
  onRefreshSearch: (text: string) => void
  onCombine: (texts: string[]) => void
}

function PlanEntry({ item, onUpdate, onRemove, onShowSpot, days, onDropItem, onMove, first, last }: { item: PlanItem; onMove: (delta: number) => void; first: boolean; last: boolean } & Pick<Props, 'onUpdate' | 'onRemove' | 'onShowSpot' | 'days' | 'onDropItem'>) {
  const [trains, setTrains] = useState(false)
  const station = item.spot?.nearestStation
  return (
    <li draggable
      onDragStart={(e) => { e.dataTransfer.setData(TRIP_DRAG_TYPE, item.id); e.dataTransfer.effectAllowed = 'move' }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes(TRIP_DRAG_TYPE)) e.preventDefault() }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropItem(e.dataTransfer.getData(TRIP_DRAG_TYPE), itemDay(item), item.id) }}
      className="cursor-grab rounded-xl border border-gray-200 bg-white p-3 active:cursor-grabbing">
      <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
        <span title="Drag to reorder">⠿</span>
        <select aria-label={`Day for ${item.title}`} value={itemDay(item)} onChange={(e) => onDropItem(item.id, e.target.value)} className="min-w-0 flex-1 rounded border border-gray-200 p-1">
          {days.map((day, i) => <option key={day} value={day}>Day {i + 1}</option>)}
        </select>
        <button onClick={() => onMove(-1)} disabled={first} aria-label={`Move ${item.title} up`} className="px-1 disabled:opacity-30">↑</button>
        <button onClick={() => onMove(1)} disabled={last} aria-label={`Move ${item.title} down`} className="px-1 disabled:opacity-30">↓</button>
      </div>
      <div className="flex gap-3">
        {item.photo && <img src={item.photo} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug font-medium">
            {item.spot ? `${KIND_EMOJI[item.spot.kind]} ` : '📖 '}
            {item.spot ? (
              <button onClick={() => onShowSpot(item.spot!)} className="text-left hover:underline">
                {item.title}
              </button>
            ) : (
              item.title
            )}
          </p>
          <p className="truncate text-xs text-gray-500">{item.subtitle}</p>
          {item.article && (
            <div className="mt-1">
              <MagazineBadge a={item.article} />
            </div>
          )}
        </div>
        <button onClick={() => onRemove(item.id)} className="self-start text-gray-400 hover:text-gray-700" aria-label="Remove">
          ✕
        </button>
      </div>
      {station && (
        <div className="mt-2 text-xs text-gray-600">
          🚉 {station.name} {station.name_en} · {station.km} km
          {station.km < 40 && (
            <button onClick={() => setTrains(!trains)} className="ml-2 underline">
              {trains ? 'hide trains' : 'trains'}
            </button>
          )}
          {trains && <Trains station={station} />}
        </div>
      )}
      <textarea
        value={item.note}
        onChange={(e) => onUpdate(item.id, e.target.value)}
        placeholder="Note, e.g. Saturday morning"
        rows={1}
        className="mt-2 w-full resize-y rounded-lg border border-gray-100 bg-gray-50 px-2 py-1 text-xs outline-none focus:border-gray-300"
      />
    </li>
  )
}

function SearchRow({
  entry,
  selected,
  onToggle,
  onEdit,
  onDelete,
  onRun,
  onRefresh,
  cached,
  busy,
}: {
  entry: SearchEntry
  selected: boolean
  onToggle: () => void
  onEdit: (text: string) => void
  onDelete: () => void
  onRun: () => void
  onRefresh: () => void
  cached: boolean
  busy: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.text)
  return (
    <li className="flex items-start gap-2 rounded-lg px-1 py-1.5 hover:bg-white">
      <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1" aria-label="Select search" />
      {editing ? (
        <form
          className="flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            onEdit(draft)
            setEditing(false)
          }}
        >
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} className="w-full rounded border border-gray-300 p-1 text-xs" />
          <div className="flex gap-2 text-xs">
            <button className="font-medium">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="text-gray-500">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button disabled={busy} onClick={onRun} className="flex-1 text-left text-xs leading-snug hover:underline disabled:opacity-40">
          {entry.text}
          <span className="mt-1 block text-[10px] text-gray-500">{cached ? 'Saved results · load instantly' : 'No saved results · search required'}</span>
        </button>
      )}
      {!editing && (
        <div className="flex shrink-0 gap-1.5 text-xs text-gray-500">
          <button disabled={busy} onClick={onRefresh} title="Run a new search (may use credits)" aria-label="Refresh search" className="disabled:opacity-30">
            ↻
          </button>
          <button onClick={() => setEditing(true)} title="Edit">
            ✎
          </button>
          <button onClick={onDelete} title="Delete">
            ✕
          </button>
        </div>
      )}
    </li>
  )
}

export function PlanPanel(props: Props) {
  const { items, searches } = props
  const [mode, setMode] = useState<TravelMode>('walking')
  const [overDay, setOverDay] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const chosen = searches.filter((s) => selected.has(s.id))

  return (
    <aside className="flex h-full flex-col overflow-y-auto border-l border-gray-200 bg-[#f4f1ea] p-4">
      <h2 className="text-lg font-semibold">My trip</h2>
      <p className="mt-1 text-xs text-gray-500">Drag cards into a day. Drop on a card to insert before it. New + cards go to the selected day.</p>
      <label className="mt-3 flex items-center gap-2 text-xs text-gray-600">
        Maps travel mode
        <select value={mode} onChange={(e) => setMode(e.target.value as TravelMode)} className="rounded border border-gray-200 bg-white p-1">
          <option value="walking">Walking</option><option value="driving">Driving</option><option value="bicycling">Cycling</option><option value="transit">Public transport</option>
        </select>
      </label>
      {props.days.map((day, dayIndex) => {
        const entries = items.filter((i) => itemDay(i) === day)
        const links = mapLinks(entries, mode)
        const unmapped = entries.filter((i) => !i.spot || !Number.isFinite(i.spot.lat) || !Number.isFinite(i.spot.lon)).length
        return <section key={day}
          onDragOver={(e) => { if (e.dataTransfer.types.includes(TRIP_DRAG_TYPE)) { e.preventDefault(); setOverDay(day) } }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverDay(null) }}
          onDrop={(e) => { e.preventDefault(); setOverDay(null); props.onDropItem(e.dataTransfer.getData(TRIP_DRAG_TYPE), day) }}
          className={`mt-4 rounded-xl border-2 p-2 ${overDay === day ? 'border-green-600 bg-green-50' : props.activeDay === day ? 'border-gray-700' : 'border-transparent'}`}>
          <div className="mb-2 flex items-center gap-2 border-b border-gray-300 pb-2">
            <button onClick={() => props.onSelectDay(day)} aria-pressed={props.activeDay === day} className="flex-1 text-left text-sm font-semibold">Day {dayIndex + 1} <span className="text-xs font-normal text-gray-500">· {entries.length} cards {props.activeDay === day ? '· selected' : ''}</span></button>
            {day !== FIRST_DAY && entries.length === 0 && <button onClick={() => props.onRemoveDay(day)} aria-label={`Remove Day ${dayIndex + 1}`} className="text-xs text-gray-500">Remove</button>}
          </div>
          {entries.length === 0 ? <p className="rounded-lg border border-dashed border-gray-300 p-5 text-center text-xs text-gray-500">Drop places or articles here. Leave empty for a rest day.</p> :
            <ol className="space-y-2">{entries.map((item, i) => <PlanEntry key={item.id} item={item} {...props} onDropItem={(...args) => { setOverDay(null); props.onDropItem(...args) }} first={i === 0} last={i === entries.length - 1}
              onMove={(delta) => { const before = delta < 0 ? entries[i - 1]?.id : entries[i + 2]?.id; props.onDropItem(item.id, day, before) }} />)}</ol>}
          {links.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{links.map((url, i) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white">Open in Google Maps{links.length > 1 ? ` · ${mode === 'transit' ? 'Leg' : 'Part'} ${i + 1}` : ''} ↗</a>)}</div>}
          {unmapped > 0 && <p className="mt-2 text-[11px] text-gray-500">{unmapped} article or unlocated card(s) excluded from Maps.</p>}
          <button onClick={() => props.onAddDay(day)} disabled={props.days.length >= 14} className="mt-3 text-xs text-gray-500 underline disabled:opacity-30">Insert an empty day after this day</button>
        </section>
      })}
      <button onClick={() => props.onAddDay()} disabled={props.days.length >= 14} className="mt-3 rounded-xl border border-dashed border-gray-400 p-3 text-sm disabled:opacity-30">+ Add day / day gap</button>
      <p className="mt-2 text-[11px] text-gray-500">Maps opens places in order, not a saved trip in your Google account. Long routes are split into parts; public transport opens one leg at a time. Check service dates before travel.</p>

      <div className="mt-6 border-t border-gray-200 pt-4">
        <div className="flex items-center">
          <h2 className="flex-1 text-sm font-semibold">My searches</h2>
          <button
            disabled={chosen.length < 1}
            onClick={() => {
              props.onCombine(chosen.map((s) => s.text))
              setSelected(new Set())
            }}
            className="rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-30"
          >
            Combine {chosen.length > 1 ? chosen.length : ''}
          </button>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">Click a search to load saved results. Use ↻ for a fresh search. Tick searches to combine them.</p>
        <p className="mt-1 text-[11px] text-gray-500">Up to 12 completed searches are saved in this browser. Deleting history also removes its saved results.</p>
        {props.storageWarning && <p role="status" className="mt-2 text-xs text-amber-800">Browser storage is full or unavailable. Results remain available in this session but may not survive a reload.</p>}
        <ul className="mt-2 space-y-0.5">
          {searches.map((s) => (
            <SearchRow
              key={s.id}
              entry={s}
              selected={selected.has(s.id)}
              onToggle={() => toggle(s.id)}
              onEdit={(t) => props.onEditSearch(s.id, t)}
              onDelete={() => props.onDeleteSearch(s.id)}
              onRun={() => props.onRunSearch(s.text)}
              onRefresh={() => props.onRefreshSearch(s.text)}
              cached={props.cachedSearches.has(s.id)}
              busy={props.busy}
            />
          ))}
        </ul>
      </div>
    </aside>
  )
}
