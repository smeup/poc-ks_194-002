/**
 * Il motore del POC: ricostruisce, passo per passo, cosa fa la piattaforma quando un
 * evento entra. Niente di qui parla con un server: i dati arrivano da `src/json/events.json`
 * e le regole sono quelle lette nel codice di `me-java-batch` e di `kokos-sdk-java-rpgle`
 * (ScpK21Manager, K21EventHandler, RabbitEventTransport, EventConsumer, BooleanOperationManager).
 */

export type ProducerKind = 'fun' | 'sdk'

export type ExchangeDef = {
  code: string
  name: string
  title: string
  publish: boolean
  capture: boolean
  keyPrio0: string
  keyPrioAlta: string
  producers: string
  consumers: string
}

export type QueueDef = {
  name: string
  type: string
  durable: string
  binding: string
  consumer: string
  note: string
}

export type MicroExecutorDef = {
  id: string
  title: string
  role: string
  knows: string
}

export type ProducerDef = {
  kind: ProducerKind
  label: string
  detail: string
  source: string
  exchange: string
  priority: number
}

export type AppObject = {
  key: string
  label: string
  className: string
  object: string
  attributes: Record<string, string>
}

export type Observer = {
  id: string
  type: 'FUN' | 'PGM' | 'K11' | 'LOG' | 'AUDIT'
  target: string
  condition: string | null
  goal: string
  note: string
}

export type CaptureDef = {
  id: string
  type: 'CAPTURE'
  target: string
  queue: string
  condition: string
  goal: string
  note: string
}

export type EventDef = {
  id: string
  okevt: string
  useCase: string
  title: string
  summary: string
  producer: ProducerDef
  objects: AppObject[]
  dataTemplate: Record<string, unknown>
  script: { library: string; file: string; text: string[] }
  missingScript?: boolean
  observers: Observer[]
  captures: CaptureDef[]
  exchangesAllowed: string[]
}

export type Catalog = {
  environment: string
  exchanges: ExchangeDef[]
  queues: QueueDef[]
  microExecutors: MicroExecutorDef[]
  events: EventDef[]
}

export type StepStatus = 'ok' | 'skip' | 'warn' | 'error'

export type StepLine = { label: string; value: string }

export type Step = {
  id: string
  n: number
  title: string
  detail: string
  status: StepStatus
  lines: StepLine[]
  code?: string
}

export type ObserverOutcome = {
  id: string
  type: Observer['type']
  target: string
  goal: string
  note: string
  condition: string | null
  resolvedCondition: string | null
  conditionValue: boolean | null
  fired: boolean
  reason: string
}

export type Verdict = {
  tone: 'ok' | 'warn' | 'error' | 'quiet'
  title: string
  text: string
}

export type RunResult = {
  steps: Step[]
  outcomes: ObserverOutcome[]
  payload: Record<string, unknown>
  exchange: ExchangeDef | null
  exchangeName: string
  routingKey: string
  queue: string
  verdict: Verdict
  substitutes: { from: string; to: string }[]
}

export type RunInput = {
  event: EventDef
  object: AppObject
  data: string
  priority: number
  producerKind: ProducerKind
  exchangeCode: string
  user: string
  captureOn: boolean
  now?: Date
}

/** `NR;SP;20260417` → terna Smeup; nel payload la classe è tipo+parametro. */
export function splitKey(key: string): { t: string; p: string; k: string } {
  const [t = '', p = '', k = ''] = key.split(';')
  return { t, p, k }
}

export function objectKeyLabel(obj: AppObject): string {
  const { t, p, k } = splitKey(obj.key)
  return `${t};${p};${k}`
}

/**
 * La routing key, esattamente come la compone KS_194_02A: priorità 0 sulla coda normale,
 * priorità > 0 sul ramo `business.event.high.<TYPE>`.
 */
export function routingKeyFor(exchange: ExchangeDef, type: string, priority: number): string {
  if (exchange.code === 'business') {
    return priority > 0 ? `business.event.high.${type}` : exchange.keyPrio0
  }
  return exchange.keyPrio0.replace('<TYPE>', type)
}

export function queueFor(exchange: ExchangeDef, priority: number): string {
  if (exchange.code !== 'business') {
    if (exchange.code === 'auth') return 'AUTHENTICATION_EVT_QUEUE'
    return `SND<id>` // la coda di risposta dei comandi
  }
  return priority > 0 ? 'BUSINESS_EVT_QUEUE_HIGH' : 'BUSINESS_EVT_QUEUE'
}

/** Le sostituzioni che ScpK21Manager fa prima di valutare una condizione. */
export function substituteCondition(
  condition: string,
  obj: AppObject,
  user: string,
  timestampMs: number,
): { text: string; substitutes: { from: string; to: string }[] } {
  const substitutes: { from: string; to: string }[] = []
  let text = condition
  const push = (from: string, to: string) => {
    if (text.includes(from)) {
      substitutes.push({ from, to })
      text = text.split(from).join(to)
    }
  }
  // prima le formule OAV: `&event.object.CAMPO` diventa `CLASSE.CHIAVE.CAMPO` e poi il valore
  const formula = /&event\.object\.([A-Za-z0-9_]+)/g
  const found = new Set(Array.from(condition.matchAll(formula)).map((m) => m[1]))
  for (const attr of found) {
    const value = obj.attributes[attr] ?? ''
    substitutes.push({ from: `&event.object.${attr}`, to: value })
    text = text.split(`&event.object.${attr}`).join(value)
  }
  push('&event.object', obj.object)
  push('&event.class', obj.className)
  push('&event.user', user)
  push('&event.timestamp', String(timestampMs))
  return { text, substitutes }
}

/** `1240 > 500` → true. Gli operatori sono quelli di BooleanOperationManager. */
export function evaluateCondition(expression: string): boolean | null {
  const match = expression.match(/([\w\s.]+?)\s*(>=|<=|==|!=|>|<)\s*([\w\s.]+)/)
  if (!match) return null
  const [, rawLeft, op, rawRight] = match
  const left = rawLeft.trim()
  const right = rawRight.trim()
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    switch (op) {
      case '>':
        return leftNumber > rightNumber
      case '<':
        return leftNumber < rightNumber
      case '>=':
        return leftNumber >= rightNumber
      case '<=':
        return leftNumber <= rightNumber
      case '==':
        return leftNumber === rightNumber
      case '!=':
        return leftNumber !== rightNumber
      default:
        return null
    }
  }
  switch (op) {
    case '==':
      return left === right
    case '!=':
      return left !== right
    default:
      return null
  }
}

function parseData(raw: string): { value: string; error: string | null } {
  const trimmed = raw.trim()
  if (!trimmed) return { value: '', error: null }
  try {
    JSON.parse(trimmed)
    return { value: trimmed, error: null }
  } catch (e) {
    return { value: trimmed, error: (e as Error).message }
  }
}

export function buildPayload(
  input: RunInput,
  env: string,
  timestampMs: number,
): Record<string, unknown> {
  const { event, object, user } = input
  return {
    event_type: event.id,
    env,
    user: input.producerKind === 'fun' ? user : event.producer.source + ' / ' + user,
    timestamp: timestampMs,
    class: object.className,
    object: object.object,
    data: input.data,
    source: input.producerKind === 'fun' ? 'KS_194_02A' : event.producer.source,
  }
}

/**
 * La catena, nell'ordine in cui succede (i dodici passi di docs/schemi/README.md, qui
 * raggruppati in dieci perché due coppie non hanno niente da mostrare separatamente).
 */
export function runScenario(input: RunInput, catalog: Catalog): RunResult {
  const { event, object, priority, exchangeCode } = input
  const now = input.now ?? new Date()
  const timestampMs = now.getTime()
  const exchange = catalog.exchanges.find((e) => e.code === exchangeCode) ?? null
  const routingKey = exchange ? routingKeyFor(exchange, event.id, priority) : ''
  const queue = exchange ? queueFor(exchange, priority) : ''
  const data = parseData(input.data)
  const payload = buildPayload(input, catalog.environment, timestampMs)
  const steps: Step[] = []
  const substitutes: { from: string; to: string }[] = []

  steps.push({
    id: 'producer',
    n: 1,
    title:
      input.producerKind === 'fun'
        ? 'Una FUN pubblica l’evento'
        : 'Un servizio con SDK pubblica l’evento',
    detail:
      input.producerKind === 'fun'
        ? 'La scheda chiama PUB.EVT sul micro esecutore indicato dal registry: nessun JSON libero, il payload è costruito dalla FUN.'
        : 'Il servizio istanzia SmeupBusinessEvent e chiama EventProducer.publish: nessuna FUN di mezzo, nessun registry.',
    status: data.error ? 'warn' : 'ok',
    lines: [
      { label: 'Produttore', value: event.producer.label },
      {
        label: 'Chiamata',
        value:
          input.producerKind === 'fun'
            ? 'F(FBK;KS_194_02A;PUB.EVT) INPUT(TYPE(...) ENV(...) CLASS(...) OBJ(...) DATA(...) PRIO(' + priority + '))'
            : event.producer.detail,
      },
      { label: 'source nel payload', value: String(payload.source) },
    ],
    code: JSON.stringify(payload, null, 2),
  })

  steps.push({
    id: 'identity',
    n: 2,
    title: 'Identità e tempo',
    detail:
      input.producerKind === 'fun'
        ? 'L’utente non è un parametro: è context.getUser(), cioè chi ha chiamato. PUB.JSN sovrascrive comunque un eventuale utente nel JSON.'
        : 'Il servizio dichiara la propria identità in `source` e mette nell’evento l’utente del proprio contesto: il motore userà quello per eseguire le FUN.',
    status: 'ok',
    lines: [
      { label: 'utente dell’evento', value: String(payload.user) },
      { label: 'timestamp', value: `${timestampMs} (${now.toISOString()})` },
      { label: 'oggetto applicativo', value: `${objectKeyLabel(object)} → class=${object.className} object=${object.object}` },
    ],
  })

  const publishable = exchange !== null && (exchange.publish || exchangeCode === 'auth' ? exchange.publish : false)
  steps.push({
    id: 'publish',
    n: 3,
    title: 'Pubblicazione sull’exchange',
    detail: exchange
      ? publishable
        ? `exchangeDeclare("${exchange.name}", "topic", durable) e basicPublish con routing key "${routingKey}". È l’unico punto d’uscita: ci passano FUN, SDK e RPGLE.`
        : `L’exchange "${exchange.code}" non è pubblicabile dal codice: KS_194_02A risponde «EXCH non valido» e non pubblica niente.`
      : 'Exchange sconosciuto.',
    status: publishable ? 'ok' : 'error',
    lines: exchange
      ? [
          { label: 'exchange', value: `${exchange.name} (${exchange.code}, topic)` },
          { label: 'routing key', value: routingKey },
          { label: 'priorità', value: String(priority) },
        ]
      : [{ label: 'exchange', value: exchangeCode }],
  })

  if (!publishable) {
    return {
      steps,
      outcomes: [],
      payload,
      exchange,
      exchangeName: exchange?.name ?? exchangeCode,
      routingKey,
      queue,
      substitutes,
      verdict: {
        tone: 'error',
        title: 'L’evento non è nemmeno partito',
        text: 'La FUN rifiuta la richiesta prima del broker: il chiamante riceve un messaggio di errore e una tabella vuota. Nessun ascoltatore verrà mai interrogato.',
      },
    }
  }

  steps.push({
    id: 'routing',
    n: 4,
    title: 'Il broker instrada',
    detail:
      priority > 0
        ? `PRIO > 0: la routing key porta sul ramo alto, quindi sulla coda ${queue}. Chi consuma la coda normale non vede questo evento.`
        : `Binding sulla coda ${queue}. Il broker non conosce gli ascoltatori: instrada e basta.`,
    status: 'ok',
    lines: [
      { label: 'binding usato', value: routingKey },
      { label: 'coda', value: queue },
      { label: 'consumatore', value: queue === 'BUSINESS_EVT_QUEUE' || queue === 'BUSINESS_EVT_QUEUE_HIGH' ? 'k21-observers (me-java-batch)' : 'dispatcher' },
    ],
  })

  steps.push({
    id: 'consume',
    n: 5,
    title: 'Il thread k21-observers preleva',
    detail:
      'Il consumer deserializza lo SmeupBusinessEvent e chiama K21EventHandler.accept. Da qui in poi è tutto dentro il processo che ha consumato.',
    status: 'ok',
    lines: [
      { label: 'messaggio', value: `${payload.event_type} · ${payload.class}/${payload.object}` },
      { label: 'data', value: data.error ? `JSON non valido: ${data.error}` : data.value || '(vuoto)' },
    ],
  })

  if (event.missingScript) {
    steps.push({
      id: 'script',
      n: 6,
      title: 'Lo script non esiste',
      detail: `ScpK21Manager cerca ${event.script.library}/${event.id}.k21 nelle librerie dell’applicazione: non c’è. Il costruttore lancia e il consumer risponde NACK senza requeue.`,
      status: 'error',
      lines: [
        { label: 'cercato', value: `${event.script.library}/${event.id}.k21` },
        { label: 'effetto', value: 'eccezione → NACK (requeue = false)' },
      ],
    })
    steps.push({
      id: 'ack',
      n: 7,
      title: 'Nessun ack: il messaggio si perde',
      detail:
        'Il NACK è senza requeue: RabbitMQ scarta il messaggio, non c’è secondo tentativo. Il pubblicatore non se ne accorge, perché la pubblicazione era già riuscita. Se ne accorge solo chi apre la console.',
      status: 'error',
      lines: [
        { label: 'ack', value: 'no' },
        { label: 'requeue', value: 'false — il messaggio non torna in coda' },
        { label: 'chi lo sa', value: 'nessuno, finché qualcuno non guarda LST.EVT o la cattura' },
      ],
    })
    return {
      steps,
      outcomes: [],
      payload,
      exchange,
      exchangeName: exchange?.name ?? exchangeCode,
      routingKey,
      queue,
      substitutes,
      verdict: {
        tone: 'error',
        title: 'Evento senza script: perso in silenzio',
        text: `Nessuno script ${event.id}.k21 è montato: il consumer nacka senza requeue e il messaggio sparisce. Non è un guasto del broker, è un ascoltatore che manca.`,
      },
    }
  }

  steps.push({
    id: 'script',
    n: 6,
    title: 'Legge lo script SCP_K21',
    detail: `SourceManager apre ${event.script.library}/${event.id}.k21 dalle librerie montate: sola lettura, mai scrittura. Ogni sezione ::SEZ Type="…" è un ascoltatore.`,
    status: 'ok',
    lines: [
      { label: 'file', value: `${event.script.library}/${event.id}.k21` },
      { label: 'sezioni', value: String(event.observers.length) },
      ...(event.captures.length
        ? [{ label: 'in più', value: `${event.captures.length} cattura effimera registrata a runtime (non nello script)` }]
        : []),
    ],
    code: event.script.text.join('\n'),
  })

  const outcomes: ObserverOutcome[] = event.observers.map((obs) => {
    if (!obs.condition) {
      return {
        id: obs.id,
        type: obs.type,
        target: obs.target,
        goal: obs.goal,
        note: obs.note,
        condition: null,
        resolvedCondition: null,
        conditionValue: null,
        fired: true,
        reason: 'nessuna condizione: parte',
      }
    }
    const { text, substitutes: subs } = substituteCondition(obs.condition, object, String(payload.user), timestampMs)
    substitutes.push(...subs)
    const value = evaluateCondition(text)
    return {
      id: obs.id,
      type: obs.type,
      target: obs.target,
      goal: obs.goal,
      note: obs.note,
      condition: obs.condition,
      resolvedCondition: text,
      conditionValue: value,
      fired: value === true,
      reason:
        value === true
          ? 'condizione vera'
          : value === false
            ? 'condizione falsa: non parte, ed è un esito normale'
            : 'condizione non valutabile',
    }
  })

  const conditioned = outcomes.filter((o) => o.condition)
  steps.push({
    id: 'substitute',
    n: 7,
    title: 'Sostituisce le variabili dell’evento',
    detail:
      '&event.class, &event.object, &event.user, &event.data, &event.timestamp prendono il valore dall’evento. Un &event.object.CAMPO diventa CLASSE.CHIAVE.CAMPO e viene risolto come formula OAV da me-java-rpgle-std, prima del confronto.',
    status: 'ok',
    lines: substitutes.length
      ? substitutes.map((s) => ({ label: s.from, value: s.to }))
      : [{ label: 'variabili', value: 'questo script non usa &event.*' }],
  })

  steps.push({
    id: 'condition',
    n: 8,
    title: 'Valuta le condizioni',
    detail:
      'BooleanOperationManager confronta i due operandi con > < >= <= == !=. Una condizione falsa non è un errore: l’ascoltatore si salta e il giro continua.',
    status: conditioned.length === 0 ? 'skip' : 'ok',
    lines: conditioned.length
      ? conditioned.map((o) => ({
          label: o.id,
          value: `${o.resolvedCondition} → ${o.conditionValue === null ? 'non valutabile' : o.conditionValue ? 'vera' : 'falsa'}`,
        }))
      : [{ label: 'condizioni', value: 'nessuna sezione condizionata' }],
  })

  const fired = outcomes.filter((o) => o.fired)
  steps.push({
    id: 'dispatch',
    n: 9,
    title: 'executeFunAsync verso l’handler',
    detail:
      'Per ogni ascoltatore con condizione vera parte una chiamata asincrona verso l’URL del micro esecutore scelto dal registry, con il contesto (utente dell’evento, ambiente). La FUN gira con le autorizzazioni di quell’utente.',
    status: fired.length ? 'ok' : 'skip',
    lines: fired.length
      ? fired.map((o) => ({ label: o.type, value: `${o.target}${o.type === 'FUN' ? ' — asincrona, nessun risultato al chiamante' : ''}` }))
      : [{ label: 'ascoltatori partiti', value: 'nessuno: tutte le condizioni sono false' }],
  })

  steps.push({
    id: 'ack',
    n: 10,
    title: 'Ack',
    detail:
      'Se il dispatch è partito il consumer acka: l’evento è stato preso in carico, non eseguito. Una FUN che poi fallisce non torna indietro, e il pubblicatore non lo saprà mai.',
    status: 'ok',
    lines: [
      { label: 'ack', value: 'sì' },
      { label: 'risultato al pubblicatore', value: 'nessuno: il dispatch è asincrono' },
    ],
  })

  const capturesNote = input.captureOn && event.captures.length > 0 ? event.captures[0] : null
  if (capturesNote) {
    steps.push({
      id: 'capture',
      n: 11,
      title: 'La cattura effimera vede lo stesso evento',
      detail:
        `REG.CAP ha dichiarato ${capturesNote.queue} (non durevole, auto-delete, TTL 600 s) e la consuma dentro il processo. Il flusso non cambia: è un secondo consumatore, non un secondo percorso.`,
      status: 'ok',
      lines: [
        { label: 'coda', value: capturesNote.queue },
        { label: 'filtro', value: capturesNote.condition },
        { label: 'vive', value: 'nella memoria del processo che ha risposto a REG.CAP' },
      ],
    })
  }

  let verdict: Verdict
  if (fired.length === 0) {
    verdict = {
      tone: 'quiet',
      title: 'L’evento è stato consumato e non è partito niente',
      text: 'Tutte le condizioni sono false: nessuna FUN chiamata, nessun errore, nessun NACK. È il comportamento corretto — se aspettavi qualcosa, il problema è nella condizione o nei dati, non nel broker.',
    }
  } else if (fired.length === 1) {
    verdict = {
      tone: 'ok',
      title: 'Un ascoltatore è partito',
      text: 'Il messaggio è stato ackato e la FUN è stata chiamata in asincrono. Il pubblicatore non riceverà né il risultato né un eventuale errore.',
    }
  } else {
    verdict = {
      tone: 'ok',
      title: `${fired.length} ascoltatori sono partiti dallo stesso evento`,
      text: 'Lo script dichiara più sezioni: il gestore le cicla tutte, una dispatch asincrona per ciascuna. Non c’è nessuna garanzia sull’ordine in cui finiscono.',
    }
  }

  return {
    steps,
    outcomes,
    payload,
    exchange,
    exchangeName: exchange?.name ?? exchangeCode,
    routingKey,
    queue,
    substitutes,
    verdict,
  }
}

/** Gli oggetti OK dietro ogni numero mostrato: la striscia in fondo alla pagina li accende. */
export const OK_OBJECTS = [
  { id: 'OKEVT', title: 'OKEVT', what: 'catalogo eventi: tipo, ascoltatori dichiarati, coda, broker, ultimo evento' },
  { id: 'OKOBS', title: 'OKOBS', what: 'registro ascoltatori: stabili (SCP_K21) ed effimeri (catture in memoria)' },
  { id: 'OKQUE', title: 'OKQUE', what: 'code: messaggi, consumatori, durevole, TTL' },
  { id: 'OKEXC', title: 'OKEXC', what: 'exchange: codice, nome reale, ruolo, chi pubblica, chi consuma' },
] as const
