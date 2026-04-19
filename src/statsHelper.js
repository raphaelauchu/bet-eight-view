import { getUrl } from './Analyses';

// Charge les boxscores des derniers N matchs d'une équipe
export async function getSOGParPeriode(abbrev, gameLog, abbrevEquipe) {
  const matchsAvecSog = [...gameLog];
  
  for (let i = 0; i < gameLog.length; i += 5) {
    const batch = gameLog.slice(i, i + 5);
    const boxscores = await Promise.all(batch.map(async (m) => {
      try {
        const r = await fetch(getUrl(`gamecenter/${m.id}/boxscore`));
        const d = await r.json();
        const dom = m.homeTeam?.abbrev === abbrevEquipe;
        return {
          ...m,
          sogPour: dom ? (d.homeTeam?.sog ?? 0) : (d.awayTeam?.sog ?? 0),
          sogContre: dom ? (d.awayTeam?.sog ?? 0) : (d.homeTeam?.sog ?? 0),
        };
      } catch { return m; }
    }));
    boxscores.forEach((b, idx) => { matchsAvecSog[i + idx] = b; });
  }
  return matchsAvecSog;
}

// Calcule la moyenne SOG pour une période donnée
export function calcSOGPeriode(matchs, type) {
  if (!matchs || matchs.length === 0) return '-';
  const valides = matchs.filter(m => type === 'POUR' ? m.sogPour != null : m.sogContre != null);
  if (valides.length === 0) return '-';
  const total = valides.reduce((s, m) => s + (type === 'POUR' ? m.sogPour : m.sogContre), 0);
  return (total / valides.length).toFixed(1);
}

// Charge le game log d'un joueur avec stats par match
export async function getGameLogJoueur(playerId) {
  try {
    const res = await fetch(getUrl(`player/${playerId}/game-log/now`));
    const data = await res.json();
    return (data.gameLog || []).slice(0, 20).map(m => ({
      gameDate: m.gameDate,
      opponentAbbrev: m.opponentAbbrev,
      goals: m.goals ?? 0,
      assists: m.assists ?? 0,
      points: m.points ?? 0,
      shots: m.shots ?? 0,
      powerPlayPoints: m.powerPlayPoints ?? 0,
      faceoffWins: m.faceoffWins ?? 0,
      blockedShots: m.blockedShots ?? 0,
      hits: m.hits ?? 0,
      toi: m.toi ?? '-',
    }));
  } catch { return []; }
}

// Calcule stats par période pour un joueur
export function calcStatsPeriodeJoueur(gameLog, periode, stat) {
  const matchs = periode === 'L5' ? gameLog.slice(0, 5)
    : periode === 'L10' ? gameLog.slice(0, 10)
    : gameLog.slice(0, 20);
  
  if (matchs.length === 0) return { total: 0, moyenne: 0, matchs: [] };
  
  const total = matchs.reduce((s, m) => s + (m[stat] ?? 0), 0);
  return {
    total,
    moyenne: parseFloat((total / matchs.length).toFixed(2)),
    matchs,
  };
}