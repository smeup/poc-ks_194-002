import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Play } from 'lucide-react'
import type {
  AppObject,
  CaptureDef,
  Catalog,
  Observer,
  ProducerKind,
  RunResult,
} from '../lib/engine'
import { producerCodeFor, runScenario } from '../lib/engine'
import ObserverBox from './Observer'
import Code from './Code'
import Catena from './Catena'
import OkTag from './OkTag'
import Casi from './Casi'
import type { Scenario } from '../lib/scenari'

type Props = {
  catalog: Catalog
  eventId: string
  initialObjectKey?: string | null
  onEventChange: (id: string) => void
  scenarios: Scenario[]
  onApriCaso: (eventId: string, objectKey: string) => void
}

function jsonFor(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2)
}

export default function Percorso({
  catalog,
  eventId,
  initialObjectKey,
  onEventChange,
  scenarios,
  onApriCaso,
}: Props) {
  const event = catalog.events.find((e) => e.id === eventId) ?? catalog.events[0]
  const [objectKey, setObjectKey] = useState(initialObjectKey ?? event.objects[0].key)
  const [producerKind, setProducerKind] = useState<ProducerKind>(event.producer.kind)
  const [captureOn, setCaptureOn] = useState(true)
  const [extraObservers, setExtraObservers] = useState<Observer[]>([])
  const [extraCaptures, setExtraCaptures] = useState<CaptureDef[]>([])
  const [result, setResult] = useState<RunResult | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const [revealed, setRevealed] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const timers = useRef<number[]>([])

  const aree = useMemo(
    () => Array.from(new Set(catalog.events.map((e) => e.useCase))),
    [catalog],
  )

  const object: AppObject = useMemo(
    () => event.objects.find((o) => o.key === objectKey) ?? event.objects[0],
    [event, objectKey],
  )

  // exchange e priorità sono quelle dell'evento: si cambiano nella tab «Capire Rabbit»,
  // qui il percorso mostra solo il codice che pubblica.
  const exchange = useMemo(
    () => catalog.exchanges.find((ex) => ex.code === event.producer.exchange) ?? null,
    [catalog, event],
  )

  // il nome vero del microexecutor in ogni corsia: chi pubblica cambia, chi consuma no
  const nomiMicro = useMemo(
    () => ({
      client: 'client web',
      produttore: producerKind === 'fun' ? 'me-java-batch' : event.producer.source,
      broker: 'RabbitMQ',
      observer: 'me-java-batch',
      cattura: 'me-xxx-yyy',
    }),
    [producerKind, event.producer.source],
  )

  const code = useMemo(
    () => producerCodeFor(producerKind, event, object, catalog.environment, exchange),
    [producerKind, event, object, catalog.environment, exchange],
  )

  function fermaSimulazione() {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setInCorso(false)
  }

  function cambiaEvento(id: string) {
    const next = catalog.events.find((e) => e.id === id)
    if (!next) return
    setObjectKey(next.objects[0].key)
    setProducerKind(next.producer.kind)
    setExtraObservers([])
    setExtraCaptures([])
    setResult(null)
    setInCorso(false)
    setRevealed(0)
    onEventChange(id)
  }

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t))
      timers.current = []
    }
  }, [])

  const input = useMemo(
    () => ({
      event,
      object,
      data: jsonFor(event.dataTemplate),
      priority: event.producer.priority,
      producerKind,
      exchangeCode: event.producer.exchange,
      user: 'MSANFILIPPO',
      captureOn,
      extraObservers,
      extraCaptures,
    }),
    [event, object, producerKind, captureOn, extraObservers, extraCaptures],
  )

  const preview = useMemo(() => runScenario(input, catalog), [input, catalog])

  function esegui() {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setResult(preview)
    setRevealed(0)
    setRunKey((k) => k + 1)
    setInCorso(true)
    preview.steps.forEach((_, index) => {
      const ultimo = index === preview.steps.length - 1
      const timer = window.setTimeout(() => {
        setRevealed(index + 1)
        if (ultimo) setInCorso(false)
      }, 420 * (index + 1))
      timers.current.push(timer)
    })
  }

  const osservatori = event.observers.length + extraObservers.length
  const activeCaptures = event.captures.length + extraCaptures.length

  return (
    <div className="space-y-4" data-testid="percorso">
      <Casi scenarios={scenarios} onApri={onApriCaso} />

      {/* ---------------------------------------------------------------- comandi */}
      <section className="rounded-2xl border border-inchiostro/10 bg-carta p-4 shadow-carta">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <span className="flex items-center gap-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-tenue">
                Evento
              </label>
              <OkTag id="OKEVT" />
            </span>
            <select
              data-testid="event-select"
              value={event.id}
              onChange={(e) => cambiaEvento(e.target.value)}
              className="mt-1 w-full rounded-lg border border-inchiostro/15 bg-fondo px-2 py-2 font-mono text-[11.5px]"
            >
              {aree.map((area) => (
                <optgroup key={area} label={area}>
                  {catalog.events
                    .filter((e) => e.useCase === area)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.okevt}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-[11.5px] leading-snug text-tenue">
              <span className="font-semibold text-inchiostro">{event.title}</span> · {event.useCase}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-tenue">
              Oggetto applicativo
            </label>
            <select
              data-testid="object-select"
              value={object.key}
              onChange={(e) => setObjectKey(e.target.value)}
              className="mt-1 w-full rounded-lg border border-inchiostro/15 bg-fondo px-2 py-2 font-mono text-[11.5px]"
            >
              {event.objects.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.key}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11.5px] leading-snug text-tenue">{object.label}</p>
            <dl className="mt-1 flex flex-wrap gap-x-2 font-mono text-[10.5px] text-tenue">
              <div className="flex gap-1">
                <dt className="text-tenue/70">class</dt>
                <dd className="text-inchiostro">{object.className}</dd>
              </div>
              <div className="flex gap-1">
                <dt className="text-tenue/70">object</dt>
                <dd className="text-inchiostro">{object.object}</dd>
              </div>
              {Object.entries(object.attributes).map(([k, v]) => (
                <div className="flex gap-1" key={k}>
                  <dt className="text-tenue/70">{k.toLowerCase()}</dt>
                  <dd className="text-inchiostro">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-tenue">
              Come viene lanciato
            </span>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {(['fun', 'sdk'] as ProducerKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  data-testid={`producer-${kind}`}
                  data-state={producerKind === kind ? 'active' : 'idle'}
                  onClick={() => setProducerKind(kind)}
                  className={
                    'rounded-lg border px-2 py-1.5 text-[11.5px] font-medium transition-colors ' +
                    (producerKind === kind
                      ? 'border-brand-primary bg-brand-primary text-white'
                      : 'border-inchiostro/15 bg-fondo text-inchiostro hover:border-brand-primary/40')
                  }
                >
                  {kind === 'fun' ? 'FUN · PUB.EVT' : 'SDK · EventProducer'}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10.5px] leading-snug text-tenue">
              {producerKind === 'fun'
                ? 'Una scheda chiama PUB.EVT su KS_194_02A: il codice qui sotto.'
                : 'Il servizio pubblica da sé su AMQP: il codice qui sotto.'}
            </p>
          </div>
        </div>

        {/* il codice del produttore: cambia cliccando FUN o SDK */}
        <div className="mt-3 rounded-xl border border-inchiostro/10 bg-fondo p-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-tenue">
              Il codice che pubblica
            </p>
            <code className="rounded bg-brand-primary-100 px-1.5 py-0.5 font-mono text-[10.5px] text-brand-primary-900">
              {code.label}
            </code>
            <span className="rounded bg-inchiostro/10 px-1.5 py-0.5 text-[10px] font-semibold text-tenue">
              {code.lang === 'java' ? 'JAVA' : 'FUN'}
            </span>
            <OkTag id="OKEXC" />
          </div>
          <Code
            text={code.text}
            lang={code.lang === 'java' ? 'java' : 'fun'}
            testId="producer-code"
            attrs={{ 'data-kind': code.kind }}
            className="mt-2"
          />
          <p className="mt-1.5 text-[11px] leading-snug text-tenue">{code.note}</p>
          <p className="mt-1 text-[10.5px] leading-snug text-tenue/80">
            La forma della chiamata è quella dei sorgenti veri; i valori sono quelli dell’evento
            scelto in questa simulazione.
          </p>
        </div>

      </section>

      {/* ------------------------------------------------------------ observer */}
      <ObserverBox
        event={event}
        exchange={exchange}
        captureOn={captureOn}
        onToggleCapture={() => setCaptureOn(!captureOn)}
        extraObservers={extraObservers}
        onAddObserver={(obs) => setExtraObservers([...extraObservers, obs])}
        onRemoveObserver={(id) => setExtraObservers(extraObservers.filter((o) => o.id !== id))}
        extraCaptures={extraCaptures}
        onAddCapture={(cap) => setExtraCaptures([...extraCaptures, cap])}
        onRemoveCapture={(id) => setExtraCaptures(extraCaptures.filter((c) => c.id !== id))}
      />

      {/* --------------------------------------------------------- avvia la simulazione */}
      <section className="rounded-2xl border border-inchiostro/10 bg-carta p-3 shadow-carta">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={esegui}
            data-testid="run-button"
            data-state={inCorso ? 'running' : 'idle'}
            aria-busy={inCorso}
            className={
              'inline-flex items-center gap-2 rounded-xl bg-brand-gradient-primary px-5 py-2.5 text-[14px] font-semibold text-white shadow-carta transition ' +
              'hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ' +
              (inCorso
                ? 'cursor-progress brightness-95'
                : 'active:translate-y-px active:scale-[0.98] active:brightness-90')
            }
          >
            {inCorso ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Play size={16} aria-hidden="true" />
            )}
            {inCorso ? 'Simulazione in corso…' : 'Simula l’evento'}
          </button>
          <p className="text-[11.5px] leading-snug text-tenue" aria-live="polite">
            {osservatori} observer da script
            {activeCaptures ? ` + ${activeCaptures} in process` : ''}
            {event.missingScript && osservatori === 0 ? ' · script assente' : ''}
            <span className="block text-[10.5px] text-tenue/80" data-testid="run-feedback">
              {inCorso
                ? `sto percorrendo la catena: ${revealed} di ${preview.steps.length} passi`
                : 'la catena parte da qui: sotto si vede chi pubblica, chi instrada e chi riceve'}
            </span>
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------------- risultato */}
      <section className="space-y-3" data-testid="percorso-result">
        {!result && (
          <div className="rounded-2xl border border-dashed border-inchiostro/20 bg-carta/60 p-5">
            <h2 className="text-[14px] font-semibold">La catena parte dal pulsante qui sopra</h2>
            <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-tenue">
              I passi compaiono uno alla volta, con il messaggio che si costruisce, la sostituzione
              di <code className="font-mono text-[11px]">&amp;event.*</code>, le formule OAV e le
              condizioni. Gli observer aggiunti qui sopra entrano nell’esecuzione come gli altri.
            </p>
          </div>
        )}

        {result && (
          <>
            <div
              className={`rounded-2xl border p-4 ${
                result.verdict.tone === 'ok'
                  ? 'border-brand-success/40 bg-brand-success-100/40'
                  : result.verdict.tone === 'error'
                    ? 'border-brand-danger/40 bg-brand-danger-100/50'
                    : result.verdict.tone === 'warn'
                      ? 'border-brand-warning/40 bg-brand-warning-100/40'
                      : 'border-inchiostro/15 bg-carta'
              }`}
              data-testid="verdict"
              data-tone={result.verdict.tone}
            >
              <h2 className="text-[15px] font-semibold">{result.verdict.title}</h2>
              <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-tenue">
                {result.verdict.text}
              </p>
            </div>

            <Catena
              key={runKey}
              steps={result.steps}
              revealed={revealed}
              onRevealAll={() => {
                fermaSimulazione()
                setRevealed(result.steps.length)
              }}
              nomi={nomiMicro}
            />

            {revealed >= result.steps.length && result.outcomes.length > 0 && (
              <div
                className="rounded-2xl border border-inchiostro/10 bg-carta p-4 shadow-carta"
                data-testid="outcomes"
              >
                <h3 className="text-[13px] font-semibold">Chi ha ricevuto l’evento</h3>
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {result.outcomes.map((o) => (
                    <div
                      key={o.id}
                      data-testid={`outcome-${o.id}`}
                      data-fired={o.fired ? 'yes' : 'no'}
                      className="rounded-xl border border-inchiostro/10 bg-fondo p-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-brand-info-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-info-900">
                          {o.type}
                        </span>
                        <span
                          className={
                            'rounded px-1.5 py-0.5 text-[10.5px] font-semibold ' +
                            (o.fired
                              ? 'bg-brand-success-100 text-brand-success-900'
                              : 'bg-inchiostro/10 text-tenue')
                          }
                        >
                          {o.fired ? 'parte' : 'non parte'}
                        </span>
                        <code className="ml-auto font-mono text-[10px] text-tenue">{o.id}</code>
                      </div>
                      <p className="mt-1 break-all font-mono text-[11.5px] text-inchiostro">{o.target}</p>
                      <p className="text-[12px] text-tenue">{o.goal}</p>
                      {o.resolvedCondition && (
                        <p className="mt-1 break-all font-mono text-[11px] text-tenue">
                          {o.condition} → {o.resolvedCondition}
                        </p>
                      )}
                      <p className="mt-1 text-[11.5px] text-tenue">{o.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
