export function getUrl(path) {
  const estEnProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('github.dev');
  if (estEnProduction) return `/api/nhl?path=${encodeURIComponent(path)}`;
  return `https://api-web.nhle.com/v1/${path}`;
}

export async function getSOGParPeriode(gameLog, abbrevEquipe) {
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

export function calcSOGPeriode(matchs, type) {
  if (!matchs || matchs.length === 0) return '-';
  const valides = matchs.filter(m => type === 'POUR' ? m.sogPour != null : m.sogContre != null);
  if (valides.length === 0) return '-';
  const total = valides.reduce((s, m) => s + (type === 'POUR' ? m.sogPour : m.sogContre), 0);
  return (total / valides.length).toFixed(1);
}

export async function getGameLogJoueur(playerId) {
  try {
    const res = await fetch(getUrl(`player/${playerId}/game-log/20252026/2`));
    const data = await res.json();
    return (data.gameLog || []).map(m => ({
      gameId: m.gameId,
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

export function calcStatsPeriode(gameLog, periode, stat) {
  const matchs = periode === 'L5' ? gameLog.slice(0, 5)
    : periode === 'L10' ? gameLog.slice(0, 10)
    : gameLog.slice(0, 20);
  if (matchs.length === 0) return { total: 0, moyenne: 0, matchs: [] };
  const total = matchs.reduce((s, m) => s + (m[stat] ?? 0), 0);
  return { total, moyenne: parseFloat((total / matchs.length).toFixed(2)), matchs };
}
export async function getHitsBlocksParMatch(playerId, gameLog) {
  const result = [...gameLog];
  for (let i = 0; i < gameLog.length; i += 5) {
    const batch = gameLog.slice(i, i + 5);
    const boxscores = await Promise.all(batch.map(async (m) => {
      try {
        const r = await fetch(getUrl(`gamecenter/${m.gameId}/boxscore`));
        const d = await r.json();
        const allPlayers = [
          ...(d.playerByGameStats?.awayTeam?.forwards || []),
          ...(d.playerByGameStats?.awayTeam?.defense || []),
          ...(d.playerByGameStats?.homeTeam?.forwards || []),
          ...(d.playerByGameStats?.homeTeam?.defense || []),
        ];
        const joueur = allPlayers.find(p => p.playerId === parseInt(playerId));
        return { ...m, hits: joueur?.hits ?? 0, blockedShots: joueur?.blockedShots ?? 0 };
      } catch { return m; }
    }));
    boxscores.forEach((b, idx) => { result[i + idx] = b; });
  }
  return result;
}