import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import App from './App'
import { microEsecutorePer } from './lib/engine'

const eventsJson = JSON.parse(
  readFileSync(join(process.cwd(), 'src/json/events.json'), 'utf8'),
) as unknown
const esitiJson = JSON.parse(
  readFileSync(join(process.cwd(), 'src/json/esiti.json'), 'utf8'),
) as unknown

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(String(input).includes('esiti') ? esitiJson : eventsJson),
      } as Response),
    ),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function caricaApp() {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByTestId('event-select')
  return user
}

describe('Percorso', () => {
  it('elenca gli eventi con la terna OK;EVT;… ben visibile', async () => {
    await caricaApp()
    const select = screen.getByTestId('event-select') as HTMLSelectElement
    const labels = Array.from(select.options).map((o) => o.textContent)
    expect(labels).toContain('OK;EVT;EXPENSE_REPORT_SUBMITTED')
    expect(labels).toContain('OK;EVT;PLATE_RECOGNIZED')
  })

  it('mostra l oggetto applicativo come terna Smeup', async () => {
    await caricaApp()
    const select = screen.getByTestId('object-select') as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toContain('SP;NOT;20260417')
  })

  it('esegue la catena e mostra i passi e gli observer', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('run-button'))
    await user.click(screen.getByTestId('reveal-all'))

    const steps = screen.getByTestId('steps')
    expect(within(steps).getByText(/Una FUN pubblica l’evento/)).toBeInTheDocument()
    expect(screen.getByTestId('step-substitute')).toBeInTheDocument()
    expect(screen.getByTestId('outcomes')).toBeInTheDocument()
    expect(screen.getByTestId('outcome-EXPENSE_REPORT_SUBMITTED#1')).toHaveAttribute(
      'data-fired',
      'yes',
    )
  })

  it('cambiando oggetto la condizione cambia esito senza errori', async () => {
    const user = await caricaApp()
    await user.selectOptions(screen.getByTestId('object-select'), 'SP;NOT;20260418')
    await user.click(screen.getByTestId('run-button'))
    await user.click(screen.getByTestId('reveal-all'))
    expect(screen.getByTestId('outcome-EXPENSE_REPORT_SUBMITTED#1')).toHaveAttribute(
      'data-fired',
      'no',
    )
    expect(screen.getByTestId('verdict')).toHaveAttribute('data-tone', 'ok')
  })

  it('l observer con la condizione falsa resta nel disegno, grigio e senza traffico in ingresso', async () => {
    const user = await caricaApp()
    await user.selectOptions(screen.getByTestId('object-select'), 'SP;NOT;20260418')
    await user.click(screen.getByTestId('run-button'))
    await user.click(screen.getByTestId('reveal-all'))

    const fermo = screen.getByTestId('step-dispatch:EXPENSE_REPORT_SUBMITTED#1')
    expect(fermo).toHaveAttribute('data-status', 'skip')
    expect(fermo).toHaveTextContent('non parte')
    // gli altri due sono accesi
    expect(screen.getByTestId('step-dispatch:EXPENSE_REPORT_SUBMITTED#2')).toHaveAttribute(
      'data-status',
      'ok',
    )
    // e nessuna freccia lo tocca
    const frecce = Array.from(
      screen.getByTestId('steps').querySelectorAll('path[marker-end]'),
    ) as SVGPathElement[]
    const box = fermo.getBoundingClientRect()
    const arrivi = frecce.filter((f) => {
      const d = f.getAttribute('d') ?? ''
      const m = d.split('L').slice(-1)[0].trim().split(' ')
      const x = Number(m[0])
      const y = Number(m[1])
      return x > box.left - 30 && x < box.right + 30 && y > box.top - 30 && y < box.bottom + 30
    })
    expect(arrivi).toHaveLength(0)
  })

  it('cliccando FUN o SDK compare il codice che pubblica', async () => {
    const user = await caricaApp()
    const fun = screen.getByTestId('producer-code')
    expect(fun).toHaveAttribute('data-kind', 'fun')
    expect(fun).toHaveTextContent('F(FBK;KS_194_02A;PUB.EVT)')

    await user.click(screen.getByTestId('producer-sdk'))
    const sdk = screen.getByTestId('producer-code')
    expect(sdk).toHaveAttribute('data-kind', 'sdk')
    expect(sdk).toHaveTextContent('SmeupBusinessEvent')
    expect(sdk).toHaveTextContent('EventProducer.getInstance().publish(')
  })

  it('il JSON dei dati e i comandi di exchange e priorita non stanno piu nel percorso', async () => {
    await caricaApp()
    expect(screen.queryByTestId('data-input')).not.toBeInTheDocument()
    expect(screen.queryByTestId('exchange-select')).not.toBeInTheDocument()
    expect(screen.queryByTestId('priority-slider')).not.toBeInTheDocument()
  })

  it('scegliendo SDK il payload dichiara il servizio come source', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('producer-sdk'))
    await user.click(screen.getByTestId('run-button'))
    await user.click(screen.getByTestId('reveal-all'))
    await user.click(screen.getByTestId('step-producer'))
    expect(screen.getByTestId('step-detail')).toHaveTextContent('KS_194_02A')
    expect(screen.getByTestId('step-detail')).toHaveTextContent('event_type')
  })

  it('la catena e una mappa di nodi: uno per passo, e il dettaglio si apre cliccando', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('run-button'))
    await user.click(screen.getByTestId('reveal-all'))

    const nodi = within(screen.getByTestId('steps')).getAllByRole('button')
    // 0..8, poi un 9 per ogni observer attivo (tre): l'ack non c'è più
    expect(nodi).toHaveLength(12)
    expect(screen.getByTestId('step-client')).toHaveAttribute('data-componente', 'client')
    const partenze = screen.getAllByTestId(/^step-dispatch:/)
    expect(partenze).toHaveLength(3)
    for (const nodo of partenze) {
      expect(nodo).toHaveTextContent(/^09/)
    }
    // EV_ e PO_ non sono servizi KS_: le serve me-xxx-zzz; l'AUDIT lo serve me-java-rpgle-std
    expect(screen.getByTestId('step-dispatch:EXPENSE_REPORT_SUBMITTED#1')).toHaveAttribute(
      'data-componente',
      'handler-servizio',
    )
    expect(screen.getByTestId('step-dispatch:EXPENSE_REPORT_SUBMITTED#3')).toHaveAttribute(
      'data-componente',
      'handler-std',
    )
    expect(screen.getByTestId('step-publish')).toHaveAttribute('data-state', 'active')
    expect(screen.getByTestId('toggle-chain-animation')).toHaveAttribute('data-state', 'on')

    await user.click(screen.getByTestId('step-condition'))
    expect(screen.getByTestId('step-detail')).toHaveTextContent('BooleanOperationManager')
    await user.click(screen.getByTestId('step-dispatch:EXPENSE_REPORT_SUBMITTED#1'))
    expect(screen.getByTestId('step-detail')).toHaveTextContent('asincrona')
  })
})


describe('Le due cartelle degli observer', () => {
  it('cliccando una sezione si vede il file k21 con quella sezione evidenziata', async () => {
    const user = await caricaApp()
    const riga = screen.getByTestId('listener-EXPENSE_REPORT_SUBMITTED#1')
    expect(riga).toHaveAttribute('data-origin', 'k21')
    await user.click(riga)

    const viewer = screen.getByTestId('listener-viewer')
    expect(viewer).toHaveTextContent('SCP_K21/EXPENSE_REPORT_SUBMITTED.k21')
    expect(viewer).toHaveTextContent('::SEZ Type="FUN"')
    expect(viewer).toHaveTextContent('::OBS Fun="F(EXB;PO_101_01;SND.BUY) 1(CO;SPNOT;&event.object)"')
    // sei righe di file, tre sezioni: solo quelle della prima sono accese
    const accese = viewer.querySelectorAll('[data-section="si"]')
    // la sezione comprende anche il commento che la descrive
    expect(accese).toHaveLength(4)
    // ::SEZ a filo, ::OBS e ::CND rientrati sotto la loro sezione
    const rientrate = viewer.querySelectorAll('[data-indent="si"]')
    // commento + ::OBS + ::CND della prima, commento + ::OBS della seconda, commento della terza
    expect(rientrate).toHaveLength(6)
    expect(accese[0]).not.toHaveAttribute('data-indent')
    expect(accese[0]).toHaveTextContent('::SEZ Type="FUN"')
    expect(viewer).toHaveTextContent('1 di 3')
  })

  it('cliccando una cattura in process si vede il codice java che si sottoscrive', async () => {
    const user = await caricaApp()
    await user.selectOptions(screen.getByTestId('event-select'), 'PLATE_RECOGNIZED')
    await user.click(screen.getByTestId('listener-E2E-7c41a902'))

    const code = screen.getByTestId('listener-code')
    expect(code).toHaveTextContent('new CaptureRequest(')
    expect(code).toHaveTextContent('EventConsoleRuntime.dependencies().capture().register(request)')
    expect(code).toHaveTextContent('EVT_CAP_7c41a902')
    expect(code).toHaveTextContent('"type = PLATE_RECOGNIZED"')
  })

  it('le due cartelle stanno una accanto all altra e dichiarano natura diversa', async () => {
    await caricaApp()
    expect(screen.getByTestId('folder-k21')).toHaveTextContent('SCP_K21')
    expect(screen.getByTestId('folder-k21')).toHaveTextContent('Restano finché qualcuno non le toglie')
    expect(screen.getByTestId('folder-process')).toHaveTextContent('REG.CAP')
    expect(screen.getByTestId('folder-process')).toHaveTextContent('Muoiono con il processo')
  })
})

describe('Observer aggiunti a mano', () => {
  it('aggiunge una riga K21 e la fa partire con l evento', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('add-k21'))
    await user.clear(screen.getByTestId('draft-target'))
    await user.type(screen.getByTestId('draft-target'), 'F(EXB;ZZ_999_01;PROVA)')
    await user.type(screen.getByTestId('draft-condition'), '&event.object.IMPORTO > 1000')
    await user.click(screen.getByTestId('confirm-k21'))

    const card = await screen.findByTestId('listener-EXPENSE_REPORT_SUBMITTED#a4')
    expect(card).toHaveAttribute('data-origin', 'aggiunto')
    expect(card).toHaveTextContent('F(EXB;ZZ_999_01;PROVA)')

    await user.click(screen.getByTestId('run-button'))
    await user.click(screen.getByTestId('reveal-all'))
    const outcome = screen.getByTestId('outcome-EXPENSE_REPORT_SUBMITTED#a4')
    expect(outcome).toHaveAttribute('data-fired', 'yes')
    expect(outcome).toHaveTextContent('1240 > 1000')
  })

  it('la form chiede quello che il tipo vuole: FUN, PGM, K11, LOG, AUDIT', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('add-k21'))

    expect(screen.getByTestId('draft-target-label')).toHaveTextContent('la FUN')

    await user.selectOptions(screen.getByTestId('draft-type'), 'PGM')
    expect(screen.getByTestId('draft-target-label')).toHaveTextContent('il programma')
    await user.clear(screen.getByTestId('draft-target'))
    await user.type(screen.getByTestId('draft-target'), 'PGMREC')
    await user.click(screen.getByTestId('confirm-k21'))
    expect(screen.getByTestId('listener-viewer')).toHaveTextContent('::OBS Pgm="PGMREC"')

    await user.click(screen.getByTestId('add-k21'))
    await user.selectOptions(screen.getByTestId('draft-type'), 'K11')
    expect(screen.getByTestId('draft-target-label')).toHaveTextContent('il codice SE.SUB')
    await user.type(screen.getByTestId('draft-vars'), '&event.object')
    await user.click(screen.getByTestId('confirm-k21'))
    expect(screen.getByTestId('listener-viewer')).toHaveTextContent('::OBS SubA38="PRO.MSG"')
    expect(screen.getByTestId('listener-viewer')).toHaveTextContent('::OBS VarA38="&event.object"')

    await user.click(screen.getByTestId('add-k21'))
    await user.selectOptions(screen.getByTestId('draft-type'), 'LOG')
    expect(screen.getByTestId('draft-target-label')).toHaveTextContent('il messaggio')
    await user.selectOptions(screen.getByTestId('draft-loglevel'), 'WARN')
    await user.click(screen.getByTestId('confirm-k21'))
    expect(screen.getByTestId('listener-viewer')).toHaveTextContent('::OBS LogLevel="WARN" Message="&event.data"')

    await user.click(screen.getByTestId('add-k21'))
    await user.selectOptions(screen.getByTestId('draft-type'), 'AUDIT')
    expect(screen.queryByTestId('draft-target')).not.toBeInTheDocument()
    expect(screen.getByTestId('draft-audit-nota')).toHaveTextContent('AUDIT non chiede niente')
    await user.type(screen.getByTestId('draft-condition'), '&event.object.IMPORTO > 5')
    await user.click(screen.getByTestId('confirm-k21'))
    const viewer = screen.getByTestId('listener-viewer')
    expect(viewer).toHaveTextContent('::SEZ Type="AUDIT"')
    expect(viewer).toHaveTextContent('::CND Esp="&event.object.IMPORTO > 5"')
  })

  it('la riga aggiunta si vede dentro lo stesso script, in coda alle altre sezioni', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('add-k21'))
    await user.clear(screen.getByTestId('draft-target'))
    await user.type(screen.getByTestId('draft-target'), 'F(EXB;ZZ_999_01;PROVA)')
    await user.click(screen.getByTestId('confirm-k21'))

    const viewer = screen.getByTestId('listener-viewer')
    expect(viewer).toHaveTextContent('sezione 4 di 4')
    // le tre sezioni del file e la quarta, aggiunta, tutte nello stesso script
    const sezioni = viewer.querySelectorAll('[data-line]')
    expect(sezioni.length).toBeGreaterThan(10)
    expect(viewer).toHaveTextContent('F(EXB;EV_224_01A;APR.REQ)')
    expect(viewer).toHaveTextContent('F(EXB;ZZ_999_01;PROVA)')
    const aggiunte = viewer.querySelectorAll('[data-aggiunta="si"]')
    expect(aggiunte.length).toBe(3)
    const accese = viewer.querySelectorAll('[data-section="si"]')
    expect(accese).toHaveLength(3)
  })

  it('aggiunge un observer in process e accende il passo della cattura', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('add-process'))
    await user.click(screen.getByTestId('confirm-process'))
    expect(screen.getByTestId('listener-E2E-prova1')).toHaveAttribute('data-origin', 'process')
    await user.click(screen.getByTestId('run-button'))
    await user.click(screen.getByTestId('reveal-all'))
    expect(screen.getByTestId('step-capture:E2E-prova1')).toBeInTheDocument()
  })

  it('una riga aggiunta salva un evento che non aveva script', async () => {
    const user = await caricaApp()
    await user.selectOptions(screen.getByTestId('event-select'), 'INVOICE_ARCHIVED')
    await user.click(screen.getByTestId('run-button'))
    await user.click(screen.getByTestId('reveal-all'))
    expect(screen.getByTestId('verdict')).toHaveAttribute('data-tone', 'error')

    await user.click(screen.getByTestId('add-k21'))
    await user.click(screen.getByTestId('confirm-k21'))
    await user.click(screen.getByTestId('run-button'))
    await user.click(screen.getByTestId('reveal-all'))
    expect(screen.getByTestId('verdict')).toHaveAttribute('data-tone', 'ok')
  })

  it('toglie un observer aggiunto', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('add-process'))
    await user.click(screen.getByTestId('confirm-process'))
    await user.click(screen.getByTestId('remove-E2E-prova1'))
    expect(screen.queryByTestId('listener-E2E-prova1')).not.toBeInTheDocument()
  })
})

describe('Chi esegue le chiamate', () => {
  it('LOG, AUDIT, PGM, K11 e le FUN su servizi KS_ vanno su me-java-rpgle-std', () => {
    expect(microEsecutorePer('LOG', 'log del micro esecutore')).toBe('handler-std')
    expect(microEsecutorePer('AUDIT', 'WRI.AUD')).toBe('handler-std')
    expect(microEsecutorePer('PGM', 'PGMREC')).toBe('handler-std')
    expect(microEsecutorePer('K11', 'PRO.MSG')).toBe('handler-std')
    expect(microEsecutorePer('FUN', 'F(EXB;KS_191_99;HND.FAT) INPUT(PAR(&event.object))')).toBe(
      'handler-std',
    )
    // le altre FUN le serve il micro esecutore del loro servizio
    expect(microEsecutorePer('FUN', 'F(EXB;EV_224_01A;APR.REQ) 1(CO;SPNOT;20260417)')).toBe(
      'handler-servizio',
    )
  })

  it('la mappa mostra le due corsie con i nomi veri', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('run-button'))
    await user.click(screen.getByTestId('reveal-all'))

    const std = screen.getByTestId('corsia-handler-std')
    const servizio = screen.getByTestId('corsia-handler-servizio')
    expect(std).toBeInTheDocument()
    expect(servizio).toBeInTheDocument()
    // la nota spese: la FUN di approvazione e il buyer su me-xxx-zzz, l'audit su me-java-rpgle-std
    expect(screen.getByTestId('step-dispatch:EXPENSE_REPORT_SUBMITTED#1')).toHaveAttribute(
      'data-componente',
      'handler-servizio',
    )
    expect(screen.getByTestId('step-dispatch:EXPENSE_REPORT_SUBMITTED#3')).toHaveAttribute(
      'data-componente',
      'handler-std',
    )
  })
})

describe('Casi da provare', () => {
  it('la striscia mette nel percorso l evento e l oggetto di quel caso', async () => {
    const user = await caricaApp()
    const strip = screen.getByTestId('casi')
    expect(strip).toHaveTextContent('9 esiti già pronti')

    await user.click(screen.getByTestId('caso-spiega-senza-script'))
    expect(strip).toHaveTextContent('cosa succede')
    expect(strip).toHaveTextContent('NACK')

    await user.click(screen.getByTestId('caso-senza-script'))
    await waitFor(() => {
      const select = screen.getByTestId('event-select') as HTMLSelectElement
      expect(select.value).toBe('INVOICE_ARCHIVED')
    })
  })

  it('restano due tab: Percorso e Capire Rabbit', async () => {
    await caricaApp()
    expect(screen.getByTestId('tab-percorso')).toBeInTheDocument()
    expect(screen.getByTestId('tab-rabbit')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-sistema')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tab-esiti')).not.toBeInTheDocument()
  })
})

describe('Capire Rabbit', () => {
  it('porta ai tutorial ufficiali di RabbitMQ', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('tab-rabbit'))
    const link = screen.getByTestId('link-tutorial-rabbit')
    expect(link).toHaveAttribute('href', 'https://www.rabbitmq.com/tutorials')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('elenca exchange, code e mostra dove finisce un messaggio', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('tab-rabbit'))

    expect(screen.getByTestId('exchange-card-business')).toHaveAttribute('data-publish', 'yes')
    expect(screen.getByTestId('exchange-card-auth')).toHaveAttribute('data-publish', 'no')
    expect(screen.getByTestId('queue-card-BUSINESS_EVT_QUEUE')).toBeInTheDocument()
    expect(screen.getByTestId('queue-card-BUSINESS_EVT_QUEUE_HIGH')).toBeInTheDocument()

    expect(screen.getByTestId('rabbit-key')).toHaveTextContent('BUSINESS_EVT_QUEUE.in')
    expect(screen.getByTestId('rabbit-queue')).toHaveTextContent(/^BUSINESS_EVT_QUEUE$/)
  })

  it('alzando la priorita la routing key cambia e la coda diventa quella alta', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('tab-rabbit'))
    fireEvent.change(screen.getByTestId('priority-slider'), { target: { value: '5' } })

    expect(screen.getByTestId('rabbit-key')).toHaveTextContent(
      'business.event.high.EXPENSE_REPORT_SUBMITTED',
    )
    expect(screen.getByTestId('rabbit-queue')).toHaveTextContent(/^BUSINESS_EVT_QUEUE_HIGH$/)
  })
})

