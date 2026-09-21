# F1 Driver Manager

Gestionale di Formula 1 per browser e Android. Due modalità sullo stesso mondo —
**Pilota** (fai carriera, cresci, ti scegli il sedile) e **Scuderia** (dirigi un team) —
con la gara simulata e mostrata dall'alto in 2D: non guidi, **decidi**.

> **Stato: motore completo + Modalità Pilota navigabile.**
> Il mondo gira da riga di comando (40 stagioni in ~300 ms) e l'app si gioca
> settimana per settimana fino a fine stagione.

---

## Indice

- [L'idea](#lidea)
- [Provalo subito](#provalo-subito)
- [Architettura: perché il motore viene prima](#architettura-perché-il-motore-viene-prima)
- [Le due modalità](#le-due-modalità)
- [Il mondo infinito](#il-mondo-infinito)
- [La settimana di gioco](#la-settimana-di-gioco)
- [Soldi e staff personale](#soldi-e-staff-personale)
- [Il modello di gara](#il-modello-di-gara)
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
npm test                      # 34 test
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

`tools/screenshots.mjs` cattura tutte le schermate a 844×390 e **verifica che la
pagina non scorra in verticale**: è una regressione facile da introdurre e
invisibile su desktop.

```bash
npm run build && npm run preview &
npm run shots -- screenshots
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

## La settimana di gioco

Una stagione dura **36 settimane**, di cui ~20 con una gara. `advanceWeek()` fa avanzare il mondo di una settimana.

| Giorno | Cosa fai | Durata |
|---|---|---|
| Lun–Gio | **Allenamento**: 6 sessioni in settimana di gara, 10 in settimana libera, **max 4 per categoria** | 30 s |
| Gio | **Il minigioco della settimana**, una sola partita | 40 s |
| Ven | **Libere**: scegli una direzione di assetto | 20 s |
| Sab | **Qualifica**: tre decisioni + il giro lanciato | 90 s |
| Dom | **Gara** | 3–5 min |

### Allenamento

Quattro categorie — `simulator`, `fitness`, `engineering`, `media` — e un tetto di 4 sessioni ciascuna. Con 10 sessioni da distribuire e un massimo di 4, sei **costretto** a toccarne almeno tre: la scelta resta viva invece di collassare sempre sullo stesso ottimo.

Lo staff non regala punti: **alza i tetti**. Il coach porta il simulatore da 4 a 5, il preparatore porta il monte totale da 10 a 12. Un ingaggio che cambia una regola vale dieci volte uno che cambia un numero.

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

## Il modello di gara

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
    screens/        Paddock, Pilota, Allenamento, Finanze, Scuderia,
                    Classifiche, Storia, overlay di fine weekend e di fine anno
engine/
  rng.ts            generatore deterministico, fork etichettati, clamp
  types.ts          modello dati completo del mondo
  driver.ts         creazione, newgen, overall, curve di età, ritiro
  staff.ts          staff personale, prezzi, moltiplicatore di crescita
  training.ts       sessioni, tetti, scelta del minigioco, applicazione crescita
  race.ts           simulazione di gara e di qualifica
  regulations.ts    sviluppo monoposto, handicap, budget cap, prestigio, reset
  market.ts         valore di mercato, ingaggi, mercato piloti, finanze
  season.ts         weekend, classifiche, aggregati storici
  world.ts          createWorld, advanceWeek, endSeason, simulateSeason
  data/
    tracks.ts       12 circuiti di fantasia, parametrizzati sui valori reali
    teams.ts        5 scuderie, palette validata per daltonismo
    names.ts        bacino di nomi per la rigenerazione annuale
tests/              34 test: rng, gara, allenamento, mondo a 40 stagioni
tools/simulate.ts   simulatore da riga di comando
tools/screenshots.mjs  schermate a 844×390 + controllo che la pagina non scorra
```

### Perché i nomi sono di fantasia

«Formula 1», i nomi delle scuderie e quelli dei piloti sono marchi protetti. Team e piloti sono inventati; i circuiti sono parametrizzati sui valori reali (giro 74–97 s, 44–70 giri) ma con nomi e disegni propri. È la stessa scelta di *Motorsport Manager*, e permette di pubblicare sugli store senza problemi.

### La palette delle scuderie

Gli otto colori non sono decorativi: sono anche i colori delle barre in tutte le classifiche, quindi devono funzionare come palette categorica. Sono stati verificati con un validatore per daltonismo — banda di luminosità, soglia di croma, separazione ΔE ≥ 9 fra tinte adiacenti in protanopia e tritanopia, contrasto ≥ 3:1 sul fondo scuro.

| Scuderia | Colore |
|---|---|
| Scuderia Aurora | `#E8283C` |
| Vantar Racing | `#3E86F0` |
| Kestrel Motors | `#12A06E` |
| Solaro Corse | `#0E9BB4` |
| Mirage GP | `#D4761E` |
| Brandt Werke | `#DE5AA2` |
| Nordvik Squadra | `#A06BE0` |
| Kaizen Racing | `#94892A` |

L'unica coppia sotto la soglia di separazione (rosa e ciano in deuteranopia,
ΔE 6.3) è sempre accompagnata dal nome della scuderia: nell'interfaccia il
colore non è mai l'unico elemento che distingue una riga. Dieci tinte
ugualmente distinguibili non esistono — il validatore lo dice chiaramente — ed
è il motivo per cui la griglia ha otto scuderie e non dieci.

---

## Comandi

```bash
npm test               # vitest, 34 test
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
- [x] Hub: Paddock, Pilota, Allenamento, Finanze, Scuderia, Classifiche, Storia
- [x] Ciclo settimanale completo: allenamento → weekend → fine stagione
- [x] Salvataggio automatico con Zustand `persist`

**Prossimo passo**:

- [ ] Vista gara: tracciato SVG, torre dei tempi, striscia dei distacchi, comandi strategia
- [ ] I tre minigiochi in React, con il risultato scritto all'avvio della partita
- [ ] Qualifica: le tre decisioni e il giro lanciato
- [ ] Libere: la direzione di assetto
- [ ] Mercato dello staff personale (il motore c'è già, manca la schermata)
- [ ] Contratti e offerte di fine stagione
- [ ] Slot di salvataggio multipli e migrazioni di versione

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
