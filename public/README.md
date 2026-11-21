# Motore di regole — modulo eventi (KS_194_02)

Prototipo per capire cosa succede a un evento di business dentro la piattaforma: chi lo
pubblica, su quale exchange finisce, quale script lo trasforma in una chiamata, e cosa
legittimamente **non** succede.

Tutti i numeri sono simulati nel browser: nessun server, nessun broker, nessuna chiamata di
rete oltre al caricamento dei JSON. Gli eventi e gli oggetti applicativi sono inventati ma
costruiti sulla forma vera del motore (SmeupBusinessEvent, script `SCP_K21`, routing key,
condizione `::CND`, ack/nack) letta nel codice di `kokos-me-java-batch` e
`kokos-sdk-java-rpgle`.

## Le tre schede

**Percorso** — scegli un evento (`OK;EVT;…`) e un oggetto applicativo (`CN;SP;…`), scrivi il
JSON dei dati (parti dal template), decidi se pubblica una FUN o un servizio con SDK, e
scegli priorità ed exchange. Poi esegui: i passi compaiono uno alla volta, con il messaggio
che si costruisce, la sostituzione di `&event.*`, la valutazione delle condizioni e l'elenco
di chi ha ricevuto l'evento.

**Sistema** — chi parla con chi, con quale canale: la FUN e il dispatcher, il servizio con
SDK, l'exchange, le code, il thread `k21-observers`, le librerie degli script, la FUN
dell'ascoltatore, la cattura effimera, la console. Ogni canale accende i nodi che tocca e i
pallini che si muovono sono il messaggio che passa.

**Esiti** — sette esiti raccontati: cosa fa il motore, cosa non fa, quale oggetto `OK` lo
racconta. Ogni scheda si riapre nel percorso con evento e oggetto già scelti.

## Gli oggetti OK

La striscia in fondo alla pagina accende le entità che forniscono i numeri della scheda
attiva: `OKEVT` (catalogo eventi), `OKOBS` (registro ascoltatori, stabili ed effimeri),
`OKQUE` (code), `OKEXC` (exchange con chi pubblica e chi consuma).

## Le dodici storie, in undici aree

Vendite (ordine confermato, due soglie sull'importo) · Acquisti (richiesta di acquisto, approvazione
reparto a 10.000 € e direzione a 100.000 €) · Magazzino (articolo sotto scorta, priorità alta e
cattura per il cruscotto) · Logistica (spedizione partita con tracking) · Amministrazione (incasso
con riconciliazione e partitario) · Produzione (ordine rilasciato, ascoltatore a37) · Assistenza
(ticket su exchange evt) · Personale (nuova assunzione, provisioning utenze) · più i tre casi
iniziali: nota spese, cancello automatico, fattura passiva.

## Cosa guardare per primo

La nota spese con importo 1240 € fa partire tre ascoltatori; la stessa nota da 310 € ne fa
partire due, e la terza non è un errore. La targa al cancello con priorità 2 finisce sulla
coda alta. La fattura archiviata non ha script: il consumer risponde NACK senza requeue e il
messaggio si perde senza che il pubblicatore lo sappia.
