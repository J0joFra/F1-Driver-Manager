# F1 Driver Manager

Gestionale di Formula 1 per browser e Android. Due modalità sullo stesso mondo —
**Pilota** (fai carriera, cresci, ti scegli il sedile) e **Scuderia** (dirigi un team) —
con la gara simulata e mostrata dall'alto in 2D: non guidi, **decidi**.

> **Stato: Modalità Pilota giocabile, gara compresa.**
> Il mondo gira da riga di comando (40 stagioni in ~300 ms), l'app si gioca
> settimana per settimana e le gare si corrono dal vivo: tracciato, torre dei
> tempi, distacchi e strategia.

---

## Indice

- [L'idea](#lidea)
- [Provalo subito](#provalo-subito)
- [Architettura: perché il motore viene prima](#architettura-perché-il-motore-viene-prima)
- [Le due modalità](#le-due-modalità)
- [Il mondo infinito](#il-mondo-infinito)
- [Il calendario della stagione](#il-calendario-della-stagione)
- [La settimana di gioco](#la-settimana-di-gioco)
- [L'albero delle abilità](#lalbero-delle-abilità)
- [Soldi e staff personale](#soldi-e-staff-personale)
- [Il modello di gara](#il-modello-di-gara)
- [La forma del circuito](#la-forma-del-circuito)
- [La qualifica, tre decisioni](#la-qualifica-tre-decisioni)
- [Le regole che tengono in piedi il bilanciamento](#le-regole-che-tengono-in-piedi-il-bilanciamento)
- [Struttura del progetto](#struttura-del-progetto)
- [Comandi](#comandi)
- [Cosa manca](#cosa-manca)
- [Mockup di riferimento](#mockup-di-riferimento)

---

## L'idea

Un incrocio fra tre cose che esistono già separatamente:

| Da | Prendiamo |
|---|---|
| **Monoposto** (Marco Pesce) | la profondità della carriera da pilota, la strategia vera |
| **F1 Clash** | la cura dell'interfaccia e il feedback immediato — **non** il gacha |
| **Soccer Manager** | la struttura a schede, il database navigabile, il gioco che non finisce mai |

Il vuoto che riempiono male tutti e tre: **una carriera single player profonda, con una presentazione moderna e senza meccaniche predatorie.**

La gara è piatta: tracciato dall'alto in SVG, vetture come forme semplici, torre dei tempi e striscia dei distacchi. Niente 3D in pista. Il 3D compare solo nei momenti da schermata — garage, podio, firma del contratto — ed è **pre-renderizzato in Blender**, non calcolato a runtime. L'unica eccezione è l'editor di livree e casco, dove serve WebGL vero.

---

## Provalo subito

```bash
npm install
npm run dev                   # l'app, su http://localhost:5173
npm test                      # 132 test
npm run sim -- --seasons 40 --verbose
```

**Il gioco si tiene in orizzontale.** Se apri l'app su un telefono in verticale
ti chiede di ruotarlo: la torre dei tempi e la pista hanno bisogno di larghezza.

Output reale dell'ultima esecuzione (seed `20260921`):

```
40 stagioni simulate (2031–2070) in 316 ms — seed 20260921
======================================================================
Piloti diversi campioni ............ 14 su 40 stagioni
Scuderie diverse campioni .......... 5 su 5
Deriva del potenziale medio ........ +4.73 punti in 40 anni
Overall medio griglia .............. 75.6 → 77.5
Età media della griglia ............ 28.4 → 28.7
Piloti attivi ...................... 10 → 10
Ritiri per gara .................... 8.3%
Azzeramenti regolamentari .......... 8

Titoli per scuderia:
  Vantar Racing      ████████████████ 16
  Nordvik Squadra    █████████ 9
  Kestrel Motors     ████████ 8
  Mirage GP          ██████ 6
  Scuderia Aurora    █ 1
```

Quello che questi numeri dicono: il mondo **non si congela** (cinque scuderie diverse vincono, e Nordvik — l'ultima forza al primo anno — ne vince nove), **non si svuota** (dieci piloti attivi dopo quarant'anni) e **non si gonfia** (il livello medio resta ancorato, quindi i record del 2031 valgono ancora nel 2070).

> Questa è esattamente la ragione per cui il motore viene prima dell'interfaccia.
> La prima simulazione a 40 stagioni dava **29 titoli su 40 a una sola scuderia**:
> la gerarchia si congelava entro la decima stagione. Nessuna schermata lo avrebbe
> mai rivelato. Le contromisure sono documentate più sotto, e un test di regressione
> le protegge.

---

## Lo stile

Guscio e impaginazione sono disegnati su mockup concordati, nella stessa
famiglia di **[OpenFoot Manager](https://github.com/openfootmanager/openfootmanager)**,
che condivide quasi tutto lo stack (React, TypeScript, Tailwind, Zustand,
Recharts, lucide-react) e ha risolto bene lo stesso problema: un gestionale
denso che resta leggibile.

| Elemento | Come |
|---|---|
| **Barra delle sezioni** | sole icone, 48 px sul bordo sinistro, tacca verde sulla voce attiva |
| **Riga di stato** | 34 px: nome, anno, settimana, prossima gara in giallo, e il comando che fa passare il tempo |
| **Schede** | fondo appena più chiaro della pagina, bordo tenue, etichetta piccola e spaziata |
| **Colonne** | due o tre per schermata: in orizzontale la larghezza è ciò che abbonda |
| **Palette navy** | pagina `#0A1120`, schede `#0C1423`, superfici `#121B2E`; verde d'azione, giallo di richiamo |
| **Tipografia** | Barlow Condensed per i numeri grandi, Inter per il testo, IBM Plex Mono per le cifre in colonna |
| **Tema chiaro** | rosso e bianco, per richiamare GridUP: vedi [la palette](#la-palette) |
| **Icone** | `lucide-react` |

Ogni attributo del pilota ha la propria tinta, presa dalla stessa scala
validata per daltonismo dei colori scuderia. Il colore non identifica nulla da
solo: il nome dell'attributo è sempre accanto alla barra.

I vincoli restano diversi da quelli di un'app desktop: 390 px di altezza
significa che l'intestazione non può avere due righe e che il menu non può
permettersi le etichette. Il monospace per le cifre è un'aggiunta nostra — in
una torre dei tempi i numeri devono incolonnarsi.

### Le schermate

| Schermata | Impaginazione |
|---|---|
| **Paddock** | tre colonne: il tuo pilota e il contratto · il prossimo weekend e la classifica piloti · la scuderia e la classifica costruttori |
| **Pilota** | tre fasce: chi è (nome, scuderia, contratto, overall e potenziale) · di cosa è fatto (ruoli a stelle, attributi in colonne, anagrafica) · come sta (morale, condizione, forma, stagione). Da qui si apre l'albero |
| **Abilità** | un'area alla volta come grafo ramificato, schede in alto, dettaglio del nodo scelto in basso |
| **Allenamento** | piano settimanale a sinistra con i pip di allocazione, a destra gli attributi che si muovono |
| **Calendario** | due viste: griglia mensile a sette colonne, o l'anno intero in tabella · a destra la settimana corrente e il resto della stagione |
| **Finanze** | entrate · uscite · il netto isolato in una colonna sua |
| **Scuderia** | la squadra · i piloti in schede · lo sviluppo, in sola lettura |
| **Contratti** | profilo e stagione a sinistra, a destra il contratto in corso o le offerte da firmare |
| **Classifiche** | piloti in tabella (V, P, OVR, PT) · scuderie in schede con passo, affidabilità e prestigio |
| **Storia** | albo d'oro · titoli per scuderia · ordine d'arrivo dell'ultima gara |

## L'interfaccia è orizzontale per costruzione

Un telefono in orizzontale lascia circa **390 px di altezza**. È l'altezza la
risorsa scarsa, non la larghezza, e questo decide tutto il resto:

| Scelta | Perché |
|---|---|
| **Rail verticale a sinistra**, non schede in alto | una barra orizzontale costerebbe il 10% dell'altezza utile |
| **La pagina non scorre mai** (`html, body, #root { overflow: hidden }`) | scorrono solo i pannelli che lo dichiarano, con `.scroll-y` |
| **Barra di stato alta 36 px** | anno, settimana, prossima gara e l'unico comando sempre presente: *Avanza* |
| **Due colonne affiancate** in ogni schermata | in orizzontale la larghezza abbonda: si mostra il doppio senza scorrere |
| **Scala tipografica compatta** (base 13 px) | densità da muretto box, non da sito web |
| `padding-left/right: env(safe-area-inset-*)` | in orizzontale la tacca del telefono sta sui lati |

`tools/screenshots.mjs` cattura tutte le schermate a 844×390 e verifica tre
cose che su desktop non si vedono mai:

1. la pagina non scorre in verticale;
2. nessun pannello sborda dal viewport;
3. **nessun contenuto è tagliato dentro il proprio pannello** senza poter
   scorrere — il difetto che ricompare a ogni schermata nuova, perché non fa
   scorrere niente: si vede solo troncato.

```bash
npm run build && npm run preview &
npm run shots -- screenshots
npm run check:palette
```

## Architettura: perché il motore viene prima

```
src/engine/   TypeScript puro. Zero import di React, zero DOM, zero Math.random().
src/ui/       (ancora da scrivere) React. Zero matematica di gioco.
```

Due regole non negoziabili, e il resto del progetto discende da queste.

### 1. Il mondo si simula da solo

Tutte le scuderie sviluppano la macchina, firmano piloti e gestiscono il budget. Tutte, sempre — anche quando il giocatore è soltanto uno dei venti in griglia.

> **Il giocatore non "gioca il gioco": occupa uno slot e sovrascrive le decisioni di un'IA che saprebbe comunque prenderle.**

Da cui il corollario operativo: **ogni decisione che il giocatore potrà prendere ha un'implementazione IA, e l'IA si scrive prima della schermata.** Se si scrive prima l'interfaccia, ci si ritrova con decisioni che solo un umano sa prendere — e la Modalità Scuderia diventa impossibile, oltre a lasciare le altre nove squadre come manichini.

### 2. Nessuna casualità non tracciabile

`Math.random()` non compare in `src/engine`. Tutto passa da [`rng.ts`](src/engine/rng.ts), che espone un generatore deterministico (mulberry32) con `fork(label)` per derivare sotto-generatori indipendenti e riproducibili.

```ts
const rng = rngFor(world, 'weekend:lario');  // stesso mondo → stessa gara
```

Conseguenze pratiche: una gara si riproduce identica per il debug, un salvataggio si ricostruisce dal seed, e il bilanciamento si **misura** invece di stimarlo a occhio.

---

## Le due modalità

Sono due valori dello stesso campo. Non due giochi.

```ts
type Seat =
  | { mode: 'pilota';   driverId: string }
  | { mode: 'scuderia'; teamId: string }
  | { mode: 'osservatore' };
```

Cambia soltanto **quali decisioni prende l'IA al posto tuo**. La schermata «Scuderia», che in Modalità Pilota è in sola lettura — vedi che il tuo team sta sbagliando lo sviluppo e non puoi farci niente — in Modalità Scuderia diventa il centro del gioco. Scritta una volta, usata due.

---

## Il mondo infinito

Soccer Manager è infinito perché un allenatore non invecchia mai. **Un pilota sì**: corre quindici o diciotto stagioni e si ritira.

La soluzione, che è anche la cosa migliore del progetto:

> **Il mondo è infinito. Il pilota no. Il salvataggio è il mondo, non il personaggio.**

Al ritiro il salvataggio non finisce. Si sceglie: **nuovo rookie** nello stesso mondo (i tuoi record restano, i piloti che hai battuto sono ora veterani), **team principal** (passi alla Modalità Scuderia, magari nella squadra che ti diede la prima chance), oppure **leggenda** (entri nella hall of fame e il mondo prosegue).

Quattro sistemi rendono tutto questo possibile, e sono già nel motore:

| Sistema | File | Cosa fa |
|---|---|---|
| **Rigenerazione** | `market.ts` · `driver.ts` | ogni anno nascono nuovi piloti (18–21 anni, potenziale nascosto) e i vecchi si ritirano |
| **Curve di età** | `driver.ts` | crescita fino a ~24, plateau, poi calo fisico mentre l'esperienza continua a salire |
| **Reset regolamentari** | `regulations.ts` | ogni 4–6 anni le monoposto convergono verso la media e la gerarchia si rimescola |
| **Anti-inflazione** | `market.ts` | il potenziale dei nuovi arrivati è ancorato al livello medio della griglia |

### Il salvataggio resta piccolo

40 stagioni × 20 gare × 20 piloti = 16 000 risultati. Salvando ogni giro, dopo quindici stagioni il file è ingestibile.

**Dettaglio completo solo per la stagione in corso, aggregati per sempre** (`SeasonTotals`, ~200 byte a pilota a stagione). Un mondo da 40 stagioni sta sotto il megabyte, e l'albo d'oro resta integro. Un test lo verifica.

---

## Il calendario della stagione

In *Soccer Manager* il calendario non è una tabella di consultazione: è
l'oggetto che fa esistere il tempo. Le partite stanno in giorni veri, le soste
si vedono, e la programmazione della settimana discende da lì. Qui vale lo
stesso — ed è ricalcato sul calendario vero della Formula 1, perché la sua
forma non è arbitraria.

[`engine/calendar.ts`](src/engine/calendar.ts) costruisce le 44 settimane
dell'anno **una volta sola**, quando il mondo nasce, e le salva dentro
`World.schedule`. Ogni settimana è un oggetto, non un id di circuito:

```ts
interface SeasonWeek {
  index: number;             // 0..43
  kind: WeekKind;            // testing | race | free | summerBreak | postseason
  startDay: number;          // giorni dal 1° gennaio: il lunedì di quella settimana
  trackId: string | null;
  round: number | null;      // numerazione delle gare, non delle settimane
}
```

### Le date vengono prima

Il generatore non conta settimane: calcola **date vere** e poi decide dove
stanno le gare. Tre àncore, prese dal calendario reale:

| Àncora | Regola | 2026 | 2027 |
|---|---|---|---|
| **Apertura** | seconda domenica di marzo | 8 marzo | 14 marzo |
| **Pausa estiva** | le prime tre domeniche d'agosto | 2–16 agosto | 1–15 agosto |
| **Finale** | prima domenica di dicembre | 6 dicembre | 5 dicembre |

Sono le stesse date del campionato 2026 vero: apertura l'8 marzo, ultima gara
prima della pausa il 26 luglio, ripresa il 23 agosto, finale il 6 dicembre.
Non è una coincidenza cercata — viene fuori da sola una volta che le àncore
sono quelle giuste.

Ancorare a una data invece che a un conteggio ha una conseguenza pratica:
`weekendDays(year, week)` produce libere di venerdì, qualifica di sabato e
gara di domenica **in ogni anno**, bisestile compreso. Un calendario contato a
settimane sarebbe scivolato di un giorno ogni quattro anni.

| Tipo di settimana | Quando | Sessioni di allenamento | Recupero |
|---|---|---|---|
| **Test invernali** | le 2 settimane prima del via | 3 | — |
| **Settimana libera** | fra due gare | 2 | — |
| **Settimana di gara** | 24 volte l'anno | **1** | — |
| **Pausa estiva** | 3 settimane ad agosto | 2, a settimane alterne | 22 punti di stanchezza |
| **Dopo-stagione** | dopo l'ultima gara | 2, a settimane alterne | 6 punti |

Sono poche sessioni di proposito. Un pilota non si allena dieci volte nella
settimana di un Gran Premio: prepara, viaggia, corre. Una sessione quando si
corre e due quando non si corre è il ritmo vero, e rende ogni singola sessione
una scelta invece che una riga di un monte ore.

Nelle pause ci si allena **una settimana sì e una no**: in vacanza, ma senza
perdere la forma. Per questo la capienza non sta sul *tipo* di settimana ma
sulla settimana stessa, in `SeasonWeek.training` — due settimane di pausa
estiva hanno lo stesso `kind` e capienza diversa, e il calendario resta
l'unica fonte di verità su cosa si può fare quando.

Le due colonne a destra sono il motivo per cui il calendario sta nel motore e
non nell'interfaccia: **`WEEK_TRAINING_CAPACITY` e `WEEK_RECOVERY` sono la
regola**, e [`training.ts`](src/engine/training.ts) le legge invece di avere una
soglia propria. Una pausa estiva che non insegna niente sarebbe decorazione; qui
è l'unico momento dell'anno in cui la stanchezza scende davvero, quindi
arrivare ad agosto logori è una scelta con una conseguenza.

### Il giro del mondo

Le gare non sono sparse a caso. Il generatore segue un **giro**, diviso in due
metà dalla pausa estiva:

```
Oceania → Asia ×2 → Medio Oriente ×2 → Americhe ×2 → Europa ×7
                    ——— pausa estiva ———
Europa ×2 → Asia ×2 → Americhe ×4 → Medio Oriente ×2
```

È la struttura del campionato vero: si apre lontano perché in Europa è ancora
inverno, si passa l'estate in Europa, e si chiude inseguendo la luce verso
ovest fino alle notturne del Medio Oriente. Senza la regione il generatore
produrrebbe un calendario legale ma assurdo — una gara europea incastrata fra
il Brasile e il finale in Medio Oriente, che è esattamente l'errore che
compariva prima che l'inventario dei circuiti fosse allineato al giro. Un test
verifica che nessuna regione ricompaia in un terzo blocco separato, che si
apra in Oceania e si chiuda in Medio Oriente.

I circuiti sono **31 per 24 gare**: ogni regione ha il suo mazzo mescolato e
qualche autodromo resta fuori ogni anno. Il calendario ruota da solo, come
quello vero, senza che nessuno decida quali togliere.

### Il ritmo: triple header e pause lunghe

Le gare si raggruppano in blocchi di una, due o tre weekend separati da
settimane libere. Le **triple header sono normali** — il 2026 vero ne ha tre —
e sono proprio loro a liberare le settimane che diventano le pause lunghe di
primavera. Un calendario di gare tutte distanziate sarebbe regolare e irreale.

I blocchi si decidono prima, poi le settimane libere avanzate si distribuiscono
fra loro: così la prima e l'ultima gara cadono **sempre** esattamente
sull'apertura e sul finale, qualunque sia il numero di gare. Quattro gare di
fila non capitano mai, e un test lo verifica su quattro seed.

### A che ora si corre

Ogni circuito porta `localStart` e `utcOffset`, e il calendario calcola l'ora
italiana tenendo conto dell'ora legale (ultima domenica di marzo → ultima di
ottobre). È il dato che un tifoso guarda per primo, e con le trasferte lontane
cambia tutto: Port Haven parte alle 15:00 locali, che in Italia sono le 5 del
mattino. Le gare che partono dalle 18:00 in poi sono notturne, e nel calendario
hanno la luna al posto della bandiera.

La schermata **Calendario** mostra l'anno intero in una tabella — settimana,
data, evento con l'ora italiana, risultato, sessioni disponibili — con gli
stacchi dei mesi e la settimana corrente evidenziata e portata in vista da
sola. A destra due pannelli: cosa succede questa settimana (regione, giorni del
weekend, ora locale e ora italiana) e cosa resta dell'anno.

### Due viste: il mese e la stagione

La schermata Calendario ha due impaginazioni, e non è ridondanza: rispondono a
due domande diverse.

**Mese** è la griglia a sette colonne dei manageriali — una riga per settimana,
una casella per giorno, fino a tre etichette per casella. Serve a *pianificare*:
il colpo d'occhio dice dove sono i weekend e quanto fiato c'è in mezzo, cosa
che una lista verticale non riesce a dare. La colonna di sinistra tiene il
carattere della settimana (`R7`, `Libera`, `Pausa`), che è l'equivalente dello
stile di allenamento nei manageriali di calcio.

**Stagione** è l'anno intero in tabella, con gli stacchi dei mesi e i
risultati. Serve a *cercare*.

Due vincoli hanno deciso la griglia:

- **Una casella è larga meno di settanta pixel.** Perciò ogni attività porta
  due nomi: `label` per intero e `short` per la griglia — "Trasferta" diventa
  "Volo", "Prova della settimana" diventa "Prova", "Preparazione" diventa
  "Fisico". Non sono abbreviazioni a caso: sono i nomi che reggono in undici
  caratteri, e un test lo verifica, perché troncare con i puntini non informa
  nessuno.
- **Le settimane fuori stagione non meritano lo stesso spazio.** A febbraio ci
  sono tre righe vuote prima dei test: a 390 px di altezza regalare loro un
  quinto dello schermo sarebbe assurdo, quindi una riga senza attività è alta
  22 px invece di 58.

### Un difetto che il calendario lungo ha fatto emergere

La stanchezza si calcolava come `totalLoad * 14 - 4`, dove `totalLoad` è la
frazione di capienza usata. Riempire il piano di una settimana di gara (6
sessioni) stancava quindi **esattamente quanto** riempirlo in una libera (10):
il tipo di settimana non contava. Con 40 settimane non si vedeva; con 44 la
stanchezza si saturava e la griglia perdeva 7 punti di overall in 40 stagioni
invece di 4.

Ora conta il numero di sessioni: `totalSessions * 1.4 - 4`. È la stessa formula
di prima per la settimana da dieci sessioni — quella su cui la crescita era
stata tarata — ma le settimane di gara costano meno. La deriva è tornata a
−4.1 punti, misurata su cinque seed, meglio dei −4.3 di partenza.

---

## La settimana di gioco

Una stagione dura **44 settimane**, di cui 24 con una gara. Il tempo però
**scorre a giorni**: `advanceDay()` è l'unità del gioco, e *Avanza* sposta il
mondo di ventiquattro ore.

| Giorno | Cosa succede | Durata |
|---|---|---|
| Mar (e Gio) | **Allenamento**: una sessione se nel weekend c'è la gara, due se non c'è | 30 s |
| Mer | **Il minigioco della settimana**, una sola partita | 40 s |
| Gio | **Trasferta** verso il circuito | — |
| Ven | **Libere**: scegli una direzione di assetto | 20 s |
| Sab | **Qualifica**: tre decisioni, poi il giro | 60 s |
| Dom | **Gara** | 3–5 min |

### Il tempo scorre a giorni, i conti restano a settimane

Sono due cose diverse e vale la pena tenerle separate.

Il **passo** è il giorno, perché è quello che rende leggibile una stagione:
scorrendo il calendario si vede la trasferta di giovedì, il venerdì di libere,
la domenica di gara. Il **conto** dell'allenamento resta settimanale, perché le
curve di crescita sono tarate su una settimana intera e spezzarle in sette
pezzi cambierebbe i risultati senza aggiungere una decisione — il piano si
sceglie una volta a settimana, non una volta al giorno.

Il ponte fra le due cose è una riga: `COMMIT_DAY`, il giorno in cui il lavoro
della settimana va a bilancio. È l'ultima giornata di allenamento — giovedì in
un weekend di gara, venerdì in una settimana libera — quindi gli attributi si
muovono quando il blocco di lavoro finisce, e sempre **prima** della gara. Un
test verifica che `COMMIT_DAY` cada sull'ultima giornata di allenamento e mai
dopo la domenica.

`advanceWeek()` esiste ancora ma non è più l'unità di tempo: è costruita sopra
`advanceDay()` e serve al simulatore da riga di comando, che corre quarant'anni
e non ha motivo di passare per i giorni. Costruirla sopra invece che accanto
significa che i due percorsi non possono divergere — e un test lo verifica
davvero, facendo correre la stessa stagione nei due modi e confrontando
classifica, attributi e stanchezza di ogni pilota.

Trecento giorni all'anno sono tanti da premere a mano, quindi accanto ad
*Avanza* c'è **Al weekend**: salta ai giorni che contano e si ferma appena
succede qualcosa.

### Allenamento

Quattro categorie — `simulator`, `fitness`, `engineering`, `media` — e **una o due sessioni a settimana**, decise dal calendario. Con una sola sessione in un weekend di gara, sceglierne una significa rinunciare alle altre tre: è la forma più pura che può prendere questa decisione.

Lo staff non regala punti: **alza i tetti**. Il coach aggiunge una sessione di simulatore, il preparatore una sessione al monte totale. Un ingaggio che cambia una regola vale più di uno che cambia un numero.

#### Cosa è cambiato quando le sessioni sono passate da dieci a una

Ridurle ha rotto tre cose, tutte trovate misurando e non leggendo.

**L'IA allenava sempre la stessa cosa.** `aiTrainingPlan` riempiva le categorie in ordine di preferenza finché il monte reggeva. Con dieci sessioni ne copriva tre e nessuno se ne accorgeva; con una, un pilota giovane allenava il simulatore ventiquattro settimane di fila e non toccava **mai** freddezza e partenze. La griglia si riempiva di piloti squilibrati e l'overall medio crollava di dieci punti in quarant'anni. Ora la sessione ruota con quote fisse (40/30/20/10 sulla lista di preferenza): il punto di partenza del giro è la scelta della settimana.

**La stanchezza era diventata un meccanismo morto.** Con una o due sessioni nessuno si stancava più, e una settimana di gara risultava la più riposante dell'anno — l'esatto contrario della realtà. Mancava il pezzo ovvio: **correre stanca**. Ora un Gran Premio costa `RACE_FATIGUE`, ed è quel numero a rendere la pausa estiva una cosa che si aspetta invece di una riga sul calendario.

**Il piano del giocatore poteva far crashare il gioco.** Il piano sopravvive da una settimana all'altra, le capienze no: un piano da due sessioni arrivava intatto al weekend di gara, che ne concede una, e `validatePlan` lanciava un'eccezione — schermo nero. Ora `clampPlan` lo riporta dentro i limiti invece di rifiutarlo.

Dopo le tre correzioni la scala di crescita è stata ritarata da 3 a 16 misurando su sei semi: la griglia perde 3.9 punti di overall in quarant'anni contro i 4.3 di prima, l'età media resta a 27, e tutte le metriche di bilanciamento restano in banda.

Una cosa però è cambiata e vale la pena saperlo: **il valore dello staff si è spostato in avanti**. Con la crescita più concentrata si arriva prima vicino al tetto, e vicino al tetto ogni moltiplicatore conta meno. Su un talento da 91 di potenziale lo staff vale **+4.8 punti a vent'anni** e +2.4 a ventisette — cioè conta di più quando stai lottando per un sedile, che è quando serve davvero.

### I minigiochi

Tre esercizi, tre verbi diversi: **memorizzare**, **reagire**, **mantenere**.

| Minigioco | Verbo | Allena | Nel motore di gara |
|---|---|---|---|
| **Sequenza luci** (tavola Batak) | memorizzare | concentrazione | errori negli stint lunghi e sotto pressione |
| **Semaforo di partenza** | reagire | riflessi, partenze | posizioni guadagnate al via |
| **Banda termica** | mantenere | gestione gomme | degrado, e quindi la strategia |

Tre regole che li rendono sostenibili in un gestionale:

1. **Il minigioco modula, non decide.** La crescita avviene comunque; il risultato vale un moltiplicatore fra **0.85× e 1.30×**. Giocare bene conta, giocare male costa poco.
2. **La difficoltà scala con l'attributo.** La sequenza è lunga `3 + attributo/15`; la finestra di reazione si stringe man mano che i riflessi migliorano. Non si può macinare, e la difficoltà *è* la barra dell'attributo letta con le dita.
3. **Sempre saltabile.** L'allenamento automatico rende 0.95× garantito.

Il minigioco della settimana **non è casuale**: è quello della categoria in cui hai messo più sessioni, e non può ripetersi due settimane di fila (`pickMinigame`). Così è la conseguenza di una tua scelta, e il divieto di ripetizione ti spinge a ruotare anche l'allenamento.

> **Attenzione in fase di implementazione UI:** il risultato va scritto nel salvataggio **quando la partita inizia**, non quando finisce. Altrimenti basta chiudere l'app dopo una partita andata male per rigiocarla, e l'intero bilanciamento salta.

---

## I contratti si firmano, non si subiscono

Gli altri diciannove piloti vengono assegnati d'ufficio dal mercato. Il
giocatore no: quando il contratto scade riceve **fino a tre offerte** e sceglie
lui. Finché non firma, il suo sedile resta vuoto e la stagione non riparte —
l'interfaccia apre da sola la schermata e disabilita il pulsante che fa passare
il tempo.

Perché questo non lasci buchi in griglia, le scuderie interessate **tengono un
posto libero** durante il mercato, e i posti rimasti si riempiono nell'istante
in cui il giocatore firma. Una squadra di coda offre sempre: restare senza
sedile a vent'anni sarebbe una fine di carriera decisa da un tiro di dado.

`npm run check:offers` verifica il flusso: nel gioco quelle schermate compaiono
solo dopo due o tre stagioni, quindi il mondo viene fatto avanzare dal motore,
iniettato nel salvataggio e controllato nell'interfaccia.

## I salvataggi sopravvivono agli aggiornamenti

Il mondo è un oggetto che cresce a ogni funzione nuova: `offers` non esisteva
prima dei contratti, `talentAnchor` prima dell'anti-inflazione, `short` sulle
scuderie prima delle colonne strette. Un salvataggio scritto prima non li ha, e
leggerli manda in crash l'app all'avvio — **schermo nero, senza un modo per
uscirne**. È successo davvero.

Due difese, entrambe necessarie:

- **`engine/migrate.ts`** riempie i campi mancanti quando il salvataggio viene
  riletto. Una carriera iniziata con una versione precedente riprende dalla
  settimana in cui era rimasta, non da zero. Quando il salvataggio è troppo
  rovinato per essere recuperato la funzione restituisce `null` e l'app riparte
  dalla creazione della carriera, invece di rompersi.
- **`ui/shell/ErrorBoundary.tsx`** intercetta qualunque eccezione in fase di
  render e mostra il messaggio con un pulsante per cancellare il salvataggio.
  Senza, un'eccezione smonta l'albero di React e lascia una pagina vuota.

Regola che ne segue: **ogni campo nuovo del mondo vuole una riga in
`migrateWorld` e un incremento di `SAVE_VERSION`.**

`npm run check:migration` riproduce il difetto vero — carica un salvataggio
senza `offers` e verifica che la carriera riprenda — e controlla anche che la
rete di sicurezza scatti su un salvataggio corrotto, così non resta codice
morto.

## L'albero delle abilità

È il posto dove finisce quello che un pilota impara correndo, e che nessun
allenamento settimanale può dare: non punti in più ma **regole diverse**. Un
nodo alza un tetto, uno cambia il degrado delle gomme, uno rende un sorpasso
più probabile, uno fa sì che il muretto ascolti quando parli.

### Quattro aree, tre di guida e una di mestiere

| Area | Cosa tocca |
|---|---|
| **Passo** | velocità pura, qualifica, sorpasso |
| **Macchina** | degrado gomme, guida sul bagnato, assetto |
| **Testa** | riflessi al via, freddezza, costanza, recupero |
| **Carriera** | stampa, sponsor, ingaggi, rapporto con gli ingegneri |

Un pilota non è solo uno che guida, e un albero che dimenticasse quella metà
racconterebbe metà carriera. L'area **Carriera** non dà niente in pista in
modo diretto: dà fama più in fretta, sponsor personali, ingaggi più ricchi, e
— il nodo che preferisco — un riscontro tecnico che fa sviluppare la
monoposto più in fretta a tutta la scuderia. È l'unico modo che un pilota ha
di migliorare la macchina, ed è vero anche nella realtà.

### È un grafo, non una fila

Ogni area ha un nodo di base da cui partono **due strade**, e in fondo un
nodo che chiede di aver percorso **entrambi** i rami interni. È la forma che
rende la scelta costosa: puoi prendere in fretta la punta di un ramo, o
andare largo e arrivare al nodo finale molto più tardi.

I collegamenti sono disegnati in SVG sotto i nodi, quindi un nodo che chiede
due rami si riconosce subito — ha due fili che vi arrivano. La schermata
mostra **un'area alla volta**: quattro grafi affiancati in 780 px
diventerebbero quattro colonne di pallini senza fili leggibili, e i fili
*sono* la regola. Le schede in alto dicono quanto manca in ciascuna area, così
cambiare scheda non è cercare al buio.

Un test verifica che ogni area abbia una sola radice, che ogni nodo sia
raggiungibile da lì, che nessun filo esca dall'area e che ogni filo vada
verso il basso — cioè che il grafo non abbia anelli.

### I punti li dà il mestiere, non il palmarès

Uno ogni cinque gare, uguale per tutti, più tre per ogni titolo. Al primo
tentativo li avevo legati ai risultati — due per una vittoria, uno per un
podio — e sembrava ovvio. In quarant'anni di simulazione produceva una
**dinastia**: chi vince prende più punti, sblocca più nodi, vince di più. Il
test `nessun mondo si congela su una sola scuderia` l'ha preso al primo colpo.

Vincere paga già in macchina migliore e contratti migliori: non deve pagare
anche qui. L'albero intero costa 74 punti e una stagione ne dà quattro o
cinque: una carriera lunga arriva a completarlo, ma solo quella. Chi smette a
trent'anni deve scegliere che pilota diventare.

I piloti gestiti dal computer spendono i loro punti da soli, sull'area in cui
sono già forti, prendendo sempre il nodo disponibile più economico. Non è la
strategia migliore possibile ed è voluto: se l'IA giocasse l'albero meglio del
giocatore, l'albero non sarebbe una scelta ma un compito. Ma **spendere deve
spenderli** — ogni decisione del giocatore ha una sua versione IA, o la
griglia resterebbe indietro rispetto a chi è al volante di una persona.

Gli effetti entrano nel motore da pochi punti precisi: `effectiveCap` per i
tetti e la crescita, `buildEntries` per tutto quello che conta in gara,
`offeredSalary` e `settleFinances` per i soldi, `developCars` per il
riscontro tecnico. Il modello di gara lavora sugli ingressi, non sui piloti,
quindi non deve sapere che l'albero esiste.

---

## Soldi e staff personale

L'ingaggio non è un numero di vanità: è la risorsa che finanzia la tua crescita. È questo che trasforma la schermata dei contratti nella più importante del gioco.

| Offerta | Il ragionamento |
|---|---|
| Nordvik, 1.2 M, prima guida | corri sempre, ma ti permetti poco staff: cresci piano |
| Aurora, 2.0 M, seconda guida | staff migliore, cresci in fretta — ma resti dietro al compagno |
| Mirage, 2.4 M, prima guida | il massimo… se il progetto non fallisce |

**Entrate**: ingaggio, bonus (15 k a punto, 150 k a podio, 400 k a vittoria) e sponsor personali legati alla **reputazione**, non ai risultati.
**Uscite**: stipendi dello staff, percentuale del procuratore (5–13 %), spese fisse (15 % del lordo).

### La regola che impedisce il disastro

Soldi → crescita → risultati → più soldi è un anello che si autoalimenta: alla sesta stagione saresti imbattibile e il gioco finirebbe. Si spezza **per costruzione**:

> **Il potenziale è fissato alla nascita del pilota e nessuno staff lo alza. Lo staff cambia solo la velocità con cui ci arrivi.**

```ts
crescita = base
         × f(qualitàStaff)          // 1.00 → 1.40 al massimo teorico
         × curvaEtà(età)            // dopo i 32 è zero, qualunque cosa tu spenda
         × moltiplicatoreMinigioco  // 0.85 → 1.30
         × (cap − attuale)          // ← il freno vero: si azzera al tetto
```

Uno staff di primo livello ti porta al tuo tetto a 24 anni invece che a 28: quattro stagioni di prime in più, enormi ma **limitate**. E un pilota con potenziale 78 resta un pilota da 78.

Due freni secondari: **costo superlineare, effetto sublineare** (`staffPrice` cresce con `quality^3.1`) e la **reputazione come cancello** — i professionisti migliori rifiutano un pilota sconosciuto a qualunque cifra (`minReputation`).

---

## La gara che si gioca

Il weekend si ferma sulla **griglia di partenza**: lì si vede la qualifica, si
sceglie la gomma di partenza e si decide se correre o simulare. Poi la pista.

| Elemento | Cosa fa |
|---|---|
| **Tracciato** | vista dall'alto, una vettura per puntino. È atmosfera: dà contesto, non numeri |
| **Velocità** | si misura in **giri al secondo**, non in «×». «Un giro al secondo» si capisce; «otto volte più veloce» dipende da quanto è lungo il giro |
| **Rallenta da sola** | ai box (4 secondi di gara al secondo reale: venti secondi di sosta diventano cinque veri), e nei momenti che chiedono una decisione |
| **Torre dei tempi** | chi è davanti a chi, distacco dal leader. Segue il giocatore invece di lasciarlo fuori schermo |
| **Striscia dei distacchi** | i secondi dal leader su una scala. È la vista funzionale: il trenino, chi si stacca, l'undercut |
| **Comandi** | mescola e box, modalità motore, attacco quando sei entro un secondo |
| **Velocità** | pausa, 1×, 4×, 8×, più «simula il resto» |

**Il gioco rallenta da solo.** Quando entri in zona DRS, quando sei sotto
attacco, quando le gomme sono finite o esce la safety car, la simulazione torna
a 1× e compare la fascia gialla: è ciò che rende guardabile una gara da 53 giri
senza chiedere di stare sempre sul pezzo.

I dodici circuiti non sono disegnati a mano: la forma nasce dal seed del
tracciato (`ui/race/trackPath.ts`), con più curve dove si sorpassa poco. Sempre
uguale per lo stesso autodromo, diversa da tutti gli altri, zero file da
mantenere.

Gli eventi di gara sono **dati, non frasi**: il motore emette `{kind, drivers}`
e l'interfaccia compone il testo. La simulazione non conosce i nomi dei piloti
né la lingua.

## Il modello, a livelli

Le formule non stanno più dentro la simulazione: vivono in moduli che si
leggono, si testano e si tarano uno alla volta.

```
curves.ts       sigmoidi, curve di età, rendimenti decrescenti
   ↓
progression.ts  crescita settimanale del pilota
tyres.ts        degrado a tre fasi e finestra termica
overtaking.ts   probabilità di sorpasso, modello logistico
incidents.ts    errore del pilota e guasto, contati separatamente
   ↓
race.ts         mette insieme il tempo sul giro
   ↓
simulateRace()  a risoluzione di giro   ·   liveRace.ts  a risoluzione di tick
   ↓
balance.ts      le metriche per sapere se tutto questo funziona
```

### Crescita del pilota

Un prodotto di fattori indipendenti, ognuno con un solo compito, così il
bilanciamento si fa spostando un numero alla volta:

```
crescita = baseGain(attributo)
         × difficoltàMarginale(gap)     ← gap^1.6: gli ultimi punti sono proibitivi
         × curvaEtà(età, picco)         ← un picco per attributo, non uno solo
         × efficienzaStaff              ← con rendimenti decrescenti
         × carico × penalitàSovrallenamento
         × penalitàStanchezza × morale
         × minigioco × rumore
```

**Ogni attributo ha il proprio picco.** I riflessi se ne vanno a ventisei anni,
il feedback tecnico cresce fino a trentatré. Un trentaquattrenne non è un
ventiseienne peggiore: è un pilota diverso, e l'**esperienza** — che sale sempre
e non cala mai — gli restituisce fino a otto centesimi al giro.

Il tetto non è un `if`: emerge da `difficoltàMarginale`, che a un decimo dal
potenziale vale già un quarantesimo. Nessuno raggiunge davvero il proprio
potenziale — ci si avvicina, e quanto ci si avvicina lo decide lo staff.

La scala è tarata sulla curva di carriera, non a occhio: **un diciottenne con
potenziale 91 arriva a 81 da solo e a 87 con uno staff di livello**, in entrambi
i casi attorno ai ventisette anni. Quei sei punti sono ciò che lo staff vale.

Anche i piloti gestiti dal computer hanno chi li segue: non uno staff da
gestire, ma l'`entourage` della loro scuderia, proporzionato al prestigio. Ne
esce un gradiente che il giocatore sente — un sedile in un top team non porta
solo una macchina migliore.

### Gomme: tre fasi e un crollo

Il degrado non è una parabola. È piatto fino al 40% di usura, quadratico fino
al 70%, poi **crolla**. È quel crollo a rendere la scelta di quando fermarsi una
decisione invece di un calcolo. La finestra termica (60–80 °C) è il gancio del
minigioco "banda termica": lì il giocatore pilota a mano la stessa variabile.

### Sorpassi: modello logistico

La formulazione additiva precedente poteva produrre probabilità negative o
maggiori di uno. Una sigmoide sta sempre fra 0 e 1 e ha coefficienti che si
leggono uno per uno: il distacco pesa più di tutto, poi il passo, poi la
differenza di abilità; la difficoltà del circuito sottrae.

## La forma del circuito

In Formula 1 non esiste «la macchina più veloce»: esiste la macchina più
veloce *su quel tracciato*. Monza premia la potenza, Monaco la trazione,
Silverstone il carico aerodinamico. Finché il passo della monoposto è stato un
numero solo, una scuderia che sviluppava l'ala andava forte ovunque, e il
campionato perdeva la cosa che lo rende interessante — che certi circuiti
stanno a pennello a certe macchine.

Un tracciato è quindi descritto da **come si spende un giro**: quanta parte in
rettilineo, quanta nelle curve lente, medie e veloci. Le quattro frazioni
sommano a uno — e non sono indovinate, sono **misurate sulla geometria reale**
dei tracciati del mondiale.

```ts
layout: { straight: 0.48, slow: 0.18, medium: 0.22, fast: 0.12 }   // di potenza
layout: { straight: 0.16, slow: 0.48, medium: 0.28, fast: 0.08 }   // fra i muretti
```

Ogni tipo di settore ha un profilo — il rettilineo è quasi tutto motore, la
curva veloce quasi tutta ala, la lenta soprattutto telaio — e i pesi di una
monoposto sono la media pesata sui settori del giro. **Sommano sempre a uno**,
quindi un tracciato non rende le macchine più veloci in assoluto: cambia solo
*quale* macchina è veloce. Un test lo verifica: una monoposto media vale 80
ovunque, ma una da 95 di motore guadagna sei punti di passo — mezzo secondo
al giro — passando da Monaco a Monza.

### Misurata, non indovinata

Le forme vengono da [`bacinger/f1-circuits`](https://github.com/bacinger/f1-circuits)
(geometria derivata da OpenStreetMap, © i contributori OSM, ODbL), passata per
[`tools/derive-layouts.py`](tools/derive-layouts.py). I nomi restano inventati
— «Formula 1» e i nomi degli autodromi sono marchi — ma Lario ha il 66% di
rettilineo perché Monza ce l'ha, e Vallmar il 58% di curve lente perché Monaco
ce l'ha.

Il procedimento usa **due misure diverse**, e il motivo è istruttivo. La
geometria ha un punto ogni ~36 metri: a quella densità una curva è
approssimata da una corda, quindi il raggio calcolato punto per punto
sottostima *sempre* la curvatura. Preso alla lettera diceva che a Marina Bay
si va dritti per il 75% del giro, il che è falso.

Due grandezze invece reggono al campionamento grossolano:

| Misura | Cosa regge | Cosa ne esce |
|---|---|---|
| **gradi/km** — rotazione totale sulla lunghezza | non dipende dalla densità dei punti | la frazione di rettilineo |
| **distribuzione dei raggi** | sbaglia i valori assoluti ma coglie il *tipo* di curva | la ripartizione lenta/media/veloce |

Monza esce a 171 gradi/km, Monaco a 641. Losail ha curvoni e zero tornanti,
l'Hungaroring il contrario. Sono i caratteri giusti, e nessuno li ha scritti
a mano.

### Quattro numeri che ne eliminano due

Sorpassi e degrado non si scrivono più a mano: **discendono dalla forma**.

Erano due valori autorevoli per ogni circuito e potevano contraddire il
tracciato che dicevano di descrivere — un circuito di soli rettilinei con i
sorpassi impossibili. Ora la forma è il dato e quelli sono la conseguenza:
cambiare la forma cambia tutto insieme, in modo coerente.

| Quantità | Da cosa discende |
|---|---|
| **Sorpassi** | rettilinei (scia e staccata) e larghezza della pista, meno le curve medie in sequenza |
| **Degrado gomme** | carico laterale: le curve veloci mangiano le gomme, i rettilinei no |
| **Peso del pilota** | 0.62× su un tracciato di solo gas, 1.34× fra i tornanti |

La **larghezza** è l'unico numero che ho aggiunto a mano, e ci è voluto un
errore per capirlo: al primo tentativo avevo dedotto i sorpassi dalla sola
forma, e i cittadini risultavano *facili* — hanno tante curve lente, cioè
tante staccate. Ma la ragione vera per cui a Monaco non si passa non è la
velocità delle curve: è che non c'è dove mettere la macchina. La larghezza è
un fatto del posto, non una manopola di bilanciamento, ed entra come
moltiplicatore: fra i muretti nemmeno il rettilineo più lungo basta.

### L'errore che ha congelato il campionato

La prima versione pesava gli attributi del pilota secondo la forma, e per
farlo diluiva la velocità pura fra sensibilità tecnica e freddezza. Sembrava
più ricco. In quarant'anni di simulazione una scuderia vinceva **trentasei
titoli su quaranta**.

Il motivo: nella griglia la velocità è l'attributo con più varianza, mentre
sensibilità e freddezza si assomigliano molto fra piloti. Diluirla ha
appiattito le differenze fra piloti, e quando il pilota non fa differenza
decide solo la macchina — cioè vince sempre la stessa. Rimesso il peso della
velocità dov'era, lo stesso seme è passato da 36 titoli a 14.

La forma del tracciato deve **spostare** il peso, non appiattire le
differenze. È una distinzione che si vede solo misurando, e un test la
difende: su quattro forme diverse, la velocità resta sempre il guadagno
maggiore, ma la sensibilità tecnica rende di più fra i muretti che in
rettilineo.

---

## La qualifica, tre decisioni

Un giro secco non si guida a comandi: si prepara. Quello che un pilota decide
davvero è **quando uscire**, **su che gomma** e **come scaldarla**, e poi il
giro è la conseguenza di quelle tre scelte più il talento.

| Decisione | Il guadagno | Il prezzo |
|---|---|---|
| **Ultimo momento** | pista gommata al massimo | traffico e bandiere, e non dipende da te |
| **Soft** | mezzo secondo | una sola occasione buona, e usura in gara |
| **Lancio spinto** | gomme nella finestra perfetta | le paghi nel primo stint |

Nessuna ha una risposta giusta, e quanto rischio convenga dipende da dove si
corre: la schermata mostra la difficoltà dei sorpassi di quel tracciato,
perché su un cittadino la pole vale una gara e su una pista di potenza molto
meno.

Gli attributi non spostano il giro qui — quello lo fa già il modello di gara —
ma decidono **quanto bene riesce ogni scelta**: la sensibilità tecnica serve a
scaldare le gomme, la freddezza a non buttare il giro quando la pista è
affollata.

### Rischiare deve convenire

Al primo tentativo uscire tardi guadagnava due decimi e rischiava di perderne
un secondo: valore atteso negativo, cioè non una scelta ma un errore. E i
piloti IA con la macchina lenta — quelli che *devono* rischiare — ci
rimettevano sempre, allargando il divario da soli: il test sul congelamento
del campionato l'ha preso subito.

Ora perdere il giro costa tre-nove decimi, non un secondo, e ogni opzione
rischiosa ha valore atteso migliore della prudenza. Un test lo verifica
mediando quattromila estrazioni per ciascuna delle tre decisioni — perché una
scelta si giudica sul valore atteso, non su un tiro.

---

## La gara, due cadenze

Un solo modello, due cadenze. `race.ts` definisce le formule — tempo sul giro,
degrado, sorpasso, ritiro, sosta — e le usano sia `simulateRace()` a
**risoluzione di giro**, per simulare stagioni intere da riga di comando, sia
`liveRace.ts` a **risoluzione di tick**, per la gara che il giocatore guarda e
in cui interviene. Le formule stanno scritte una volta sola.

`simulateRace()` lavora a **risoluzione di giro**. Nessuna fisica: si calcola un tempo sul giro per vettura, lo si accumula e si risolvono aria sporca e sorpassi con un modello probabilistico.

```
tempoGiro = baseCircuito
          + (100 − passoMacchina) × 0.092      ← la macchina pesa il doppio del pilota
          + (100 − abilitàPilota) × 0.030
          + mescola + degrado² + carburante
          + aria sporca (se sei entro 1.0 s)
          + pioggia
          + rumore ∝ (100 − costanza)
```

Ogni giro, dopo l'aggiornamento dei tempi: se il distacco scende sotto **0.42 s** si tira il dado del sorpasso, pesato sul delta di passo e sulla difficoltà del circuito; se fallisce, l'inseguitore resta incollato e perde 0.22 s di aria sporca.

Ritiri: guasto meccanico ∝ affidabilità della monoposto, errore umano ∝ costanza, raddoppiato sul bagnato e con gomme finite. Il risultato misurato è **8–11 % per gara**, in linea con la Formula 1 moderna.

Lo stesso motore alimenta l'interfaccia giro per giro e la simulazione di quarant'anni da riga di comando.

---

## Le regole che tengono in piedi il bilanciamento

Ognuna nasce da un problema osservato, non da un'intuizione.

| # | Regola | Perché | Dove |
|---|---|---|---|
| 1 | Lo staff compra tempo, non talento | spezza l'anello soldi → crescita → risultati | `staff.ts`, `training.ts` |
| 2 | Handicap di sviluppo inverso alla classifica | chi vince sviluppa meno, come le ore di galleria del vento in F1 | `regulations.ts` |
| 3 | Budget cap comune | senza, la scuderia ricca al primo anno resta ricca per sempre | `regulations.ts` |
| 4 | Il prestigio segue i risultati | altrimenti il mercato premia in eterno chi era forte alla creazione | `regulations.ts` |
| 5 | Mobilità nel mercato piloti | il prestigio decide chi sceglie per primo, ma non da solo | `market.ts` |
| 6 | La macchina pesa il doppio del pilota | è la Formula 1, non i kart | `race.ts` |
| 7 | Ancoraggio del potenziale | i record delle prime stagioni devono continuare a valere | `market.ts` |
| 8 | Reset regolamentare ogni 4–6 anni | rimescola la gerarchia; senza, il gioco muore entro la decima stagione | `regulations.ts` |
| 9 | Anti-inflazione a controllo integrale | una correzione proporzionale lascia un errore permanente: al volante arrivano i migliori del bacino | `market.ts` |
| 10 | Difficoltà marginale `gap^1.6` | il potenziale è un asintoto, non una destinazione | `curves.ts` |
| 11 | Sovrallenamento e stanchezza | senza, l'ottimo è sempre "tutto al massimo, tutte le settimane" | `progression.ts` |
| 12 | Entourage dei piloti IA | altrimenti solo il giocatore cresce, e la griglia si svuota di talento | `staff.ts` |

Le regole 2–6 sono state aggiunte **dopo** la prima simulazione a 40 stagioni, che aveva dato 29 titoli su 40 a una sola scuderia. Il test `nessuna scuderia monopolizza il campionato` impedisce alla regressione di tornare.

---

## Struttura del progetto

```
src/
  App.tsx           instrada le schermate, gestisce l'avanzamento della settimana
  state/useGame.ts  store zustand + persist: sposta dati, non decide nulla
  ui/
    shell/          rail di navigazione, barra di stato, blocco orientamento
    components/     primitive (Panel, Stat, Bar, Btn, Note)
    screens/        Paddock, Pilota, Allenamento, Calendario, Finanze,
                    Scuderia, Contratti, Classifiche, Storia, overlay di fine
                    weekend e di fine anno
    race/           griglia di partenza, tracciato, torre dei tempi, striscia
                    dei distacchi, comandi, forma procedurale del circuito
  state/raceSession.ts  la gara in corso, fuori dallo store: contiene il
                    generatore casuale, che non è serializzabile
engine/
  rng.ts            generatore deterministico, fork etichettati, clamp
  types.ts          modello dati completo del mondo
  driver.ts         creazione, newgen, overall, curve di età, ritiro
  staff.ts          staff personale, prezzi, moltiplicatore di crescita
  calendar.ts       calendario della stagione: date vere, gare, pause, capienza
  layout.ts         la forma del giro: settori, pesi della monoposto, derivate
  qualifying.ts     le tre decisioni del sabato e il loro prezzo
  roles.ts          quanto un pilota vale in ciascun mestiere del weekend
  skills.ts         l'albero delle abilità: nodi, punti, effetti
  days.ts           la settimana giorno per giorno: attività, giorno di bilancio
  training.ts       sessioni, tetti, scelta del minigioco, applicazione crescita
  curves.ts         sigmoidi, curve di età, rendimenti decrescenti
  progression.ts    crescita settimanale, sovrallenamento, stanchezza
  tyres.ts          degrado a tre fasi, finestra termica
  overtaking.ts     probabilità di sorpasso a modello logistico
  incidents.ts      errore del pilota e guasto meccanico
  balance.ts        metriche di bilanciamento con bande obiettivo
  migrate.ts        recupera i salvataggi scritti da versioni precedenti
  race.ts           il modello: formule di gara, gara veloce, qualifica
  liveRace.ts       la stessa gara avanzata a passi, con i comandi del giocatore
  regulations.ts    sviluppo monoposto, handicap, budget cap, prestigio, reset
  market.ts         valore di mercato, ingaggi, mercato piloti, finanze
  season.ts         weekend, classifiche, aggregati storici
  world.ts          createWorld, advanceDay, advanceWeek, endSeason, simulateSeason
  data/
    tracks.ts       31 circuiti: forma del giro, larghezza, regione, fuso, orari
    teams.ts        5 scuderie, palette validata per daltonismo
    names.ts        bacino di nomi per la rigenerazione annuale
tests/              132 test: rng, curve e modelli, gara, gara live,
                    allenamento, mondo, contratti, migrazione
tools/simulate.ts   simulatore da riga di comando
tools/screenshots.mjs  schermate a 844×390 + tre controlli di impaginazione
tools/check-palette.mjs contrasti, separazione fra tinte, daltonismo
tools/check-offers.mjs verifica il flusso delle offerte di contratto
tools/check-migration.mjs  carica un salvataggio vecchio e uno corrotto
```

### Perché i nomi sono di fantasia

«Formula 1», i nomi delle scuderie e quelli dei piloti sono marchi protetti. Team e piloti sono inventati; i circuiti sono parametrizzati sui valori reali (giro 70–105 s, 44–71 giri) ma con nomi e disegni propri. È la stessa scelta di *Motorsport Manager*, e permette di pubblicare sugli store senza problemi.

### La palette

Il gioco è **chiaro**, sul rosso e bianco di GridUP. Il fondo è grigio
chiarissimo e non bianco pieno, così le schede bianche si staccano senza
bordi pesanti. Il rosso di marca è l'unico rosso che significa *premi qui*.

Tutti i colori stanno in [`src/theme.js`](src/theme.js), letto da tre
consumatori: `tailwind.config.js` per le classi, `src/ui/palette.ts` per quel
che si disegna con `style` (barre, pallini SVG, pip) e
`tools/check-palette.mjs` per verificarli. Prima i colori "a mano" vivevano
sparsi nei componenti, e cambiare tema ne lasciava indietro metà.

Gli otto colori delle scuderie non sono decorativi: sono anche i colori delle
barre in tutte le classifiche, quindi devono funzionare come palette
categorica. `npm run check:palette` verifica quattro cose:

1. contrasto di ogni tinta sul pannello bianco ≥ 4.5:1, così il testo bianco
   sopra è sempre leggibile;
2. nessuna scuderia troppo vicina al rosso di marca;
3. separazione ΔE ≥ 9 fra tutte le coppie, in visione normale **e** in
   protanopia, deuteranopia e tritanopia;
4. che `src/engine/data/teams.ts` non sia divergente dal tema — il motore
   porta il colore nel salvataggio e non può importare la presentazione,
   quindi le due liste vanno confrontate invece che condivise.

Il controllo non è cerimoniale: lanciato sulla vecchia palette scura ha
trovato **tre coppie indistinguibili** che la documentazione dava per
validate. Otto tinte categoriche che sopravvivono a tre dicromazie stanno al
limite del possibile — il margine più stretto è ΔE 9.9 contro un minimo di 9
— quindi non si toccano a occhio: si cambia un valore e si rilancia.


## Comandi

```bash
npm test               # vitest, 132 test
npm run test:watch
npm run typecheck      # tsc --noEmit, strict
npm run sim            # 40 stagioni, riepilogo
npm run sim:long       # con il dettaglio anno per anno
npm run sim -- --seasons 100 --seed 7 --verbose
```

### Usare il motore

```ts
import { createWorld, advanceWeek, endSeason, SEASON_WEEKS } from './src/engine/index.js';

const world = createWorld({ seed: 20260921, seat: { mode: 'pilota', driverId: 'dXYZ' } });

while (world.week < SEASON_WEEKS) {
  const report = advanceWeek(world, {
    plan: { simulator: 4, fitness: 3, engineering: 2, media: 1 },
    minigameScore: 0.78,          // 0–1; assente = allenamento automatico
  });
  if (report.minigame) console.log('minigioco della settimana:', report.minigame);
  if (report.raceRun)  console.log('gara corsa a', report.raceRun);
}

const summary = endSeason(world);   // campione, ritiri, newgen, reset regolamentare
```

---

## Cosa manca

**Fatto** — la Modalità Pilota è navigabile:

- [x] Vite + React + TypeScript + Tailwind, layout orizzontale
- [x] Hub: Paddock, Pilota, Allenamento, Calendario, Finanze, Scuderia, Contratti, Classifiche, Storia
- [x] Il tempo scorre a giorni: *Avanza* di ventiquattro ore, *Al weekend* per saltare ai giorni che contano
- [x] Ciclo settimanale completo: allenamento → weekend → fine stagione
- [x] Calendario ricalcato su quello vero: date reali, giro del mondo per regioni, triple header, pausa d'agosto, orari locali e italiani
- [x] Salvataggio automatico con Zustand `persist`, con migrazione dei salvataggi vecchi

- [x] Vista gara: griglia, tracciato SVG, torre dei tempi, striscia dei distacchi, strategia

**Prossimo passo**:

- [ ] I tre minigiochi in React, con il risultato scritto all'avvio della partita
- [ ] Libere: la direzione di assetto
- [x] Albero delle abilità, dal profilo pilota
- [x] Qualifica giocabile: le tre decisioni del sabato
- [x] Forma dei circuiti misurata sulla geometria reale
- [ ] Mercato dello staff personale (il motore c'è già, manca la schermata)
- [ ] Slot di salvataggio multipli

**Poi**:

- [ ] Modalità Scuderia (interfaccia sui sistemi che il motore ha già)
- [ ] Livree come dati: pattern procedurali, editor, codice condivisibile
- [ ] Personaggio a strati e casco 3D (three.js) — l'unica schermata WebGL
- [ ] Momenti pre-renderizzati: garage, podio, firma del contratto
- [ ] Ingegnere personale, addetto stampa, analista dati (staff che dà informazioni invece di statistiche)
- [ ] Meteo dinamico in gara e gomme da bagnato
- [ ] Build Android con Capacitor

---

## Mockup di riferimento

I tre prototipi che hanno definito il gioco prima della prima riga di motore:

- **Vista gara** — tracciato, torre dei tempi, striscia dei distacchi, strategia
- **Hub carriera** — le sette schede, finanze e staff personale
- **Sala allenamento** — i tre minigiochi giocabili

Sono prototipi HTML autonomi, con dati inventati: servono al confronto visivo, non sono codice di produzione.

---

## Licenza

Progetto personale. Team, piloti e circuiti sono opere di fantasia e non rappresentano persone, scuderie o autodromi reali.
