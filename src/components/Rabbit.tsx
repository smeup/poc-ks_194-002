import { useMemo, useState } from 'react'
import type { Catalog } from '../lib/engine'
import { queueFor, routingKeyFor } from '../lib/engine'
import OkTag from './OkTag'

type Props = { catalog: Catalog }

const PASSI = [
  {
    n: 1,
    title: 'Qualcuno pubblica',
    text: 'Una FUN, un servizio con SDK o un programma RPGLE spedisce un messaggio al broker. Nell’intestazione ci sono exchange e routing key.',
  },
  {
    n: 2,
    title: 'L’exchange smista',
    text: 'L’exchange non tiene messaggi: confronta la routing key con i binding delle code e copia il messaggio in quelle che combaciano.',
  },
  {
    n: 3,
    title: 'La coda conserva',
    text: 'La coda è l’unico posto dove il messaggio aspetta. Se nessun binding combacia il messaggio viene scartato subito, senza errori per chi ha pubblicato.',
  },
  {
    n: 4,
    title: 'Un consumer lo prende',
    text: 'Il thread k21-observers di me-java-batch legge dalla coda, interpreta lo script SCP_K21 e chiama gli observer, poi conferma (ack).',
  },
]

export default function Rabbit({ catalog }: Props) {
  const publishable = catalog.exchanges.filter((ex) => ex.publish)
  const [exchangeCode, setExchangeCode] = useState(publishable[0]?.code ?? catalog.exchanges[0].code)
  const [type, setType] = useState(catalog.events[0].id)
  const [priority, setPriority] = useState(0)

  const exchange = useMemo(
    () => catalog.exchanges.find((ex) => ex.code === exchangeCode) ?? catalog.exchanges[0],
    [catalog, exchangeCode],
  )

  const key = routingKeyFor(exchange, type, priority)
  const queue = queueFor(exchange, priority)
  const alta = priority > 0 && exchange.keyPrioAlta !== exchange.keyPrio0

  return (
    <div className="space-y-4" data-testid="rabbit">
      {/* -------------------------------------------------------------- i quattro passi */}
      <section className="rounded-2xl border border-inchiostro/10 bg-carta p-4 shadow-carta">
        <h2 className="text-[14px] font-semibold">Che cosa è Rabbit, in quattro passi</h2>
        <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-tenue">
          Gli eventi non si chiamano: si spediscono. Chi pubblica non sa chi ascolta, e chi ascolta
          non sa chi ha pubblicato. In mezzo c’è un broker con tre parole: exchange, routing key,
          coda.
        </p>
        <a
          href="https://www.rabbitmq.com/tutorials"
          target="_blank"
          rel="noreferrer"
          data-testid="link-tutorial-rabbit"
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-brand-warning/50 px-2.5 py-1 text-[11.5px] font-semibold text-brand-warning-700 hover:bg-brand-warning hover:text-white"
        >
          I tutorial ufficiali di RabbitMQ
          <span aria-hidden="true">↗</span>
        </a>
        <ol className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {PASSI.map((p) => (
            <li key={p.n} className="rounded-xl border border-inchiostro/10 bg-fondo p-3">
              <p className="text-[12.5px] font-semibold">
                <span className="mr-1.5 font-mono text-[11px] text-tenue">
                  {String(p.n).padStart(2, '0')}
                </span>
                {p.title}
              </p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-tenue">{p.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------------------- la prova */}
      <section
        className="rounded-2xl border border-brand-primary/25 bg-brand-primary-100/30 p-4"
        data-testid="rabbit-simulatore"
      >
        <h2 className="text-[14px] font-semibold">Prova: dove finisce un messaggio</h2>
        <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-tenue">
          Scegli exchange, tipo di evento e priorità: qui sotto leggi la routing key che il broker
          confronta e la coda che riceve il messaggio.
        </p>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-tenue">
              Exchange
            </label>
            <select
              data-testid="rabbit-exchange"
              value={exchange.code}
              onChange={(e) => setExchangeCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-inchiostro/15 bg-carta px-2 py-2 font-mono text-[11.5px]"
            >
              {catalog.exchanges.map((ex) => (
                <option key={ex.code} value={ex.code}>
                  {ex.code} · {ex.name}
                  {ex.publish ? '' : ' (non pubblicabile)'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-tenue">
              Tipo di evento
            </label>
            <select
              data-testid="rabbit-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-inchiostro/15 bg-carta px-2 py-2 font-mono text-[11.5px]"
            >
              {catalog.events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-tenue">
              Priorità <span className="font-mono text-inchiostro">{priority}</span>
            </label>
            <input
              type="range"
              min={0}
              max={10}
              value={priority}
              data-testid="priority-slider"
              onChange={(e) => setPriority(Number(e.target.value))}
              className="mt-3 w-full accent-brand-primary"
            />
            <p className="mt-1 text-[10.5px] leading-snug text-tenue">
              {alta
                ? 'Sopra 0 la routing key cambia e la coda è quella alta.'
                : 'A 0 si usa la routing key normale.'}
            </p>
          </div>
        </div>

        <dl className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-inchiostro/10 bg-carta p-2.5">
            <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-tenue">
              routing key
            </dt>
            <dd data-testid="rabbit-key" className="mt-0.5 break-all font-mono text-[12px]">
              {key}
            </dd>
          </div>
          <div className="rounded-xl border border-inchiostro/10 bg-carta p-2.5">
            <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-tenue">
              coda
            </dt>
            <dd
              data-testid="rabbit-queue"
              className="mt-0.5 break-all font-mono text-[12px] text-brand-primary"
            >
              {queue}
            </dd>
          </div>
          <div className="rounded-xl border border-inchiostro/10 bg-carta p-2.5">
            <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-tenue">
              consumer
            </dt>
            <dd className="mt-0.5 text-[12px]">{exchange.consumers}</dd>
          </div>
        </dl>

        {!exchange.publish && (
          <p className="mt-2 rounded-lg border border-brand-danger/40 bg-brand-danger-100/50 px-2.5 py-1.5 text-[11.5px] text-brand-danger-900">
            Su <code className="font-mono">{exchange.code}</code> il codice non pubblica: KS_194_02A
            risponde «EXCH non valido» e non parte niente. Qui la routing key è solo quella che
            userebbe il resto della piattaforma.
          </p>
        )}
      </section>

      {/* ----------------------------------------------------------------- gli exchange */}
      <section className="rounded-2xl border border-inchiostro/10 bg-carta p-4 shadow-carta">
        <h2 className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
          <OkTag id="OKEXC" />
          Gli exchange{' '}
          <span className="font-normal text-tenue">
            {catalog.exchanges.length} dichiarati, {publishable.length} pubblicabili dal codice
          </span>
        </h2>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {catalog.exchanges.map((ex) => (
            <div
              key={ex.code}
              data-testid={`exchange-card-${ex.code}`}
              data-publish={ex.publish ? 'yes' : 'no'}
              className="rounded-xl border border-inchiostro/10 bg-fondo p-2.5"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-brand-info-100 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-brand-info-900">
                  {ex.code}
                </span>
                <code className="font-mono text-[11px] text-inchiostro">{ex.name}</code>
                <span
                  className={
                    'ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold ' +
                    (ex.publish
                      ? 'bg-brand-success-100 text-brand-success-900'
                      : 'bg-inchiostro/10 text-tenue')
                  }
                >
                  {ex.publish ? 'pubblicabile' : 'solo dal dispatcher'}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] leading-snug text-tenue">{ex.title}</p>
              <dl className="mt-1 space-y-0.5 text-[11px]">
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-tenue/80">chiave 0</dt>
                  <dd className="min-w-0 break-all font-mono">{ex.keyPrio0}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-tenue/80">chiave alta</dt>
                  <dd className="min-w-0 break-all font-mono">{ex.keyPrioAlta}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-tenue/80">chi pubblica</dt>
                  <dd className="min-w-0 text-tenue">{ex.producers}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-tenue/80">chi consuma</dt>
                  <dd className="min-w-0 text-tenue">{ex.consumers}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------------------- le code */}
      <section className="rounded-2xl border border-inchiostro/10 bg-carta p-4 shadow-carta">
        <h2 className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
          <OkTag id="OKQUE" />
          Le code <span className="font-normal text-tenue">{catalog.queues.length} in ambiente {catalog.environment}</span>
        </h2>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {catalog.queues.map((q) => (
            <div
              key={q.name}
              data-testid={`queue-card-${q.name}`}
              className="rounded-xl border border-inchiostro/10 bg-fondo p-2.5"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <code className="font-mono text-[11.5px] font-semibold text-inchiostro">{q.name}</code>
                <span className="rounded bg-brand-warning-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-warning-900">
                  {q.type}
                </span>
                <span className="ml-auto rounded bg-inchiostro/10 px-1.5 py-0.5 text-[10px] font-semibold text-tenue">
                  {q.durable === 'S' ? 'durevole' : 'effimera'}
                </span>
              </div>
              <dl className="mt-1 space-y-0.5 text-[11px]">
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-tenue/80">binding</dt>
                  <dd className="min-w-0 break-all font-mono">{q.binding}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-tenue/80">consumer</dt>
                  <dd className="min-w-0 text-tenue">{q.consumer}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-tenue/80">nota</dt>
                  <dd className="min-w-0 text-tenue">{q.note}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ la priorità */}
      <section className="rounded-2xl border border-inchiostro/10 bg-carta p-4 shadow-carta">
        <h2 className="text-[13px] font-semibold">Perché esistono due code</h2>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-inchiostro/10 bg-fondo p-2.5">
            <p className="font-mono text-[11.5px] font-semibold">PRIO 0 → BUSINESS_EVT_QUEUE</p>
            <p className="mt-1 text-[11.5px] leading-snug text-tenue">
              La coda normale: la routing key è <code className="font-mono">BUSINESS_EVT_QUEUE.in</code>{' '}
              e il consumer la legge nello stesso ordine in cui è arrivata.
            </p>
          </div>
          <div className="rounded-xl border border-brand-primary/30 bg-brand-primary-100/40 p-2.5">
            <p className="font-mono text-[11.5px] font-semibold text-brand-primary-900">
              PRIO &gt; 0 → BUSINESS_EVT_QUEUE_HIGH
            </p>
            <p className="mt-1 text-[11.5px] leading-snug text-tenue">
              La routing key diventa{' '}
              <code className="font-mono">business.event.high.&lt;TYPE&gt;</code> e il messaggio
              entra in una coda separata, letta dallo stesso consumer ma senza la fila normale
              davanti. Non è una priorità dentro la coda: sono due code.
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-tenue">
          Fuori intervallo 0–10 la FUN avvisa e usa 0 o 10. Un valore non numerico diventa 0 con un
          warning: PRIO sbagliata non fa mai fallire la pubblicazione.
        </p>
      </section>
    </div>
  )
}
