# Motore di regole — modulo eventi (KS_194_02)

Prototipo per capire cosa succede a un evento di business dentro la piattaforma: chi lo
pubblica, su quale exchange finisce, quale script lo trasforma in una chiamata, e cosa
legittimamente **non** succede.

Tutti i numeri sono simulati nel browser: nessun server, nessun broker, nessuna chiamata di
rete oltre al caricamento dei JSON. Gli eventi e gli oggetti applicativi sono inventati ma
costruiti sulla forma vera del motore (SmeupBusinessEvent, script `SCP_K21`, routing key,
condizione `::CND`, ack/nack) letta nel codice di `kokos-me-java-batch`,
`kokos-me-java-rpgle-std` e `kokos-sdk-java-rpgle`.

## Le due schede

**Percorso** — scegli un evento (`OK;EVT;…`) e un oggetto applicativo (`SP;NOT;…`), poi scegli
come viene lanciato: una FUN (`PUB.EVT`) o un servizio con SDK. Cliccando le due opzioni
compare **il codice che pubblica**, con la sintassi colorata: la chiamata FUN vera o il
`SmeupBusinessEvent` + `EventProducer` in Java.

Sotto ci sono le due cartelle degli **observer**: gli script dichiarati in `SCP_K21`
(il file `.k21` con le sue sezioni `::SEZ`) e gli observer **in process** (code effimere
`EVT_CAP_*` registrate a runtime). Cliccando una riga si apre il contenuto: il file con la
sezione evidenziata, oppure il codice che registra la cattura.

Da lì il pulsante **Simula l'evento** fa partire la catena: una mappa a bande, una per
componente della piattaforma (client web, micro esecutore che pubblica, RabbitMQ, observer
manager con accanto il processo che ha la cattura, micro esecutore dell'observer), con la
legenda dei componenti sopra la mappa. Il broker ha due consumatori: l'observer manager legge
`SCP_K21`, la cattura preleva la sua copia e non guarda lo script. Dopo la valutazione delle
condizioni le frecce si aprono: un passo 9 per ogni observer con la condizione vera, tutti in
parallelo. I pallini sono il messaggio che scorre su ogni freccia; cliccando un passo si legge
il suo dettaglio, con il payload JSON o lo script `.k21` (commentato come i file veri).

**Capire Rabbit** — i quattro passi del broker, un simulatore (exchange, tipo di evento,
priorità) che mostra routing key, coda e consumer, gli exchange e le code dichiarati, e
perché esistono due code invece di una priorità dentro la coda.

In cima al Percorso c'è la striscia **Casi da provare**: i nove esiti già pronti. Il titolo di un
caso mette nel Percorso l'evento e l'oggetto giusti, il `?` accanto apre il racconto — cosa
succede e cosa **non** succede.

## Gli oggetti OK

`OK;EVT`, `OK;OBS`, `OK;QUE`, `OK;EXC` stanno **accanto al riquadro che fornisce quei
numeri**: `OK;EVT` sul selettore degli eventi, `OK;OBS` sulle due cartelle degli observer e
sui passi dello script, `OK;QUE` sulle code, `OK;EXC` sugli exchange e sulla pubblicazione.
Il suggerimento del mouse dice cosa contiene ciascuno.

## Le dodici storie, in undici aree

Vendite (ordine confermato, due soglie sull'importo) · Acquisti (richiesta di acquisto, approvazione
reparto a 10.000 € e direzione a 100.000 €) · Magazzino (articolo sotto scorta, priorità alta e
cattura per il cruscotto) · Logistica (spedizione partita con tracking) · Amministrazione (incasso
con riconciliazione e partitario) · Produzione (ordine rilasciato, observer a37) · Assistenza
(ticket su exchange `evt`) · Personale (nuova assunzione, provisioning utenze) · più i tre casi
iniziali: nota spese, cancello automatico, fattura passiva.

## Cosa guardare per primo

La nota spese con importo 1240 € fa partire tre observer; la stessa nota da 310 € ne fa
partire due, e la terza non è un errore. La targa al cancello con priorità 2 finisce sulla
coda alta. La fattura archiviata non ha script: il consumer risponde NACK senza requeue e il
messaggio si perde senza che il pubblicatore lo sappia.
