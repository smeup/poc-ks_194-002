import { useMemo, useState } from 'react'
import type { CaptureDef, EventDef, ExchangeDef, Observer } from '../lib/engine'
import {
  captureQueueName,
  captureSubscribeCode,
  k21FileLines,
  observerToScriptLines,
} from '../lib/engine'
import Code, { CodeLine } from './Code'
import OkTag from './OkTag'

type Props = {
  event: EventDef
  exchange: ExchangeDef | null
  captureOn: boolean
  onToggleCapture: () => void
  extraObservers: Observer[]
  onAddObserver: (obs: Observer) => void
  onRemoveObserver: (id: string) => void
  extraCaptures: CaptureDef[]
  onAddCapture: (cap: CaptureDef) => void
  onRemoveCapture: (id: string) => void
}

const OBSERVER_TYPES: Observer['type'][] = ['FUN', 'PGM', 'K11', 'LOG', 'AUDIT']

/** Ogni tipo di observer chiede una cosa diversa nel K21: la form lo chiede di conseguenza. */
const CAMPO: Record<
  Observer['type'],
  { etichetta: string; esempio: string; valore: string; scopo: string } | null
> = {
  FUN: {
    etichetta: 'la FUN',
    esempio: 'F(EXB;XX_100_01;DO.SOMETHING)',
    valore: 'F(EXB;XX_100_01;DO.SOMETHING)',
    scopo: 'chiamare la FUN',
  },
  PGM: { etichetta: 'il programma', esempio: 'PGMREC', valore: 'PGMXXX', scopo: 'chiamare il programma' },
  K11: { etichetta: 'il codice SE.SUB', esempio: 'PRO.MSG', valore: 'PRO.MSG', scopo: 'mandare il messaggio alla sezione LOA38' },
  LOG: { etichetta: 'il messaggio', esempio: '&event.data', valore: '&event.data', scopo: 'scrivere l’evento nel log' },
  AUDIT: null,
}

type Scelta = { kind: 'k21'; id: string } | { kind: 'process'; id: string }

export default function ObserverBox({
  event,
  exchange,
  captureOn,
  onToggleCapture,
  extraObservers,
  onAddObserver,
  onRemoveObserver,
  extraCaptures,
  onAddCapture,
  onRemoveCapture,
}: Props) {
  const [form, setForm] = useState<'none' | 'k21' | 'process'>('none')
  const [draftType, setDraftType] = useState<Observer['type']>('FUN')
  const [draftTarget, setDraftTarget] = useState('F(EXB;XX_100_01;DO.SOMETHING)')
  const [draftCondition, setDraftCondition] = useState('')
  const [draftLogLevel, setDraftLogLevel] = useState<'INFO' | 'WARN' | 'ERROR'>('INFO')
  const [draftVars, setDraftVars] = useState('')

  const campo = CAMPO[draftType]

  function cambiaTipo(tipo: Observer['type']) {
    setDraftType(tipo)
    const nuovo = CAMPO[tipo]
    setDraftTarget(nuovo ? nuovo.valore : '')
  }
  const [scelta, setScelta] = useState<Scelta | null>(null)

  const catture = [...event.captures, ...extraCaptures]
  const k21Rows = [...event.observers, ...extraObservers]
  const fileEsiste = !event.missingScript

  // aperto di default: la prima sezione del file, altrimenti la prima cattura
  const attiva: Scelta | null =
    scelta ??
    (k21Rows.length
      ? { kind: 'k21', id: k21Rows[0].id }
      : catture.length
        ? { kind: 'process', id: catture[0].id }
        : null)

  /** Il file come lo si legge adesso: le righe del repository e, in coda, le sezioni aggiunte qui. */
  const fileLines = useMemo(() => {
    const base = k21FileLines(event).map((riga) => ({ ...riga, aggiunta: false }))
    const aggiunte: { n: number; text: string; section: number; aggiunta: boolean }[] = []
    extraObservers.forEach((obs, i) => {
      observerToScriptLines(obs)
        .split('\n')
        .forEach((text) => {
          aggiunte.push({
            n: base.length + aggiunte.length + 1,
            text,
            section: event.observers.length + i,
            aggiunta: true,
          })
        })
    })
    return [...base, ...aggiunte]
  }, [event, extraObservers])

  const sezioniTotali = event.observers.length + extraObservers.length

  const contenuto = (() => {
    if (!attiva) return null
    if (attiva.kind === 'process') {
      const capture = catture.find((c) => c.id === attiva.id)
      if (!capture) return null
      return {
        kind: 'process' as const,
        path: `in process → ${capture.queue}`,
        badge: 'JAVA',
        text: captureSubscribeCode(event, capture, exchange),
        nota:
          'Nessun file su disco: la coda la dichiara il processo quando registra la cattura, e sparisce con lui.',
      }
    }

    const obs = k21Rows.find((o) => o.id === attiva.id)
    if (!obs) return null
    const inFile = fileEsiste && event.observers.some((o) => o.id === obs.id)
    const index = inFile
      ? event.observers.findIndex((o) => o.id === obs.id)
      : event.observers.length + extraObservers.findIndex((o) => o.id === obs.id)
    return {
      kind: 'k21' as const,
      path: `SCP_K21/${event.script.file} · sezione ${index + 1} di ${sezioniTotali}${
        inFile ? '' : ' · aggiunta in questa sessione'
      }`,
      badge: 'K21',
      text: fileLines.map((l) => l.text).join('\n'),
      highlight: index,
      nota: inFile
        ? 'Il file si legge tutto: la sezione evidenziata è quella che questo observer dichiara. Il resto sono gli altri observer dello stesso evento, comprese le sezioni aggiunte qui.'
        : 'Questa sezione non è nel file versionato: è appesa in coda per questa sessione, e si vede nel contesto delle altre.',
    }
  })()

  function aggiungiK21() {
    const n = event.observers.length + extraObservers.length + 1
    const scopo = CAMPO[draftType]
    const target = draftTarget.trim() || (scopo ? scopo.valore : '')
    const obs: Observer = {
      id: `${event.id}#a${n}`,
      type: draftType,
      target,
      condition: draftCondition.trim() || null,
      // il commento della sezione: per LOG il messaggio è il payload, non serve ripeterlo
      goal: scopo
        ? draftType === 'LOG'
          ? scopo.scopo
          : `${scopo.scopo} ${target}`.trim()
        : 'tracciare l’evento in audit',
      note: 'non esiste nel file versionato: è una prova, non una modifica al repository',
      ...(draftType === 'LOG' ? { logLevel: draftLogLevel } : {}),
      ...(draftType === 'K11' && draftVars.trim() ? { vars: draftVars.trim() } : {}),
    }
    onAddObserver(obs)
    setScelta({ kind: 'k21', id: obs.id })
    setForm('none')
    setDraftCondition('')
  }

  function aggiungiProcess() {
    const n = extraCaptures.length + 1
    const id = `E2E-prova${n}`
    onAddCapture({
      id,
      type: 'CAPTURE',
      target: captureQueueName(id),
      queue: captureQueueName(id),
      condition: `type = ${event.id}`,
      goal: 'observer in process aggiunto a mano',
      note: 'REG.CAP a runtime: coda non durevole, auto-delete, TTL 600 s, vive nel processo che risponde alla chiamata',
    })
    setScelta({ kind: 'process', id })
    setForm('none')
  }

  return (
    <section className="space-y-3" data-testid="listeners">
      <div className="grid gap-3 lg:grid-cols-2">
        {/* ------------------------------------------------------- cartella SCP_K21 */}
        <div
          className="rounded-2xl border border-t-4 border-inchiostro/10 border-t-brand-primary bg-carta p-3 shadow-carta"
          data-testid="folder-k21"
        >
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold">
                Observer in script K21
                <span className="rounded bg-brand-primary-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-primary-900">
                  file · stabile
                </span>
                <OkTag id="OKOBS" />
              </p>
              <p className="mt-1 text-[11.5px] leading-snug text-tenue">
                Righe di file <span className="font-mono">.k21</span>: le legge il thread{' '}
                <span className="font-mono">k21-observers</span> di me-java-batch. Restano finché
                qualcuno non le toglie dal file.
              </p>
            </div>
            <button
              type="button"
              data-testid="add-k21"
              onClick={() => setForm(form === 'k21' ? 'none' : 'k21')}
              className="ml-auto shrink-0 rounded-lg border border-brand-primary/40 px-2 py-1 text-[11.5px] font-semibold text-brand-primary hover:bg-brand-primary hover:text-white"
            >
              + riga nel file
            </button>
          </div>

          {form === 'k21' && (
            <div className="mt-2 rounded-xl border border-brand-primary/30 bg-brand-primary-100/30 p-2.5">
              <div className="grid gap-2 sm:grid-cols-[110px_1fr] xl:grid-cols-[110px_1fr_1fr_auto]">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-tenue">
                    tipo
                  </span>
                  <select
                    data-testid="draft-type"
                    value={draftType}
                    onChange={(e) => cambiaTipo(e.target.value as Observer['type'])}
                    className="rounded-lg border border-inchiostro/15 bg-carta px-2 py-1.5 font-mono text-[11.5px]"
                  >
                    {OBSERVER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                {campo ? (
                  <label className="flex flex-col gap-0.5">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide text-tenue"
                      data-testid="draft-target-label"
                    >
                      {campo.etichetta}
                    </span>
                    <input
                      data-testid="draft-target"
                      value={draftTarget}
                      onChange={(e) => setDraftTarget(e.target.value)}
                      placeholder={campo.esempio}
                      className="rounded-lg border border-inchiostro/15 bg-carta px-2 py-1.5 font-mono text-[11.5px]"
                    />
                  </label>
                ) : (
                  <p
                    className="self-end rounded-lg border border-dashed border-inchiostro/20 bg-carta px-2 py-1.5 text-[11.5px] text-tenue"
                    data-testid="draft-audit-nota"
                  >
                    AUDIT non chiede niente: la sezione non ha <span className="font-mono">::OBS</span>
                  </p>
                )}

                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-tenue">
                    la condizione <span className="normal-case">(per tutti, facoltativa)</span>
                  </span>
                  <input
                    data-testid="draft-condition"
                    value={draftCondition}
                    onChange={(e) => setDraftCondition(e.target.value)}
                    placeholder="&event.object.CAMPO > 0"
                    className="rounded-lg border border-inchiostro/15 bg-carta px-2 py-1.5 font-mono text-[11.5px]"
                  />
                </label>

                <button
                  type="button"
                  data-testid="confirm-k21"
                  onClick={aggiungiK21}
                  className="self-end rounded-lg bg-brand-primary px-3 py-1.5 text-[12px] font-semibold text-white"
                >
                  aggiungi
                </button>
              </div>

              {/* quello che il tipo chiede in più */}
              {draftType === 'LOG' && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] text-tenue">
                    livello
                    <select
                      data-testid="draft-loglevel"
                      value={draftLogLevel}
                      onChange={(e) => setDraftLogLevel(e.target.value as 'INFO' | 'WARN' | 'ERROR')}
                      className="rounded-lg border border-inchiostro/15 bg-carta px-2 py-1 font-mono text-[11.5px]"
                    >
                      {(['INFO', 'WARN', 'ERROR'] as const).map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="text-[11px] text-tenue">
                    il messaggio è il payload dell’evento: <span className="font-mono">&amp;event.data</span>
                  </span>
                </div>
              )}
              {draftType === 'K11' && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="flex flex-1 items-center gap-1.5 text-[11px] text-tenue">
                    parametri <span className="font-mono">VarA38</span> (facoltativi)
                    <input
                      data-testid="draft-vars"
                      value={draftVars}
                      onChange={(e) => setDraftVars(e.target.value)}
                      placeholder="&event.object"
                      className="min-w-40 flex-1 rounded-lg border border-inchiostro/15 bg-carta px-2 py-1.5 font-mono text-[11.5px]"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* come una cartella: prima il file, poi le sue sezioni */}
          <div className="mt-2 rounded-xl border border-inchiostro/10 bg-fondo p-2">
            <p className="flex items-center gap-1.5 font-mono text-[11px] text-tenue">
              <span className="text-brand-primary">▾</span>
              SCP_K21/<span className="text-inchiostro">{fileEsiste ? event.script.file : `${event.id}.k21`}</span>
              <span className="ml-auto">
                {fileEsiste ? `${event.observers.length} sezioni` : 'assente'}
              </span>
            </p>

            <ul className="mt-1 space-y-1">
              {k21Rows.map((obs, index) => {
                const inFile = fileEsiste && index < event.observers.length
                const isOpen = attiva?.kind === 'k21' && attiva.id === obs.id
                return (
                  <li key={obs.id}>
                    <button
                      type="button"
                      data-testid={`listener-${obs.id}`}
                      data-origin={inFile ? 'k21' : 'aggiunto'}
                      data-open={isOpen ? 'yes' : 'no'}
                      onClick={() => setScelta({ kind: 'k21', id: obs.id })}
                      className={
                        'w-full rounded-lg border px-2 py-1.5 text-left transition-colors ' +
                        (isOpen
                          ? 'border-brand-primary/50 bg-brand-primary-100/50'
                          : inFile
                            ? 'border-inchiostro/10 bg-carta hover:border-brand-primary/30'
                            : 'border-brand-primary/40 bg-brand-primary-100/30 hover:border-brand-primary/60')
                      }
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-4 shrink-0 font-mono text-[10.5px] text-tenue">
                          {inFile ? `#${index + 1}` : '+'}
                        </span>
                        <span className="shrink-0 rounded bg-brand-info-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-info-900">
                          {obs.type}
                        </span>
                        <span className="truncate font-mono text-[11.5px] text-inchiostro">
                          {obs.target}
                        </span>
                      </span>
                      {obs.condition && (
                        <span className="mt-1 block truncate font-mono text-[10.5px] text-brand-primary">
                          se {obs.condition}
                        </span>
                      )}
                    </button>
                    {!inFile && (
                      <button
                        type="button"
                        data-testid={`remove-${obs.id}`}
                        onClick={() => onRemoveObserver(obs.id)}
                        className="ml-1 text-[10px] text-tenue hover:text-brand-danger"
                        aria-label={`togli ${obs.id}`}
                      >
                        ✕ togli
                      </button>
                    )}
                  </li>
                )
              })}

              {k21Rows.length === 0 && (
                <li className="rounded-lg border border-dashed border-brand-danger/40 bg-brand-danger-100/30 px-2 py-1.5">
                  <p className="text-[11.5px] font-semibold text-brand-danger-900">
                    Nessuno script per questo evento
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-brand-danger-900/80">
                    Il file non esiste: il consumer nackerà senza requeue e l’evento si perde.
                    Aggiungi una riga qui sopra e avrà chi lo riceve.
                  </p>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* ---------------------------------------------------- cartella in process */}
        <div
          className="rounded-2xl border border-t-4 border-inchiostro/10 border-t-brand-warning bg-carta p-3 shadow-carta"
          data-testid="folder-process"
        >
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold">
                Observer
                <span className="font-normal text-tenue">in process</span>
                <span className="rounded bg-brand-warning-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-warning-900">
                  runtime · effimera
                </span>
                <OkTag id="OKOBS" />
              </p>
              <p className="mt-1 text-[11.5px] leading-snug text-tenue">
                Code dichiarate a runtime da <span className="font-mono">REG.CAP</span>: non
                durevoli, auto-delete, TTL ≤ 3600 s. Muoiono con il processo che le ha create.
              </p>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                data-testid="toggle-capture"
                data-state={captureOn ? 'on' : 'off'}
                onClick={onToggleCapture}
                className={
                  'rounded-lg px-2 py-1 text-[11px] font-semibold ' +
                  (captureOn ? 'bg-brand-success text-white' : 'bg-inchiostro/10 text-tenue')
                }
              >
                {captureOn ? 'accesi' : 'spenti'}
              </button>
              <button
                type="button"
                data-testid="add-process"
                onClick={() => setForm(form === 'process' ? 'none' : 'process')}
                className="rounded-lg border border-brand-warning/50 px-2 py-1 text-[11.5px] font-semibold text-brand-warning-700 hover:bg-brand-warning hover:text-white"
              >
                + cattura
              </button>
            </div>
          </div>

          {form === 'process' && (
            <div className="mt-2 rounded-xl border border-brand-warning/40 bg-brand-warning-100/30 p-2.5">
              <p className="text-[11.5px] leading-snug text-inchiostro">
                <span className="font-mono">REG.CAP</span> dichiara una coda non durevole con
                auto-delete e TTL 600 s e la consuma dentro il processo che sta rispondendo: non
                c’è niente da scrivere in <span className="font-mono">SCP_K21</span>.
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

          <div className="mt-2 rounded-xl border border-inchiostro/10 bg-fondo p-2">
            <p className="flex items-center gap-1.5 font-mono text-[11px] text-tenue">
              <span className="text-brand-warning">▾</span>
              runtime/<span className="text-inchiostro">catture</span>
              <span className="ml-auto">
                {catture.length} {catture.length === 1 ? 'coda' : 'code'}
                {captureOn ? '' : ' · spenti'}
              </span>
            </p>

            <ul className="mt-1 space-y-1">
              {catture.map((cap) => {
                const aggiunta = extraCaptures.some((c) => c.id === cap.id)
                const isOpen = attiva?.kind === 'process' && attiva.id === cap.id
                return (
                  <li key={cap.id}>
                    <button
                      type="button"
                      data-testid={`listener-${cap.id}`}
                      data-origin="process"
                      data-open={isOpen ? 'yes' : 'no'}
                      onClick={() => setScelta({ kind: 'process', id: cap.id })}
                      className={
                        'w-full rounded-lg border px-2 py-1.5 text-left transition-colors ' +
                        (isOpen
                          ? 'border-brand-warning/60 bg-brand-warning-100/50'
                          : aggiunta
                            ? 'border-brand-warning/50 bg-brand-warning-100/40 hover:border-brand-warning'
                            : 'border-inchiostro/10 bg-carta hover:border-brand-warning/40')
                      }
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="rounded bg-brand-warning px-1.5 py-0.5 text-[9.5px] font-semibold text-white">
                          IN PROCESS
                        </span>
                        <span className="truncate font-mono text-[11px] text-inchiostro">
                          {cap.queue}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-tenue">
                        {cap.condition}
                      </span>
                    </button>
                    {aggiunta && (
                      <button
                        type="button"
                        data-testid={`remove-${cap.id}`}
                        onClick={() => onRemoveCapture(cap.id)}
                        className="ml-1 text-[10px] text-tenue hover:text-brand-danger"
                        aria-label={`togli ${cap.id}`}
                      >
                        ✕ togli
                      </button>
                    )}
                  </li>
                )
              })}

              {catture.length === 0 && (
                <li className="rounded-lg border border-dashed border-inchiostro/20 px-2 py-1.5">
                  <p className="text-[11px] leading-snug text-tenue">
                    Nessuna cattura: nessuno sta ascoltando questo evento dentro un processo. Con
                    «+ cattura» ne aggiungi una e vedi il codice che la registra.
                  </p>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- il visualizzatore */}
      <div className="rounded-2xl border border-inchiostro/10 bg-carta p-3 shadow-carta" data-testid="listener-viewer">
        {contenuto ? (
          <>
            <div className="flex flex-wrap items-baseline gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-tenue">
                {contenuto.kind === 'k21' ? 'Il file .k21' : 'Il codice che si sottoscrive'}
              </p>
              <code className="rounded bg-inchiostro/10 px-1.5 py-0.5 font-mono text-[10.5px] text-inchiostro">
                {contenuto.path}
              </code>
              <span className="rounded bg-inchiostro/10 px-1.5 py-0.5 text-[10px] font-semibold text-tenue">
                {contenuto.badge}
              </span>
            </div>

            {contenuto.kind === 'k21' && contenuto.highlight !== undefined ? (
              <div className="mt-2 overflow-x-auto rounded-lg bg-inchiostro px-2 py-2 font-mono text-[11px] leading-relaxed text-white">
                {fileLines.map((line) => (
                  <div
                    key={line.n}
                    data-line={line.n}
                    data-section={line.section === contenuto.highlight ? 'si' : 'no'}
                    data-aggiunta={line.aggiunta ? 'si' : undefined}
                    data-indent={
                      line.section !== null && !/^::SEZ/i.test(line.text.trim()) ? 'si' : undefined
                    }
                    className={
                      'whitespace-pre px-1 ' +
                      (line.section !== null && !/^::SEZ/i.test(line.text.trim()) ? 'pl-5 ' : '') +
                      (line.section === contenuto.highlight
                        ? 'border-l-4 border-brand-warning bg-white/25'
                        : 'border-l-4 border-transparent opacity-55') +
                      (line.aggiunta ? ' border-dashed' : '')
                    }
                  >
                    <CodeLine line={line.text} lang="k21" />
                    {line.aggiunta && /^::SEZ/i.test(line.text.trim()) && (
                      <span className="ml-2 rounded bg-brand-primary px-1 py-0.5 text-[9px] font-semibold text-white">
                        aggiunta in questa sessione
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Code
                text={contenuto.text}
                lang={contenuto.kind === 'process' ? 'java' : 'k21'}
                testId="listener-code"
                className="mt-2"
              />
            )}

            <p className="mt-1.5 text-[11px] leading-snug text-tenue">{contenuto.nota}</p>
          </>
        ) : (
          <p className="text-[11.5px] text-tenue">
            Scegli un observer da una delle due cartelle: qui compare il file <span className="font-mono">.k21</span>{' '}
            oppure il codice in process.
          </p>
        )}
      </div>
    </section>
  )
}
