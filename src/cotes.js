const API_KEY = process.env.REACT_APP_ODDS_API_KEY;
const BASE_URL = 'https://api.the-odds-api.com/v4';

export async function getCotesHockey() {
  try {
    console.log('Clé API:', API_KEY);
    const response = await fetch(
      `${BASE_URL}/sports/icehockey_nhl/odds/?apiKey=${API_KEY}&regions=us,eu&markets=h2h&bookmakers=bet365,betway,draftkings,fanduel`
    );
    const data = await response.json();
    console.log('Cotes reçues:', data);
    if (Array.isArray(data)) return data;
    return [];
  } catch (err) {
    console.error('Erreur cotes:', err);
    return [];
  }
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