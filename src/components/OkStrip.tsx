import { OK_OBJECTS } from '../lib/engine'
import type { OkId } from '../lib/ok'

type Props = { active: OkId[] }

export default function OkStrip({ active }: Props) {
  return (
    <div className="border-t border-inchiostro/10 bg-carta px-4 py-3" data-testid="ok-strip">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">
          Oggetti OK dietro i numeri
        </span>
        {OK_OBJECTS.map((obj) => {
          const on = active.includes(obj.id)
          return (
            <div
              key={obj.id}
              data-state={on ? 'active' : 'idle'}
              className={
                'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors ' +
                (on
                  ? 'border-brand-primary/30 bg-brand-primary-100/60'
                  : 'border-inchiostro/10 bg-fondo')
              }
            >
              <code
                className={
                  'rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ' +
                  (on ? 'bg-brand-primary text-white' : 'bg-inchiostro/10 text-tenue')
                }
              >
                {obj.title}
              </code>
              <span
                className={
                  'hidden text-[11px] sm:inline ' + (on ? 'text-brand-primary-900' : 'text-tenue')
                }
              >
                {obj.what}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
