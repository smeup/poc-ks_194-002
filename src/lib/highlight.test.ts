import { describe, expect, it } from 'vitest'
import { tokenizeLine } from './highlight'

const kinds = (line: string, lang: 'java' | 'k21' | 'fun' | 'json') =>
  tokenizeLine(line, lang).map((t) => `${t.kind}:${t.text}`)

describe('evidenziatore', () => {
  it('il Java distingue commento, tipo, parola chiave, stringa e numero', () => {
    const token = kinds('// la coda nasce a runtime', 'java')
    expect(token).toEqual(['comment:// la coda nasce a runtime'])

    const riga = 'final CaptureRequest request = new CaptureRequest('
    expect(kinds(riga, 'java')).toEqual([
      'keyword:final',
      'plain: ',
      'type:CaptureRequest',
      'plain: request = ',
      'keyword:new',
      'plain: ',
      'type:CaptureRequest',
      'plain:(',
    ])

    const argomenti = '        600,                            // TTL secondi'
    const pezzi = kinds(argomenti, 'java')
    expect(pezzi).toContain('number:600')
    expect(pezzi[pezzi.length - 1]).toBe('comment:// TTL secondi')
  })

  it('nel .k21 spiccano le direttive, le chiavi e le &event dentro le virgolette', () => {
    const sez = kinds('::SEZ Type="FUN"', 'k21')
    expect(sez).toContain('directive:::SEZ')
    expect(sez).toContain('key:Type')
    expect(sez).toContain('string:"FUN"')

    const cond = kinds('::CND Esp="&event.object.IMPORTO > 500"', 'k21')
    expect(cond).toContain('directive:::CND')
    expect(cond).toContain('variable:&event.object.IMPORTO')
    expect(cond).toContain('operator:>')
    expect(cond).toContain('number:500')
  })

  it('la chiamata FUN evidenzia F(, i campi e le variabili', () => {
    const pezzi = kinds('    CLASS(SPNOT)', 'fun')
    expect(pezzi).toContain('param:CLASS')
    expect(pezzi).toContain('type:SPNOT')

    const apertura = kinds('F(FBK;KS_194_02A;PUB.EVT)', 'fun')
    expect(apertura).toContain('keyword:F(')
    expect(apertura).toContain('type:KS_194_02A')
    expect(apertura).toContain('type:PUB.EVT')

    expect(kinds('    DATA(IMPORTO=&event.object.IMPORTO)', 'fun')).toContain(
      'variable:&event.object.IMPORTO',
    )
  })

  it('il JSON distingue chiavi, stringhe, numeri e booleani', () => {
    const pezzi = kinds('  "event_type": "EXPENSE_REPORT_SUBMITTED",', 'json')
    expect(pezzi).toContain('key:"event_type"')
    expect(pezzi).toContain('string:"EXPENSE_REPORT_SUBMITTED"')
    expect(kinds('  "data": null', 'json')).toContain('keyword:null')
    expect(kinds('  "timestamp": 1732219200000,', 'json')).toContain('number:1732219200000')
  })

  it('non perde un carattere per strada', () => {
    const righe = [
      'F(FBK;KS_194_02A;PUB.EVT)',
      '::OBS Fun="F(EXB;VT_310_01;NOTIFY.RCP) 1(CO;AUTAR;&event.object)"',
      '        "il-nome-del-servizio");                                                   // SOURCE',
    ]
    type Coppia = ['fun' | 'k21' | 'java', string]
    const casi: Coppia[] = [
      ['fun', righe[0]],
      ['k21', righe[1]],
      ['java', righe[2]],
    ]
    for (const [lang, riga] of casi) {
      expect(tokenizeLine(riga, lang).map((t) => t.text).join('')).toBe(riga)
    }
  })
})
