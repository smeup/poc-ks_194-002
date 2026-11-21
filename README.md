# poc-ksbase-003 — Feature map di Grain

POC navigabile: la mappa di Grain (Application) a sinistra, la tabella
delle feature del capitolo selezionato a destra.

- le feature sono le voci della lista ufficiale di Grain (11 aree: User
  Interface, Front-end development, Back-end and business Logic, Persistence,
  Integration Hub, Security, Custom Development, Modernization tools, DevOps,
  Deployment, Observability), **spezzate una per voce**: gli elenchi diventano
  righe separate (CSV/XLS/PDF/Google Drive, block/object/SQL/NoSQL, una riga per
  linguaggio delle polyglot functions, un connettore per riga; i 10 key points dell'AI Agent raggruppati in 7 voci) →
  **202 feature** in `src/json/features.json`, che coprono **tutti gli 81 capitoli**;
- ogni feature ha nome, descrizione e **completamento** (`completion`, 0–100,
  inventato): barretta + percentuale in tabella, con **spunta verde al 100%**,
  **spunta gialla fra 1% e 99%**, **x rossa allo 0%**; in testata il completamento
  medio del capitolo;
- i capitoli vengono dalla struttura di `poc-ksbase-001` (15 UPP, 78 capitoli +
  3 capitoli generali sotto KSBASE) in `src/json/structure.json`.

## Due modi di leggere la mappa

In cima alla colonna sinistra si sceglie la vista:

- **Livelli** — la mappa a strati come prima: tutte le aree una sotto l'altra, con i
  blocchi chiudibili e le frecce fra gli strati.
- **Drill-down** — **ogni livello occupa tutta l'area** e ogni passo mostra un solo
  livello: `Grain` → componenti (`Frontend`, `Dispatcher e comunicazione`,
  `Business Logic`, `Strato ontologico`, `Dati`) → gruppi del componente (le sue UPP,
  o per il dispatcher gateway, endpoint, autenticazione e capitoli generali) →
  capitoli del gruppo. I blocchi di un livello si spartiscono l'altezza disponibile.
  Il percorso resta in cima (`Grain › Componenti › Dispatcher › Endpoint esposti`) e
  da lì si risale sempre; il click su un capitolo apre la tabella delle feature a
  destra come nell'altra vista.

L'**infrastruttura** per ora non è fra i componenti: è una decisione ancora aperta.
Nella vista a livelli l'area è ancora presente.

La ricerca funziona uguale nelle due viste: non filtra, **attenua** ciò che non
corrisponde e mostra `N match` sul componente che ne contiene.

## Ricerca

- campo in cima alla mappa: cerca **id e nome dei capitoli**, **nome e descrizione
  delle feature**; case- e accento-insensitive (`funzionalita` trova
  `Funzionalità`); `/` porta il focus, `Esc` pulisce;
- gli elementi colpiti **direttamente** (capitolo/UPP per id o nome) e
  **indirettamente** (capitoli e UPP che contengono feature corrispondenti)
  restano pieni e mostrano il numero di corrispondenze; tutto il resto viene
  attenuato ma resta cliccabile;
- la tabella del capitolo aperto evince con `match` le feature che corrispondono
  (`src/lib/search.ts` è puro e testato: `normalize`, `searchFeatureMap`,
  `isChapterMatched`, `isUppMatched`).

## Stack

React + Vite + TypeScript, Tailwind CSS (palette `brand-*`), nessun database:
struttura e feature sono JSON in `src/json/`, letti con `fetch('./json/...')`.

```bash
npm ci
npm run dev
npm run build
npm test
npm run lint
```
