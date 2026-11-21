import { useEffect, useMemo, useRef, useState } from 'react'
import type { Catalog } from '../lib/engine'

type Props = { catalog: Catalog }

type NodeDef = {
  id: string
  label: string
  sub: string
  x: number
  y: number
  tone: 'produttore' | 'interno' | 'broker' | 'esterno'
  knows: string
}

type Channel = {
  id: string
  label: string
  detail: string
  path: string[]
  tone: string
}

const NODES: NodeDef[] = [
  {
    id: 'fun',
    label: 'FUN / scheda',
    sub: 'PUB.EVT · PUB.JSN',
    x: 13,
    y: 10,
    tone: 'produttore',
    knows: 'solo le FUN che chiama, niente stato del motore',
  },
  {
    id: 'sdk',
    label: 'Servizio con SDK',
    sub: 'EventProducer.publish',
    x: 40,
    y: 10,
    tone: 'produttore',
    knows: 'solo il proprio dominio: non conosce gli ascoltatori',
  },
  {
    id: 'dispatcher',
    label: 'Dispatcher',
    sub: 'executeFun → registry',
    x: 70,
    y: 10,
    tone: 'interno',
    knows: 'l’identità dell’utente e la mappa servizio → handler',
  },
  {
    id: 'exchange',
    label: 'RabbitMQ · exchange',
    sub: 'topic, smeupBusinessEvtExchange',
    x: 26,
    y: 34,
    tone: 'broker',
    knows: 'solo i binding: non sa cosa sia un ascoltatore',
  },
  {
    id: 'queue',
    label: 'code eventi',
    sub: 'BUSINESS_EVT_QUEUE · _HIGH',
    x: 26,
    y: 56,
    tone: 'broker',
    knows: 'messaggi in attesa e consumatori registrati',
  },
  {
    id: 'k21',
    label: 'me-java-batch',
    sub: 'thread k21-observers',
    x: 57,
    y: 56,
    tone: 'interno',
    knows: 'il proprio processo, le code connesse, gli script delle librerie',
  },
  {
    id: 'libs',
    label: 'Librerie DSL',
    sub: 'SCP_K21/<TYPE>.k21',
    x: 86,
    y: 34,
    tone: 'esterno',
    knows: 'i file versionati: non sa chi li consuma',
  },
  {
    id: 'target',
    label: 'me-java-rpgle-std',
    sub: 'la FUN dell’ascoltatore',
    x: 57,
    y: 80,
    tone: 'interno',
    knows: 'le librerie montate e i servizi del registry che gli competono',
  },
  {
    id: 'capture',
    label: 'cattura effimera',
    sub: 'EVT_CAP_<id>',
    x: 86,
    y: 80,
    tone: 'esterno',
    knows: 'una finestra di memoria di un solo processo, con TTL',
  },
  {
    id: 'console',
    label: 'Console KS_194_02',
    sub: 'LST.EVT · GET.QUE · REG.CAP',
    x: 13,
    y: 80,
    tone: 'interno',
    knows: 'legge, non scrive: nessuna registrazione di ascoltatori',
  },
]

const CHANNELS: Channel[] = [
  {
    id: 'fun',
    label: 'La FUN pubblica',
    detail:
      'POST /api/v3/executeFun al dispatcher con Bearer; il dispatcher risolve il servizio sul registry e inoltra. PUB.EVT compone lo SmeupBusinessEvent e chiama publish: unico punto d’uscita, anche per SDK e RPGLE.',
    path: ['fun', 'dispatcher', 'exchange', 'queue', 'k21'],
    tone: 'bg-brand-primary',
  },
  {
    id: 'sdk',
    label: 'Il servizio con SDK pubblica',
    detail:
      'Nessuna FUN e nessun registry: EventProducer.publish(exchange, routingKey, event) con la connessione AMQP dell’SDK. Il payload è lo stesso tipo di evento.',
    path: ['sdk', 'exchange', 'queue', 'k21'],
    tone: 'bg-brand-info',
  },
  {
    id: 'script',
    label: 'Lo script diventa una chiamata',
    detail:
      'k21-observers legge SCP_K21/<TYPE>.k21 dalle librerie montate (sola lettura), sostituisce &event.*, valuta ::CND e chiama la FUN con executeFunAsync verso l’URL dell’handler.',
    path: ['k21', 'libs', 'k21', 'target'],
    tone: 'bg-brand-success',
  },
  {
    id: 'capture',
    label: 'La cattura guarda la stessa coda',
    detail:
      'REG.CAP dichiara EVT_CAP_<id> non durevole con auto-delete e TTL ≤ 3600 s, e la consuma dentro il processo. Il flusso non cambia: è un secondo consumatore.',
    path: ['queue', 'capture'],
    tone: 'bg-brand-warning',
  },
  {
    id: 'console',
    label: 'La console legge',
    detail:
      'LST.EVT, GET.QUE, LST.LIS, GET.HLT: tutte FUN, nessuna chiamata a Prometheus. Quello che non è sintetizzabile diventa un link a Grafana.',
    path: ['console', 'queue'],
    tone: 'bg-tenue',
  },
]

const TONES: Record<NodeDef['tone'], string> = {
  produttore: 'border-brand-primary/40 bg-brand-primary-100/70',
  interno: 'border-brand-info/40 bg-brand-info-100/60',
  broker: 'border-brand-warning/40 bg-brand-warning-100/60',
  esterno: 'border-inchiostro/20 bg-fondo',
}

function nodeById(id: string): NodeDef {
  return NODES.find((n) => n.id === id) ?? NODES[0]
}

/** Interpola il pallino lungo i waypoint del canale: nessun CSS animato, solo style inline. */
function positionOnPath(path: string[], phase: number, index: number): { x: number; y: number } {
  if (path.length === 1) {
    const only = nodeById(path[0])
    return { x: only.x, y: only.y }
  }
  const segments = path.length - 1
  const t = ((phase + index * 0.17) % 1) * segments
  const i = Math.min(Math.floor(t), segments - 1)
  const local = t - i
  const from = nodeById(path[i])
  const to = nodeById(path[i + 1])
  return { x: from.x + (to.x - from.x) * local, y: from.y + (to.y - from.y) * local }
}

export default function Sistema({ catalog }: Props) {
  const [channelId, setChannelId] = useState(CHANNELS[0].id)
  const [selected, setSelected] = useState<string | null>(null)
  const [running, setRunning] = useState(true)
  const [phase, setPhase] = useState(0)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return
    let last = performance.now()
    const loop = (now: number) => {
      const delta = (now - last) / 1000
      last = now
      setPhase((p) => (p + delta * 0.22) % 1)
      frame.current = requestAnimationFrame(loop)
    }
    frame.current = requestAnimationFrame(loop)
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
    }
  }, [running])

  const channel = CHANNELS.find((c) => c.id === channelId) ?? CHANNELS[0]
  const activeNodes = useMemo(() => new Set(channel.path), [channel])
  const dots = useMemo(() => [0, 1, 2], [])
  const selectedNode = selected ? nodeById(selected) : null

  return (
    <div className="space-y-3" data-testid="sistema">
      <section className="rounded-2xl border border-inchiostro/10 bg-carta p-3 shadow-carta">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-tenue">
            Canale
          </span>
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                type="button"
                data-testid={`channel-${c.id}`}
                data-state={channelId === c.id ? 'active' : 'idle'}
                onClick={() => setChannelId(c.id)}
                className={
                  'rounded-lg border px-2.5 py-1 text-[12px] font-semibold transition-colors ' +
                  (channelId === c.id
                    ? 'border-brand-primary bg-brand-primary text-white'
                    : 'border-inchiostro/15 bg-fondo text-inchiostro hover:border-brand-primary/40')
                }
              >
                {c.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            data-testid="toggle-animation"
            data-state={running ? 'on' : 'off'}
            onClick={() => setRunning((r) => !r)}
            className={
              'ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold ' +
              (running ? 'bg-brand-success text-white' : 'bg-inchiostro/10 text-tenue')
            }
          >
            animazione {running ? 'accesa' : 'spenta'}
          </button>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-tenue">{channel.detail}</p>
      </section>

      <section className="min-w-0 space-y-3">
        <p className="text-[11px] text-tenue sm:hidden">la mappa si scorre in orizzontale →</p>
        <div className="w-full max-w-full overflow-x-auto rounded-2xl border border-inchiostro/10 bg-carta shadow-carta">
        <div
          className="relative h-[460px] w-[760px] shrink-0 sm:w-full"
          data-testid="map"
        >
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            {CHANNELS.map((c) =>
              c.path.slice(0, -1).map((from, i) => {
                const a = nodeById(from)
                const b = nodeById(c.path[i + 1])
                const on = c.id === channelId
                return (
                  <line
                    key={`${c.id}-${from}-${b.id}`}
                    x1={`${a.x}%`}
                    y1={`${a.y}%`}
                    x2={`${b.x}%`}
                    y2={`${b.y}%`}
                    stroke={on ? '#a61a2f' : '#c9c9cf'}
                    strokeWidth={on ? 2 : 1}
                    strokeDasharray={on ? '0' : '4 4'}
                    opacity={on ? 0.75 : 0.5}
                  />
                )
              }),
            )}
          </svg>

          {NODES.map((node) => {
            const on = activeNodes.has(node.id)
            return (
              <button
                type="button"
                key={node.id}
                data-testid={`node-${node.id}`}
                data-state={on ? 'active' : 'idle'}
                onClick={() => setSelected(node.id)}
                style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
                className={
                  'absolute w-[126px] rounded-xl border px-2 py-1.5 text-left shadow-carta transition-opacity ' +
                  TONES[node.tone] +
                  (on ? ' opacity-100' : ' opacity-35')
                }
              >
                <p className="truncate text-[11.5px] font-semibold text-inchiostro">{node.label}</p>
                <p className="truncate font-mono text-[9.5px] text-tenue">{node.sub}</p>
              </button>
            )
          })}

          {running &&
            dots.map((d) => {
              const p = positionOnPath(channel.path, phase, d)
              return (
                <span
                  key={`dot-${d}`}
                  className={`pointer-events-none absolute h-2.5 w-2.5 rounded-full ${channel.tone} shadow`}
                  style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}
                />
              )
            })}
        </div>
        </div>

        <div
          className="rounded-2xl border border-inchiostro/10 bg-carta p-3.5 shadow-carta"
          data-testid="node-detail"
        >
          {selectedNode ? (
            <>
              <p className="text-[13px] font-semibold">{selectedNode.label}</p>
              <p className="mt-0.5 font-mono text-[11px] text-tenue">{selectedNode.sub}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-tenue">
                Sa: {selectedNode.knows}
              </p>
            </>
          ) : (
            <p className="text-[12.5px] text-tenue">
              Clicca un nodo per sapere cosa quel pezzo conosce e cosa non può sapere. La
              distinzione è la ragione per cui la console esiste: il broker instrada e basta, e il
              pubblicatore non riceve né risultato né errore.
            </p>
          )}
          <p className="mt-2 font-mono text-[10.5px] text-tenue/80">
            ambiente {catalog.environment} · {catalog.microExecutors.length} micro esecutori noti
          </p>
        </div>
      </section>
    </div>
  )
}
