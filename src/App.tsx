import { useCallback, useEffect, useState } from 'react';
import { useGame, seasonWeeks } from './state/useGame.js';
import { OrientationGate } from './ui/shell/OrientationGate.js';
import { NavRail } from './ui/shell/NavRail.js';
import { TopBar } from './ui/shell/TopBar.js';
import { NewGame } from './ui/screens/NewGame.js';
import { Paddock } from './ui/screens/Paddock.js';
import { Training } from './ui/screens/Training.js';
import { DriverScreen } from './ui/screens/DriverScreen.js';
import { Finance } from './ui/screens/Finance.js';
import { TeamScreen } from './ui/screens/TeamScreen.js';
import { Standings } from './ui/screens/Standings.js';
import { History } from './ui/screens/History.js';
import { SeasonOverlay, WeekendOverlay } from './ui/screens/Overlays.js';
import { GridScreen } from './ui/race/GridScreen.js';
import { RaceView } from './ui/race/RaceView.js';

export function App() {
  const world = useGame((s) => s.world);
  const screen = useGame((s) => s.screen);
  const plan = useGame((s) => s.plan);
  const advance = useGame((s) => s.advance);
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
      else advance(plan);
    } finally {
      setBusy(false);
    }
  }, [advance, closeSeason, plan, busy]);

  if (!world) {
    return (
      <OrientationGate>
        <NewGame />
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
        <NavRail />
        <div className="flex-1 min-w-0 flex flex-col relative">
          <TopBar onAdvance={onAdvance} busy={busy} />
          <main className="flex-1 min-h-0 p-2">
            {screen === 'paddock' && <Paddock />}
            {screen === 'pilota' && <DriverScreen />}
            {screen === 'allenamento' && <Training />}
            {screen === 'finanze' && <Finance />}
            {screen === 'scuderia' && <TeamScreen />}
            {screen === 'classifiche' && <Standings />}
            {screen === 'storia' && <History />}
          </main>
          {showWeekend && <WeekendOverlay />}
          {showSeason && <SeasonOverlay />}
        </div>
      </div>
    </OrientationGate>
  );
}
