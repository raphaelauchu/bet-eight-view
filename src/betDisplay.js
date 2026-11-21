// Titre d'affichage d'un bet importe (table bets_auto) : joueur (prop) > equipe misee
// (moneyline) > type. Fichier dedie (plutot que defini dans src/Dashboard.js, qui l'exportait
// avant) pour que src/Home.js et src/PerformanceInsights.js puissent l'utiliser sans importer
// Dashboard.js -- Dashboard.js importe desormais src/Bankroll.js (AddAccountSheet), qui importe
// lui-meme des utilitaires de src/Home.js : un import Home -> Dashboard aurait ferme un cycle
// (Dashboard -> Bankroll -> Home -> Dashboard).
export function titreBetAuto(bet) {
  if (bet.joueur_nom) return `${bet.joueur_nom} — ${bet.stat_type || ''} ${bet.ligne ?? ''}`.trim();
  if (bet.equipe) return `${bet.equipe} vs ${bet.adversaire || '?'}`;
  return bet.type_bet || '—';
}
