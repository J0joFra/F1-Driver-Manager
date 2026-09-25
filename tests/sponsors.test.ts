import { describe, expect, it } from 'vitest';
import { createWorld, endSeason, advanceWeek } from '../src/engine/world.js';
import { playerTeam, startTeam } from '../src/engine/team.js';
import { SEASON_WEEKS } from '../src/engine/calendar.js';
import {
  ageDeals, BASE_SHARE, goalMet, investorOffers, settleInvestor, signInvestor,
  signSponsor, sponsorIncome, sponsorOffers, sponsorValue,
} from '../src/engine/sponsors.js';

function founded(seed = 21) {
  const world = startTeam({
    seed, name: 'Prova', short: 'PRV', colour: '#D21E1E', budget: 'indipendente',
  });
  return { world, team: playerTeam(world)! };
}

describe('gli sponsor', () => {
  it('senza contratto si incassa solo la base, con il contratto molto di più', () => {
    const { world, team } = founded();
    const base = Math.round(sponsorValue(team.prestige) * BASE_SHARE);
    expect(sponsorIncome(team)).toBe(base);

    const deal = sponsorOffers(world, team)[0]!;
    signSponsor(team, deal);
    expect(sponsorIncome(team)).toBe(deal.perSeason);
    expect(sponsorIncome(team)).toBeGreaterThan(base);
  });

  it('le offerte non cambiano riaprendo la schermata', () => {
    const { world, team } = founded();
    // Se cambiassero, basterebbe chiudere e riaprire finché non esce quella
    // buona, e la scelta non esisterebbe più.
    expect(sponsorOffers(world, team)).toEqual(sponsorOffers(world, team));
  });

  it('il contratto lungo paga meno all’anno di quello corto', () => {
    const { world, team } = founded();
    const offers = sponsorOffers(world, team);
    const uno = offers.find((o) => o.seasons === 1)!;
    const tre = offers.find((o) => o.seasons === 3)!;
    expect(uno.perSeason).toBeGreaterThan(tre.perSeason);
    // Ma sulla durata intera rende di più: è il compromesso.
    expect(tre.perSeason * 3).toBeGreaterThan(uno.perSeason);
  });

  it('scala di una stagione alla volta e poi scade', () => {
    const { world, team } = founded();
    signSponsor(team, sponsorOffers(world, team).find((o) => o.seasons === 2)!);
    ageDeals(team);
    expect(team.sponsor?.seasonsLeft).toBe(1);
    ageDeals(team);
    expect(team.sponsor).toBeNull();
  });
});

describe('gli investitori', () => {
  it('il versamento entra subito in cassa', () => {
    const { world, team } = founded(22);
    const cash = team.cash;
    const deal = investorOffers(world, team)[0]!;
    signInvestor(team, deal);
    expect(team.cash).toBe(cash + deal.upfront);
    expect(team.investor?.status).toBe('aperto');
  });

  it('l’obiettivo centrato paga il bonus, quello mancato non costa niente', () => {
    const { world, team } = founded(23);
    // Un obiettivo impossibile: nessuna gara corsa, zero punti.
    signInvestor(team, {
      ...investorOffers(world, team)[0]!,
      goal: { kind: 'punti', target: 500 },
    });
    const cash = team.cash;
    const outcome = settleInvestor(world, team)!;
    expect(outcome.met).toBe(false);
    expect(team.cash).toBe(cash);
    expect(team.investor?.status).toBe('fallito');

    // E uno raggiungibile: zero punti richiesti.
    const second = founded(24);
    signInvestor(second.team, {
      ...investorOffers(second.world, second.team)[0]!,
      goal: { kind: 'punti', target: 0 },
    });
    const before = second.team.cash;
    const win = settleInvestor(second.world, second.team)!;
    expect(win.met).toBe(true);
    expect(second.team.cash).toBe(before + win.bonus);
  });

  it('si valuta prima che la stagione venga azzerata', () => {
    const world = createWorld({ seed: 25 });
    const team = Object.values(world.teams)[0]!;
    signInvestor(team, {
      ...investorOffers(world, team)[0]!,
      goal: { kind: 'posizione', target: 9 },
    });
    while (world.week < SEASON_WEEKS) advanceWeek(world);
    // Qui la classifica esiste ancora: il conto si chiude su questa.
    expect(goalMet(world, team, { kind: 'posizione', target: 9 })).toBe(true);
    const summary = endSeason(world);
    expect(summary.investors[team.id]).toBeDefined();
  });

  it('a fine stagione tutte le scuderie del computer hanno uno sponsor', () => {
    const world = createWorld({ seed: 26 });
    while (world.week < SEASON_WEEKS) advanceWeek(world);
    endSeason(world);
    for (const team of Object.values(world.teams)) {
      expect(team.sponsor, team.name).not.toBeNull();
    }
  });
});
