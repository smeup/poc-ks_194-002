import { useEffect, useMemo, useState } from 'react'
import type { Catalog } from './lib/engine'
import Percorso from './components/Percorso'
import Rabbit from './components/Rabbit'
import type { Scenario } from './lib/scenari'

type TabId = 'percorso' | 'rabbit'

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: 'percorso', label: 'Percorso', hint: 'un evento, passo per passo' },
  { id: 'rabbit', label: 'Capire Rabbit', hint: 'exchange, code, priorità' },
]

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('percorso')
  const [eventId, setEventId] = useState('')
  const [objectSeed, setObjectSeed] = useState<{ key: string; objectKey: string } | null>(null)
  const [mountSeed, setMountSeed] = useState(0)

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch('./json/events.json').then((r) => {
        if (!r.ok) throw new Error(`events.json: ${r.status}`)
        return r.json()
      }),
      fetch('./json/esiti.json').then((r) => {
        if (!r.ok) throw new Error(`esiti.json: ${r.status}`)
        return r.json()
      }),
    ])
      .then(([events, esiti]) => {
        if (!alive) return
        const loaded = events as Catalog
        setCatalog(loaded)
        setScenarios((esiti as { scenarios: Scenario[] }).scenarios)
        setEventId(loaded.events[0].id)
      })
      .catch((e: Error) => {
        if (alive) setError(e.message)
      })
    return () => {
      alive = false
    }
  }, [])

  const initialObject = useMemo(() => {
    if (!objectSeed || objectSeed.key !== eventId) return null
    return objectSeed.objectKey
  }, [objectSeed, eventId])

  function apriNelPercorso(nextEventId: string, objectKey: string) {
    setEventId(nextEventId)
    setObjectSeed({ key: nextEventId, objectKey })
    setMountSeed((s) => s + 1)
    setTab('percorso')
  }

  return (
    <div className="flex min-h-screen flex-col bg-fondo text-inchiostro">
      <header className="bg-brand-gradient-primary px-4 pb-4 pt-5 text-white sm:px-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-serif text-[22px] leading-tight sm:text-[26px]">
              Motore di regole · modulo eventi
            </h1>
            <span className="rounded bg-white/15 px-2 py-0.5 font-mono text-[11px]">KS_194_02</span>
            <span className="rounded bg-white/15 px-2 py-0.5 text-[11px]">
              ambiente SVI · dati simulati nel browser
            </span>
          </div>
          <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-white/85">
            Come un evento di business attraversa la piattaforma: chi lo pubblica, su quale
            exchange finisce, chi lo consuma, quale script lo trasforma in una chiamata. Scegli un
            evento e fallo partire.
          </p>
        </div>
      </header>

      <nav className="border-b border-inchiostro/10 bg-carta px-4 sm:px-6" role="tablist">
        <div className="mx-auto flex max-w-[1400px] gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              data-testid={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={
                'border-b-2 px-3 py-2.5 text-left text-[13px] font-semibold transition-colors ' +
                (tab === t.id
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-tenue hover:text-inchiostro')
              }
            >
              {t.label}
              <span className="ml-2 hidden text-[11px] font-normal text-tenue sm:inline">
                {t.hint}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6">
        {error && (
          <div className="rounded-2xl border border-brand-danger/40 bg-brand-danger-100/50 p-4">
            <p className="text-[13px] font-semibold text-brand-danger-900">
              I dati del POC non si sono caricati
            </p>
            <p className="mt-1 font-mono text-[12px] text-brand-danger-900/80">{error}</p>
          </div>
        )}

        {!catalog && !error && (
          <p className="text-[13px] text-tenue">Carico il catalogo degli eventi…</p>
        )}

        {catalog && (
          <>
            {tab === 'percorso' && (
              <Percorso
                key={`${eventId}-${mountSeed}`}
                catalog={catalog}
                eventId={eventId}
                initialObjectKey={initialObject}
                onEventChange={setEventId}
                scenarios={scenarios}
                onApriCaso={apriNelPercorso}
              />
            )}
            {tab === 'rabbit' && <Rabbit catalog={catalog} />}
          </>
        )}
      </main>

    </div>
  )
}
