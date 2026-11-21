// Verifica del POC Motore di regole · modulo eventi.
//
// Uso: node tools/verify-poc.mjs [baseUrl]
// Apre le tre schede, esegue un evento, controlla animazione della mappa, gli stati
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

// --- Percorso: evento con tre ascoltatori
await page.selectOption('[data-testid="event-select"]', 'EXPENSE_REPORT_SUBMITTED')
await page.click('[data-testid="run-button"]')
await page.click('[data-testid="reveal-all"]')
await page.waitForSelector('[data-testid="outcomes"]')
const steps = await page.locator('[data-testid="steps"] > li').count()
const verdict = await page.locator('[data-testid="verdict"]').getAttribute('data-tone')
const fired = await page.locator('[data-testid="outcomes"] [data-fired="yes"]').count()
console.log(`percorso: ${steps} passi, verdetto=${verdict}, ascoltatori partiti=${fired}`)
await page.screenshot({ path: shot('percorso'), fullPage: true })

// --- Percorso: oggetto sotto soglia
await page.selectOption('[data-testid="object-select"]', 'SP;NOT;20260418')
await page.click('[data-testid="run-button"]')
await page.click('[data-testid="reveal-all"]')
await page.waitForSelector('[data-testid="outcomes"]')
const firedLow = await page.locator('[data-testid="outcomes"] [data-fired="yes"]').count()
const verdictLow = await page.locator('[data-testid="verdict"]').getAttribute('data-tone')
console.log(`sotto soglia: ascoltatori partiti=${firedLow}, verdetto=${verdictLow}`)

// --- Percorso: le opzioni stanno sopra il risultato, non a destra
const boxComandi = await page.locator('[data-testid="percorso"] > section').first().boundingBox()
const boxAscoltatori = await page.locator('[data-testid="listeners"]').boundingBox()
const boxRisultato = await page.locator('[data-testid="percorso-result"]').boundingBox()
const sopra =
  boxComandi.y + boxComandi.height <= boxAscoltatori.y + 1 &&
  boxAscoltatori.y + boxAscoltatori.height <= boxRisultato.y + 1
console.log(
  `opzioni sopra: ${sopra} (comandi ${Math.round(boxComandi.y)}→${Math.round(boxComandi.y + boxComandi.height)}, ascoltatori ${Math.round(boxAscoltatori.y)}, risultato ${Math.round(boxRisultato.y)})`,
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
  `ascoltatori: ${nelFile} nel file + ${aggiunti} aggiunti → partiti ${partiti} (con la riga nuova)`,
)

// --- Percorso: evento senza script
await page.selectOption('[data-testid="event-select"]', 'INVOICE_ARCHIVED')
await page.click('[data-testid="run-button"]')
await page.click('[data-testid="reveal-all"]')
const verdictMissing = await page.locator('[data-testid="verdict"]').getAttribute('data-tone')
const lastStep = await page.locator('[data-testid="steps"] > li').last().innerText()
console.log(`senza script: verdetto=${verdictMissing} · ultimo passo: ${lastStep.split('\n')[0]}`)

// --- Sistema: animazione e canali
await page.click('[data-testid="tab-sistema"]')
await page.waitForSelector('[data-testid="map"]')
const dotBefore = await page.locator('[data-testid="map"] span[class*="rounded-full"]').first().getAttribute('style')
await page.waitForTimeout(900)
const dotAfter = await page.locator('[data-testid="map"] span[class*="rounded-full"]').first().getAttribute('style')
console.log(`sistema: pallino si muove = ${dotBefore !== dotAfter}`)
await page.click('[data-testid="channel-script"]')
const activeNodes = await page.locator('[data-testid="map"] [data-state="active"]').count()
const idleNodes = await page.locator('[data-testid="map"] [data-state="idle"]').count()
console.log(`canale script: nodi accesi=${activeNodes}, attenuati=${idleNodes}`)
await page.screenshot({ path: shot('sistema'), fullPage: true })

// --- Esiti
await page.click('[data-testid="tab-esiti"]')
await page.waitForSelector('[data-testid="esiti"]')
const scenarios = await page.locator('[data-testid^="scenario-"]').count()
await page.click('[data-testid="scenario-code-diverse"] button')
const openNow = await page.locator('[data-testid="scenario-code-diverse"]').getAttribute('data-open')
console.log(`esiti: ${scenarios} schede, apertura a richiesta=${openNow}`)
await page.screenshot({ path: shot('esiti'), fullPage: true })

// --- Ritorno al percorso da una scheda
await page.click('[data-testid="open-senza-script"]')
await page.waitForSelector('[data-testid="event-select"]')
const selected = await page.locator('[data-testid="event-select"]').inputValue()
console.log(`apri nel percorso: evento selezionato=${selected}`)

// --- Telefono: percorso e mappa
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(400)
const overflow = await page.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  client: document.documentElement.clientWidth,
}))
console.log(`390px percorso: scrollWidth=${overflow.scroll} clientWidth=${overflow.client} overflow=${overflow.scroll - overflow.client}px`)
await page.screenshot({ path: shot('telefono'), fullPage: true })

await page.click('[data-testid="tab-sistema"]')
await page.waitForSelector('[data-testid="map"]')
const nodiSovrapposti = await page.evaluate(() => {
  const boxes = Array.from(document.querySelectorAll('[data-testid="map"] [data-testid^="node-"]')).map((n) =>
    n.getBoundingClientRect(),
  )
  let coppie = 0
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]
      const b = boxes[j]
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) coppie += 1
    }
  }
  return { coppie, nodi: boxes.length }
})
const overflowMap = await page.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  client: document.documentElement.clientWidth,
}))
console.log(
  `390px mappa: nodi=${nodiSovrapposti.nodi}, coppie sovrapposte=${nodiSovrapposti.coppie}, overflow pagina=${overflowMap.scroll - overflowMap.client}px`,
)
await page.screenshot({ path: shot('telefono-mappa'), fullPage: true })

console.log('errori console:', errors.length ? errors.join(' | ') : 'nessuno')
console.log('screenshot:', shot('percorso'), shot('sistema'), shot('esiti'), shot('telefono'))

await browser.close()
