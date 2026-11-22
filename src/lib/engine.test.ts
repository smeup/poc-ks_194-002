import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  captureSubscribeCode,
  stepMeta,
  evaluateCondition,
  funCallCode,
  k21FileLines,
  k21SectionLines,
  javaProducerCode,
  producerCodeFor,
  queueFor,
  routingKeyFor,
  observerToScriptLines,
  captureQueueName,
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
const purchase = catalog.events.find((e) => e.id === 'PURCHASE_REQUEST_CREATED') as EventDef
const stock = catalog.events.find((e) => e.id === 'STOCK_BELOW_REORDER') as EventDef
const production = catalog.events.find((e) => e.id === 'PRODUCTION_ORDER_RELEASED') as EventDef
const ticket = catalog.events.find((e) => e.id === 'TICKET_OPENED') as EventDef

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
    expect(splitKey('SP;NOT;20260417')).toEqual({ t: 'SP', p: 'NOT', k: '20260417' })
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

describe('righe di script generate', () => {
  it('una sezione FUN aggiunta produce SEZ, OBS e CND', () => {
    expect(observerToScriptLines({
      id: 'X#a1', type: 'FUN', target: 'F(EXB;ZZ_1_01;P)', condition: '&event.object.IMPORTO > 10',
      goal: 'prova', note: '',
    })).toBe('::SEZ Type="FUN"\n* prova\n::OBS Fun="F(EXB;ZZ_1_01;P)"\n::CND Esp="&event.object.IMPORTO > 10"')
  })

  it('una sezione LOG chiede il messaggio, e il livello si sceglie', () => {
    expect(observerToScriptLines({
      id: 'X#a2', type: 'LOG', target: 'log', condition: null, goal: 'scrivere nel log', note: '',
    })).toBe('::SEZ Type="LOG"\n* scrivere nel log\n::OBS LogLevel="INFO" Message="&event.data"')
  })

  it('K11 chiede il SE.SUB, AUDIT non chiede niente, e la condizione la chiedono tutti', () => {
    expect(observerToScriptLines({
      id: 'X#a3', type: 'K11', target: 'PRO.MSG', condition: '&event.object.QUANTITA > 100',
      goal: 'mandare il messaggio al terminale', note: '',
    })).toBe(
      '::SEZ Type="K11"\n* mandare il messaggio al terminale\n::OBS SubA38="PRO.MSG"\n::CND Esp="&event.object.QUANTITA > 100"',
    )
    expect(observerToScriptLines({
      id: 'X#a4', type: 'AUDIT', target: 'WRI.AUD', condition: '&event.object.IMPORTO > 10',
      goal: 'tracciare', note: '',
    })).toBe('::SEZ Type="AUDIT"\n* tracciare\n::CND Esp="&event.object.IMPORTO > 10"')
  })

  it('la coda di una cattura aggiunta prende le prime otto cifre', () => {
    expect(captureQueueName('E2E-7c41a902')).toBe('EVT_CAP_7c41a902')
    expect(captureQueueName('E2E-prova1')).toBe('EVT_CAP_prova1')
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
    expect(text).toBe('SPNOT/20260417/MSANFILIPPO/1000')
  })
})

describe('il percorso di un evento', () => {
  it('con un importo sopra soglia fa partire tutti e tre gli observer', () => {
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

  it('con priorita 2 sposta evento e observer sulla coda alta', () => {
    const result = run(plate, 0, 2)
    expect(result.routingKey).toBe('business.event.high.PLATE_RECOGNIZED')
    expect(result.queue).toBe('BUSINESS_EVT_QUEUE_HIGH')
    expect(result.steps.find((s) => s.id === 'routing')?.detail).toContain('BUSINESS_EVT_QUEUE_HIGH')
  })

  it('pubblica da SDK senza passare da una FUN', () => {
    const result = run(plate, 0, 2)
    expect(result.payload.source).toBe('gate-camera-service')
    expect(result.steps.find((s) => s.id === 'producer')?.title).toContain('SDK')
  })

  it('pubblica da FUN quando il produttore e la console', () => {
    const result = run(expense, 0)
    expect(result.payload.source).toBe('KS_194_02A')
    expect(result.steps.find((s) => s.id === 'producer')?.title).toContain('FUN')
  })

  it('mette class e object dell oggetto applicativo nel payload', () => {
    const result = run(invoice, 0)
    expect(result.payload.class).toBe('FAPAS')
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
    expect(result.steps.map((s) => s.id)).toEqual([
      'client',
      'producer',
      'identity',
      'publish',
      'routing',
      'consume',
      'script',
    ])
    expect(result.steps[result.steps.length - 1].n).toBe(6)
    expect(result.steps.find((s) => s.id === 'script')?.lines).toContainEqual({
      label: 'effetto',
      value: 'eccezione → NACK senza requeue: il messaggio si perde',
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
    expect(result.steps).toHaveLength(4)
    expect(result.steps[3].detail).toContain('EXCH non valido')
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
    expect(result.steps.find((s) => s.id === 'producer')?.status).toBe('warn')
    expect(result.verdict.tone).toBe('ok')
  })

  it('parte dal client e ogni passo sa a quale microexecutor appartiene', () => {
    const result = run(expense, 0)
    expect(result.steps[0].id).toBe('client')
    expect(result.steps[0].n).toBe(0)
    expect(stepMeta(result.steps[0]).componente).toBe('client')
    expect(stepMeta(result.steps.find((s) => s.id === 'publish')!).ok).toContain('OKEXC')
    expect(stepMeta(result.steps.find((s) => s.id === 'script')!).ok).toContain('OKOBS')
    expect(stepMeta(result.steps.find((s) => s.id === 'routing')!).componente).toBe('broker')
    // la nota spese chiama EV_224_01A / PO_101_01: non sono servizi KS_, quindi me-xxx-zzz
    expect(stepMeta(result.steps.find((s) => s.id.startsWith('dispatch:'))!).componente).toBe(
      'handler-servizio',
    )
  })

  it('aggiunge il passo 11 quando la cattura e accesa', () => {
    const on = run(plate, 0, 2)
    expect(on.steps.some((s) => s.id.startsWith('capture:'))).toBe(true)
  })
})

describe('i nuovi eventi ERP', () => {
  it('il catalogo copre dodici eventi in undici aree', () => {
    expect(catalog.events).toHaveLength(12)
    expect(new Set(catalog.events.map((e) => e.useCase)).size).toBe(11)
  })

  it('sulla richiesta di acquisto scatta solo la prima soglia a 42.000', () => {
    const result = run(purchase, 0)
    const reparto = result.outcomes.find((o) => o.id === 'PURCHASE_REQUEST_CREATED#1')!
    const direzione = result.outcomes.find((o) => o.id === 'PURCHASE_REQUEST_CREATED#2')!
    expect(reparto.fired).toBe(true)
    expect(reparto.resolvedCondition).toBe('42000 > 10000')
    expect(direzione.fired).toBe(false)
    expect(result.outcomes.filter((o) => o.fired)).toHaveLength(2)
  })

  it('sopra 100.000 partono tutte e tre le sezioni', () => {
    const result = run(purchase, 1)
    expect(result.outcomes.filter((o) => o.fired)).toHaveLength(3)
  })

  it('sotto scorta parte da SDK sulla coda alta e accende la cattura', () => {
    const result = run(stock, 0)
    expect(result.payload.source).toBe('stock-monitor')
    expect(result.queue).toBe('BUSINESS_EVT_QUEUE_HIGH')
    expect(result.steps.some((s) => s.id.startsWith('capture:'))).toBe(true)
  })

  it('un articolo rientrato in scorta non fa partire la FUN', () => {
    const result = run(stock, 1)
    const fun = result.outcomes.find((o) => o.type === 'FUN')!
    expect(fun.fired).toBe(false)
    expect(fun.resolvedCondition).toBe('120 < 10')
  })

  it("l'observer K11 dell'ordine di produzione resta dichiarato come K11", () => {
    const result = run(production, 0)
    const k11 = result.outcomes.find((o) => o.type === 'K11')!
    expect(k11.fired).toBe(true)
    expect(k11.target).toContain('PRO.MSG')
  })

  it('il ticket viaggia su evt con la routing key del tipo', () => {
    const result = run(ticket, 0)
    expect(result.routingKey).toBe('TICKET_OPENED.in')
    expect(result.exchange?.name).toBe('smeupEvtExchange')
  })

  it('la priorita del ticket non crea una coda alta che non esiste', () => {
    const result = run(ticket, 0, 8)
    expect(result.queue).toBe('SND<id>')
    expect(result.routingKey).toBe('TICKET_OPENED.in')
  })

  it('il ticket di priorita 1 non viene assegnato', () => {
    const result = run(ticket, 1)
    const assign = result.outcomes.find((o) => o.type === 'FUN')!
    expect(assign.fired).toBe(false)
    expect(assign.resolvedCondition).toBe('1 >= 2')
  })

  it('le terne sono classe(2);sottoclasse(3);codice(almeno 6)', () => {
    for (const e of catalog.events) {
      expect(e.objects.length).toBeGreaterThan(0)
      for (const o of e.objects) {
        const [t, p, k] = o.key.split(';')
        expect(t, o.key).toHaveLength(2)
        expect(p, o.key).toHaveLength(3)
        expect(k.length, o.key).toBeGreaterThanOrEqual(6)
        expect(o.className).toBe(t + p)
        expect(o.object).toBe(k)
      }
    }
  })

  it('nessuna condizione cita piu le vecchie classi a quattro caratteri', () => {
    for (const e of catalog.events) {
      for (const line of e.script.text) {
        const match = line.match(/1\(CO;([A-Z]+);/)
        if (match) expect(match[1].length, line).toBe(5)
      }
    }
  })

  it('ogni condizione degli script si risolve su un attributo esplicito', () => {
    for (const e of catalog.events) {
      for (const obs of e.observers) {
        if (!obs.condition) continue
        const match = obs.condition.match(/&event\.object\.([A-Za-z0-9_]+)/)
        expect(match, `${obs.id}: ${obs.condition}`).not.toBeNull()
        const attr = match![1]
        for (const o of e.objects) {
          expect(Object.keys(o.attributes)).toContain(attr)
        }
      }
    }
  })
})

describe('il codice del produttore', () => {
  it('la FUN prende i campi uno per uno, non un JSON libero', () => {
    const text = funCallCode(expense, expense.objects[0], catalog.environment)
    expect(text).toContain('F(FBK;KS_194_02A;PUB.EVT)')
    expect(text).toContain('TYPE(EXPENSE_REPORT_SUBMITTED)')
    expect(text).toContain('CLASS(SPNOT)')
    expect(text).toContain('OBJ(20260417)')
    expect(text).toContain('DATA(IMPORTO=1240;VALUTA=EUR')
    expect(text).not.toContain('{')
  })

  it('il servizio Java dichiara se stesso in SOURCE e pubblica sulla coda alta', () => {
    const text = javaProducerCode(plate, plate.objects[0], catalog.environment, business)
    expect(text).toContain('SmeupBusinessEvent')
    expect(text).toContain('"PLATE_RECOGNIZED"')
    expect(text).toContain('"gate-camera-service"')
    expect(text).toContain('EventProducer.getInstance().publish(')
    expect(text).toContain('business.event.high.PLATE_RECOGNIZED')
  })

  it('su un evento che nasce da FUN il nome del servizio resta un segnaposto', () => {
    const text = javaProducerCode(expense, expense.objects[0], catalog.environment, business)
    expect(text).toContain('il-nome-del-servizio')
    expect(text).not.toContain('KS_194_02A')
  })

  it('cliccando FUN o SDK cambia il codice mostrato', () => {
    const fun = producerCodeFor('fun', expense, expense.objects[0], catalog.environment, business)
    const sdk = producerCodeFor('sdk', expense, expense.objects[0], catalog.environment, business)
    expect(fun.lang).toBe('fun')
    expect(sdk.lang).toBe('java')
    expect(fun.text).not.toBe(sdk.text)
  })
})

describe('il file .k21 e la cattura in process', () => {
  it('ogni ::SEZ apre una sezione, cioè un observer', () => {
    const lines = k21FileLines(expense)
    expect(lines).toHaveLength(expense.script.text.length)
    // ::SEZ + commento + ::OBS + ::CND
    expect(lines.filter((l) => l.section === 0).length).toBe(4)
    expect(lines.filter((l) => l.section === 1).length).toBe(3)
    expect(k21SectionLines(expense, 0)[0]).toBe('::SEZ Type="FUN"')
    expect(k21SectionLines(expense, 0)).toContain(
      '::CND Esp="&event.object.IMPORTO > 500"',
    )
  })

  it('senza script non ci sono righe da leggere', () => {
    expect(k21FileLines(archived)).toEqual([])
  })

  it('la cattura in process si registra a runtime, non nel file', () => {
    const capture = plate.captures[0]
    const text = captureSubscribeCode(plate, capture, business)
    expect(text).toContain('new CaptureRequest(')
    expect(text).toContain('"smeupBusinessEvtExchange"')
    expect(text).toContain('"business.event.high.PLATE_RECOGNIZED"')
    expect(text).toContain('600')
    expect(text).toContain(`"${capture.condition}"`)
    expect(text).not.toContain('SCP_K21/')
  })
})
