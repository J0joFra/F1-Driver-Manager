import { useCallback, useEffect, useState } from 'react';
import { useGame, seasonWeeks } from './state/useGame.js';
import { OrientationGate } from './ui/shell/OrientationGate.js';
import { Sidebar } from './ui/shell/Sidebar.js';
import { TopBar } from './ui/shell/TopBar.js';
import { Skills } from './ui/screens/Skills.js';
import { Qualifying } from './ui/screens/Qualifying.js';
import { isRaceWeek } from './engine/selectors.js';
import { QUALIFYING_DAY } from './engine/days.js';
import { NewGame } from './ui/screens/NewGame.js';
import { MainMenu } from './ui/screens/MainMenu.js';
import { DailyRewards } from './ui/screens/DailyRewards.js';
import { Objectives } from './ui/screens/Objectives.js';
import { Store } from './ui/screens/Store.js';
import { Paddock } from './ui/screens/Paddock.js';
import { Drivers } from './ui/screens/Drivers.js';
import { DriverScreen } from './ui/screens/DriverScreen.js';
import { Finance } from './ui/screens/Finance.js';
import { TeamScreen } from './ui/screens/TeamScreen.js';
import { Calendar } from './ui/screens/Calendar.js';
import { Market } from './ui/screens/Market.js';
import { Development } from './ui/screens/Development.js';
import { Standings } from './ui/screens/Standings.js';
import { History } from './ui/screens/History.js';
import { SeasonOverlay, WeekendOverlay } from './ui/screens/Overlays.js';
import { GridScreen } from './ui/race/GridScreen.js';
import { RaceView } from './ui/race/RaceView.js';

/** Le schermate che vivono sopra il menu, non dentro la partita. */
type Overlay = 'nuova' | 'premi' | 'obiettivi' | 'negozio' | null;

export function App() {
  const world = useGame((s) => s.world);
  const stage = useGame((s) => s.stage);
  const toMenu = useGame((s) => s.toMenu);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const screen = useGame((s) => s.screen);
  const advance = useGame((s) => s.advance);
  const skipToWeekend = useGame((s) => s.skipToWeekend);
  const closeSeason = useGame((s) => s.closeSeason);
  const lastWeek = useGame((s) => s.lastWeek);
  const lastSeason = useGame((s) => s.lastSeason);
  const pendingRace = useGame((s) => s.pendingRace);
  const raceRunning = useGame((s) => s.raceRunning);
  const gridReady = useGame((s) => s.gridReady);
  const openGrid = useGame((s) => s.openGrid);
  const completeRace = useGame((s) => s.completeRace);
  const [busy, setBusy] = useState(false);

  // Una gara in sospeso prende il controllo dello schermo: prima la griglia,
  // poi la pista. Il resto dell'interfaccia torna quando è registrata.
  useEffect(() => {
    if (pendingRace) openGrid();
  }, [pendingRace, openGrid]);

  const onAdvance = useCallback(() => {
    const w = useGame.getState().world;
    if (!w || busy) return;
    setBusy(true);
    try {
      if (w.week >= seasonWeeks) closeSeason();
      else advance();
    } finally {
      setBusy(false);
    }
  }, [advance, closeSeason, busy]);

  const onSkip = useCallback(() => {
    const w = useGame.getState().world;
    if (!w || busy || w.week >= seasonWeeks) return;
    setBusy(true);
    try {
      skipToWeekend();
    } finally {
      setBusy(false);
    }
  }, [skipToWeekend, busy]);

  /*
   * Il menu è uno stato, non l'assenza di un mondo.
   *
   * Prima bastava «c'è un salvataggio o non c'è»: riaprire l'app con una
   * carriera in corso ti portava dentro la partita, e non esisteva un modo di
   * tornare indietro per caricarne un'altra o comprare qualcosa.
   */
  if (stage === 'menu' || !world) {
    return (
      <OrientationGate>
        <div className="h-full bg-ground">
          {overlay === null && (
            <MainMenu
              onNewGame={() => setOverlay('nuova')}
              onSettings={() => setOverlay(null)}
              onDaily={() => setOverlay('premi')}
              onObjectives={() => setOverlay('obiettivi')}
              onStore={() => setOverlay('negozio')}
            />
          )}
          {overlay !== null && (
            <div className="h-full p-2">
              {overlay === 'nuova' && <NewGame onBack={() => setOverlay(null)} />}
              {overlay === 'premi' && <DailyRewards onClose={() => setOverlay(null)} />}
              {overlay === 'obiettivi' && <Objectives onClose={() => setOverlay(null)} />}
              {overlay === 'negozio' && <Store onClose={() => setOverlay(null)} />}
            </div>
          )}
        </div>
      </OrientationGate>
    );
  }

  /*
   * Sabato di un weekend di gara il giocatore decide la qualifica prima di
   * poter avanzare. Prende lo schermo come la gara: sono decisioni, non una
   * scheda da consultare, e lasciarle in un angolo le renderebbe saltabili.
   */
  if (
    !pendingRace && isRaceWeek(world) && world.dayOfWeek === QUALIFYING_DAY
    && world.qualifyingPlan === null
  ) {
    return (
      <OrientationGate>
        <div className="h-full flex flex-col bg-ground">
          <TopBar onAdvance={onAdvance} onSkip={onSkip} busy={busy} onMenu={toMenu} />
          <main className="flex-1 min-h-0 p-2">
            <Qualifying onDone={onAdvance} />
          </main>
        </div>
      </OrientationGate>
    );
  }

  if (pendingRace) {
    return (
      <OrientationGate>
        {!gridReady ? (
          <div className="h-full grid place-items-center font-display text-sm tracking-[0.2em] uppercase text-dim">
            Qualifica in corso…
          </div>
        ) : raceRunning ? (
          <RaceView onFinish={completeRace} />
        ) : (
          <GridScreen />
        )}
      </OrientationGate>
    );
  }

  const showWeekend = !!lastWeek?.raceRun && !lastSeason;
  const showSeason = !!lastSeason;

  return (
    <OrientationGate>
      <div className="h-full flex">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col relative">
          <TopBar onAdvance={onAdvance} onSkip={onSkip} busy={busy} onMenu={toMenu} />
          <main className="flex-1 min-h-0 p-2">
            {screen === 'paddock' && <Paddock onAdvance={onAdvance} />}
            {screen === 'scuderia' && <TeamScreen />}
            {screen === 'sviluppo' && <Development />}
            {screen === 'piloti' && <Drivers onAdvance={onAdvance} />}
            {screen === 'profilo' && <DriverScreen />}
            {screen === 'mercato' && <Market />}
            {screen === 'calendario' && <Calendar />}
            {screen === 'finanze' && <Finance />}
            {screen === 'classifiche' && <Standings />}
            {screen === 'abilita' && <Skills />}
            {screen === 'storia' && <History />}
          </main>
          {showWeekend && <WeekendOverlay />}
          {showSeason && <SeasonOverlay />}
        </div>
      </div>
    </OrientationGate>
  );
}
