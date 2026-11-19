import { supabase } from './supabase';
import { SPORTSBOOKS } from './sportsbooksConfig';

// Les cotes passent par l'Edge Function nhl-odds-cache (voir supabase/functions/) plutot que
// par un appel direct a The Odds API depuis le navigateur : la cle API reste cote serveur et
// le resultat est mis en cache (5 min) pour tous les utilisateurs/composants qui le demandent
// en meme temps (voir audit de la source dans le resume de la tache qui a introduit ce cache).
export async function getCotesHockey() {
  try {
    const { data: payload, error } = await supabase.functions.invoke('nhl-odds-cache');
    if (error) throw error;
    const cotes = Array.isArray(payload?.data) ? payload.data : [];
    cotes._fetchedAt = payload?.fetchedAt || null;
    return cotes;
  } catch (err) {
    console.error('Erreur cotes:', err);
    const vide = [];
    vide._fetchedAt = null;
    return vide;
  }
}

// Horodatage de la derniere mise a jour des cotes retournees par getCotesHockey(), fourni par
// le cache serveur (nhl-odds-cache). null si aucune cote n'a pu etre chargee.
export function getCotesLastUpdated(cotes) {
  return (cotes && cotes._fetchedAt) || null;
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

// Extrait, pour un match de getCotesHockey(), les cotes de CHAQUE sportsbook connu de
// sportsbooksConfig.js qui possede une correspondance dans la source (oddsApiBookmakerKey non
// null). Utilise par le comparateur multi-sites (src/LineShopping.js), par opposition a
// extraireCotesMatch() qui ne retourne que le premier bookmaker trouve. Un sportsbook absent
// du resultat (bet99, Sports Interaction) n'est pas fourni par The Odds API pour la LNH --
// aucune cote inventee ou scrapee pour ces sites.
export function extraireComparaisonCotes(match) {
  if (!match?.bookmakers?.length) return {};
  const parSportsbook = {};
  SPORTSBOOKS.forEach(sb => {
    if (!sb.oddsApiBookmakerKey) return;
    const bk = match.bookmakers.find(b => b.key === sb.oddsApiBookmakerKey);
    if (!bk) return;
    const marche = key => bk.markets?.find(m => m.key === key)?.outcomes || null;
    parSportsbook[sb.id] = {
      moneyline: marche('h2h'),
      spread: marche('spreads'),
      total: marche('totals'),
      lastUpdate: bk.last_update || null,
    };
  });
  return parSportsbook;
}

// Conversion cote decimale (format de The Odds API) -> cote americaine, pour l'affichage
// "format americain avec equivalent decimal" du comparateur. Retourne null si non convertible.
export function decimalToAmerican(decimal) {
  if (typeof decimal !== 'number' || !Number.isFinite(decimal) || decimal <= 1) return null;
  const americain = decimal >= 2 ? (decimal - 1) * 100 : -100 / (decimal - 1);
  return Math.round(americain);
}