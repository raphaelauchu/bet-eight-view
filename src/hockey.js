const NHL_API = process.env.NODE_ENV === 'production' 
  ? '/api/nhl?path=' 
  : 'https://corsproxy.io/?https://api-web.nhle.com/v1/';

export async function getMatchsAujourdhui() {
  try {
    const aujourdhui = new Date().toISOString().split('T')[0];
    const response = await fetch(`${NHL_API}schedule/${aujourdhui}`);
    const data = await response.json();
    return data.gameWeek?.[0]?.games || [];
  } catch (err) {
    console.error('Erreur:', err);
    return [];
  }
}

export async function getStatsEquipe(equipeId) {
  try {
    const response = await fetch(`${NHL_API}standings/now`);
    const data = await response.json();
    return data.standings?.find(e => e.teamId === equipeId) || null;
  } catch (err) {
    return null;
  }
}

export async function getScoreEnDirect(gameId) {
  try {
    const response = await fetch(`${NHL_API}gamecenter/${gameId}/landing`);
    const data = await response.json();
    return {
      domicile: data.homeTeam,
      visiteur: data.awayTeam,
      periode: data.periodDescriptor,
      score: {
        domicile: data.homeTeam?.score || 0,
        visiteur: data.awayTeam?.score || 0,
      }
    };
  } catch (err) {
    return null;
  }
}