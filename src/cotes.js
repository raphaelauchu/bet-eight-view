const API_KEY = process.env.REACT_APP_ODDS_API_KEY;
const BASE_URL = 'https://api.the-odds-api.com/v4';

export async function getCotesHockey() {
  try {
    const response = await fetch(
      `${BASE_URL}/sports/icehockey_nhl/odds/?apiKey=${API_KEY}&regions=us,eu&markets=h2h,spreads,totals&bookmakers=bet365,betway,draftkings,fanduel`
    );
    const data = await response.json();
    if (Array.isArray(data)) return data;
    return [];
  } catch (err) {
    console.error('Erreur cotes:', err);
    return [];
  }
}

// Retrouve, dans la liste renvoyée par getCotesHockey(), le match correspondant à une paire
// d'équipes NHL identifiées par leur nom commun (ex: "Maple Leafs", "Canadiens").
export function trouverCotesPourMatch(cotes, nomEquipeAway, nomEquipeHome) {
  if (!Array.isArray(cotes)) return null;
  const away = (nomEquipeAway || '').toLowerCase();
  const home = (nomEquipeHome || '').toLowerCase();
  return cotes.find(m => {
    const mAway = (m.away_team || '').toLowerCase();
    const mHome = (m.home_team || '').toLowerCase();
    return (mAway.includes(away) || away.includes(mAway)) && (mHome.includes(home) || home.includes(mHome));
  }) || null;
}

// Extrait, pour un match de getCotesHockey(), les cotes moneyline/puck line/total du premier
// bookmaker qui les propose.
export function extraireCotesMatch(match) {
  if (!match?.bookmakers?.length) return null;
  const bk = match.bookmakers.find(b => b.markets?.some(m => m.key === 'h2h')) || match.bookmakers[0];
  const marche = key => bk.markets?.find(m => m.key === key)?.outcomes || null;
  return {
    bookmaker: bk.title,
    moneyline: marche('h2h'),
    spread: marche('spreads'),
    total: marche('totals'),
  };
}

export function trouverMeilleureCote(match) {
  if (!match?.bookmakers) return null;
  let meilleureCote = null;
  let meilleureValeur = 0;
  match.bookmakers.forEach(bookmaker => {
    bookmaker.markets?.forEach(market => {
      market.outcomes?.forEach(outcome => {
        if (outcome.price > meilleureValeur) {
          meilleureValeur = outcome.price;
          meilleureCote = {
            bookmaker: bookmaker.title,
            equipe: outcome.name,
            cote: outcome.price,
          };
        }
      });
    });
  });
  return meilleureCote;
}