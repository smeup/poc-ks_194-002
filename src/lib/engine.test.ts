import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  evaluateCondition,
  queueFor,
  routingKeyFor,
  runScenario,
  splitKey,
  substituteCondition,
  type Catalog,
  type EventDef,
} from './engine'

const catalog = JSON.parse(
  readFileSync(join(process.cwd(), 'src/json/events.json'), 'utf8'),
) as Catalog

const expense = catalog.events.find((e) => e.id === 'EXPENSE_REPORT_SUBMITTED') as EventDef
const plate = catalog.events.find((e) => e.id === 'PLATE_RECOGNIZED') as EventDef
const invoice = catalog.events.find((e) => e.id === 'PASSIVE_INVOICE_RECEIVED') as EventDef
const archived = catalog.events.find((e) => e.id === 'INVOICE_ARCHIVED') as EventDef

const business = catalog.exchanges.find((e) => e.code === 'business')!
const auth = catalog.exchanges.find((e) => e.code === 'auth')!

function run(event: EventDef, objectIndex = 0, priority = event.producer.priority) {
  return runScenario(
    {
      event,
      object: event.objects[objectIndex],
      data: JSON.stringify(event.dataTemplate),
      priority,
      producerKind: event.producer.kind,
      exchangeCode: event.producer.exchange,
      user: 'MSANFILIPPO',
      captureOn: true,
    },
    catalog,
  )
}

describe('terna e routing key', () => {
  it('spezza la terna Smeup in tipo, parametro e chiave', () => {
    expect(splitKey('NR;SP;20260417')).toEqual({ t: 'NR', p: 'SP', k: '20260417' })
  })

  it('manda a priorita 0 la routing key normale, sopra la coda alta', () => {
    expect(routingKeyFor(business, 'PLATE_RECOGNIZED', 0)).toBe('BUSINESS_EVT_QUEUE.in')
    expect(routingKeyFor(business, 'PLATE_RECOGNIZED', 2)).toBe(
      'business.event.high.PLATE_RECOGNIZED',
    )
    expect(queueFor(business, 0)).toBe('BUSINESS_EVT_QUEUE')
    expect(queueFor(business, 2)).toBe('BUSINESS_EVT_QUEUE_HIGH')
  })

  it('sostituisce <TYPE> sugli exchange non business', () => {
    const evt = catalog.exchanges.find((e) => e.code === 'evt')!
    expect(routingKeyFor(evt, 'PLATE_RECOGNIZED', 0)).toBe('PLATE_RECOGNIZED.in')
  })
})

describe('condizioni ::CND', () => {
  it('valuta i confronti numerici come BooleanOperationManager', () => {
    expect(evaluateCondition('1240 > 500')).toBe(true)
    expect(evaluateCondition('310 > 500')).toBe(false)
    expect(evaluateCondition('5124 >= 1000')).toBe(true)
    expect(evaluateCondition('240 != 240')).toBe(false)
  })

  it('confronta le stringhe con == e !=', () => {
    expect(evaluateCondition('S == S')).toBe(true)
    expect(evaluateCondition('N == S')).toBe(false)
  })

  it('dice di non sapere quando non riconosce la forma', () => {
    expect(evaluateCondition('ciao')).toBeNull()
  })

  it('risolve &event.object.CAMPO sul valore dell attributo', () => {
    const { text, substitutes } = substituteCondition(
      '&event.object.IMPORTO > 500',
      expense.objects[0],
      'MSANFILIPPO',
      1000,
    )
    expect(text).toBe('1240 > 500')
    expect(substitutes).toContainEqual({ from: '&event.object.IMPORTO', to: '1240' })
  })

  it('sostituisce anche object, class, user e timestamp', () => {
    const { text } = substituteCondition(
      '&event.class/&event.object/&event.user/&event.timestamp',
      expense.objects[0],
      'MSANFILIPPO',
      1000,
    )
    expect(text).toBe('NRSP/20260417/MSANFILIPPO/1000')
  })
})

describe('il percorso di un evento', () => {
  it('con un importo sopra soglia fa partire tutti e tre gli ascoltatori', () => {
    const result = run(expense, 0)
    expect(result.outcomes).toHaveLength(3)
    expect(result.outcomes.filter((o) => o.fired)).toHaveLength(3)
    expect(result.verdict.tone).toBe('ok')
  })

  it('con un importo sotto soglia lascia a casa l approvazione, senza errori', () => {
    const result = run(expense, 1)
    const approvazione = result.outcomes.find((o) => o.id === 'EXPENSE_REPORT_SUBMITTED#1')!
    expect(approvazione.fired).toBe(false)
    expect(approvazione.resolvedCondition).toBe('310 > 500')
    expect(result.outcomes.filter((o) => o.fired)).toHaveLength(2)
    expect(result.steps.every((s) => s.status !== 'error')).toBe(true)
  })

  it('racconta gli stessi passi anche quando nessuno parte', () => {
    const result = run(plate, 1)
    const fun = result.outcomes.find((o) => o.type === 'FUN')!
    expect(fun.fired).toBe(false)
    expect(result.outcomes.filter((o) => o.fired)).toHaveLength(1)
  })

  it('con priorita 2 sposta evento e ascoltatori sulla coda alta', () => {
    const result = run(plate, 0, 2)
    expect(result.routingKey).toBe('business.event.high.PLATE_RECOGNIZED')
    expect(result.queue).toBe('BUSINESS_EVT_QUEUE_HIGH')
    expect(result.steps.find((s) => s.id === 'routing')?.detail).toContain('BUSINESS_EVT_QUEUE_HIGH')
  })

  it('pubblica da SDK senza passare da una FUN', () => {
    const result = run(plate, 0, 2)
    expect(result.payload.source).toBe('gate-camera-service')
    expect(result.steps[0].title).toContain('SDK')
  })

  it('pubblica da FUN quando il produttore e la console', () => {
    const result = run(expense, 0)
    expect(result.payload.source).toBe('KS_194_02A')
    expect(result.steps[0].title).toContain('FUN')
  })

  it('mette class e object dell oggetto applicativo nel payload', () => {
    const result = run(invoice, 0)
    expect(result.payload.class).toBe('FAPA')
    expect(result.payload.object).toBe('202600187')
    expect(result.payload.event_type).toBe('PASSIVE_INVOICE_RECEIVED')
  })

  it('chiama anche il programma RPG quando la soglia e superata', () => {
    const result = run(invoice, 0)
    const pgm = result.outcomes.find((o) => o.type === 'PGM')!
    expect(pgm.fired).toBe(true)
    expect(pgm.resolvedCondition).toBe('5124 > 1000')
  })

  it('lascia a casa il programma RPG sotto i mille euro', () => {
    const result = run(invoice, 1)
    const pgm = result.outcomes.find((o) => o.type === 'PGM')!
    expect(pgm.fired).toBe(false)
  })

  it('senza script si ferma prima e nacka senza requeue', () => {
    const result = run(archived, 0)
    expect(result.verdict.tone).toBe('error')
    expect(result.steps.map((s) => s.id)).toEqual(['producer', 'identity', 'publish', 'routing', 'consume', 'script', 'ack'])
    expect(result.steps[result.steps.length - 1].n).toBe(7)
    expect(result.steps.find((s) => s.id === 'ack')?.lines).toContainEqual({
      label: 'requeue',
      value: 'false — il messaggio non torna in coda',
    })
  })

  it('rifiuta l exchange auth prima ancora di pubblicare', () => {
    const result = runScenario(
      {
        event: expense,
        object: expense.objects[0],
        data: '{}',
        priority: 0,
        producerKind: 'fun',
        exchangeCode: 'auth',
        user: 'MSANFILIPPO',
        captureOn: false,
      },
      catalog,
    )
    expect(result.verdict.tone).toBe('error')
    expect(result.steps).toHaveLength(3)
    expect(result.steps[2].detail).toContain('EXCH non valido')
    expect(auth.publish).toBe(false)
  })

  it('segnala un data che non e JSON senza bloccare l evento', () => {
    const result = runScenario(
      {
        event: expense,
        object: expense.objects[0],
        data: '{ non json',
        priority: 0,
        producerKind: 'fun',
        exchangeCode: 'business',
        user: 'MSANFILIPPO',
        captureOn: false,
      },
      catalog,
    )
    expect(result.steps[0].status).toBe('warn')
    expect(result.verdict.tone).toBe('ok')
  })

  it('aggiunge il passo 11 quando la cattura e accesa', () => {
    const on = run(plate, 0, 2)
    expect(on.steps.some((s) => s.id === 'capture')).toBe(true)
  })
})
