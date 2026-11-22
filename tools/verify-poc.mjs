// Verifica del POC Motore di regole · modulo eventi.
//
// Uso: node tools/verify-poc.mjs [baseUrl]
// Apre le due schede, esegue un evento, controlla la catena, la striscia dei casi, gli stati
// esposti come data-* e l'overflow orizzontale a 390 px; salva tre screenshot in /tmp.
//
// Playwright è risolto a runtime: lo stesso script gira su macOS e su Linux.

const { chromium } = await import(
  process.env.PLAYWRIGHT_ENTRY ?? `${process.env.HOME}/.hermes/hermes-agent/node_modules/playwright/index.mjs`
)

const base = process.argv[2] ?? 'http://localhost:5177/'
const shot = (name) => `/tmp/poc194-${name}.png`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 })
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(base, { waitUntil: 'load' })
await page.waitForSelector('[data-testid="event-select"]')

const title = await page.title()
console.log('titolo:', title)

const events = await page.locator('[data-testid="event-select"] option').allTextContents()
console.log('eventi nel catalogo:', events.length, events.join(' | '))

// --- Percorso: evento con tre observer
await page.selectOption('[data-testid="event-select"]', 'EXPENSE_REPORT_SUBMITTED')
await page.click('[data-testid="run-button"]')
await page.click('[data-testid="reveal-all"]')
await page.waitForSelector('[data-testid="outcomes"]')
const steps = await page.locator('[data-testid="steps"] button').count()
const verdict = await page.locator('[data-testid="verdict"]').getAttribute('data-tone')
const fired = await page.locator('[data-testid="outcomes"] [data-fired="yes"]').count()
console.log(`percorso: ${steps} passi, verdetto=${verdict}, observer partiti=${fired}`)
await page.screenshot({ path: shot('percorso'), fullPage: true })

// --- Percorso: oggetto sotto soglia
await page.selectOption('[data-testid="object-select"]', 'SP;NOT;20260418')
await page.click('[data-testid="run-button"]')
await page.click('[data-testid="reveal-all"]')
await page.waitForSelector('[data-testid="outcomes"]')
const firedLow = await page.locator('[data-testid="outcomes"] [data-fired="yes"]').count()
const verdictLow = await page.locator('[data-testid="verdict"]').getAttribute('data-tone')
console.log(`sotto soglia: observer partiti=${firedLow}, verdetto=${verdictLow}`)

// --- Percorso: le opzioni stanno sopra il risultato, non a destra
const boxComandi = await page.locator('[data-testid="percorso"] > section').first().boundingBox()
const boxObserver = await page.locator('[data-testid="listeners"]').boundingBox()
const boxRisultato = await page.locator('[data-testid="percorso-result"]').boundingBox()
const sopra =
  boxComandi.y + boxComandi.height <= boxObserver.y + 1 &&
  boxObserver.y + boxObserver.height <= boxRisultato.y + 1
console.log(
  `opzioni sopra: ${sopra} (comandi ${Math.round(boxComandi.y)}→${Math.round(boxComandi.y + boxComandi.height)}, observer ${Math.round(boxObserver.y)}, risultato ${Math.round(boxRisultato.y)})`,
)

// --- Percorso: riga K21 aggiunta a mano
const nelFile = await page.locator('[data-testid="listeners"] [data-origin="k21"]').count()
await page.click('[data-testid="add-k21"]')
await page.fill('[data-testid="draft-target"]', 'F(EXB;ZZ_999_01;PROVA)')
await page.fill('[data-testid="draft-condition"]', '&event.object.IMPORTO > 100')
await page.click('[data-testid="confirm-k21"]')
const aggiunti = await page.locator('[data-testid="listeners"] [data-origin="aggiunto"]').count()
await page.click('[data-testid="run-button"]')
await page.click('[data-testid="reveal-all"]')
await page.waitForSelector('[data-testid="outcomes"]')
const partiti = await page.locator('[data-testid="outcomes"] [data-fired="yes"]').count()
console.log(
  `observer: ${nelFile} nel file + ${aggiunti} aggiunti → partiti ${partiti} (con la riga nuova)`,
)

// --- Percorso: evento senza script
await page.selectOption('[data-testid="event-select"]', 'INVOICE_ARCHIVED')
await page.click('[data-testid="run-button"]')
await page.click('[data-testid="reveal-all"]')
const verdictMissing = await page.locator('[data-testid="verdict"]').getAttribute('data-tone')
await page.click('[data-testid="step-script"]')
const lastStep = await page.locator('[data-testid="step-detail"]').innerText()
console.log(`senza script: verdetto=${verdictMissing} · ultimo passo: ${lastStep.split('\n')[0]}`)

// --- Percorso: il codice del produttore cambia con FUN o SDK
await page.click('[data-testid="producer-fun"]')
const codeFun = await page.locator('[data-testid="producer-code"]').innerText()
await page.click('[data-testid="producer-sdk"]')
const codeSdk = await page.locator('[data-testid="producer-code"]').innerText()
await page.click('[data-testid="producer-fun"]')
console.log(
  `codice produttore: FUN chiama PUB.EVT=${codeFun.includes('PUB.EVT')} · SDK istanzia l evento=${codeSdk.includes('SmeupBusinessEvent')} · diversi=${codeFun !== codeSdk}`,
)

const tolti = await page.evaluate(() =>
  ['data-input', 'exchange-select', 'priority-slider'].filter((t) =>
    document.querySelector(`[data-testid="${t}"]`),
  ),
)
console.log(`comandi tolti dal percorso: ${tolti.length ? 'RESTANO ' + tolti.join(',') : 'si'}`)

// --- Observer: due cartelle, si clicca e si vede il contenuto
await page.selectOption('[data-testid="event-select"]', 'EXPENSE_REPORT_SUBMITTED')
await page.click('[data-testid="listener-EXPENSE_REPORT_SUBMITTED#2"]')
const fileK21 = await page.locator('[data-testid="listener-viewer"]').innerText()
const accese = await page.locator('[data-testid="listener-viewer"] [data-section="si"]').count()
const righeFile = await page.locator('[data-testid="listener-viewer"] [data-line]').count()
console.log(
  `file k21: ${righeFile} righe, ${accese} nella sezione scelta, path «${fileK21.split('\n')[0]}»`,
)

await page.selectOption('[data-testid="event-select"]', 'PLATE_RECOGNIZED')
await page.click('[data-testid="listener-E2E-7c41a902"]')
const javaCap = await page.locator('[data-testid="listener-code"]').innerText()
const cartelle = await page.locator('[data-testid="folder-k21"], [data-testid="folder-process"]').count()
console.log(
  `in process: ${cartelle} cartelle · java: CaptureRequest=${javaCap.includes('new CaptureRequest(')} · coda=${javaCap.includes('EVT_CAP_7c41a902')}`,
)
await page.screenshot({ path: shot('observer'), fullPage: true })

// --- La catena: animazione accesa e nodi che si accendono
await page.click('[data-testid="run-button"]')
await page.waitForSelector('[data-testid="catena"]')
await page.waitForTimeout(600)
const puntoPrima = await page.locator('[data-testid="steps"] span.pointer-events-none').first().getAttribute('style')
await page.waitForTimeout(700)
const puntoDopo = await page.locator('[data-testid="steps"] span.pointer-events-none').first().getAttribute('style')
console.log(`catena: pallino si muove = ${puntoPrima !== puntoDopo}`)

// --- La striscia dei casi: si apre il racconto e si salta al caso
const casi = await page.locator('[data-testid^="caso-"]:not([data-testid^="caso-spiega-"])').count()
await page.click('[data-testid="caso-spiega-senza-script"]')
const spiega = await page.locator('[data-testid="casi"]').innerText()
console.log(
  `casi da provare: ${casi} · racconto aperto = ${/cosa succede/i.test(spiega)} · cosa non succede = ${/cosa non succede/i.test(spiega)}`,
)
await page.click('[data-testid="caso-senza-script"]')
await page.waitForSelector('[data-testid="event-select"]')
console.log(`caso aperto nel percorso: ${await page.locator('[data-testid="event-select"]').inputValue()}`)

// --- Capire Rabbit: exchange, code e prova della priorita
await page.click('[data-testid="tab-rabbit"]')
await page.waitForSelector('[data-testid="rabbit"]')
const key0 = await page.locator('[data-testid="rabbit-key"]').innerText()
const queue0 = await page.locator('[data-testid="rabbit-queue"]').innerText()
await page.locator('[data-testid="priority-slider"]').fill('5')
const key5 = await page.locator('[data-testid="rabbit-key"]').innerText()
const queue5 = await page.locator('[data-testid="rabbit-queue"]').innerText()
const schedeExchange = await page.locator('[data-testid^="exchange-card-"]').count()
const schedeCode = await page.locator('[data-testid^="queue-card-"]').count()
console.log(
  `rabbit: ${schedeExchange} exchange, ${schedeCode} code · prio 0 → ${key0} / ${queue0} · prio 5 → ${key5} / ${queue5}`,
)
await page.screenshot({ path: shot('rabbit'), fullPage: true })

// --- Telefono: percorso e mappa
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(400)
const overflow = await page.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  client: document.documentElement.clientWidth,
}))
console.log(`390px percorso: scrollWidth=${overflow.scroll} clientWidth=${overflow.client} overflow=${overflow.scroll - overflow.client}px`)
await page.screenshot({ path: shot('telefono'), fullPage: true })

const overflowCatena = await page.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  client: document.documentElement.clientWidth,
}))
console.log(`390px catena: overflow pagina=${overflowCatena.scroll - overflowCatena.client}px`)
await page.screenshot({ path: shot('telefono-catena'), fullPage: true })

await page.click('[data-testid="tab-percorso"]')
await page.click('[data-testid="tab-rabbit"]')
await page.waitForSelector('[data-testid="rabbit"]')
const overflowRabbit = await page.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  client: document.documentElement.clientWidth,
}))
console.log(
  `390px rabbit: overflow pagina=${overflowRabbit.scroll - overflowRabbit.client}px`,
)
await page.screenshot({ path: shot('telefono-rabbit'), fullPage: true })

console.log('errori console:', errors.length ? errors.join(' | ') : 'nessuno')
console.log('screenshot:', shot('percorso'), shot('telefono'), shot('telefono-catena'))

await browser.close()
