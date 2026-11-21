// Screenshot per la consegna: tre viste a schermo intero (non full page), così
// Telegram non le riduce in una striscia illeggibile.
const { chromium } = await import(
  process.env.PLAYWRIGHT_ENTRY ?? `${process.env.HOME}/.hermes/hermes-agent/node_modules/playwright/index.mjs`
)

const base = process.argv[2] ?? 'http://localhost:5177/'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1360, height: 940 }, deviceScaleFactor: 2 })

await page.goto(base, { waitUntil: 'load' })
await page.waitForSelector('[data-testid="event-select"]')
await page.selectOption('[data-testid="event-select"]', 'SALES_ORDER_CONFIRMED')
await page.click('[data-testid="run-button"]')
await page.click('[data-testid="reveal-all"]')
await page.waitForSelector('[data-testid="outcomes"]')
await page.evaluate(() => window.scrollTo(0, 0))
await page.screenshot({ path: '/tmp/poc194-1-percorso.png' })

// le due soglie della richiesta di acquisto: sopra 100.000 partono tutte e tre
await page.selectOption('[data-testid="event-select"]', 'PURCHASE_REQUEST_CREATED')
await page.selectOption('[data-testid="object-select"]', 'CA;RI;000124')
await page.click('[data-testid="run-button"]')
await page.click('[data-testid="reveal-all"]')
await page.waitForSelector('[data-testid="outcomes"]')
await page.evaluate(() => window.scrollTo(0, 0))
await page.screenshot({ path: '/tmp/poc194-2-acquisti.png' })

await page.click('[data-testid="tab-sistema"]')
await page.click('[data-testid="channel-script"]')
await page.waitForTimeout(600)
await page.screenshot({ path: '/tmp/poc194-3-sistema.png' })

await page.click('[data-testid="tab-esiti"]')
await page.waitForSelector('[data-testid="esiti"]')
await page.screenshot({ path: '/tmp/poc194-4-esiti.png' })

await browser.close()
console.log('fatto')
