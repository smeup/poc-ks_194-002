/**
 * Un evidenziatore minuscolo, senza dipendenze: serve a colorare i tre linguaggi che il POC
 * mostra (il `.k21`, la chiamata FUN, il Java). È uno scanner per riga: niente parser, e va
 * bene così, perché i testi sono brevi e li conosciamo.
 */

export type Lang = 'java' | 'k21' | 'fun' | 'json'

export type TokenKind =
  | 'plain'
  | 'comment'
  | 'string'
  | 'keyword'
  | 'param'
  | 'type'
  | 'number'
  | 'variable'
  | 'directive'
  | 'key'
  | 'operator'

export type Token = { text: string; kind: TokenKind }

type Rule = { re: RegExp; kind: TokenKind }

const JAVA_KEYWORDS = [
  'final',
  'new',
  'return',
  'void',
  'public',
  'private',
  'protected',
  'static',
  'class',
  'interface',
  'extends',
  'implements',
  'throws',
  'throw',
  'if',
  'else',
  'for',
  'while',
  'try',
  'catch',
  'true',
  'false',
  'null',
  'this',
]

const FUN_FIELDS = ['TYPE', 'ENV', 'CLASS', 'OBJ', 'DATA', 'EXCH', 'PRIO', 'INPUT', 'KEY', 'TTL', 'MAX', 'FILTER', 'ID']

const FUNCALL = /&event\.[A-Za-z0-9_.]+/

const RULES: Record<Lang, Rule[]> = {
  java: [
    { re: /\/\/.*/y, kind: 'comment' },
    { re: /"(?:[^"\\]|\\.)*"/y, kind: 'string' },
    { re: new RegExp(`\\b(?:${JAVA_KEYWORDS.join('|')})\\b`, 'y'), kind: 'keyword' },
    { re: /[A-Z][A-Za-z0-9_]*(?=\s*\()/y, kind: 'type' },
    { re: /[A-Z][A-Za-z0-9_]*/y, kind: 'type' },
    { re: /[a-zA-Z_][A-Za-z0-9_]*(?=\s*\()/y, kind: 'param' },
    { re: /\b\d+\b/y, kind: 'number' },
  ],
  k21: [
    // il parser vero salta le righe che iniziano con *, // o #
    { re: /^(?:\*|\/\/|#).*$/y, kind: 'comment' },
    { re: /::[A-Za-z]+/y, kind: 'directive' },
    { re: /&event\.[A-Za-z0-9_.]+/y, kind: 'variable' },
    { re: /[A-Za-z]+(?==)/y, kind: 'key' },
    { re: /"(?:[^"\\]|\\.)*"/y, kind: 'string' },
    { re: /\b(?:FUN|PGM|K11|LOG|AUDIT|CAPTURE)\b/y, kind: 'type' },
    { re: /[><=!]=?/y, kind: 'operator' },
    { re: /\b\d+\b/y, kind: 'number' },
  ],
  fun: [
    { re: /F\(/y, kind: 'keyword' },
    { re: /&event\.[A-Za-z0-9_.]+/y, kind: 'variable' },
    { re: new RegExp(`\\b(?:${FUN_FIELDS.join('|')})\\b(?=\\()`, 'y'), kind: 'param' },
    { re: /"(?:[^"\\]|\\.)*"/y, kind: 'string' },
    { re: /[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)+/y, kind: 'type' },
    { re: /\b[A-Z][A-Z0-9_]{1,}\b/y, kind: 'type' },
    { re: /\b\d+\b/y, kind: 'number' },
  ],
  json: [
    { re: /"(?:[^"\\]|\\.)*"(?=\s*:)/y, kind: 'key' },
    { re: /"(?:[^"\\]|\\.)*"/y, kind: 'string' },
    { re: /\b(?:true|false|null)\b/y, kind: 'keyword' },
    { re: /-?\b\d+(?:\.\d+)?\b/y, kind: 'number' },
  ],
}

/**
 * Dentro le virgolette di un `.k21` c'è una vera espressione: `&event.object.IMPORTO > 500`.
 * La spezzo, così la variabile, l'operatore e il numero restano riconoscibili.
 */
const IN_STRING: Rule[] = [
  { re: FUNCALL, kind: 'variable' },
  { re: /\b\d+(?:\.\d+)?\b/y, kind: 'number' },
  { re: /[><=!]=?/y, kind: 'operator' },
]

function splitString(text: string, outer: TokenKind): Token[] {
  const parts: Token[] = []
  let i = 0
  let plain = ''
  const flush = () => {
    if (plain) parts.push({ text: plain, kind: outer })
    plain = ''
  }
  while (i < text.length) {
    let matched = false
    for (const rule of IN_STRING) {
      rule.re.lastIndex = i
      const m = rule.re.exec(text)
      if (m && m.index === i) {
        flush()
        parts.push({ text: m[0], kind: rule.kind })
        i += m[0].length
        matched = true
        break
      }
    }
    if (!matched) {
      plain += text[i]
      i += 1
    }
  }
  flush()
  return parts
}

/** I token di una riga: serve al visualizzatore che evidenzia una sezione del file. */
export function tokenizeLine(line: string, lang: Lang): Token[] {
  const rules = RULES[lang]
  const out: Token[] = []
  let i = 0

  const push = (text: string, kind: TokenKind) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last && last.kind === kind) last.text += text
    else out.push({ text, kind })
  }

  while (i < line.length) {
    let matched = false
    for (const rule of rules) {
      rule.re.lastIndex = i
      const m = rule.re.exec(line)
      if (m && m.index === i) {
        const token = { text: m[0], kind: rule.kind }
        if (rule.kind === 'string' && lang === 'k21') {
          splitString(token.text, token.kind).forEach((t) => push(t.text, t.kind))
        } else {
          push(token.text, token.kind)
        }
        i += m[0].length
        matched = true
        break
      }
    }
    if (!matched) {
      push(line[i], 'plain')
      i += 1
    }
  }
  return out
}

/** Un testo intero, riga per riga. */
export function tokenize(text: string, lang: Lang): Token[][] {
  return text.split('\n').map((line) => tokenizeLine(line, lang))
}
