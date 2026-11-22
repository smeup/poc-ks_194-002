import { useEffect, useMemo, useRef, useState } from 'react'
import { Cog, Inbox, Laptop, Rabbit, Radar, Server, type LucideIcon } from 'lucide-react'
import type { Componente, Step } from '../lib/engine'
import { stepMeta } from '../lib/engine'
import Code from './Code'
import OkTag from './OkTag'

type Props = {
  steps: Step[]
  revealed: number
  onRevealAll: () => void
  /** il nome vero del microexecutor per ogni corsia: cambia con l'evento e con chi pubblica */
  nomi: Partial<Record<Componente, string>>
}

const LARGHEZZA = 1120
const NODO_L = 164
const NODO_H = 96
// lo spazio fra due nodi della stessa riga: serve a far vedere la freccia orizzontale
const GAP = 64
// la colonnina, dentro la banda, dove sta scritto il nome del componente
const GUTTER = 30
const CORSIA = 160

type CorsiaDef = {
  breve: string
  titolo: string
  sottotitolo: string
  icona: LucideIcon
  sdk: boolean
  tinta: string
  bordo: string
}

/** Ogni blocco appartiene a un pezzo di piattaforma; l'SDK sta dentro ogni microexecutor. */
const CORSIE: Record<Componente, CorsiaDef> = {
  client: {
    breve: 'Client web',
    titolo: 'Client web',
    sottotitolo: 'il browser: qualcuno fa partire l’azione',
    icona: Laptop,
    sdk: false,
    tinta: 'bg-brand-primary-100/25',
    bordo: 'border-l-brand-primary',
  },
  produttore: {
    breve: 'Produttore',
    titolo: 'Microexecutor · produttore',
    sottotitolo: 'la FUN (KS_194_02A) o il servizio che costruisce e pubblica l’evento',
    icona: Server,
    sdk: true,
    tinta: 'bg-brand-info-100/25',
    bordo: 'border-l-brand-info',
  },
  broker: {
    breve: 'RabbitMQ',
    titolo: 'RabbitMQ · broker',
    sottotitolo: 'exchange, routing key, code: instrada e conserva, non sa cosa sia un evento',
    icona: Rabbit,
    sdk: false,
    tinta: 'bg-brand-warning-100/30',
    bordo: 'border-l-brand-warning',
  },
  observer: {
    breve: 'Observer manager',
    titolo: 'Observer manager · me-java-batch',
    sottotitolo: 'thread k21-observers: consuma, legge SCP_K21, sostituisce, valuta, acka',
    icona: Radar,
    sdk: true,
    tinta: 'bg-brand-success-100/25',
    bordo: 'border-l-brand-success',
  },
  'handler-std': {
    breve: 'me-java-rpgle-std',
    titolo: 'me-java-rpgle-std',
    sottotitolo:
      'esegue le FUN su servizi KS_… e gli observer LOG, AUDIT, PGM e K11: sono i servizi della scheda',
    icona: Cog,
    sdk: true,
    tinta: 'bg-brand-info-100/15',
    bordo: 'border-l-brand-info',
  },
  'handler-servizio': {
    breve: 'me-xxx-zzz',
    titolo: 'Microexecutor del servizio',
    sottotitolo: 'le FUN che non sono servizi KS_… le serve il microexecutor del loro servizio',
    icona: Cog,
    sdk: true,
    tinta: 'bg-brand-info-100/25',
    bordo: 'border-l-brand-info',
  },
  cattura: {
    breve: 'Cattura',
    titolo: 'Processo con la cattura',
    sottotitolo: 'EVT_CAP_<id>: coda effimera di chi l’ha registrata',
    icona: Inbox,
    sdk: true,
    tinta: 'bg-brand-warning-100/20',
    bordo: 'border-l-brand-warning',
  },
}

/** Le righe della mappa: due componenti affiancati nella stessa riga stanno allo stesso livello. */
const RIGHE: Componente[][] = [
  ['client'],
  ['produttore'],
  ['broker'],
  ['observer', 'cattura'],
  ['handler-std', 'handler-servizio'],
]

const TONE: Record<Step['status'], { nodo: string; pallino: string; tratto: string }> = {
  ok: {
    nodo: 'border-brand-success/50 bg-carta',
    pallino: 'bg-brand-success',
    tratto: '#22b53d',
  },
  skip: {
    nodo: 'border-inchiostro/20 bg-fondo',
    pallino: 'bg-tenue/60',
    tratto: '#8d8d95',
  },
  warn: {
    nodo: 'border-brand-warning/50 bg-carta',
    pallino: 'bg-brand-warning',
    tratto: '#e27c0f',
  },
  error: {
    nodo: 'border-brand-danger/50 bg-carta',
    pallino: 'bg-brand-danger',
    tratto: '#b71d2f',
  },
}

type Punto = { x: number; y: number }

/**
 * Il tratto fra due nodi della stessa riga: non va da centro a centro, si accorcia di quanto basta
 * a uscire dal riquadro, così la linea unisce i bordi e il pallino non passa sopra le scritte.
 */
function accorcia(a: Punto, b: Punto): { a: Punto; b: Punto } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const uscita = (vx: number, vy: number) =>
    Math.min(
      Math.abs(vx) < 1e-6 ? Infinity : (NODO_L / 2 + 6) / Math.abs(vx),
      Math.abs(vy) < 1e-6 ? Infinity : (NODO_H / 2 + 6) / Math.abs(vy),
    )
  const margine = Math.max(0, (len - 2) / 2)
  const testa = Math.min(uscita(ux, uy), margine)
  const coda = Math.min(uscita(-ux, -uy), margine)
  return {
    a: { x: a.x + ux * testa, y: a.y + uy * testa },
    b: { x: b.x - ux * coda, y: b.y - uy * coda },
  }
}

/**
 * Il percorso di una freccia. Se i due nodi stanno sulla stessa riga è una linea dritta fra i bordi;
 * se cambia riga fa una piega a gomito, così non attraversa i riquadri che stanno in mezzo.
 */
function traccia(a: Punto, b: Punto): Punto[] {
  const verticale = Math.abs(a.y - b.y) > 1
  const sotto = b.y > a.y
  if (!verticale) {
    const { a: da, b: a2 } = accorcia(a, b)
    return [da, a2]
  }
  const uscita = { x: a.x, y: a.y + (sotto ? NODO_H / 2 + 6 : -NODO_H / 2 - 6) }
  const ingresso = { x: b.x, y: b.y + (sotto ? -NODO_H / 2 - 6 : NODO_H / 2 + 6) }
  if (Math.abs(a.x - b.x) < 4) return [uscita, ingresso]
  // la piega orizzontale sta nel corridoio vuoto fra le due bande, mai dentro un riquadro
  const mezzo = sotto ? uscita.y + 5 : uscita.y - 5
  return [uscita, { x: a.x, y: mezzo }, { x: b.x, y: mezzo }, ingresso]
}

/** I tratti seguono `after`: quando più passi partono dallo stesso padre, le frecce si aprono. */
function trattiDellaCatena(
  steps: Step[],
  centri: Map<string, Punto>,
): { punti: Punto[]; verso: number }[] {
  const tratti: { punti: Punto[]; verso: number }[] = []
  steps.forEach((step, i) => {
    const padri = step.after ?? (i > 0 ? [steps[i - 1].id] : [])
    for (const padre of padri) {
      const a = centri.get(padre)
      const b = centri.get(step.id)
      if (!a || !b) continue
      tratti.push({ punti: traccia(a, b), verso: i })
    }
  })
  return tratti
}

/**
 * Il pallino su un percorso: stessa fase per tutte le frecce, così quando c'è un fan-out i pallini
 * partono insieme e si vedono muoversi in parallelo.
 */
function puntoSulPercorso(punti: Punto[], fase: number, sfasamento: number): Punto {
  const giro = (((fase + sfasamento) % 1) + 1) % 1
  const t = 0.06 + (Number.isFinite(giro) ? giro : 0) * 0.88
  const lunghezze: number[] = []
  let totale = 0
  for (let i = 0; i < punti.length - 1; i += 1) {
    const len = Math.hypot(punti[i + 1].x - punti[i].x, punti[i + 1].y - punti[i].y)
    lunghezze.push(len)
    totale += len
  }
  if (totale === 0) return punti[0]
  let resto = t * totale
  for (let i = 0; i < lunghezze.length; i += 1) {
    if (resto <= lunghezze[i] || i === lunghezze.length - 1) {
      const locale = lunghezze[i] === 0 ? 0 : resto / lunghezze[i]
      return {
        x: punti[i].x + (punti[i + 1].x - punti[i].x) * locale,
        y: punti[i].y + (punti[i + 1].y - punti[i].y) * locale,
      }
    }
    resto -= lunghezze[i]
  }
  return punti[punti.length - 1]
}

export default function Catena({ steps, revealed, onRevealAll, nomi }: Props) {
  const [corrente, setCorrente] = useState<number | null>(null)
  const [animata, setAnimata] = useState(true)
  const [fase, setFase] = useState(0)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (!animata) return
    let ultimo = performance.now()
    const giro = (ora: number) => {
      const delta = (ora - ultimo) / 1000
      ultimo = ora
      setFase((f) => (f + delta * 0.22) % 1)
      frame.current = requestAnimationFrame(giro)
    }
    frame.current = requestAnimationFrame(giro)
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
    }
  }, [animata])

  const { centri, bande, righe } = useMemo(() => {
    const mappa = new Map<string, Punto>()
    const elenco: { componente: Componente; x: number; w: number; y: number; h: number }[] = []
    let riga = 0
    RIGHE.forEach((componenti) => {
      const presenti = componenti
        .map((componente) => ({
          componente,
          passi: steps.filter((s) => stepMeta(s).componente === componente),
        }))
        .filter((c) => c.passi.length > 0)
      if (presenti.length === 0) return
      const larghezze = presenti.map(
        (p) => GUTTER + p.passi.length * NODO_L + (p.passi.length - 1) * GAP,
      )
      const totale = larghezze.reduce((a, b) => a + b, 0) + (presenti.length - 1) * 36
      let x = Math.max(0, (LARGHEZZA - totale) / 2)
      presenti.forEach((p, i) => {
        elenco.push({ componente: p.componente, x, w: larghezze[i], y: riga * CORSIA, h: CORSIA - 10 })
        const y = riga * CORSIA + CORSIA / 2 - 6
        p.passi.forEach((passo, k) => {
          mappa.set(passo.id, { x: x + GUTTER + k * (NODO_L + GAP) + NODO_L / 2, y })
        })
        x += larghezze[i] + 36
      })
      riga += 1
    })
    return { centri: mappa, bande: elenco, righe: riga }
  }, [steps])

  const altezza = righe * CORSIA + 12

  const tratti = useMemo(() => trattiDellaCatena(steps, centri), [steps, centri])


  // chi ha lo stesso numero di passo si accende nello stesso istante: la cattura con l'observer
  const livello =
    revealed > 0
      ? Math.max(...steps.slice(0, Math.min(revealed, steps.length)).map((s) => s.n))
      : -1
  const visibile = (step: Step) => step.n <= livello
  const visibili = steps.filter(visibile).length
  const scelto = corrente !== null ? steps[corrente] : steps[Math.max(0, visibili - 1)]
  const metaScelto = scelto ? stepMeta(scelto) : null

  return (
    <div className="space-y-3" data-testid="catena">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-tenue">
          La catena, passo per passo
        </p>
        <span className="rounded bg-inchiostro/10 px-1.5 py-0.5 font-mono text-[10.5px] text-tenue">
          {visibili}/{steps.length} passi
        </span>
        <button
          type="button"
          data-testid="toggle-chain-animation"
          data-state={animata ? 'on' : 'off'}
          onClick={() => setAnimata((a) => !a)}
          className={
            'ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold ' +
            (animata ? 'bg-brand-success text-white' : 'bg-inchiostro/10 text-tenue')
          }
        >
          animazione {animata ? 'accesa' : 'spenta'}
        </button>
        {revealed < steps.length && (
          <button
            type="button"
            data-testid="reveal-all"
            onClick={onRevealAll}
            className="rounded-xl border border-inchiostro/15 bg-carta px-3 py-1.5 text-[12px] font-semibold text-inchiostro hover:border-brand-primary/40"
          >
            Mostra tutti i passi ({steps.length})
          </button>
        )}
      </div>

      <p className="text-[11px] leading-snug text-tenue">
        I blocchi sono raggruppati per componente: in ogni microexecutor c’è l’SDK, quindi non è un
        blocco a sé. Il broker ha due consumatori: l’observer manager, che legge lo script, e il
        processo con la cattura, che preleva la sua copia e non guarda lo script. Dopo la
        valutazione delle condizioni le frecce <span className="font-semibold">si aprono</span>: c’è
        un passo 9 per ogni observer dello script: quelli con la condizione vera partono tutti in
        parallelo, quelli con la condizione falsa restano nel disegno grigi e senza freccia in
        ingresso, perché «non parte» è un esito e va visto. I pallini sono il messaggio che scorre,
        le frecce il verso. Quello che da qui non si vede lo dice la console <span className="font-mono">KS_194_02</span>:{' '}
        <span className="font-mono">LST.EVT</span>, <span className="font-mono">GET.QUE</span>,{' '}
        <span className="font-mono">LST.LIS</span> sono FUN, nessuna chiamata a Prometheus.
      </p>
      <p className="text-[11px] text-tenue sm:hidden">la mappa si scorre in orizzontale →</p>

      <div className="w-full max-w-full overflow-x-auto rounded-2xl border border-inchiostro/10 bg-carta shadow-carta">
        <div className="relative shrink-0" style={{ width: `${LARGHEZZA}px`, height: `${altezza}px` }} data-testid="steps">
          {/* le corsie: lo sfondo dice a quale componente appartiene il blocco */}
          {bande.map((banda) => {
            const def = CORSIE[banda.componente]
            const Icona = def.icona
            return (
              <div
                key={`corsia-${banda.componente}`}
                data-testid={`corsia-${banda.componente}`}
                className={`absolute overflow-hidden rounded-xl border-l-4 ${def.bordo} ${def.tinta}`}
                style={{
                  left: `${banda.x - 8}px`,
                  width: `${banda.w + 8}px`,
                  top: `${banda.y}px`,
                  height: `${banda.h}px`,
                }}
              >
                {/* il nome del componente sta nella sua banda, in verticale: non tocca le frecce */}
                <div
                  className="absolute inset-y-0 left-0 flex flex-col items-center justify-center gap-1 px-0.5"
                  style={{ width: `${GUTTER - 4}px` }}
                  title={`${def.titolo} — ${def.sottotitolo}`}
                  data-testid={`etichetta-${banda.componente}`}
                >
                  <Icona size={13} className="shrink-0 text-inchiostro/60" aria-hidden="true" />
                  <span
                    className="whitespace-nowrap font-mono text-[10px] font-semibold leading-none text-inchiostro/85"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    {nomi[banda.componente] ?? def.breve}
                  </span>
                  {def.sdk && (
                    <span className="rounded bg-brand-info px-1 text-[8px] font-semibold uppercase tracking-wide text-white">
                      sdk
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              {(
                [
                  ['ok', TONE.ok.tratto],
                  ['warn', TONE.warn.tratto],
                  ['error', TONE.error.tratto],
                  ['skip', TONE.skip.tratto],
                  ['spento', '#c9c9cf'],
                ] as const
              ).map(([nome, tinta]) => (
                <marker
                  key={nome}
                  id={`freccia-${nome}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L10,5 L0,10 z" fill={tinta} />
                </marker>
              ))}
            </defs>
            {tratti.map(({ punti, verso }, i) => {
              // una freccia è accesa quando il passo a cui punta è già stato raggiunto
              const acceso = verso < visibili
              const tinta = TONE[steps[verso].status].tratto
              const d = punti.map((p, k) => `${k === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
              return (
                <path
                  key={`tratto-${i}`}
                  d={d}
                  fill="none"
                  stroke={acceso ? tinta : '#c9c9cf'}
                  strokeWidth={acceso ? 2 : 1}
                  strokeDasharray={acceso ? '0' : '4 4'}
                  opacity={acceso ? 0.7 : 0.45}
                  markerEnd={`url(#freccia-${acceso ? steps[verso].status : 'spento'})`}
                />
              )
            })}
          </svg>

          {steps.map((step, i) => {
            const centro = centri.get(step.id)
            if (!centro) return null
            const acceso = i < visibili
            const aperto = scelto?.id === step.id && i < visibili
            const tinta = TONE[step.status]
            const meta = stepMeta(step)
            const Icona = CORSIE[meta.componente].icona
            return (
              <button
                type="button"
                key={step.id}
                data-testid={`step-${step.id}`}
                data-status={step.status}
                data-componente={meta.componente}
                data-state={acceso ? 'active' : 'idle'}
                onClick={() => setCorrente(i)}
                style={{
                  left: `${centro.x}px`,
                  top: `${centro.y}px`,
                  width: `${NODO_L}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={
                  'absolute rounded-xl border px-2 py-1.5 text-left shadow-carta transition-opacity ' +
                  tinta.nodo +
                  (acceso ? ' opacity-100' : ' opacity-30') +
                  (aperto ? ' ring-2 ring-brand-primary ring-offset-1 ring-offset-carta' : '')
                }
              >
                <span className="flex items-center gap-1.5">
                  <Icona size={13} className="shrink-0 text-inchiostro/60" aria-hidden="true" />
                  <span className="font-mono text-[10px] text-tenue">
                    {String(step.n).padStart(2, '0')}
                  </span>
                  <span className={`h-2 w-2 rounded-full ${tinta.pallino}`} />
                  {meta.ok.length > 0 && (
                    <span className={'ml-auto flex gap-0.5' + (acceso && step.status === 'skip' ? ' opacity-40' : '')}>
                      {meta.ok.slice(0, 2).map((ok) => (
                        <OkTag key={ok} id={ok} />
                      ))}
                    </span>
                  )}
                </span>
                {step.id.startsWith('dispatch:') ? (
                  // la FUN come parte davvero: mono, su più righe, con i valori già sciolti
                  <span className="mt-0.5 block break-all font-mono text-[9px] leading-tight text-inchiostro line-clamp-4">
                    {step.title}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-[11.5px] font-semibold leading-tight text-inchiostro line-clamp-2">
                    {step.title}
                  </span>
                )}
                {step.status === 'skip' && (
                  <span className="mt-0.5 inline-block rounded bg-inchiostro/15 px-1 py-0.5 text-[9px] font-semibold text-tenue">
                    non parte
                  </span>
                )}
                {aperto ? (
                  <span className="mt-0.5 inline-block rounded bg-brand-primary px-1 py-0.5 text-[9px] font-semibold text-white">
                    dettaglio sotto
                  </span>
                ) : (
                  step.lines[0] && (
                    <span className="mt-0.5 block truncate font-mono text-[9.5px] text-tenue">
                      {step.lines[0].value}
                    </span>
                  )
                )}
              </button>
            )
          })}

          {animata &&
            tratti.flatMap((tratto, i) => {
              // un pallino per ogni freccia accesa: al fan-out partono tutti insieme
              if (!visibile(steps[tratto.verso])) return []
              const p = puntoSulPercorso(tratto.punti, fase, 0)
              return [
                <span
                  key={`pallino-${i}`}
                  className="pointer-events-none absolute h-2.5 w-2.5 rounded-full bg-brand-primary shadow"
                  style={{ left: `${p.x}px`, top: `${p.y}px`, transform: 'translate(-50%, -50%)' }}
                />,
              ]
            })}
        </div>
      </div>

      {scelto && metaScelto && (
        <div
          className="rounded-2xl border border-inchiostro/10 bg-carta p-3.5 shadow-carta"
          data-testid="step-detail"
        >
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-[13px] font-semibold">
              <span className="mr-1.5 font-mono text-[11px] text-tenue">
                {String(scelto.n).padStart(2, '0')}
              </span>
              {scelto.title}
            </p>
            <span
              className={
                'rounded px-1.5 py-0.5 text-[10px] font-semibold ' +
                (scelto.status === 'ok'
                  ? 'bg-brand-success-100 text-brand-success-900'
                  : scelto.status === 'warn'
                    ? 'bg-brand-warning-100 text-brand-warning-900'
                    : scelto.status === 'error'
                      ? 'bg-brand-danger-100 text-brand-danger-900'
                      : 'bg-inchiostro/10 text-tenue')
              }
            >
              {scelto.status}
            </span>
            <span className="rounded bg-inchiostro/10 px-1.5 py-0.5 text-[10px] font-semibold text-tenue">
              {CORSIE[metaScelto.componente].titolo}
            </span>
            {metaScelto.ok.map((ok) => (
              <OkTag key={ok} id={ok} />
            ))}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-tenue">{scelto.detail}</p>
          <p className="mt-1 text-[11.5px] leading-snug text-tenue/80">
            <span className="font-semibold">{CORSIE[metaScelto.componente].titolo}</span> · cosa sa:{' '}
            {CORSIE[metaScelto.componente].sottotitolo}
          </p>
          {scelto.lines.length > 0 && (
            <dl className="mt-2 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
              {scelto.lines.map((line, i) => (
                <div key={`${scelto.id}-${i}`} className="flex gap-2 text-[11.5px]">
                  <dt className="w-32 shrink-0 text-tenue/80">{line.label}</dt>
                  <dd className="min-w-0 break-words font-mono text-inchiostro">{line.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {scelto.code && (
            <Code text={scelto.code} lang={scelto.codeLang ?? 'json'} className="mt-2 max-h-56" />
          )}
          <p className="mt-2 text-[10.5px] text-tenue/80">
            clicca un altro passo della catena per cambiare il dettaglio
          </p>
        </div>
      )}
    </div>
  )
}
