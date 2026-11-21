import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppObject, Catalog, ProducerKind, RunResult, Step } from '../lib/engine'
import { runScenario } from '../lib/engine'

type Props = {
  catalog: Catalog
  eventId: string
  initialObjectKey?: string | null
  onEventChange: (id: string) => void
}

const STATUS_TONE: Record<Step['status'], string> = {
  ok: 'border-brand-success/40 bg-brand-success-100/50',
  skip: 'border-inchiostro/15 bg-fondo',
  warn: 'border-brand-warning/40 bg-brand-warning-100/50',
  error: 'border-brand-danger/40 bg-brand-danger-100/60',
}

const STATUS_DOT: Record<Step['status'], string> = {
  ok: 'bg-brand-success',
  skip: 'bg-tenue/50',
  warn: 'bg-brand-warning',
  error: 'bg-brand-danger',
}

function jsonFor(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2)
}

export default function Percorso({
  catalog,
  eventId,
  initialObjectKey,
  onEventChange,
}: Props) {
  const event = catalog.events.find((e) => e.id === eventId) ?? catalog.events[0]
  const [objectKey, setObjectKey] = useState(initialObjectKey ?? event.objects[0].key)
  const [dataText, setDataText] = useState(jsonFor(event.dataTemplate))
  const [producerKind, setProducerKind] = useState<ProducerKind>(event.producer.kind)
  const [exchangeCode, setExchangeCode] = useState(event.producer.exchange)
  const [priority, setPriority] = useState(event.producer.priority)
  const [captureOn, setCaptureOn] = useState(true)
  const [result, setResult] = useState<RunResult | null>(null)
  const [revealed, setRevealed] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const timers = useRef<number[]>([])

  const object: AppObject = useMemo(
    () => event.objects.find((o) => o.key === objectKey) ?? event.objects[0],
    [event, objectKey],
  )

  // il cambio evento resetta i comandi nell'handler: un setState dentro un effect
  // è vietato da react-hooks/set-state-in-effect e provocherebbe render a cascata
  function cambiaEvento(id: string) {
    const next = catalog.events.find((e) => e.id === id)
    if (!next) return
    setObjectKey(next.objects[0].key)
    setDataText(jsonFor(next.dataTemplate))
    setProducerKind(next.producer.kind)
    setExchangeCode(next.producer.exchange)
    setPriority(next.producer.priority)
    setResult(null)
    setRevealed(0)
    onEventChange(id)
  }

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t))
      timers.current = []
    }
  }, [])

  const preview = useMemo(
    () =>
      runScenario(
        {
          event,
          object,
          data: dataText,
          priority,
          producerKind,
          exchangeCode,
          user: 'MSANFILIPPO',
          captureOn,
        },
        catalog,
      ),
    [event, object, dataText, priority, producerKind, exchangeCode, captureOn, catalog],
  )

  function esegui() {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setResult(preview)
    setRevealed(0)
    setRunKey((k) => k + 1)
    preview.steps.forEach((_, index) => {
      const timer = window.setTimeout(() => setRevealed(index + 1), 420 * (index + 1))
      timers.current.push(timer)
    })
  }

  const shown = result ? preview.steps.slice(0, revealed) : []

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]" data-testid="percorso">
      <aside className="space-y-3">
        <div className="rounded-2xl border border-inchiostro/10 bg-carta p-4 shadow-carta">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-tenue">
            Evento
          </label>
          <select
            data-testid="event-select"
            value={event.id}
            onChange={(e) => cambiaEvento(e.target.value)}
            className="mt-1 w-full rounded-lg border border-inchiostro/15 bg-fondo px-2 py-2 font-mono text-[12px]"
          >
            {catalog.events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.okevt}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[12px] leading-snug text-tenue">
            <span className="font-semibold text-inchiostro">{event.title}</span> · {event.useCase}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-tenue">{event.summary}</p>
        </div>

        <div className="rounded-2xl border border-inchiostro/10 bg-carta p-4 shadow-carta">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-tenue">
            Oggetto applicativo
          </label>
          <select
            data-testid="object-select"
            value={object.key}
            onChange={(e) => setObjectKey(e.target.value)}
            className="mt-1 w-full rounded-lg border border-inchiostro/15 bg-fondo px-2 py-2 font-mono text-[12px]"
          >
            {event.objects.map((o) => (
              <option key={o.key} value={o.key}>
                {o.key}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[12px] leading-snug text-tenue">{object.label}</p>
          <dl className="mt-2 space-y-0.5 font-mono text-[11px] text-tenue">
            <div className="flex gap-1">
              <dt className="w-16 shrink-0 text-tenue/70">class</dt>
              <dd className="text-inchiostro">{object.className}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="w-16 shrink-0 text-tenue/70">object</dt>
              <dd className="text-inchiostro">{object.object}</dd>
            </div>
            {Object.entries(object.attributes).map(([k, v]) => (
              <div className="flex gap-1" key={k}>
                <dt className="w-16 shrink-0 text-tenue/70">{k.toLowerCase()}</dt>
                <dd className="text-inchiostro">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl border border-inchiostro/10 bg-carta p-4 shadow-carta">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-tenue">
              Dati dell’evento (JSON)
            </label>
            <button
              type="button"
              onClick={() => setDataText(jsonFor(event.dataTemplate))}
              className="rounded border border-inchiostro/15 px-1.5 py-0.5 text-[10px] text-tenue hover:text-inchiostro"
            >
              template
            </button>
          </div>
          <textarea
            data-testid="data-input"
            value={dataText}
            onChange={(e) => setDataText(e.target.value)}
            spellCheck={false}
            rows={8}
            className="mt-1 w-full resize-y rounded-lg border border-inchiostro/15 bg-fondo px-2 py-1.5 font-mono text-[11px] leading-snug"
          />
        </div>

        <div className="rounded-2xl border border-inchiostro/10 bg-carta p-4 shadow-carta">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-tenue">
            Chi pubblica
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
                  'rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors ' +
                  (producerKind === kind
                    ? 'border-brand-primary bg-brand-primary text-white'
                    : 'border-inchiostro/15 bg-fondo text-inchiostro hover:border-brand-primary/40')
                }
              >
                {kind === 'fun' ? 'FUN · PUB.EVT' : 'SDK · EventProducer'}
              </button>
            ))}
          </div>

          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-tenue">
            Exchange
          </label>
          <select
            data-testid="exchange-select"
            value={exchangeCode}
            onChange={(e) => setExchangeCode(e.target.value)}
            className="mt-1 w-full rounded-lg border border-inchiostro/15 bg-fondo px-2 py-2 font-mono text-[12px]"
          >
            {catalog.exchanges.map((ex) => (
              <option key={ex.code} value={ex.code}>
                {ex.code} · {ex.name}
              </option>
            ))}
          </select>

          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-tenue">
            Priorità: {priority}
            <span className="ml-1 font-normal normal-case text-tenue/80">
              {priority > 0 ? '→ coda alta' : '→ coda normale'}
            </span>
          </label>
          <input
            type="range"
            min={0}
            max={10}
            value={priority}
            data-testid="priority-slider"
            onChange={(e) => setPriority(Number(e.target.value))}
            className="mt-1 w-full accent-brand-primary"
          />

          {event.captures.length > 0 && (
            <label className="mt-3 flex items-start gap-2 text-[12px] text-inchiostro">
              <input
                type="checkbox"
                checked={captureOn}
                onChange={(e) => setCaptureOn(e.target.checked)}
                className="mt-0.5 accent-brand-primary"
              />
              <span>
                cattura effimera attiva
                <span className="block text-[11px] text-tenue">
                  {event.captures[0].queue} · TTL 600 s · vive nel processo
                </span>
              </span>
            </label>
          )}

          <button
            type="button"
            onClick={esegui}
            data-testid="run-button"
            className="mt-4 w-full rounded-xl bg-brand-gradient-primary px-3 py-2.5 text-[13px] font-semibold text-white shadow-carta"
          >
            Esegui l’evento
          </button>
        </div>
      </aside>

      <section className="space-y-3" data-testid="percorso-result">
        {!result && (
          <div className="rounded-2xl border border-dashed border-inchiostro/20 bg-carta/60 p-6">
            <h2 className="text-[15px] font-semibold">La catena parte dal pulsante in alto</h2>
            <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-tenue">
              Scegli l’evento, l’oggetto applicativo e i dati, poi esegui: i passi compaiono uno
              alla volta, con il messaggio che si costruisce. Prima di eseguire puoi già leggere
              qui a fianco quali oggetti <code className="font-mono text-[12px]">OK</code> forniscono
              i numeri di ogni passo.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-inchiostro/10 bg-fondo p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-tenue">
                  In uscita, adesso
                </p>
                <p className="mt-1 font-mono text-[11px] text-inchiostro">{preview.exchangeName}</p>
                <p className="font-mono text-[11px] text-inchiostro">{preview.routingKey}</p>
                <p className="font-mono text-[11px] text-brand-primary">{preview.queue}</p>
              </div>
              <div className="rounded-xl border border-inchiostro/10 bg-fondo p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-tenue">
                  Ascoltatori dichiarati
                </p>
                <p className="mt-1 text-[12px] text-inchiostro">
                  {event.observers.length} da script
                  {event.captures.length ? ` + ${event.captures.length} cattura` : ''}
                  {event.missingScript ? ' · script assente' : ''}
                </p>
              </div>
            </div>
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

            {revealed < result.steps.length && (
              <button
                type="button"
                data-testid="reveal-all"
                onClick={() => {
                  timers.current.forEach((t) => window.clearTimeout(t))
                  timers.current = []
                  setRevealed(result.steps.length)
                }}
                className="w-full rounded-xl border border-inchiostro/15 bg-carta px-3 py-2 text-[12.5px] font-semibold text-inchiostro hover:border-brand-primary/40"
              >
                Mostra tutti i passi ({result.steps.length})
              </button>
            )}

            <ol className="space-y-2" data-testid="steps" key={runKey}>
              {shown.map((step) => (
                <li
                  key={step.id}
                  data-testid={`step-${step.id}`}
                  data-status={step.status}
                  className={`rounded-2xl border p-3.5 ${STATUS_TONE[step.status]}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[step.status]}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">
                        <span className="mr-1.5 font-mono text-[11px] text-tenue">
                          {String(step.n).padStart(2, '0')}
                        </span>
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-tenue">{step.detail}</p>
                      {step.lines.length > 0 && (
                        <dl className="mt-2 space-y-0.5">
                          {step.lines.map((line, i) => (
                            <div key={`${step.id}-${i}`} className="flex gap-2 text-[11.5px]">
                              <dt className="w-40 shrink-0 text-tenue/80">{line.label}</dt>
                              <dd className="min-w-0 break-words font-mono text-inchiostro">
                                {line.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      {step.code && (
                        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-inchiostro px-2.5 py-2 font-mono text-[11px] leading-relaxed text-white">
                          {step.code}
                        </pre>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {revealed >= result.steps.length && result.outcomes.length > 0 && (
              <div
                className="rounded-2xl border border-inchiostro/10 bg-carta p-4 shadow-carta"
                data-testid="outcomes"
              >
                <h3 className="text-[13px] font-semibold">Chi ha ricevuto l’evento</h3>
                <div className="mt-2 space-y-2">
                  {result.outcomes.map((o) => (
                    <div
                      key={o.id}
                      data-testid={`outcome-${o.id}`}
                      data-fired={o.fired ? 'yes' : 'no'}
                      className="rounded-xl border border-inchiostro/10 bg-fondo p-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <code className="rounded bg-inchiostro/10 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-inchiostro">
                          {o.id}
                        </code>
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
                      </div>
                      <p className="mt-1 font-mono text-[11.5px] text-inchiostro">{o.target}</p>
                      <p className="text-[12px] text-tenue">{o.goal}</p>
                      {o.resolvedCondition && (
                        <p className="mt-1 font-mono text-[11px] text-tenue">
                          {o.condition} → {o.resolvedCondition}
                        </p>
                      )}
                      <p className="mt-1 text-[11.5px] text-tenue">{o.reason}</p>
                    </div>
                  ))}
                  {event.captures.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-brand-warning/30 bg-brand-warning-100/30 p-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <code className="rounded bg-inchiostro/10 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold">
                          {c.id}
                        </code>
                        <span className="rounded bg-brand-warning-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-warning-900">
                          in process
                        </span>
                        <span className="rounded bg-brand-success-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-success-900">
                          {captureOn ? 'riceve' : 'spenta'}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-tenue">{c.note}</p>
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
