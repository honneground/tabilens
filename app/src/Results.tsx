import { useState } from 'react'
import { KIND_EMOJI } from './SpotCard'
import { issueLabel, usd, type ArticleCard, type LockedCard, type Run, type Spot } from './types'

const JOURNAL_COLORS: Record<string, string> = {
  EVEN: '#0f6b3a',
  PEAKS: '#7a3e12',
  'Randonnée': '#2f6f8f',
  'BiCYCLE CLUB': '#b3261e',
}

export function MagazineBadge({ a }: { a: { journal?: string; date?: string; page?: number } }) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-white"
      style={{ background: JOURNAL_COLORS[a.journal ?? ''] ?? '#1c1a17' }}
    >
      {issueLabel(a)}
    </span>
  )
}

interface CardsProps {
  run: Run
  onSpot: (s: Spot) => void
  onRead: (a: ArticleCard) => void
  onAddArticle: (a: ArticleCard) => void
  onAddSpot: (s: Spot) => void
  onUnlock: (run: Run, hit: LockedCard) => Promise<void>
  planned: Set<string>
}

function Article({ a, run, onSpot, onRead, onAddArticle, onAddSpot, planned }: Omit<CardsProps, 'onUnlock'> & { a: ArticleCard }) {
  const spots = run.spots.filter((s) => s.articleId === a.id)
  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {a.photos[0] && (
        <button onClick={() => onRead(a)} className="block w-full">
          <img src={a.photos[0]} alt={a.headline_en} className="h-48 w-full object-cover" />
        </button>
      )}
      <div className="p-4">
        <MagazineBadge a={a} />
        <h3 className="mt-2 text-lg leading-snug font-semibold">{a.headline_en}</h3>
        <p className="mt-0.5 text-xs text-gray-500">{a.title}</p>
        {a.summary_en && <p className="mt-2 text-sm leading-relaxed text-gray-700">{a.summary_en}</p>}
        {spots.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {spots.map((s) => (
              <span key={s.name_ja} className="inline-flex items-center overflow-hidden rounded-full border border-gray-200 text-xs">
                <button onClick={() => onSpot(s)} className="px-2 py-1 hover:bg-gray-50" title="Show on map">
                  {KIND_EMOJI[s.kind]} {s.name_en}
                </button>
                <button
                  onClick={() => onAddSpot(s)}
                  disabled={planned.has(`spot:${s.name_ja}`)}
                  className="border-l border-gray-200 px-2 py-1 text-gray-500 hover:bg-gray-50 disabled:text-green-700"
                  title="Add to plan"
                >
                  {planned.has(`spot:${s.name_ja}`) ? '✓' : '+'}
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2 text-sm">
          <button onClick={() => onRead(a)} className="rounded-lg bg-gray-900 px-3 py-1.5 font-medium text-white">
            Read the article
          </button>
          <button
            onClick={() => onAddArticle(a)}
            disabled={planned.has(`article:${a.id}`)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:text-green-700"
          >
            {planned.has(`article:${a.id}`) ? '✓ In plan' : '+ Plan'}
          </button>
        </div>
      </div>
    </article>
  )
}

export function Locked({ hit, onUnlock }: { hit: LockedCard; onUnlock: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-gray-300 bg-white/60 p-3">
      <div className="min-w-0 flex-1">
        <MagazineBadge a={hit} />
        <p className="mt-1 truncate text-sm font-medium" title={hit.title}>
          {hit.title}
        </p>
        <p className="text-xs text-gray-500">{hit.figureCount > 0 ? `📷 ${hit.figureCount} photo · ` : ''}locked page</p>
      </div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await onUnlock().finally(() => setBusy(false))
        }}
        className="shrink-0 rounded-lg border border-gray-900 px-2.5 py-1 text-xs font-medium disabled:opacity-50"
      >
        {busy ? 'Reading…' : `Unlock ${usd(hit.cost)}`}
      </button>
    </div>
  )
}

export function RunResults(props: CardsProps) {
  const { run, onUnlock } = props
  return (
    <section className="space-y-3">
      <div className="px-1">
        <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">You asked</p>
        <p className="font-medium">{run.query}</p>
        {!run.done && !run.error && (
          <p className="mt-1 text-sm text-gray-600">
            <span className="animate-pulse">●</span> {run.status}
          </p>
        )}
        {run.queries && <p className="mt-1 text-xs text-gray-500">Searched {run.queries.join(' · ')}</p>}
        {run.previewed && (
          <p className="text-xs text-gray-500">
            {run.previewed.found} pages previewed free · {usd(run.spent)} unlocked
            {run.balance !== undefined && ` · balance ${usd(run.balance)}`}
          </p>
        )}
        {run.error && <p className="mt-1 text-sm text-red-700">{run.error}</p>}
      </div>

      {run.note && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{run.note}</p>}

      {run.articles.map((a) => (
        <Article key={a.id} a={a} {...props} />
      ))}

      {run.locked.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 pt-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">More in the magazines</p>
          {run.locked.map((hit) => (
            <Locked key={hit.id} hit={hit} onUnlock={() => onUnlock(run, hit)} />
          ))}
        </div>
      )}
    </section>
  )
}

interface ReaderProps {
  article: ArticleCard
  run: Run | undefined
  onClose: () => void
  onUnlock: (run: Run, hit: LockedCard) => Promise<void>
  onAddArticle: (a: ArticleCard) => void
  planned: Set<string>
}

export function Reader({ article, run, onClose, onUnlock, onAddArticle, planned }: ReaderProps) {
  const [more, setMore] = useState<LockedCard[] | null>(null)
  const [loading, setLoading] = useState(false)
  const unlockedIds = new Set(run?.articles.map((a) => a.id))

  async function digDeeper() {
    setLoading(true)
    try {
      const res = await fetch('/api/more', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article }),
      })
      setMore((await res.json()).locked ?? [])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] flex justify-center bg-black/40 p-6" onClick={onClose}>
      <div
        className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-white/90 shadow" aria-label="Close">
          ✕
        </button>
        <div className="overflow-y-auto">
          {article.photos.map((p) => (
            <img key={p} src={p} alt="" className="max-h-[50vh] w-full object-cover" />
          ))}
          <div className="p-6">
            <MagazineBadge a={article} />
            <h2 className="mt-2 text-2xl font-semibold">{article.headline_en}</h2>
            {article.summary_en && <p className="mt-3 leading-relaxed text-gray-700">{article.summary_en}</p>}
            <div className="mt-5 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">From the page</p>
              <p className="mt-1 text-sm text-gray-500">{article.title}</p>
              <p className="mt-2 leading-loose whitespace-pre-line">{article.text}</p>
              <p className="mt-3 text-xs text-gray-500">
                © ADDIX · {issueLabel(article)} · licensed excerpt via Redpine
              </p>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={digDeeper}
                disabled={loading || more !== null}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {loading ? 'Looking through the issue…' : 'Dig deeper in this issue'}
              </button>
              <button
                onClick={() => onAddArticle(article)}
                disabled={planned.has(`article:${article.id}`)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:text-green-700"
              >
                {planned.has(`article:${article.id}`) ? '✓ In plan' : '+ Plan'}
              </button>
            </div>

            {more && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Nearby pages in {issueLabel({ ...article, page: undefined })}</p>
                {more.length === 0 && <p className="text-sm text-gray-500">Nothing else found in this issue.</p>}
                {more.map((hit) =>
                  unlockedIds.has(hit.id) ? (
                    <p key={hit.id} className="text-sm text-green-700">
                      ✓ p.{hit.page} {hit.title} added to your results
                    </p>
                  ) : (
                    <Locked key={hit.id} hit={hit} onUnlock={() => (run ? onUnlock(run, hit) : Promise.resolve())} />
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
