# F1 Manager

Gestionale di Formula 1 per browser e Android. **Fondi una scuderia** — nome,
colori, il capitale che ti sei procurato — e la porti dall'ultima fila del
paddock a vincere. Sviluppi la monoposto a progetti di reparto, ingaggi e fai
crescere i piloti, e la domenica la gara si corre dal vivo, vista dall'alto in
2D: non guidi, **decidi**.

> **Stato: giocabile dall'inizio alla fine.** Si fonda la scuderia, si ingaggia,
> si sviluppa, si corre, si chiude la stagione e si ricomincia. Il mondo gira
> anche da riga di comando — 40 stagioni in ~300 ms — ed è lì che si verifica
> che regga.

> **C'era anche una Modalità Pilota**, in cui si guidava una carriera invece di
> una squadra. È stata tolta: due modalità significavano due interfacce e due
> insiemi di decisioni sopra lo stesso motore, e nessuna delle due arrivava in
> fondo. I salvataggi di allora non si perdono — chi li apre prende in mano la
> scuderia del pilota che guidava.

---

## Indice

- [L'idea](#lidea)
- [Provalo subito](#provalo-subito)
- [Architettura: perché il motore viene prima](#architettura-perché-il-motore-viene-prima)
- [La scuderia: fondarla e tenerla in piedi](#la-scuderia-fondarla-e-tenerla-in-piedi)
- [Lo sviluppo a progetti di reparto](#lo-sviluppo-a-progetti-di-reparto)
- [Il mondo infinito](#il-mondo-infinito)
- [Il calendario della stagione](#il-calendario-della-stagione)
- [La settimana di gioco](#la-settimana-di-gioco)
- [L'albero delle abilità](#lalbero-delle-abilità)
- [Il modello di gara](#il-modello-di-gara)
- [La carriera, tarata sui mondiali veri](#la-carriera-tarata-sui-mondiali-veri)
- [La forma del circuito](#la-forma-del-circuito)
- [Il regolamento](#il-regolamento)
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
| **Monoposto** (Marco Pesce) | la profondità della simulazione, la strategia vera |
| **F1 Clash** | la cura dell'interfaccia e il feedback immediato — **non** il gacha |
| **Soccer Manager** | la struttura a schede, il database navigabile, il gioco che non finisce mai |

Il vuoto che riempiono male tutti e tre: **un gestionale single player profondo, con una presentazione moderna e senza meccaniche predatorie.**

La gara è piatta: tracciato dall'alto in SVG, vetture come forme semplici, torre dei tempi e striscia dei distacchi. Niente 3D in pista. Il 3D compare solo nei momenti da schermata — garage, podio, firma del contratto — ed è **pre-renderizzato in Blender**, non calcolato a runtime. L'unica eccezione è l'editor di livree e casco, dove serve WebGL vero.

---

## Provalo subito

```bash
npm install
npm run dev                   # l'app, su http://localhost:5173
npm test                      # 145 test
npm run sim -- --seasons 40 --verbose
npm run check:team            # 10 scuderie fondate da zero × 16 stagioni
```

**Il gioco si tiene in orizzontale.** Se apri l'app su un telefono in verticale
ti chiede di ruotarlo: la torre dei tempi e la pista hanno bisogno di larghezza.

Output reale dell'ultima esecuzione (seed `20260921`), senza nessun giocatore:
il mondo che gira da solo.

```
40 stagioni simulate (2031–2070) in 1796 ms — seed 20260921
==========================================================================
Piloti diversi campioni ............ 16 su 40 stagioni
Scuderie diverse campioni .......... 7 su 8
Deriva a regime (dal 2040) ......... +2.44 punti in 30 anni
Overall medio griglia .............. 77.3 → 75.9
Piloti attivi ...................... 16 → 16
Ritiri per gara .................... 14.7%
Azzeramenti regolamentari .......... 7

Titoli per scuderia:
  Vantar Racing      ██████████████████ 18
  Kestrel Motors     ███████ 7
  Nordvik Squadra    █████ 5
  Brandt Werke       █████ 5
  Scuderia Aurora    ██ 2
  Solaro Corse       ██ 2
  Mirage GP          █ 1
```

Quello che questi numeri dicono: il mondo **non si congela** (sette scuderie
diverse vincono, e Nordvik e Brandt — penultima e terzultima al primo anno —
ne vincono cinque a testa), **non si svuota** (sedici piloti in griglia dopo
quarant'anni) e **non si gonfia** (il livello medio resta ancorato, quindi i
record del 2031 valgono ancora nel 2070). Le scuderie del computer aprono e
chiudono i loro progetti di sviluppo da sole: se non lo facessero, il giocatore
vincerebbe tutto in tre stagioni senza aver deciso niente.

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
| **Paddock** | tre colonne: la tua scuderia e i tuoi piloti · il prossimo weekend e la classifica piloti · i reparti al lavoro e la classifica costruttori. Quello che potrebbe fermarti — un sedile vuoto, un reparto fermo, la cassa agli sgoccioli — compare qui ed è cliccabile |
| **Scuderia** | chi sei (prestigio, personale) · cosa hai (la monoposto voce per voce, con la griglia come tacca) · quanto reggi (cassa e conto della stagione) |
| **Sviluppo** | quattro riquadri, uno per reparto: quanto vali rispetto alla griglia, cosa ci sta lavorando, o i tre progetti che puoi aprirci. Il motivo per cui non puoi è scritto dove premeresti |
| **Piloti** | in alto si sceglie il pilota, sotto il suo piano settimanale a sinistra e gli attributi che si muovono a destra. Da qui si aprono la scheda e l'albero |
| **Scheda pilota** | tre fasce: chi è (nome, contratto, overall e potenziale) · di cosa è fatto (ruoli a stelle, attributi in colonne, anagrafica) · come sta (morale, condizione, forma, **crescita**, stagione) |
| **Abilità** | un'area alla volta come grafo ramificato, schede in alto, dettaglio del nodo scelto in basso |
| **Mercato** | i piloti liberi in tabella, con quanto chiedono **per venire da te** · a destra il foglio dell'offerta, con il pulsante di firma inchiodato in fondo |
| **Calendario** | due viste: griglia mensile a sette colonne, o l'anno intero in tabella · a destra la settimana corrente e il resto della stagione |
| **Bilancio** | entrate · uscite · cassa e **autonomia**: a quanto stai spendendo, quante settimane di lavoro hai davanti |
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

## La scuderia: fondarla e tenerla in piedi

Si entra da **nona scuderia**, che è la posizione più scomoda del paddock: la
griglia passa da sedici a diciotto monoposto e le due nuove sono le più lente
di tutte.

| Cosa hai all'inizio | Valore | Perché |
|---|---|---|
| Monoposto | 64 / 65 / 63, affidabilità 70 | sei punti sotto l'ultima della griglia |
| Prestigio | 14 | nessuno ti conosce, e i piloti se ne accorgono |
| Reparto tecnico | 44 / 42 / 40 | gente brava non lavora ancora per te |
| Piloti | **nessuno** | i sedili li riempi tu, o non prendi il via |
| Cassa | 40, 75 o 120 milioni | è la difficoltà, ed è dichiarata |

La monoposto parte sei punti sotto l'ultima, non dodici. Dodici era il primo
valore, e non funzionava: il bilancio di una scuderia ultima classificata
compra due aggiornamenti all'anno, e con quelli non si recuperano dodici punti
su una griglia che nel frattempo si muove. La sonda mostrava otto stagioni
tutte al nono posto — che non è difficoltà, è l'assenza di un gioco.

### Il capitale iniziale è la difficoltà, e si vede

Niente moltiplicatori nascosti: la scelta è quante settimane di sviluppo ti
puoi permettere prima che comincino a entrare i premi di fine stagione.
**Garagista** (40 M) compra un progetto maggiore e poco altro; **Costruttore**
(120 M) tiene due reparti al lavoro per tutto il primo anno.

### Il mercato, dal lato di chi ingaggia

Nel gioco di prima si aspettavano le offerte. Adesso le si fanno, e la colonna
che decide non è quanto vale un pilota ma **quanto chiede per venire da te**:

```
prezzo = valore di mercato × (1 + quanto gli costa scendere di squadra)
```

Il secondo fattore dipende dal tuo prestigio, e arriva a moltiplicare per 3,4.
Oltre mezza griglia di distacco fra il suo posto e il tuo, non firma a nessuna
cifra — senza un limite duro, la cassa iniziale comprerebbe subito il miglior
pilota del mondo e il primo anno non sarebbe più il primo anno di nessuno.

All'apertura del mondo, oltre ai ragazzi dell'academy, ci sono **cinque piloti
già formati senza contratto**. Senza di loro tutti i sedili sarebbero occupati
e una scuderia che nasce non avrebbe nessuna scelta da fare, solo giovani da
prendere. Con loro la prima decisione vera esiste: un ventenne da far crescere,
o un trentenne che porta punti subito e costa tutto il bilancio.

### Rinnovare, e perché è la decisione che si dimentica

Un contratto che scade manda il pilota sul mercato generale, e una scuderia
più grande se lo prende. La sonda lo mostrava come un difetto di crescita — i
piloti della squadra restavano fermi a 71 di overall per otto stagioni — mentre
era un difetto di mercato: **non erano gli stessi piloti**, ogni due anni si
ricominciava con qualcun altro. Rinnovare costa il prezzo di adesso, non quello
di quando l'hai preso: un giovane cresciuto va pagato per quello che è
diventato, ed è il conto che si presenta a chi ha lavorato bene.

### I conti

| Entrate | | Uscite | |
|---|---|---|---|
| Premio di classifica | 62–114 M | Ingaggi piloti | 0,3–24 M |
| Sponsor (dal prestigio) | 0–30 M | Gestione (dal personale) | 24–51 M |

Lo sviluppo non compare: i progetti si pagano **a settimana**, ed è proprio
quello che rende la cassa una cosa da guardare durante la stagione invece che a
dicembre.

I primi numeri che avevo messo rendevano il gioco impossibile, e la sonda lo ha
mostrato subito: una scuderia nuova incassava 32 milioni e ne spendeva 40 solo
per esistere, chiudeva il primo anno in rosso, il secondo peggio, e dal terzo
non poteva più nemmeno pagare un pilota. Non era difficoltà, era una sottrazione
senza uscita. Adesso la base del premio è quasi il doppio e la forbice più
stretta: l'ultimo chiude in attivo di una ventina di milioni, che sono circa due
aggiornamenti all'anno. Pochi, e questo è il punto — ma sono suoi, e crescono
con lui.

---

## Lo sviluppo a progetti di reparto

È il cuore del gestionale, e sostituisce lo sviluppo automatico di fine
stagione che il gioco aveva prima. Quello era un numero che arrivava a
dicembre: nessuna decisione, nessun rischio, nessun modo di sbagliare.

| Progetto | Durata | Costo | Guadagno atteso |
|---|---|---|---|
| Pacchetto | 6 settimane | 1,6 M | +0,27 |
| Aggiornamento | 12 settimane | 4,0 M | +0,63 |
| Progetto maggiore | 22 settimane | 8,4 M | +1,38 |

**Tre vincoli, e la decisione sta dove si incrociano.**

1. **Un reparto alla volta.** Aerodinamica, motore, telaio e affidabilità
   lavorano in parallelo, ma ciascuno su un progetto solo: aprire il secondo
   vuol dire chiudere il primo, e quello che era a metà è perso.
2. **Le settimane.** Un progetto maggiore occupa il reparto per mezza stagione.
   Deciderlo a marzo vuol dire vederlo in pista ad agosto, e nel frattempo gli
   altri hanno portato due pacchetti piccoli.
3. **I soldi.** Qui sta il vincolo vero. Il calendario non ti ferma: ti ferma la
   cassa. Un progetto rimasto senza fondi **non si annulla e non indebita la
   scuderia** — si ferma, e riparte quando la cassa torna.

### Il rischio non è decorazione

Un progetto non rende quello che prometteva: rende quello che prometteva
moltiplicato per come è andata. La resa si taglia a −0,45, il che vuol dire che
**un progetto maggiore può peggiorare la macchina**. Senza quel taglio,
«rischio» sarebbe solo una parola per «guadagni un po' meno».

### Quattro correttivi, e ognuno risponde a un difetto misurato

- **Rendimenti calanti.** Portare l'aerodinamica da 70 a 71 è lavoro normale,
  da 95 a 96 è mezza stagione. Senza, la scuderia di vertice accumula
  all'infinito.
- **Handicap al vincitore.** Chi ha vinto sviluppa meno, come le ore di
  galleria del vento assegnate al contrario della classifica.
- **Il reparto tecnico.** Gli stessi soldi in mani migliori rendono di più: è
  ciò che rende il personale una spesa e non un numero decorativo.
- **Il recupero.** Chi è molto indietro guadagna di più per ogni euro. È il più
  importante dei quattro e l'avevo perso strada facendo, togliendo lo sviluppo
  automatico: la sonda mostrava una scuderia nuova che restava nona per otto
  stagioni di fila, perché il suo bilancio da ultima comprava due aggiornamenti
  all'anno contro gli otto di chi stava davanti. Senza recupero, la classifica
  di partenza è la classifica per sempre.

### L'ancora che tiene fermi i numeri

I rating delle monoposto si gonfiavano e basta: ogni scuderia sviluppa, nessuna
regredisce, e in otto stagioni la media della griglia passava da 82 a 90,
schiacciata contro il tetto di 99. L'azzeramento regolamentare non lo impediva,
perché faceva convergere tutti verso la media **di allora** — cioè spostava
tutti nello stesso punto, sempre più in alto.

Il danno peggiore non era l'inflazione in sé ma cosa faceva al gioco: **una
scuderia nuova inseguiva un bersaglio che scappava più in fretta di quanto lei
potesse correre**, e non raggiungeva mai il gruppo per quanto bene giocasse.

Adesso l'azzeramento riporta le monoposto a un livello di riferimento fisso
(`CAR_ANCHOR = 78`) e lascia in piedi **metà** del vantaggio di chi era avanti.
È l'equivalente di `talentAnchor` per le macchine, ed è quello che rende
l'azzeramento un'occasione vera per chi insegue — oltre a chiudere i cantieri
aperti, perché un progetto costruito sulle regole di prima non serve più.

### `npm run check:team`

Dieci scuderie fondate da zero, sedici stagioni, un giocatore di riferimento
che gioca in modo **ragionevole** e non ottimo:

```
st   posizione   passo vs media   piloti
  1      8.7           −12.8        71.9
  4      7.3            −7.5        77.4
  8      6.8            −3.9        75.7
 12      5.4            −0.7        75.7
 16      4.3            −1.1        77.1
```

Si entra ultimi e si sale, su entrambe le leve: la monoposto arriva alla pari
attorno alla dodicesima stagione, i piloti crescono di cinque punti. Il
giocatore di riferimento non arriva al vertice, e deve essere così: se ci
arrivasse, vorrebbe dire che le decisioni non contano.

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
| Mar (e Gio) | **Allenamento dei tuoi piloti**, uno per uno: una sessione se nel weekend c'è la gara, due se non c'è | 30 s |
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
allenamento settimanale può dare: non punti in più ma **regole diverse**.
L'albero è di ogni pilota, non della scuderia: i punti li accumulano loro
correndo, e li spendi tu — per ciascuno dei due, che è un altro modo in cui due
monoposto sono due decisioni e non una. Un
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
| **Velocità** | pausa, ½×, 1×, 2×, più «simula il resto» |
| **Le tue due monoposto** | si passa dall'una all'altra senza uscire dalla gara: la strategia si decide per ciascuna |

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
         × difficoltàMarginale(margine)  ← in PUNTI, non in frazione del tetto
         × curvaEtà(età, picco)          ← un picco per attributo, non uno solo
         × efficienzaStaff              ← con rendimenti decrescenti
         × carico × penalitàSovrallenamento
         × penalitàStanchezza × morale
         × minigioco × rumore
```

**Ogni attributo ha il proprio picco.** I riflessi se ne vanno a ventisei anni,
il feedback tecnico cresce fino a trentatré. Un trentaquattrenne non è un
ventiseienne peggiore: è un pilota diverso, e l'**esperienza** — che sale sempre
e non cala mai — gli restituisce fino a otto centesimi al giro.

Il tetto non è un `if`: emerge da `difficoltàMarginale`, che a tre punti dal
potenziale vale meno di un trentesimo. Nessuno raggiunge davvero il proprio
potenziale — ci si avvicina, e quanto ci si avvicina lo decide lo staff.

#### Il margine si conta in punti, non in frazioni del tetto

È il difetto che teneva ferma ogni carriera a metà. `difficoltàMarginale`
prendeva `(tetto − attuale) / tetto`, e con quella formula un pilota a undici
punti dal proprio limite cresceva al 4% del ritmo base, mentre uno a dieci
punti da un tetto di 40 cresceva all'11%: **più in fretta con meno margine**,
il che non vuol dire niente. Il risultato lo si misurava: in otto stagioni un
pilota realizzava due punti dei dodici che aveva disponibili, e l'overall
restava fermo dalla seconda stagione in poi.

Adesso l'argomento è il margine **in punti**, normalizzato su `HEADROOM_SCALE`
= 30, che è il margine tipico di un diciottenne. Da lì in giù la crescita
rallenta, e vicino al tetto resta proibitiva come deve essere — ma non dipende
più da quanto è alto il tetto.

La scala è tarata sulla curva di carriera, non a occhio: **un diciottenne con
potenziale 91 arriva a 81 da solo e a 87 con uno staff di livello**, in entrambi
i casi attorno ai ventisette anni. Quei sei punti sono ciò che lo staff vale.

Anche i piloti gestiti dal computer hanno chi li segue: non uno staff da
gestire, ma l'`entourage` della loro scuderia, proporzionato al prestigio. Ne
esce un gradiente che il giocatore sente — un sedile in un top team non porta
solo una macchina migliore.

## La carriera, tarata sui mondiali veri

C'era un difetto che si sentiva prima di poterlo misurare: **chi iniziava una
carriera restava in coda per sempre**. Allenarsi non si vedeva, correre non si
vedeva, e la classifica dell'ottava stagione era quella della prima.

Per correggerlo serviva sapere che forma ha davvero una carriera, e quella non
si indovina. I numeri vengono dallo storico dei mondiali su Supabase — lo
stesso database di FantaF1 — tabella `season_driver_standing`, 1681 righe. La
misura è il **percentile in classifica**: 0 = campione, 1 = ultimo, l'unica
grandezza confrontabile fra un mondiale a 13 piloti e uno a 26.

### La coorte fissa, e perché serviva

La curva su tutti i piloti va da 0.712 al primo anno a 0.406 all'ottavo, e non
dice quasi niente: mescola la crescita vera con il fatto che **chi va male
smette**. Da 388 esordienti si arriva a 30 veterani, e la media migliora da
sola perché i peggiori escono dal conto.

La curva usata è invece quella dei **73 piloti con almeno otto stagioni**,
seguiti uno per uno. Quello che resta è crescita, non sopravvivenza:

| stagione | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| percentile medio | 0.634 | 0.431 | 0.404 | 0.349 | 0.344 | **0.311** | 0.365 | 0.415 |

Il gradino grande è il primo; poi si migliora ancora, ma piano; il picco è alla
sesta stagione e la risalita finale è l'età. σ ≈ 0.24 in ogni stagione: la
varianza fra piloti è enorme.

### L'abilità è garantita, la posizione no

Il secondo numero conta più del primo. Quante volte un pilota migliora davvero
da una stagione all'altra?

| passaggio | 1→2 | 2→3 | 3→4 | 4→5 | 5→6 | 6→7 |
|---|---|---|---|---|---|---|
| migliora | **63%** | 51% | 52% | 54% | 53% | 35% |

Solo il primo passo è affidabile. Dopo si oscilla attorno al 52%, cioè poco più
di una monetina, **perché il risultato in pista lo decide soprattutto la
macchina**. Da qui la regola di progetto:

> L'abilità cresce in modo affidabile e visibile. La posizione no.

Il pilota deve vedersi migliorare — attributi, offerte, prestigio della squadra
— anche in un anno in cui la classifica gli va peggio. Garantire la classifica
sarebbe irreale; non garantire niente era il difetto di partenza.

### Un esordiente non è lento, è impreparato

Prima tutti i nuovi partivano fra il 62% e il 78% del proprio tetto, su ogni
attributo. Un debuttante valeva 57 di overall contro una griglia a 75: una
stagione senza partita.

Adesso la frazione dipende da **cosa** si sta misurando. Velocità pura e
partenze sono istinto e arrivano quasi complete (84–92% del tetto); gomme,
freddezza, costanza, lavoro tecnico e bagnato si imparano, e quelle mancano
davvero (68–80%). È il rookie veloce e grezzo, che ogni tanto firma un giro da
prima fila e poi butta via la gara — e il suo distacco viene da quello che non
sa, non dall'essere lento.

L'esperienza fa il resto, ed è un sistema a parte: riduce il rumore sul giro
quanto la costanza, ed è il motivo per cui il salto più grande di una carriera
è fra la prima e la seconda stagione.

### Piloti e scuderie sulla stessa scala

Il valore di mercato di un pilota si ferma attorno a 80 anche per un
fuoriclasse; il prestigio di una scuderia arriva a 90. Confrontarli
direttamente — com'era: `valore ≥ prestigio × 0.55 + 42` — significa che la
soglia di una squadra da titolo **sta sopra il valore massimo che un pilota
possa mai raggiungere**. Nessuno la superava, e il giocatore non riceveva
un'offerta di vertice nemmeno da campione del mondo: la carriera si fermava a
metà griglia per sempre.

Adesso i due numeri vengono portati sulla stessa scala — non «quanto vali» ma
«a che punto della griglia stai» — e l'interesse nasce dalla differenza fra i
due posti. Resta valido anche fra quarant'anni, quando i numeri assoluti si
saranno spostati.

### L'attrito che tiene vivo il campionato

Mettere tutti sulla stessa scala ha avuto un effetto che non avevo previsto e
che la simulazione a quarant'anni ha trovato subito: le scuderie ordinavano la
griglia **troppo bene**. I migliori finivano sempre nella macchina migliore, e
il campionato diventava di una sola squadra — i campioni diversi scendevano da
15 a 11, le scuderie iridate da 7 a 4.

`SCOUTING_NOISE` è la correzione: 18 punti di errore di valutazione. Una
squadra sbaglia il giudizio, arriva tardi, punta sul giovane sbagliato. Con
l'attrito rimesso, 16 campioni diversi su 40 stagioni e 7 scuderie iridate su
8 — meglio di prima della modifica, e con metà della deriva di livello.

### `npm run check:career`

Sessanta carriere di otto stagioni, confrontate con i limiti di
`careerCurve.ts`:

```
st   gioco   reale   prestigio   overall   ultimi due
 1   0.878   0.634       38      70.7        43%
 2   0.577   0.431       39      73.9         0%
 4   0.349   0.349       60      76.4         0%
 8   0.279   0.415       58      78.1         0%

overall alla partenza 62.3 → 78.1  (potenziale 79.2)
```

Due scarti dalla realtà sono voluti, e il file li spiega perché senza
spiegazione sembrerebbero errori. **La prima stagione è più dura del vero**:
una carriera comincia sempre sul sedile della scuderia meno prestigiosa, mentre
la coorte vera contiene esordienti entrati anche in macchine da podio.
**L'ottava è migliore del vero**: il pilota del gioco a quel punto ha 26 anni
ed è nel suo momento migliore, la coorte vera contiene anche chi ha debuttato a
trenta ed è già in calo.

Quello che deve combaciare è la forma. E quel `43%` della prima stagione, che
diventa `0%` da subito dopo, è la misura del difetto originale: si può finire
in fondo l'anno del debutto, ma non è più il proprio posto.

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

## Il regolamento

Le regole che un giocatore dà per scontate perché le conosce dalla
televisione, e che quindi si notano solo quando mancano. Stanno in
[`engine/rules.ts`](src/engine/rules.ts), separate dalle formule di
prestazione: sono vincoli, non modelli.

### La distanza di gara, e perché Monaco è più corta

Non si scrivono più i giri: si corre **la distanza più corta che superi i 305
km**, con un tetto di 78 giri. Le lunghezze vengono dai tracciati reali, e i
conti tornano da soli:

| Tracciato | Lunghezza | Giri calcolati | Giri veri |
|---|---|---|---|
| Lario (Monza) | 5.77 km | 53 | 53 |
| Nordkap (Spa) | 6.95 km | 44 | 44 |
| Wyverne (Silverstone) | 5.86 km | 53 | 52 |
| Vallmar (Monaco) | 3.32 km | **78** (tetto) | 78 |

Il tetto non è un caso speciale per Monaco: è una regola sola, e su un
tracciato da 3.3 km produce 78 giri e 260 km invece dei 305. L'eccezione più
famosa del calendario esce da sé.

Con le lunghezze vere anche il **tempo sul giro** smette di essere scritto a
mano: `baseLap` deriva da lunghezza e forma, perché un giro si percorre alla
velocità che la sua forma permette. Prima erano tre numeri indipendenti e
potevano contraddirsi — un tracciato da sette chilometri percorso a 308 km/h
di media. Ora le gare durano fra i 68 e gli 89 minuti.

### Due mescole diverse

Su asciutto vanno usate almeno due mescole, il che rende obbligatoria almeno
una sosta. È **l'unica ragione per cui una strategia esiste**: senza, la gara
migliore sarebbe sempre partire con la dura e non fermarsi mai.

Chi finisce senza prende 25 secondi — abbastanza da rovinare la gara, non da
cancellarla come farebbe la squalifica vera. E il pulsante dei box lo dice
mentre corri: una penalità che non potevi vedere arrivare non è una regola, è
una punizione.

---

## La qualifica, tre decisioni

### Q1, Q2, Q3

Tre manche con le eliminazioni: Q1 taglia i cinque più lenti, Q2 altri cinque,
Q3 decide la pole. Non è una formalità, **cambia la natura della decisione**:
in Q1 basta sopravvivere e rischiare per due decimi che non servono a niente è
stupido; in Q3 quei due decimi sono la pole. La stessa scelta ha un prezzo
diverso a seconda di quanto hai da perdere.

Due dettagli che fanno la differenza fra una simulazione e una lista di tempi:
la **pista si gomma** manche dopo manche, quindi in Q3 si gira più forte che
in Q1 anche con la stessa macchina; e le **gomme non si azzerano**, quindi chi
passa il taglio col cuore in gola arriva in Q3 con la gomma segnata.

L'IA lo sa: `pressureOf` dice quanto è avventato rischiare, e un pilota al
sicuro in Q1 non esce all'ultimo momento mentre uno sul filo del taglio sì.

### Le tre decisioni

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
    screens/        Paddock, Scuderia, Sviluppo, Piloti, Mercato, Calendario,
                    Bilancio, Classifiche, Storia, scheda pilota, albero delle
                    abilità, overlay di fine weekend e di fine anno
    race/           griglia di partenza, tracciato, torre dei tempi, striscia
                    dei distacchi, comandi, forma procedurale del circuito
  state/raceSession.ts  la gara in corso, fuori dallo store: contiene il
                    generatore casuale, che non è serializzabile
engine/
  rng.ts            generatore deterministico, fork etichettati, clamp
  types.ts          modello dati completo del mondo
  driver.ts         creazione, newgen, overall, curve di età, ritiro
  team.ts           fondare la scuderia, ingaggi, rinnovi, conti di stagione
  projects.ts       progetti di reparto: costi, settimane, resa, rischio
  staff.ts          chi segue i piloti: efficienza dell'entourage
  calendar.ts       calendario della stagione: date vere, gare, pause, capienza
  layout.ts         la forma del giro: settori, pesi della monoposto, derivate
  qualifying.ts     le tre decisioni del sabato, le manche, il loro prezzo
  rules.ts          distanza di gara, punti, regola delle due mescole
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
  regulations.ts    budget cap, prestigio, azzeramento regolamentare e ancora
  market.ts         valore di mercato, scala comune, mercato delle altre otto
  careerCurve.ts    la forma di una carriera, misurata sui mondiali veri
  season.ts         weekend, classifiche, aggregati storici
  world.ts          createWorld, advanceDay, advanceWeek, endSeason, simulateSeason
  data/
    tracks.ts       31 circuiti: forma del giro, larghezza, regione, fuso, orari
    teams.ts        5 scuderie, palette validata per daltonismo
    names.ts        bacino di nomi per la rigenerazione annuale
tests/              137 test: rng, curve e modelli, gara, gara live,
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
categorica. `npm run check:palette` verifica cinque cose:

1. contrasto di ogni tinta sul pannello bianco ≥ 4.5:1, così il testo bianco
   sopra è sempre leggibile;
2. nessuna scuderia troppo vicina al rosso di marca;
3. separazione ΔE ≥ 9 fra tutte le coppie, in visione normale **e** in
   protanopia, deuteranopia e tritanopia;
4. che `src/engine/data/teams.ts` non sia divergente dal tema — il motore
   porta il colore nel salvataggio e non può importare la presentazione,
   quindi le due liste vanno confrontate invece che condivise;
5. che i **colori offerti al giocatore** siano distinguibili da tutte e otto
   le scuderie, sempre nelle quattro visioni.

Il quinto controllo è nato da un difetto: la prima tavolozza di creazione
offriva le stesse tinte delle otto squadre esistenti, e sette su otto erano
**copie esatte** — la tua scuderia sarebbe stata indistinguibile da una già in
griglia, in classifica e sul tracciato.

Fra loro, invece, i sei colori del giocatore **non** devono distinguersi, e
chiederlo sarebbe stato un errore: se ne sceglie uno solo, e due tinte simili
nella tavolozza non si incontrano mai. Pretendere anche quella separazione
costringeva la scelta su sei toni di blu, perché lo spazio che la griglia
lascia libero è stretto.

Il controllo non è cerimoniale: lanciato sulla vecchia palette scura ha
trovato **tre coppie indistinguibili** che la documentazione dava per
validate. Otto tinte categoriche che sopravvivono a tre dicromazie stanno al
limite del possibile — il margine più stretto è ΔE 9.9 contro un minimo di 9
— quindi non si toccano a occhio: si cambia un valore e si rilancia.


## Comandi

```bash
npm test               # vitest, 145 test
npm run test:watch
npm run typecheck      # tsc --noEmit, strict
npm run sim            # 40 stagioni, riepilogo
npm run sim:long       # con il dettaglio anno per anno
npm run sim -- --seasons 100 --seed 7 --verbose
npm run check:team     # 10 scuderie fondate da zero × 16 stagioni
npm run check:career   # la forma di una carriera contro i mondiali veri
npm run check:migration
npm run check:palette
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

**Fatto** — il gioco si chiude da capo a fondo: si fonda una scuderia, si
ingaggia, si sviluppa, si corre, si chiude l'anno e si ricomincia.

- [x] Vite + React + TypeScript + Tailwind, layout orizzontale
- [x] Creazione della scuderia: nome, sigla, colore, capitale iniziale
- [x] Schede: Paddock, Scuderia, Sviluppo, Piloti, Mercato, Calendario, Bilancio, Classifiche, Storia
- [x] Sviluppo a progetti di reparto, con settimane, costi settimanali e rischio
- [x] Mercato dal lato di chi ingaggia: offerte, rinnovi, rescissioni
- [x] Allenamento e albero delle abilità per ciascuno dei tuoi due piloti
- [x] Il tempo scorre a giorni: *Avanza* di ventiquattro ore, *Al weekend* per saltare ai giorni che contano
- [x] Calendario ricalcato su quello vero: date reali, giro del mondo per regioni, triple header, pausa d'agosto, orari locali e italiani
- [x] Vista gara a diciotto monoposto, con le tue due comandabili entrambe
- [x] Qualifica giocabile: le tre decisioni del sabato
- [x] Forma dei circuiti misurata sulla geometria reale
- [x] Salvataggio automatico, con recupero dei salvataggi della vecchia Modalità Pilota

**Prossimo passo**:

- [ ] I tre minigiochi in React, con il risultato scritto all'avvio della partita
- [ ] Libere: la direzione di assetto
- [ ] Assumere e licenziare il personale tecnico (adesso segue il prestigio da solo)
- [ ] Strategia separata per le due monoposto già prima del via
- [ ] Slot di salvataggio multipli

**Poi**:

- [ ] Livree come dati: pattern procedurali, editor, codice condivisibile
- [ ] Momenti pre-renderizzati: garage, podio, firma del contratto
- [ ] Sponsor come contratti da negoziare, non solo un numero dal prestigio
- [ ] Meteo dinamico in gara e gomme da bagnato
- [ ] Limiti sui componenti della power unit, con penalità in griglia
- [ ] Build Android con Capacitor

---

## Mockup di riferimento

I tre prototipi che hanno definito il gioco prima della prima riga di motore:

- **Vista gara** — tracciato, torre dei tempi, striscia dei distacchi, strategia
- **Hub carriera** — la struttura a schede, da cui viene quella di adesso
- **Sala allenamento** — i tre minigiochi giocabili

Sono prototipi HTML autonomi, con dati inventati: servono al confronto visivo, non sono codice di produzione.

---

## Licenza

Progetto personale. Team, piloti e circuiti sono opere di fantasia e non rappresentano persone, scuderie o autodromi reali.
