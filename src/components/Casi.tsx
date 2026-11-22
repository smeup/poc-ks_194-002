import { useState } from 'react'
import type { Scenario } from '../lib/scenari'

type Props = {
  scenarios: Scenario[]
  onApri: (eventId: string, objectKey: string) => void
}

/**
 * I nove casi che vale la pena provare, in una striscia: un click mette nel Percorso l'evento e
 * l'oggetto giusti. Il racconto (cosa succede e cosa non succede) si apre sul caso scelto.
 */
export default function Casi({ scenarios, onApri }: Props) {
  const [aperto, setAperto] = useState<string | null>(null)
  const scelto = scenarios.find((s) => s.id === aperto) ?? null

  return (
    <section className="rounded-2xl border border-inchiostro/10 bg-carta p-3 shadow-carta" data-testid="casi">
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-tenue">Casi da provare</p>
        <p className="text-[11px] text-tenue">
          {scenarios.length} esiti già pronti: un click mette l’evento e l’oggetto nel percorso
        </p>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {scenarios.map((s) => (
          <span key={s.id} className="inline-flex items-center overflow-hidden rounded-lg border border-inchiostro/15">
            <button
              type="button"
              data-testid={`caso-${s.id}`}
              title={s.lead}
              onClick={() => onApri(s.open.eventId, s.open.objectKey)}
              className="bg-fondo px-2 py-1 text-[11.5px] font-semibold text-inchiostro hover:bg-brand-primary hover:text-white"
            >
              {s.title}
            </button>
            <button
              type="button"
              data-testid={`caso-spiega-${s.id}`}
              data-state={aperto === s.id ? 'open' : 'closed'}
              aria-label={`cosa succede in ${s.title}`}
              onClick={() => setAperto(aperto === s.id ? null : s.id)}
              className="border-l border-inchiostro/15 bg-carta px-1.5 py-1 font-mono text-[11px] text-tenue hover:text-brand-primary"
            >
              {aperto === s.id ? '−' : '?'}
            </button>
          </span>
        ))}
      </div>

      {scelto && (
        <div className="mt-2 grid gap-2 rounded-xl border border-inchiostro/10 bg-fondo p-2.5 md:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-success-900">
              cosa succede
            </p>
            <ul className="mt-1 space-y-1">
              {scelto.happens.map((h) => (
                <li key={h} className="flex gap-1.5 text-[11.5px] leading-snug text-inchiostro">
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-brand-success" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-danger-900">
              cosa <span className="normal-case">non</span> succede
            </p>
            <ul className="mt-1 space-y-1">
              {scelto.notHappens.map((h) => (
                <li key={h} className="flex gap-1.5 text-[11.5px] leading-snug text-inchiostro">
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-brand-danger" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
