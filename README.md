# poc-ks_194-002 — Motore di regole, modulo eventi

Prototipo per capire cosa succede a un evento di business dentro la piattaforma: chi lo
pubblica, su quale exchange finisce, chi lo consuma, quale script lo trasforma in una
chiamata, e cosa legittimamente **non** succede.

Solo frontend: React + Vite + TypeScript, dati in `src/json/`, nessun server, nessun broker.
Gli eventi e gli oggetti applicativi sono inventati (tre casi d'uso: nota spese, cancello
automatico, fattura passiva) ma la forma è quella vera letta nel codice di
`kokos-me-java-batch` e `kokos-sdk-java-rpgle`.

## Le tre schede

- **Percorso** — si sceglie l'evento (`OK;EVT;…`), l'oggetto applicativo (`NR;SP;…`), si
  scrive il JSON dei dati partendo dal template, si decide se pubblica una FUN o un
  servizio con SDK, e si sceglie exchange e priorità. Eseguito, l'evento attraversa i passi
  uno alla volta: payload, exchange, routing key, coda, thread `k21-observers`, script
  `SCP_K21`, sostituzione di `&event.*`, formule OAV, `::CND`, `executeFunAsync`, ack.
- **Sistema** — chi parla con chi: ogni canale accende i nodi che tocca e i pallini che si
  muovono sono il messaggio che passa. Cliccando un nodo si legge cosa quel pezzo sa e cosa
  non può sapere.
- **Esiti** — sette esiti raccontati: cosa fa il motore, cosa non fa, quale oggetto `OK` lo
  dimostra. Ogni scheda si riapre nel percorso con evento e oggetto già scelti.

La striscia in fondo accende gli oggetti `OK` dietro i numeri della scheda attiva: `OKEVT`,
`OKOBS`, `OKQUE`, `OKEXC`.

## Comandi

```bash
npm install
npm run dev          # sviluppo
npm run build        # tsc -b + vite build (typecheck compreso)
npm test             # vitest
npm run lint
node tools/verify-poc.mjs [baseUrl]   # verifica Playwright: tre schede, animazione, 390 px
```

## Regole del progetto

Valgono quelle di `AGENTS.md`: niente CSS proprio (solo token `brand-*` e neutri), niente
database (tutto in `src/json/`), percorsi relativi `fetch('./json/...')`, `base: './'`.
