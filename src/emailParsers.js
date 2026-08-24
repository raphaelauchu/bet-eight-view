// Registre des parsers d'emails de confirmation de paris, par bookmaker.
// Chaque parser prend le texte brut (ou HTML) d'un email et retourne un objet
// compatible avec la table `bets_auto` (type_bet, joueur_nom, equipe, adversaire,
// stat_type, ligne, mise, cote, gain_potentiel, game_date, ...), ou `null` si
// l'email ne correspond pas au format attendu.
//
// Ce fichier ne contient volontairement aucune implémentation pour l'instant —
// seulement l'infrastructure (registre + interface) pour brancher les parsers
// plus tard, un bookmaker à la fois.

// TODO: implémenter le parser Bet99
// function parseBet99(emailRaw) { ... }

// TODO: implémenter le parser Mise au jeu
// function parseMiseAuJeu(emailRaw) { ... }

// TODO: implémenter le parser DraftKings
// function parseDraftKings(emailRaw) { ... }

// TODO: implémenter le parser Betway
// function parseBetway(emailRaw) { ... }

// TODO: implémenter le parser Bet365
// function parseBet365(emailRaw) { ... }

// TODO: implémenter le parser Sports Interaction
// function parseSportsInteraction(emailRaw) { ... }

export const EMAIL_PARSERS = {
  // 'Bet99': parseBet99,
  // 'Mise au jeu': parseMiseAuJeu,
  // 'DraftKings': parseDraftKings,
  // 'Betway': parseBetway,
  // 'Bet365': parseBet365,
  // 'Sports Interaction': parseSportsInteraction,
};

// TODO: point d'entrée appelé par le job/Edge Function de parsing (à créer).
// Devrait: lire les nouveaux emails Gmail pour les bookmakers actifs de
// `user_email_connections`, appeler le parser correspondant, insérer le
// résultat dans `bets_auto`, puis logger le succès/échec dans `email_parsing_logs`.
// export async function parseEmail(bookmaker, emailRaw) {
//   const parser = EMAIL_PARSERS[bookmaker];
//   if (!parser) return null;
//   return parser(emailRaw);
// }
