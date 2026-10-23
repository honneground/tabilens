import { useState } from 'react'
import { KIND_EMOJI, Trains } from './SpotCard'
import { MagazineBadge } from './Results'
import type { PlanItem, SearchEntry, Spot } from './types'

interface Props {
  items: PlanItem[]
  onUpdate: (id: string, note: string) => void
  onRemove: (id: string) => void
  onShowSpot: (s: Spot) => void
  searches: SearchEntry[]
  onEditSearch: (id: string, text: string) => void
  onDeleteSearch: (id: string) => void
  onRunSearch: (text: string) => void
  onCombine: (texts: string[]) => void
}

function PlanEntry({ item, onUpdate, onRemove, onShowSpot }: { item: PlanItem } & Pick<Props, 'onUpdate' | 'onRemove' | 'onShowSpot'>) {
  const [trains, setTrains] = useState(false)
  const station = item.spot?.nearestStation
  return (
    <li className="rounded-xl border border-gray-200 bg-white p-3">
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
}: {
  entry: SearchEntry
  selected: boolean
  onToggle: () => void
  onEdit: (text: string) => void
  onDelete: () => void
  onRun: () => void
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
        <p className="flex-1 text-xs leading-snug">{entry.text}</p>
      )}
      {!editing && (
        <div className="flex shrink-0 gap-1.5 text-xs text-gray-500">
          <button onClick={onRun} title="Search again">
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
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-gray-500">Add places and articles with + to build your plan.</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {items.map((item) => (
            <PlanEntry key={item.id} item={item} {...props} />
          ))}
        </ol>
      )}

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
        <p className="mt-0.5 text-xs text-gray-500">Tick searches to combine them into a sharper one.</p>
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
            />
          ))}
        </ul>
      </div>
    </aside>
  )
}
