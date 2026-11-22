import { tokenizeLine, type Lang, type TokenKind } from '../lib/highlight'

/** I colori dei token, presi dalla palette brand: niente colori arbitrari. */
const TONE: Record<TokenKind, string> = {
  plain: 'text-white/85',
  comment: 'text-white/45 italic',
  string: 'text-brand-success-300',
  keyword: 'font-semibold text-brand-warning-300',
  param: 'text-brand-warning-200',
  type: 'text-brand-info-200',
  number: 'text-brand-warning-200',
  variable: 'font-semibold text-brand-primary-200',
  directive: 'font-semibold text-brand-info-200',
  key: 'text-white/70',
  operator: 'text-brand-warning-300',
}

type LineProps = { line: string; lang: Lang }

/** Una riga sola, già colorata: la usa chi evidenzia una sezione del file. */
export function CodeLine({ line, lang }: LineProps) {
  return (
    <>
      {tokenizeLine(line, lang).map((token, i) => (
        <span key={i} className={TONE[token.kind]}>
          {token.text}
        </span>
      ))}
    </>
  )
}

type Props = {
  text: string
  lang: Lang
  testId?: string
  attrs?: Record<string, string>
  className?: string
  maxHeight?: string
}

/** Un blocco di codice con l'evidenziazione: `pre` su fondo inchiostro, come negli altri tab. */
/**
 * Nel `.k21` quello che segue un `::SEZ` appartiene alla sezione: `::OBS` e `::CND` vanno rientrati,
 * come i figli di un nodo. È una regola di visualizzazione, il file non cambia.
 */
function righeDelFile(text: string, lang: Lang): { line: string; indent: boolean }[] {
  const out: { line: string; indent: boolean }[] = []
  let dentroUnaSezione = false
  for (const line of text.split('\n')) {
    const isSez = /^::SEZ/i.test(line.trim())
    if (isSez) dentroUnaSezione = true
    out.push({ line, indent: lang === 'k21' && dentroUnaSezione && !isSez })
  }
  return out
}

export default function Code({ text, lang, testId, attrs, className, maxHeight }: Props) {
  const lines = righeDelFile(text, lang)
  return (
    <pre
      data-testid={testId}
      {...attrs}
      className={
        'overflow-x-auto rounded-lg bg-inchiostro px-2.5 py-2 font-mono text-[11px] leading-relaxed ' +
        (maxHeight ?? '') +
        (className ? ' ' + className : '')
      }
    >
      {lines.map(({ line, indent }, i) => (
        <div
          key={i}
          className={'whitespace-pre' + (indent ? ' pl-4' : '')}
          data-lang={lang}
          data-indent={indent ? 'si' : undefined}
        >
          {line ? <CodeLine line={line} lang={lang} /> : '\u200b'}
        </div>
      ))}
    </pre>
  )
}
