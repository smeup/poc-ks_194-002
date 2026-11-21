import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AppObject,
  CaptureDef,
  Catalog,
  Observer,
  ProducerKind,
  RunResult,
  Step,
} from '../lib/engine'
import { captureQueueName, observerToScriptLines, runScenario } from '../lib/engine'

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

const OBSERVER_TYPES: Observer['type'][] = ['FUN', 'PGM', 'K11', 'LOG', 'AUDIT']

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
  const [extraObservers, setExtraObservers] = useState<Observer[]>([])
  const [extraCaptures, setExtraCaptures] = useState<CaptureDef[]>([])
  const [form, setForm] = useState<'none' | 'k21' | 'process'>('none')
  const [draftType, setDraftType] = useState<Observer['type']>('FUN')
  const [draftTarget, setDraftTarget] = useState('F(EXB;XX_100_01;DO.SOMETHING)')
  const [draftCondition, setDraftCondition] = useState('')
  const [result, setResult] = useState<RunResult | null>(null)
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

  function cambiaEvento(id: string) {
    const next = catalog.events.find((e) => e.id === id)
    if (!next) return
    setObjectKey(next.objects[0].key)
    setDataText(jsonFor(next.dataTemplate))
    setProducerKind(next.producer.kind)
    setExchangeCode(next.producer.exchange)
    setPriority(next.producer.priority)
    setExtraObservers([])
    setExtraCaptures([])
    setForm('none')
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

  const input = useMemo(
    () => ({
      event,
      object,
      data: dataText,
      priority,
      producerKind,
      exchangeCode,
      user: 'MSANFILIPPO',
      captureOn,
      extraObservers,
      extraCaptures,
    }),
    [event, object, dataText, priority, producerKind, exchangeCode, captureOn, extraObservers, extraCaptures],
  )

  const preview = useMemo(() => runScenario(input, catalog), [input, catalog])

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

  function aggiungiK21() {
    const n = event.observers.length + extraObservers.length + 1
    const obs: Observer = {
      id: `${event.id}#a${n}`,
      type: draftType,
      target: draftTarget.trim() || 'F(EXB;XX_100_01;DO.SOMETHING)',
      condition: draftCondition.trim() || null,
      goal: 'ascoltatore aggiunto a mano in questa sessione',
      note: 'non esiste nel file versionato: è una prova, non una modifica al repository',
    }
    setExtraObservers([...extraObservers, obs])
    setForm('none')
    setDraftCondition('')
  }

  function aggiungiProcess() {
    const n = extraCaptures.length + 1
    const id = `E2E-prova${n}`
    const capture: CaptureDef = {
      id,
      type: 'CAPTURE',
      target: captureQueueName(id),
      queue: captureQueueName(id),
      condition: `type = ${event.id}`,
      goal: 'ascoltatore in process aggiunto a mano',
      note: 'REG.CAP a runtime: coda non durevole, auto-delete, TTL 600 s, vive nel processo che risponde alla chiamata',
    }
    setExtraCaptures([...extraCaptures, capture])
    setForm('none')
  }

  const ascoltatori = event.observers.length + extraObservers.length
  const shown = result ? preview.steps.slice(0, revealed) : []
  const activeCaptures = event.captures.length + extraCaptures.length

  return (
    <div className="space-y-4" data-testid="percorso">
      {/* ---------------------------------------------------------------- comandi */}
      <section className="rounded-2xl border border-inchiostro/10 bg-carta p-4 shadow-carta">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-tenue">
              Evento
            </label>
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
                ? 'La scheda chiama PUB.EVT passando dal dispatcher.'
                : 'Il servizio istanzia l’evento e pubblica su AMQP.'}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-tenue">
              Exchange e priorità
            </label>
            <select
              data-testid="exchange-select"
              value={exchangeCode}
              onChange={(e) => setExchangeCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-inchiostro/15 bg-fondo px-2 py-1.5 font-mono text-[11.5px]"
            >
              {catalog.exchanges.map((ex) => (
                <option key={ex.code} value={ex.code}>
                  {ex.code} · {ex.name}
                </option>
              ))}
            </select>
            <label className="mt-2 block text-[10.5px] text-tenue">
              priorità {priority} · {priority > 0 ? 'coda alta' : 'coda normale'}
            </label>
            <input
              type="range"
              min={0}
              max={10}
              value={priority}
              data-testid="priority-slider"
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full accent-brand-primary"
            />
            <button
              type="button"
              onClick={esegui}
              data-testid="run-button"
              className="mt-2 w-full rounded-xl bg-brand-gradient-primary px-3 py-2 text-[13px] font-semibold text-white shadow-carta"
            >
              Esegui l’evento
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_260px]">
          <div>
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
              rows={5}
              className="mt-1 w-full resize-y rounded-lg border border-inchiostro/15 bg-fondo px-2 py-1.5 font-mono text-[11px] leading-snug"
            />
            <p className="mt-1 text-[10.5px] leading-snug text-tenue">
              I dati sono liberi: le condizioni dello script si risolvono sugli attributi
              dell’<span className="font-semibold">oggetto applicativo</span> qui sopra
              (<code className="font-mono">class.object.CAMPO</code>), non su questo JSON.
            </p>
          </div>
          <div className="rounded-xl border border-inchiostro/10 bg-fondo p-2.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-tenue">
              In uscita, adesso
            </p>
            <p className="mt-1 font-mono text-[11px] text-inchiostro">{preview.exchangeName}</p>
            <p className="font-mono text-[11px] break-all text-inchiostro">{preview.routingKey}</p>
            <p className="font-mono text-[11px] text-brand-primary">{preview.queue}</p>
            <p className="mt-1.5 text-[11px] text-tenue">
              {ascoltatori} ascoltatori da script
              {activeCaptures ? ` + ${activeCaptures} in process` : ''}
              {event.missingScript && ascoltatori === 0 ? ' · script assente' : ''}
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ ascoltatori */}
      <section
        className="rounded-2xl border border-inchiostro/10 bg-carta p-4 shadow-carta"
        data-testid="listeners"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[13px] font-semibold">
            Ascoltatori dichiarati{' '}
            <span className="font-normal text-tenue">
              {event.id}.k21 · {event.observers.length} nel file
              {extraObservers.length
                ? ` + ${extraObservers.length} ${extraObservers.length === 1 ? 'aggiunto' : 'aggiunti'}`
                : ''}
            </span>
          </h2>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              data-testid="toggle-capture"
              data-state={captureOn ? 'on' : 'off'}
              onClick={() => setCaptureOn(!captureOn)}
              className={
                'rounded-lg px-2 py-1 text-[11px] font-semibold ' +
                (captureOn ? 'bg-brand-success text-white' : 'bg-inchiostro/10 text-tenue')
              }
            >
              ascoltatori in process: {captureOn ? 'accesi' : 'spenti'}
            </button>
            <button
              type="button"
              data-testid="add-k21"
              onClick={() => setForm(form === 'k21' ? 'none' : 'k21')}
              className="rounded-lg border border-brand-primary/40 px-2 py-1 text-[11.5px] font-semibold text-brand-primary hover:bg-brand-primary hover:text-white"
            >
              + riga in K21
            </button>
            <button
              type="button"
              data-testid="add-process"
              onClick={() => setForm(form === 'process' ? 'none' : 'process')}
              className="rounded-lg border border-brand-warning/50 px-2 py-1 text-[11.5px] font-semibold text-brand-warning-700 hover:bg-brand-warning hover:text-white"
            >
              + ascoltatore in process
            </button>
          </div>
        </div>

        {form === 'k21' && (
          <div className="mt-2 grid gap-2 rounded-xl border border-brand-primary/30 bg-brand-primary-100/30 p-2.5 sm:grid-cols-[110px_1fr_1fr_auto]">
            <select
              data-testid="draft-type"
              value={draftType}
              onChange={(e) => setDraftType(e.target.value as Observer['type'])}
              className="rounded-lg border border-inchiostro/15 bg-carta px-2 py-1.5 font-mono text-[11.5px]"
            >
              {OBSERVER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              data-testid="draft-target"
              value={draftTarget}
              onChange={(e) => setDraftTarget(e.target.value)}
              placeholder="F(EXB;XX_100_01;DO.SOMETHING)"
              className="rounded-lg border border-inchiostro/15 bg-carta px-2 py-1.5 font-mono text-[11.5px]"
            />
            <input
              data-testid="draft-condition"
              value={draftCondition}
              onChange={(e) => setDraftCondition(e.target.value)}
              placeholder="&event.object.CAMPO > 0 (facoltativa)"
              className="rounded-lg border border-inchiostro/15 bg-carta px-2 py-1.5 font-mono text-[11.5px]"
            />
            <button
              type="button"
              data-testid="confirm-k21"
              onClick={aggiungiK21}
              className="rounded-lg bg-brand-primary px-3 py-1.5 text-[12px] font-semibold text-white"
            >
              aggiungi
            </button>
          </div>
        )}

        {form === 'process' && (
          <div className="mt-2 rounded-xl border border-brand-warning/40 bg-brand-warning-100/30 p-2.5">
            <p className="text-[11.5px] text-inchiostro">
              Una cattura effimera: <code className="font-mono">REG.CAP</code> dichiara una coda
              non durevole con auto-delete e TTL 600 s, e la consuma dentro il processo. Non
              scrive niente su disco: sopravvive al prossimo riavvio solo se qualcuno la richiama.
            </p>
            <button
              type="button"
              data-testid="confirm-process"
              onClick={aggiungiProcess}
              className="mt-2 rounded-lg bg-brand-warning px-3 py-1.5 text-[12px] font-semibold text-white"
            >
              attiva la cattura su {event.id}
            </button>
          </div>
        )}

        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {event.observers.map((obs) => (
            <div
              key={obs.id}
              data-testid={`listener-${obs.id}`}
              data-origin="k21"
              className="rounded-xl border border-inchiostro/10 bg-fondo p-2"
            >
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-brand-info-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-info-900">
                  {obs.type}
                </span>
                <code className="truncate font-mono text-[10px] text-tenue">{obs.id}</code>
              </div>
              <p className="mt-1 truncate font-mono text-[11px] text-inchiostro">{obs.target}</p>
              <p className="text-[11px] leading-snug text-tenue">{obs.goal}</p>
              {obs.condition && (
                <p className="mt-0.5 truncate font-mono text-[10px] text-brand-primary">
                  {obs.condition}
                </p>
              )}
            </div>
          ))}

          {extraObservers.map((obs) => (
            <div
              key={obs.id}
              data-testid={`listener-${obs.id}`}
              data-origin="aggiunto"
              className="rounded-xl border border-brand-primary/40 bg-brand-primary-100/40 p-2"
            >
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-brand-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {obs.type}
                </span>
                <code className="truncate font-mono text-[10px] text-tenue">{obs.id}</code>
                <button
                  type="button"
                  data-testid={`remove-${obs.id}`}
                  onClick={() => setExtraObservers(extraObservers.filter((o) => o.id !== obs.id))}
                  className="ml-auto text-[11px] text-tenue hover:text-brand-danger"
                  aria-label={`togli ${obs.id}`}
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 truncate font-mono text-[11px] text-inchiostro">{obs.target}</p>
              <pre className="mt-1 overflow-hidden rounded bg-inchiostro px-1.5 py-1 font-mono text-[9.5px] leading-tight text-white">
                {observerToScriptLines(obs)}
              </pre>
            </div>
          ))}

          {[...event.captures, ...extraCaptures].map((cap) => (
            <div
              key={cap.id}
              data-testid={`listener-${cap.id}`}
              data-origin="process"
              className={
                'rounded-xl border p-2 ' +
                (extraCaptures.some((c) => c.id === cap.id)
                  ? 'border-brand-warning/50 bg-brand-warning-100/40'
                  : 'border-inchiostro/10 bg-fondo')
              }
            >
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-brand-warning px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  IN PROCESS
                </span>
                <code className="truncate font-mono text-[10px] text-tenue">{cap.id}</code>
                {extraCaptures.some((c) => c.id === cap.id) && (
                  <button
                    type="button"
                    data-testid={`remove-${cap.id}`}
                    onClick={() => setExtraCaptures(extraCaptures.filter((c) => c.id !== cap.id))}
                    className="ml-auto text-[11px] text-tenue hover:text-brand-danger"
                    aria-label={`togli ${cap.id}`}
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="mt-1 truncate font-mono text-[11px] text-inchiostro">{cap.queue}</p>
              <p className="text-[11px] leading-snug text-tenue">{cap.goal}</p>
            </div>
          ))}

          {ascoltatori === 0 && activeCaptures === 0 && (
            <div className="rounded-xl border border-dashed border-brand-danger/40 bg-brand-danger-100/30 p-2">
              <p className="text-[11.5px] font-semibold text-brand-danger-900">Nessuno ascolta</p>
              <p className="mt-0.5 text-[11px] leading-snug text-brand-danger-900/80">
                Non esiste {event.id}.k21: il consumer nackerà senza requeue. Aggiungi una riga qui
                sopra e l’evento avrà chi lo riceve.
              </p>
            </div>
          )}
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
              condizioni. Gli ascoltatori aggiunti qui sopra entrano nell’esecuzione come gli altri.
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

            <ol className="grid gap-2 lg:grid-cols-2" data-testid="steps" key={runKey}>
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
                              <dt className="w-32 shrink-0 text-tenue/80">{line.label}</dt>
                              <dd className="min-w-0 break-words font-mono text-inchiostro">
                                {line.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      {step.code && (
                        <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-inchiostro px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-white">
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
