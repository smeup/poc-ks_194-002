import { OK_OBJECTS } from '../lib/engine'
import type { StepOk } from '../lib/engine'

type Props = { id: StepOk; className?: string }

const SUFFISSO: Record<StepOk, string> = {
  OKEVT: 'EVT',
  OKOBS: 'OBS',
  OKQUE: 'QUE',
  OKEXC: 'EXC',
}

/**
 * L'oggetto OK che fornisce i numeri di quel riquadro, scritto lì accanto: `OK;OBS` nel box degli
 * observer, `OK;QUE` in quello delle code. Il `title` dice cosa contiene.
 */
export default function OkTag({ id, className }: Props) {
  const oggetto = OK_OBJECTS.find((o) => o.id === id)
  return (
    <span
      data-testid={`ok-label-${SUFFISSO[id]}`}
      title={oggetto ? `${oggetto.title} — ${oggetto.what}` : id}
      className={
        'inline-flex shrink-0 items-center rounded bg-brand-primary-100 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-brand-primary-900 ' +
        (className ?? '')
      }
    >
      OK;{SUFFISSO[id]}
    </span>
  )
}
