// Shows the judges (esp. Redpine) exactly which MCP calls ran — transparency is part of the pitch.
export default function PipelineTrace({ trace = [], billing, mode }) {
  return (
    <details className="rounded-2xl border border-line bg-white p-5 text-sm shadow-sm" open>
      <summary className="cursor-pointer font-display font-bold text-moss-dark">
        Redpine MCP pipeline <span className="text-xs font-normal text-ink/50">({mode})</span>
      </summary>
      <ul className="mt-3 space-y-1 font-mono text-xs">
        {trace.map((t, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span>
              {t.status === 'ok' ? '✓' : t.status === 'error' ? '✗' : '○'} {t.step}
            </span>
            <span className="text-ink/50">{t.status === 'error' ? t.error : `${t.ms} ms`}</span>
          </li>
        ))}
      </ul>
      {billing && (
        <p className="mt-3 border-t border-line pt-2 text-xs text-ink/60">
          Spent this query: ${billing.spentUsd.toFixed(2)}
          {billing.pending?.length > 0 && ` · ${billing.pending.length} search(es) awaiting manual unlock`}
        </p>
      )}
    </details>
  );
}
