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
  /** solo LOG: il livello scritto in `::OBS LogLevel=` */
  logLevel?: 'INFO' | 'WARN' | 'ERROR'
  /** solo K11: i parametri per la sezione LOA38 (`::OBS VarA38=`) */
  vars?: string | null
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

/** Il pezzo di piattaforma in cui succede il passo: serve a raggruppare i blocchi nella mappa. */
export type Componente =
  | 'client'
  | 'produttore'
  | 'broker'
  | 'observer'
  | 'handler-std'
  | 'handler-servizio'
  | 'cattura'

export type StepOk = 'OKEVT' | 'OKOBS' | 'OKQUE' | 'OKEXC'

export type StepLine = { label: string; value: string }

export type Step = {
  id: string
  n: number
  title: string
  detail: string
  status: StepStatus
  lines: StepLine[]
  code?: string
  /** come colorare il blocco di codice del passo: il payload è JSON, lo script è .k21 */
  codeLang?: 'json' | 'k21'
  /** da quale passo arriva la freccia: assente = dal passo precedente nell'elenco */
  after?: string[]
  /** il componente che esegue questo passo, quando non basta l'id a dirlo */
  componente?: Componente
}

/** Chi esegue il passo, e quali oggetti OK forniscono i numeri che si vedono. */
export const STEP_META: Record<string, { componente: Componente; ok: StepOk[] }> = {
  client: { componente: 'client', ok: ['OKEVT'] },
  producer: { componente: 'produttore', ok: ['OKEVT'] },
  identity: { componente: 'produttore', ok: ['OKEVT'] },
  publish: { componente: 'produttore', ok: ['OKEXC'] },
  routing: { componente: 'broker', ok: ['OKEXC', 'OKQUE'] },
  consume: { componente: 'observer', ok: ['OKQUE'] },
  script: { componente: 'observer', ok: ['OKOBS'] },
  substitute: { componente: 'observer', ok: ['OKOBS'] },
  condition: { componente: 'observer', ok: ['OKOBS'] },
  dispatch: { componente: 'handler-std', ok: ['OKOBS'] },
  ack: { componente: 'observer', ok: ['OKQUE', 'OKOBS'] },
  capture: { componente: 'cattura', ok: ['OKOBS', 'OKQUE'] },
}

export function stepMeta(step: Step): { componente: Componente; ok: StepOk[] } {
  if (step.componente) return { ...(STEP_META[step.id] ?? STEP_META.dispatch), componente: step.componente }
  if (step.id.startsWith('dispatch:')) return STEP_META.dispatch
  if (step.id.startsWith('capture:')) return STEP_META.capture
  return STEP_META[step.id] ?? { componente: 'observer', ok: [] }
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
  /** observer aggiunti a mano in questa sessione: una riga K21 o una cattura */
  extraObservers?: Observer[]
  extraCaptures?: CaptureDef[]
  now?: Date
}

/** `SP;NOT;20260417` → terna Smeup: classe(2); sottoclasse(3); codice(>=6).
 *  Nel payload la `class` è classe+sottoclasse, l'`object` è il codice. */
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

/**
 * Chi esegue la chiamata di un observer. LOG, AUDIT, PGM e K11 li serve sempre me-java-rpgle-std,
 * come le FUN che chiamano un servizio `KS_…` (le schede). Tutte le altre FUN le serve il micro
 * executor del servizio, che qui è un segnaposto: `me-xxx-zzz`.
 */
export function microEsecutorePer(tipo: Observer['type'], chiamata: string): Componente {
  if (tipo !== 'FUN') return 'handler-std'
  const servizio = chiamata.match(/^F\([^;]*;([^;)]+)/)?.[1]?.trim() ?? ''
  return /^KS/i.test(servizio) ? 'handler-std' : 'handler-servizio'
}

/** La FUN come la scrive lo script in quella sezione: `::OBS Fun="F(...) 1(CO;…;…) P(...)"`. */
export function scriptFunFor(event: EventDef, observer: Observer): string {
  const index = event.observers.findIndex((o) => o.id === observer.id)
  if (index < 0) return observer.target
  const riga = k21SectionLines(event, index).find(
    (l) => l.trim().toUpperCase().startsWith('::OBS') && /Fun=/.test(l),
  )
  const valore = riga?.match(/Fun="([^"]*)"/)?.[1]?.trim()
  return valore && valore.length ? valore : observer.target
}

/**
 * Le stesse sostituzioni, applicate però alla chiamata FUN di un observer: è il testo che parte
 * davvero verso il microexecutor, con `&event.object` e `&event.data` già sciolti.
 */
export function resolveEventTokens(
  target: string,
  obj: AppObject,
  user: string,
  timestampMs: number,
  data: string,
): string {
  const { text } = substituteCondition(target, obj, user, timestampMs)
  return text.split('&event.data').join(data)
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

/** Le righe che una sezione aggiunta a mano produrrebbe nello script. */
export function observerToScriptLines(obs: Observer): string {
  // il commento sta sopra la sezione, come negli script veri
  const commento = `* ${obs.goal}`
  // ogni tipo chiede una cosa diversa: FUN la funzione, PGM il programma, K11 il codice SE.SUB,
  // LOG il messaggio; AUDIT non chiede niente. La condizione invece la possono chiedere tutti.
  const rigaObs =
    obs.type === 'FUN'
      ? `::OBS Fun="${obs.target}"`
      : obs.type === 'PGM'
        ? `::OBS Pgm="${obs.target}"`
        : obs.type === 'K11'
          ? `::OBS SubA38="${obs.target}"`
          : obs.type === 'LOG'
            ? `::OBS LogLevel="${obs.logLevel ?? 'INFO'}" Message="${
                obs.target.trim().startsWith('&') ? obs.target.trim() : '&event.data'
              }"`
            : null
  const varA38 = obs.type === 'K11' && obs.vars ? `::OBS VarA38="${obs.vars}"` : null
  const condizione = obs.condition ? `::CND Esp="${obs.condition}"` : ''
  return [`::SEZ Type="${obs.type}"`, commento, rigaObs, varA38, condizione]
    .filter((riga) => riga !== null && riga !== '')
    .join('\n')
}

/** La coda effimera di una cattura registrata a runtime. */
export function captureQueueName(id: string): string {
  return `EVT_CAP_${id.replace(/^E2E-/, '').slice(0, 8)}`
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

export type ProducerCode = {
  kind: ProducerKind
  label: string
  lang: string
  text: string
  note: string
}

/** I campi di `DATA(...)` nell'ordine del template: la FUN prende `chiave=valore`, non JSON. */
function dataPairs(event: EventDef): string {
  const pairs = Object.entries(event.dataTemplate).map(
    ([k, v]) => `${k.toUpperCase()}=${String(v)}`,
  )
  return pairs.length ? pairs.join(';') : ''
}

/**
 * La chiamata FUN che pubblica l'evento: è quello che scrive il programma chiamante, con la
 * firma vera di `KS_194_02A` (`TYPE ENV CLASS OBJ DATA EXCH PRIO`).
 */
export function funCallCode(event: EventDef, object: AppObject, env: string): string {
  return [
    'F(FBK;KS_194_02A;PUB.EVT)',
    '  INPUT(',
    `    TYPE(${event.id})`,
    `    ENV(${env})`,
    `    CLASS(${object.className})`,
    `    OBJ(${object.object})`,
    `    DATA(${dataPairs(event)})`,
    `    EXCH(${event.producer.exchange})`,
    `    PRIO(${event.producer.priority}))`,
  ].join('\n')
}

/**
 * Lo stesso evento da un servizio Java: `SmeupBusinessEvent` + `EventProducer`, senza FUN e
 * senza registry. `source` è il nome del servizio; se nel catalogo l'evento nasce da una FUN
 * il POC non inventa il nome, lo lascia come segnaposto.
 */
export function javaProducerCode(
  event: EventDef,
  object: AppObject,
  env: string,
  exchange: ExchangeDef | null,
): string {
  const fromService = event.producer.source !== 'KS_194_02A'
  const source = fromService ? event.producer.source : 'il-nome-del-servizio'
  const exchangeName = exchange?.name ?? 'smeupBusinessEvtExchange'
  const key = exchange ? routingKeyFor(exchange, event.id, event.producer.priority) : ''
  const args: [string, string][] = [
    [`"${event.id}"`, 'TYPE'],
    [`"${env}"`, 'ENV'],
    ['context.getUser()', 'utente'],
    ['System.currentTimeMillis()', 'TIMESTAMP'],
    [`"${object.className}"`, 'CLASS'],
    [`"${object.object}"`, 'OBJ'],
    [`"${dataPairs(event)}"`, 'DATA'],
    [`"${source}"`, 'SOURCE'],
  ]
  // le colonne si allineano ma senza inseguire la riga DATA, che è lunghissima
  const width = Math.min(Math.max(...args.map(([v]) => v.length)) + 2, 48)
  return [
    ...(fromService
      ? ['// il servizio dichiara sé stesso in SOURCE: KS_194_02A non entra']
      : ['// SOURCE è il servizio: qui il POC lascia un segnaposto, non inventa un nome']),
    'final SmeupBusinessEvent event = new SmeupBusinessEvent(',
    ...args.map(([v, c], i) => {
      const comma = i === args.length - 1 ? ');' : ','
      return `        ${(v + comma).padEnd(width)} // ${c}`
    }),
    'EventProducer.getInstance().publish(',
    `        ${exchangeName},`,
    `        "${key}",`,
    '        event,',
    '        null);',
  ].join('\n')
}

/** Il codice del produttore per la scelta FUN / SDK: è quello che si vede cliccando. */
export function producerCodeFor(
  kind: ProducerKind,
  event: EventDef,
  object: AppObject,
  env: string,
  exchange: ExchangeDef | null,
): ProducerCode {
  if (kind === 'fun') {
    return {
      kind,
      label: 'F(FBK;KS_194_02A;PUB.EVT)',
      lang: 'fun',
      text: funCallCode(event, object, env),
      note:
        'La scheda costruisce il payload dal modello: niente JSON libero. L’utente non è un parametro, è chi ha chiamato.',
    }
  }
  return {
    kind,
    label: 'SmeupBusinessEvent + EventProducer',
    lang: 'java',
    text: javaProducerCode(event, object, env, exchange),
    note:
      'Il servizio pubblica in proprio su AMQP: nessuna FUN di mezzo, nessun registry da consultare.',
  }
}

/**
 * Il file `.k21` riga per riga, con il numero della sezione a cui appartiene ogni riga: ogni
 * `::SEZ` apre una sezione, cioè un observer. Serve a evidenziare la sezione scelta.
 */
export type K21Line = { n: number; text: string; section: number | null }

export function k21FileLines(event: EventDef): K21Line[] {
  const lines = event.script?.text ?? []
  let section: number | null = null
  let count = 0
  return lines.map((text, i) => {
    if (text.trim().toUpperCase().startsWith('::SEZ')) {
      section = count
      count += 1
    }
    return { n: i + 1, text, section }
  })
}

/** Le righe della sezione `index` del file: è quello che un observer dichiara. */
export function k21SectionLines(event: EventDef, index: number): string[] {
  return k21FileLines(event)
    .filter((line) => line.section === index)
    .map((line) => line.text)
}

/**
 * Il codice in process che si sottoscrive allo stesso evento: una cattura effimera registrata
 * a runtime dal processo, con `REG.CAP`/`CapturePort`, non una riga in `SCP_K21`.
 */
export function captureSubscribeCode(
  event: EventDef,
  capture: CaptureDef,
  exchange: ExchangeDef | null,
): string {
  const ttl = Number(/(\d+)\s*s/.exec(capture.note)?.[1] ?? 600)
  const max = Number(/(\d+)\s*messaggi/.exec(capture.note)?.[1] ?? 100)
  const key = exchange ? routingKeyFor(exchange, event.id, event.producer.priority) : event.id
  const args: [string, string][] = [
    [`"${exchange?.name ?? 'smeupBusinessEvtExchange'}"`, 'EXCH'],
    [`"${key}"`, 'KEY'],
    [`${ttl}`, `TTL secondi (max ${3600})`],
    [`${max}`, `MAX eventi (max ${500})`],
    [`"${capture.condition}"`, 'FILTER'],
  ]
  // le colonne si allineano ma senza inseguire il filtro, che può essere lungo
  const width = Math.min(Math.max(...args.map(([v]) => v.length)) + 2, 48)
  return [
    '// in process: la coda nasce dentro il processo che risponde alla chiamata,',
    '// non in SCP_K21. Dalla scheda la stessa cosa è F(EXB;KS_194_02B;REG.CAP) INPUT(...)',
    'final CaptureRequest request = new CaptureRequest(',
    ...args.map(([v, c], i) => `        ${(v + (i === args.length - 1 ? ');' : ',')).padEnd(width)} // ${c}`),
    'final CaptureRegistration capture =',
    '        EventConsoleRuntime.dependencies().capture().register(request);',
    `// capture.queue() → ${capture.queue}`,
    '// auto-delete: TTL, massimo di messaggi, e via quando il processo chiude',
  ].join('\n')
}

/**
 * La catena, nell'ordine in cui succede (i dodici passi di docs/schemi/README.md, qui
 * raggruppati in dieci perché due coppie non hanno niente da mostrare separatamente).
 */
export function runScenario(input: RunInput, catalog: Catalog): RunResult {
  const { event, object, priority, exchangeCode } = input
  const observers = [...event.observers, ...(input.extraObservers ?? [])]
  const captures = [...event.captures, ...(input.extraCaptures ?? [])]
  // uno script assente che riceve una riga aggiunta non è più assente
  const hasScript = !event.missingScript || observers.length > 0
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
    id: 'client',
    n: 0,
    title: 'Il client lancia l’evento',
    detail:
      input.producerKind === 'fun'
        ? 'Dal browser l’utente fa partire un’azione nella scheda: la pagina chiama il microexecutor sul dispatcher con il token dell’utente. Da qui in poi nessuno sa più chi ha cliccato, se non per l’utente scritto nell’evento.'
        : 'Il client web (o un altro servizio) chiama l’endpoint del microexecutor del produttore. L’evento nasce lì dentro, non nel browser: quello che arriva al broker è già un payload costruito dal servizio.',
    status: 'ok',
    lines: [
      { label: 'client', value: input.producerKind === 'fun' ? 'browser · scheda KS_194_02' : 'client web o servizio esterno' },
      { label: 'chiamata', value: input.producerKind === 'fun' ? 'POST executeFun · KS_194_02A' : 'endpoint del servizio produttore' },
      { label: 'chi paga il tempo', value: 'il client aspetta la risposta della chiamata, non dell’evento' },
    ],
  })

  steps.push({
    id: 'producer',
    n: 1,
    title:
      input.producerKind === 'fun'
        ? 'Una FUN pubblica l’evento'
        : 'Un servizio con SDK pubblica l’evento',
    detail:
      input.producerKind === 'fun'
        ? 'La scheda chiama PUB.EVT sul microexecutor indicato dal registry: nessun JSON libero, il payload è costruito dalla FUN.'
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
    title: 'User e timestamp',
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
        text: 'La FUN rifiuta la richiesta prima del broker: il chiamante riceve un messaggio di errore e una tabella vuota. Nessun observer verrà mai interrogato.',
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
        : `Binding sulla coda ${queue}. Il broker non conosce gli observer: instrada e basta.`,
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

  if (!hasScript) {
    steps.push({
      id: 'script',
      n: 6,
      title: 'Lo script non esiste',
      detail: `ScpK21Manager cerca ${event.script.library}/${event.id}.k21 nelle librerie dell’applicazione: non c’è. Il costruttore lancia e il consumer risponde NACK senza requeue.`,
      status: 'error',
      lines: [
        { label: 'cercato', value: `${event.script.library}/${event.id}.k21` },
        { label: 'effetto', value: 'eccezione → NACK senza requeue: il messaggio si perde' },
        { label: 'chi lo sa', value: 'nessuno: il pubblicatore non riceve né risultato né errore' },
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
        text: `Nessuno script ${event.id}.k21 è montato: il consumer nacka senza requeue e il messaggio sparisce. Non è un guasto del broker, è un observer che manca.`,
      },
    }
  }

  steps.push({
    id: 'script',
    n: 6,
    title: 'Legge lo script SCP_K21',
    detail: `SourceManager apre ${event.script.library}/${event.id}.k21 dalle librerie montate: sola lettura, mai scrittura. Ogni sezione ::SEZ Type="…" è un observer.`,
    status: 'ok',
    lines: [
      { label: 'file', value: `${event.script.library}/${event.id}.k21` },
      { label: 'sezioni', value: String(event.observers.length) },
      ...(observers.length > event.observers.length
        ? [{ label: 'aggiunte', value: `${observers.length - event.observers.length} sezione/i da questa sessione` }]
        : []),
      ...(captures.length
        ? [{ label: 'in più', value: `${captures.length} ascoltarore/i in process registrato/i a runtime (non nello script)` }]
        : []),
    ],
    code: event.script.text.length ? event.script.text.join('\n') : observers.map(observerToScriptLines).join('\n'),
    codeLang: 'k21',
    // la freccia arriva dal prelievo, non dalla cattura che sta sulla stessa riga
    after: ['consume'],
  })

  const outcomes: ObserverOutcome[] = observers.map((obs) => {
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
      'BooleanOperationManager confronta i due operandi con > < >= <= == !=. Una condizione falsa non è un errore: l’observer si salta e il giro continua.',
    status: conditioned.length === 0 ? 'skip' : 'ok',
    lines: conditioned.length
      ? conditioned.map((o) => ({
          label: o.id,
          value: `${o.resolvedCondition} → ${o.conditionValue === null ? 'non valutabile' : o.conditionValue ? 'vera' : 'falsa'}`,
        }))
      : [{ label: 'condizioni', value: 'nessuna sezione condizionata' }],
  })

  const fired = outcomes.filter((o) => o.fired)

  // il fan-out: un passo 9 per ogni observer che ha la condizione vera, non un passo solo
  // c'è un passo 9 per OGNI observer dello script: quelli con la condizione falsa restano nel
  // disegno, grigi e senza freccia in ingresso, perché «non parte» è un esito e va visto
  outcomes.forEach((o) => {
    // la FUN come parte davvero: i segnaposto sciolti con l'oggetto e i dati di questa simulazione
    const dalloScript = scriptFunFor(event, observers.find((x) => x.id === o.id) ?? observers[0])
    const chiamata = resolveEventTokens(
      dalloScript,
      object,
      String(payload.user),
      timestampMs,
      input.data,
    )
    steps.push({
      id: `dispatch:${o.id}`,
      n: 9,
      title: o.type === 'FUN' ? chiamata : `${o.type} · ${chiamata}`,
      detail: o.fired
        ? o.type === 'FUN'
          ? `Una chiamata asincrona verso l’URL del microexecutor scelto dal registry, con il contesto dell’evento: la FUN gira con le autorizzazioni dell’utente che ha pubblicato. Nessun risultato torna al chiamante.`
          : `L’observer è di tipo ${o.type}: stessa chiamata asincrona, ma il bersaglio lo serve un altro componente della piattaforma.`
        : 'La condizione di questa sezione è falsa: l’observer resta dichiarato nello script ma non viene chiamato. Non è un errore e non è un guasto — nessun NACK, nessun requeue, il giro continua per gli altri observer.',
      status: o.fired ? 'ok' : 'skip',
      lines: [
        { label: 'observer', value: o.id },
        { label: 'come la scrive lo script', value: dalloScript },
        { label: o.fired ? 'come parte adesso' : 'come sarebbe partita', value: chiamata },
        { label: 'perché parte', value: o.reason },
        {
          label: o.fired ? 'quando' : 'quando partirebbe',
          value: o.fired ? 'subito, in parallelo agli altri observer attivi' : 'mai, con questo evento',
        },
        { label: 'chi lo saprebbe se fallisse', value: 'nessuno: il consumer acka la presa in carico, non l’esito' },
      ],
      // chi non parte non riceve niente: nessuna freccia in ingresso e nessun traffico
      after: o.fired ? ['condition'] : [],
      componente: microEsecutorePer(o.type, dalloScript),
    })
  })
  if (input.captureOn) {
    captures.forEach((cap) => {
      steps.push({
        id: `capture:${cap.id}`,
        n: 5,
        title: `${cap.queue} preleva`,
        detail:
          'Il processo che ha registrato la cattura è un secondo consumatore della stessa coda: preleva la sua copia e fa quello che deve, senza passare da SCP_K21 e senza guardare le condizioni dello script. Non ha un ack verso gli altri: TTL, auto-delete, sparisce con il processo.',
        status: 'ok',
        lines: [
          { label: 'coda', value: cap.queue },
          { label: 'binding', value: `la stessa routing key della coda normale, dichiarata su ${cap.queue}` },
          { label: 'filtro', value: cap.condition },
          { label: 'vive', value: 'nella memoria del processo che ha registrato la cattura' },
        ],
        after: ['routing'],
      })
    })
  }

  // l'ordine di lettura è quello dei numeri: così un passo parallelo (la cattura, n=5) si accende
  // nello stesso istante dell'altro consumatore e non alla fine della catena
  steps.sort((a, b) => a.n - b.n)

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
      title: 'Un observer è partito',
      text: 'Il messaggio è stato ackato e la FUN è stata chiamata in asincrono. Il pubblicatore non riceverà né il risultato né un eventuale errore.',
    }
  } else {
    verdict = {
      tone: 'ok',
      title: `${fired.length} observer sono partiti dallo stesso evento`,
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
  { id: 'OKEVT', title: 'OKEVT', what: 'catalogo eventi: tipo, observer dichiarati, coda, broker, ultimo evento' },
  { id: 'OKOBS', title: 'OKOBS', what: 'registro observer: stabili (SCP_K21) ed effimeri (catture in memoria)' },
  { id: 'OKQUE', title: 'OKQUE', what: 'code: messaggi, consumatori, durevole, TTL' },
  { id: 'OKEXC', title: 'OKEXC', what: 'exchange: codice, nome reale, ruolo, chi pubblica, chi consuma' },
] as const
