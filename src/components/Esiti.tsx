import { useState } from 'react'

export type Scenario = {
  id: string
  title: string
  lead: string
  happens: string[]
  notHappens: string[]
  ok: string[]
  open: { eventId: string; objectKey: string }
}

type Props = {
  scenarios: Scenario[]
  onOpenInPercorso: (eventId: string, objectKey: string) => void
}

export default function Esiti({ scenarios, onOpenInPercorso }: Props) {
  const [openId, setOpenId] = useState<string | null>(scenarios[0]?.id ?? null)

  return (
    <div className="space-y-3" data-testid="esiti">
      <p className="max-w-3xl text-[13px] leading-relaxed text-tenue">
        Nove esiti che nel percorso si vedono succedere. Qui sono raccontati: cosa fa il motore,
        cosa <span className="font-semibold text-inchiostro">non</span> fa, e quale oggetto{' '}
        <code className="font-mono text-[12px]">OK</code> lo racconta nella console. Ogni scheda si
        apre nel percorso con l’evento e l’oggetto già scelti.
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        {scenarios.map((s) => {
          const open = openId === s.id
          return (
            <article
              key={s.id}
              data-testid={`scenario-${s.id}`}
              data-open={open ? 'yes' : 'no'}
              className={
                'rounded-2xl border bg-carta p-4 shadow-carta transition-colors ' +
                (open ? 'border-brand-primary/40' : 'border-inchiostro/10')
              }
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : s.id)}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <span className="text-[14px] font-semibold text-inchiostro">{s.title}</span>
                <span className="mt-0.5 shrink-0 font-mono text-[11px] text-tenue">
                  {open ? '−' : '+'}
                </span>
              </button>
              <p className="mt-1 text-[12.5px] leading-relaxed text-tenue">{s.lead}</p>

              {open && (
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-success-900">
                      Cosa succede
                    </p>
                    <ul className="mt-1 space-y-1">
                      {s.happens.map((h) => (
                        <li key={h} className="flex gap-1.5 text-[12px] leading-snug text-inchiostro">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-success" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-tenue">
                      Cosa non succede
                    </p>
                    <ul className="mt-1 space-y-1">
                      {s.notHappens.map((h) => (
                        <li key={h} className="flex gap-1.5 text-[12px] leading-snug text-tenue">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-tenue/50" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {s.ok.map((id) => (
                  <code
                    key={id}
                    className="rounded bg-inchiostro/10 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-inchiostro"
                  >
                    {id}
                  </code>
                ))}
                <button
                  type="button"
                  data-testid={`open-${s.id}`}
                  onClick={() => onOpenInPercorso(s.open.eventId, s.open.objectKey)}
                  className="ml-auto rounded-lg border border-brand-primary/40 px-2 py-1 text-[11.5px] font-semibold text-brand-primary hover:bg-brand-primary hover:text-white"
                >
                  Apri nel percorso →
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
