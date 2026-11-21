# Feature map di Grain

Prototipo navigabile che risponde a una domanda: **quali funzionalità di Grain
sono coperte, e dove?**

A sinistra ci sono **quattro modi di leggere la mappa**, da scegliere in cima: a *strati*
(tutte le aree insieme), a *discesa* — si parte da Grain, si scende nei componenti e
se ne esplode uno alla volta, con il percorso sempre visibile in cima —, a *matrioska*,
che mostra le **stesse bambole tutte aperte insieme**, dall'esterno verso l'interno
(Grain contiene i componenti, ogni componente le sue UPP, ogni UPP i suoi capitoli), e a
*matrioska semplice*, che si ferma alle UPP: i capitoli non ci sono, si vedono i numeri
di ogni UPP e tutta la mappa sta in una schermata. Nelle due matrioske non si naviga:
nella completa l'unico click è la scelta del capitolo, e le cornici che lo contengono si
illuminano anche quando si passa alla semplice.

Nella vista a strati c'è la mappa di Grain — Frontend (Webup e Ketchup con tutti i
loro capitoli), Dispatcher e comunicazione, Business Logic, Strato ontologico,
Dati, Infrastruttura. **Ogni macro blocco (area) e ogni blocco (UPP, sezioni del
dispatcher, database, UFR) è chiudibile, e all'apertura sono tutti chiusi**; c'è
comunque "Espandi tutto / Comprimi tutto" e una ricerca che apre da sola i blocchi
in cui trova qualcosa. Ogni blocco dichiara la UPP dei capitoli che contiene (`KS_197 · 4`,
`KSBASE · 3`, `KS_193 · 2`…) e ogni capitolo mostra quante delle sue feature sono
presenti (`2/5`). Cliccando un capitolo, a destra compare la tabella delle sue feature:

- **Nome** — la funzionalità, con l'area della feature map a cui appartiene;
- **Descrizione** — che cosa fa, in una riga;
- **Completamento** — percentuale con barretta: verde al 100%, gialla se parziale,
  vuota allo 0%;
- **Presente** — spunta verde se la funzionalità è completa (100%), gialla se è
  parziale;
- **Non presente** — x rossa se manca del tutto (0%).

In cima alla mappa c'è la **ricerca**: cerca nei nomi dei capitoli e delle UPP e
nel nome e nella descrizione delle feature (senza badare a maiuscole e accenti).
Quello che corrisponde resta evidenziato — i capitoli direttamente, le UPP che li
contengono, e quelli che contengono feature corrispondenti — mentre il resto si
attenua; aprendo un capitolo, le feature che corrispondono sono marcate `match`
nella tabella.

Le funzionalità sono quelle della lista ufficiale di Grain, **spezzate una per
voce** — un elenco nella lista diventa una riga per elemento (CSV, XLS, PDF,
Google Drive; block, object, SQL, NoSQL; una riga per linguaggio; un connettore
per riga): in tutto 202, distribuite su tutti gli 81 capitoli della struttura. La
presenza è simulata (dati finti in `src/json/`).
Non ci sono backend né database: tutto il contenuto è in JSON.
