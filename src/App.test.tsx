import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import App from './App'

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

  it('esegue la catena e mostra i passi e gli ascoltatori', async () => {
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

  it('scegliendo SDK il payload dichiara il servizio come source', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('producer-sdk'))
    await user.click(screen.getByTestId('run-button'))
    await user.click(screen.getByTestId('reveal-all'))
    expect(screen.getByTestId('step-producer')).toHaveTextContent('KS_194_02A')
  })
})


describe('Ascoltatori aggiunti a mano', () => {
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

  it('aggiunge un ascoltatore in process e accende il passo della cattura', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('add-process'))
    await user.click(screen.getByTestId('confirm-process'))
    expect(screen.getByTestId('listener-E2E-prova1')).toHaveAttribute('data-origin', 'process')
    await user.click(screen.getByTestId('run-button'))
    await user.click(screen.getByTestId('reveal-all'))
    expect(screen.getByTestId('step-capture')).toBeInTheDocument()
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

  it('toglie un ascoltatore aggiunto', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('add-process'))
    await user.click(screen.getByTestId('confirm-process'))
    await user.click(screen.getByTestId('remove-E2E-prova1'))
    expect(screen.queryByTestId('listener-E2E-prova1')).not.toBeInTheDocument()
  })
})

describe('Sistema', () => {
  it('accende i nodi del canale scelto', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('tab-sistema'))
    await user.click(screen.getByTestId('channel-script'))
    expect(screen.getByTestId('node-libs')).toHaveAttribute('data-state', 'active')
    expect(screen.getByTestId('node-sdk')).toHaveAttribute('data-state', 'idle')
    await user.click(screen.getByTestId('node-exchange'))
    expect(screen.getByTestId('node-detail')).toHaveTextContent('binding')
    expect(screen.getByTestId('toggle-animation')).toHaveAttribute('data-state', 'on')
  })
})

describe('Esiti', () => {
  it('racconta gli scenari e li riapre nel percorso', async () => {
    const user = await caricaApp()
    await user.click(screen.getByTestId('tab-esiti'))
    expect(screen.getByTestId('scenario-piu-ascoltatori')).toHaveAttribute('data-open', 'yes')
    await user.click(screen.getByTestId('open-senza-script'))
    await waitFor(() => {
      const select = screen.getByTestId('event-select') as HTMLSelectElement
      expect(select.value).toBe('INVOICE_ARCHIVED')
    })
  })

  it('la striscia degli oggetti OK accende quelli della tab attiva', async () => {
    const user = await caricaApp()
    const strip = screen.getByTestId('ok-strip')
    expect(within(strip).getByText('OKEVT').parentElement).toHaveAttribute('data-state', 'active')
    await user.click(screen.getByTestId('tab-sistema'))
    expect(within(strip).getByText('OKEXC').parentElement).toHaveAttribute('data-state', 'active')
  })
})
