// Fonctions pures de calcul pour les comptes de bankroll multiples (src/Bankroll.js, src/Home.js).
// Aucun appel reseau ici -- tout prend en entree des listes deja chargees (bankroll_accounts,
// bankroll_transactions, paris, bets_auto) et retourne des nombres/series. Permet de tester le
// calcul independamment de Supabase/React (voir bankrollCalc.test.js).
import { titreBetAuto } from './betDisplay';
//
// Convention partagee avec src/Home.js (computeTodayChangeAmount, computeChartSeries) : un pari
// manuel (table `paris`) n'a qu'une seule date (date_pari), utilisee a la fois comme date de mise
// et date de reglement -- un bet importe (table `bets_auto`) a game_date/created_at (mise) et
// verified_at (reglement). normalizeBet() uniformise les deux sources vers une seule forme.
//
// `title` : LE libelle d'affichage (src/BetRow.js, utilise partout -- accueil, page de compte,
// calendrier) -- joueur (prop) > equipe misee (moneyline) > type, via titreBetAuto (meme fonction
// que l'accueil, voir src/betDisplay.js) pour bets_auto ; texte libre de l'utilisateur pour un
// pari manuel (`paris.match`). Ne PAS utiliser `match`/`selection` separement pour l'affichage :
// ils restent exposes pour compatibilite mais `selection` seul (ex. juste "Alexandre Texier",
// sans la ligne statistique) etait la source du libelle incoherent entre l'accueil et la page de
// compte -- voir le CHANGELOG de cette fonction.

// Statut brut ('actif'/'pending' | 'gagne' | 'perdu' | 'annule') -> statut normalise. 'annule'
// (push/void : la mise est remboursee, aucun gain ni perte net) est un statut REGLE (status !==
// 'pending', voir settledBets/computeSettledReturns -- la mise, deja retiree du solde a la
// creation du pari comme tous les autres, doit bien y revenir integralement) mais exclu des
// statistiques de performance (voir decidedBets ci-dessous) : un pari annule ne compte ni comme
// gagne ni comme perdu, jamais une defaite deguisee dans le taux de reussite/ROI.
function statusFromStatut(statut, pendingValue) {
  if (statut === pendingValue) return 'pending';
  if (statut === 'gagne') return 'won';
  if (statut === 'annule') return 'cancelled';
  return 'lost';
}

export function normalizeBet(entry, source) {
  if (source === 'paris') {
    const status = statusFromStatut(entry.statut, 'actif');
    return {
      id: `m-${entry.id}`,
      source: 'paris',
      accountId: entry.account_id || null,
      datePlaced: entry.date_pari || null,
      dateSettlement: entry.date_pari || null,
      status,
      stake: Number(entry.mise) || 0,
      odds: Number(entry.cote) || 0,
      profit: status === 'pending' ? null : status === 'cancelled' ? 0 : (Number(entry.profit) || 0),
      bookmaker: entry.bookmaker || null,
      title: entry.match || entry.selection || null,
      match: entry.match || null,
      selection: entry.selection || null,
      // 'player' (prop joueur) vs 'match' (tout le reste : moneyline/total/parlay) -- filtre
      // "type de pari" de src/Bets.js. `raw` : la ligne brute paris/bets_auto, pour reconstruire
      // l'objet {type,data} attendu par BetDetailSheet.js sans dupliquer les champs ici.
      kind: entry.type_pari === 'prop' ? 'player' : 'match',
      raw: entry,
    };
  }
  // bets_auto
  const status = statusFromStatut(entry.statut, 'pending');
  return {
    id: `a-${entry.id}`,
    source: 'bets_auto',
    accountId: entry.account_id || null,
    datePlaced: entry.game_date || entry.created_at || null,
    dateSettlement: entry.verified_at || entry.created_at || null,
    status,
    stake: Number(entry.mise) || 0,
    odds: Number(entry.cote) || 0,
    profit: status === 'pending' ? null : status === 'cancelled' ? 0 : (Number(entry.resultat) || 0),
    bookmaker: entry.bookmaker || null,
    title: titreBetAuto(entry),
    match: entry.equipe && entry.adversaire ? `${entry.equipe} vs ${entry.adversaire}` : null,
    selection: entry.joueur_nom || entry.type_bet || null,
    kind: entry.type_bet === 'Prop joueur' ? 'player' : 'match',
    raw: entry,
  };
}

// Fusionne paris + bets_auto (deja charges pour l'utilisateur) en une seule liste de bets
// normalises -- utilise partout ailleurs dans ce fichier.
export function normalizeAllBets(paris, betsAuto) {
  return [
    ...(paris || []).map(p => normalizeBet(p, 'paris')),
    ...(betsAuto || []).map(b => normalizeBet(b, 'bets_auto')),
  ];
}

export function betsForAccount(bets, accountId) {
  return (bets || []).filter(b => b.accountId === accountId);
}

export function settledBets(bets) {
  return (bets || []).filter(b => b.status !== 'pending');
}

export function pendingBets(bets) {
  return (bets || []).filter(b => b.status === 'pending');
}

// Paris DECIDES (gagne/perdu uniquement, PAS annule) -- utilise pour toutes les statistiques de
// PERFORMANCE (ROI, taux de reussite, mise moyenne/cote moyenne, meilleure journee) : un pari
// annule n'a jamais ete un risque reellement couru (sa mise est remboursee, voir
// computeSettledReturns/computeAccountBalance qui eux utilisent toujours settledBets, PAS
// decidedBets -- la mise doit quand meme revenir au solde). Ne JAMAIS utiliser settledBets() pour
// une statistique de performance : un pari annule y compterait comme une defaite deguisee
// (mise comptee au denominateur, 0% de retour).
export function decidedBets(bets) {
  return (bets || []).filter(b => b.status === 'won' || b.status === 'lost');
}

// Date de reference d'un pari pour le regroupement/filtrage par periode : date de mise tant
// qu'il est en cours, date de reglement une fois decide (ou annule) -- meme convention partagee
// par buildMonthCalendar/betsForDay ci-dessous et par src/Bets.js (filtre de periode + regroupement
// par jour de la liste).
export function refDateForBet(b) {
  return b.status === 'pending' ? b.datePlaced : b.dateSettlement;
}

// ===================== Solde d'un compte =====================

export function sumDeposits(transactions) {
  return (transactions || []).filter(tx => tx.type === 'deposit').reduce((a, tx) => a + (Number(tx.amount) || 0), 0);
}

export function sumWithdrawals(transactions) {
  return (transactions || []).filter(tx => tx.type === 'withdrawal').reduce((a, tx) => a + (Number(tx.amount) || 0), 0);
}

export function computeNetDeposits(transactions) {
  return sumDeposits(transactions) - sumWithdrawals(transactions);
}

// Profit/mise des paris DECIDES uniquement (gagne/perdu, jamais annule -- voir decidedBets) --
// le ROI et le "rendement" affiches restent bases sur la performance reelle, jamais dilues par
// un pari en cours ni par un pari annule (mise remboursee, aucun risque reellement couru). Ne
// pas confondre avec computeSettledReturns ci-dessous (le MONTANT retourne au solde, qui lui
// inclut bien les annules -- voir decidedBets pour le detail de cette distinction).
export function computeTotalReturn(bets) {
  return decidedBets(bets).reduce((a, b) => a + (b.profit || 0), 0);
}

export function computeTotalStaked(bets) {
  return decidedBets(bets).reduce((a, b) => a + (b.stake || 0), 0);
}

// Mises de TOUS les paris (regles + en cours) -- utilise pour le solde (une mise sort du solde
// des la creation du pari, pas seulement une fois regle) et pour l'affichage "Total Staked" (qui
// ne doit plus afficher 0$ quand un pari est en jeu, voir src/Bankroll.js).
export function computeTotalStakedAll(bets) {
  return (bets || []).reduce((a, b) => a + (b.stake || 0), 0);
}

// Montant retourne par les paris REGLES (pas le profit net) : gagnant -> mise x cote, perdant ->
// 0, push/annule -> mise remboursee. Equivaut a mise + profit, le profit etant deja stocke par
// pari avec cette meme convention (gagne : mise*cote-mise ; perdu : -mise ; push : 0 si jamais
// un statut push existe un jour). C'est ce montant, PAS le profit, qui revient dans le solde au
// reglement (voir computeAccountBalance).
export function computeSettledReturns(bets) {
  return settledBets(bets).reduce((a, b) => a + (b.stake || 0) + (b.profit || 0), 0);
}

export function computeROI(bets) {
  const staked = computeTotalStaked(bets);
  return staked > 0 ? (computeTotalReturn(bets) / staked) * 100 : 0;
}

// Solde d'un compte = depots - retraits - mises de TOUS les paris (la mise sort du solde des la
// creation du pari, qu'il soit encore en cours ou deja regle) + montant retourne par les paris
// REGLES (voir computeSettledReturns). Un pari en cours ampute donc deja le solde de sa mise --
// "Disponible" = ce solde directement, "En jeu" (computeAtRisk) est seulement informatif,
// affiche a part, jamais soustrait une seconde fois.
//
// Exemple (depot 50$, mise 50$) : en cours -> solde 0$ ; gagnant a la cote 2.0 -> solde 100$
// (mise+profit renvoyes = 50+50) ; perdant -> solde 0$ (0 renvoye) ; push -> solde 50$ (mise
// remboursee). Voir bankrollCalc.test.js.
export function computeAccountBalance(transactions, bets) {
  return computeNetDeposits(transactions) - computeTotalStakedAll(bets) + computeSettledReturns(bets);
}

// En jeu = somme des mises des paris en attente du compte -- purement informatif desormais (le
// solde, ci-dessus, a DEJA retire ces mises) : ne jamais le re-soustraire de computeAccountBalance.
export function computeAtRisk(bets) {
  return pendingBets(bets).reduce((a, b) => a + (b.stake || 0), 0);
}

// Disponible = le solde du compte directement (retrait maximum). Le solde exclut deja les mises
// en cours (voir computeAccountBalance) : ne plus soustraire "en jeu" une seconde fois ici.
export function computeAvailable(balance) {
  return balance;
}

// Un nouveau pari ne peut jamais depasser le disponible ACTUEL du compte (avant l'ajout de ce
// pari) -- verification cote app, en plus du trigger cote base (voir
// supabase/migrations/20261125_bet_stake_balance.sql) qui l'applique aussi a l'insertion directe.
export function canPlaceBet(transactions, existingBets, stake) {
  return (Number(stake) || 0) <= computeAccountBalance(transactions, existingBets);
}

export function computeWinRate(bets) {
  const decided = decidedBets(bets);
  if (decided.length === 0) return 0;
  return Math.round((decided.filter(b => b.status === 'won').length / decided.length) * 100);
}

export function computeAverageOdds(bets) {
  const decided = decidedBets(bets);
  if (decided.length === 0) return 0;
  return decided.reduce((a, b) => a + (b.odds || 0), 0) / decided.length;
}

// Meilleure journee (profit le plus eleve sur un seul jour de reglement), null s'il n'y a aucun
// pari decide. decidedBets (pas settledBets) : un pari annule contribue toujours 0 au profit,
// l'exclure ou pas ne change jamais quel jour est "le meilleur" -- mais reste coherent avec le
// reste de ce bloc (une statistique de PERFORMANCE, jamais de solde).
export function computeBestDay(bets) {
  const byDay = new Map();
  for (const b of decidedBets(bets)) {
    if (!b.dateSettlement) continue;
    const day = String(b.dateSettlement).slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + (b.profit || 0));
  }
  let best = null;
  for (const [day, profit] of byDay.entries()) {
    if (!best || profit > best.profit) best = { day, profit };
  }
  return best;
}

// ===================== Bankroll globale (somme des comptes non archives) =====================

// `accounts` : [{ id, archivedAt, transactions, bets }] -- chaque compte apporte ses propres
// transactions/bets deja filtres par compte (voir betsForAccount).
export function computeAccountSummary(account) {
  const balance = computeAccountBalance(account.transactions, account.bets);
  const atRisk = computeAtRisk(account.bets);
  return {
    id: account.id,
    balance,
    atRisk,
    available: computeAvailable(balance),
    netDeposits: computeNetDeposits(account.transactions),
    totalReturn: computeTotalReturn(account.bets),
    roi: computeROI(account.bets),
  };
}

export function computeGlobalBankroll(accounts) {
  return (accounts || [])
    .filter(a => !a.archivedAt)
    .reduce((sum, a) => sum + computeAccountBalance(a.transactions, a.bets), 0);
}

// ===================== Courbe / periodes =====================

export const BANKROLL_PERIODS = ['1d', '1w', '1m', '3m', '6m', 'ytd', '1y', 'all'];
const JOURS_PAR_PERIODE = { '1d': 1, '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365 };

export function isWithinPeriod(dateStr, period, now = new Date()) {
  if (!dateStr) return false;
  if (period === 'all') return true;
  const d = new Date(dateStr);
  if (period === 'ytd') return d.getFullYear() === now.getFullYear();
  const jours = JOURS_PAR_PERIODE[period] ?? JOURS_PAR_PERIODE['1m'];
  return (now - d) / 86400000 <= jours;
}

// Historique CHRONOLOGIQUE COMPLET (jamais filtre par periode) du solde, evenement par
// evenement : depot/retrait a sa date (tx.occurred_on), mise retiree a la date de PLACEMENT du
// pari (evenement -mise), montant retourne ajoute a la date de REGLEMENT (evenement +montant
// retourne, gagnant: mise*cote, perdant: 0, annule/push: mise remboursee -- voir
// computeSettledReturns). cumul demarre a 0 avant le tout premier evenement. Comme chaque valeur
// est un solde ABSOLU (pas une variation relative a une fenetre), le DERNIER point de l'historique
// complet egale toujours exactement computeAccountBalance(transactions, bets) -- et selectionner
// n'importe quel sous-ensemble chronologique final (voir computeBankrollSeries mode='value', qui
// filtre ces points par periode) preserve cette egalite pour la periode 'all'.
export function computeBalanceHistory(transactions, bets) {
  const events = [];
  for (const tx of transactions || []) {
    if (tx.type === 'deposit') events.push({ date: tx.occurred_on, delta: Number(tx.amount) || 0 });
    else if (tx.type === 'withdrawal') events.push({ date: tx.occurred_on, delta: -(Number(tx.amount) || 0) });
  }
  for (const b of bets || []) {
    if (b.datePlaced) events.push({ date: b.datePlaced, delta: -(b.stake || 0) });
    if (b.status !== 'pending' && b.dateSettlement) events.push({ date: b.dateSettlement, delta: (b.stake || 0) + (b.profit || 0) });
  }
  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  let cumul = 0;
  return events.map(e => { cumul += e.delta; return { date: e.date, value: cumul }; });
}

// Serie {values,dates,finalValue} pour la courbe (src/Home.js:BankrollHeroChart,
// src/Bankroll.js:BankrollOverview/AccountDetail/AccountCard -- SEULE source de cette courbe,
// ne jamais recalculer une variante locale).
//
// mode='value' : solde ABSOLU reconstruit par computeBalanceHistory ci-dessus, simplement
// restreint aux points dont la date tombe dans la periode choisie -- PAS une serie qui repart de
// zero a chaque periode. Consequence directe et voulue : le dernier point est TOUJOURS le solde
// reel actuel (voir computeAccountBalance), quelle que soit la periode selectionnee, puisque le
// dernier evenement chronologique de l'historique complet tombe forcement dans n'importe quelle
// periode incluant "maintenant". Le sous-titre/ROI affiches par l'appelant ne doivent PAS etre
// derives de la variation brute de cette courbe (un depot/retrait dans la periode y apparait
// comme un saut qui n'est pas de la "performance") -- voir computePeriodStats, qui isole le
// profit hors depots/retraits.
//
// mode='return' : profit CUMULE en $ (pas un pourcentage) des paris REGLES uniquement, a leur
// date de REGLEMENT -- jamais de depot/retrait ici. Sur la periode 'all', le dernier point egale
// exactement computeTotalReturn(bets) (= la carte "Total return"), puisque les deux sommes
// portent sur exactement les memes paris decides.
export function computeBankrollSeries(transactions, bets, period, mode, now = new Date()) {
  if (mode === 'return') {
    const filtered = settledBets(bets)
      .filter(b => isWithinPeriod(b.dateSettlement, period, now))
      .sort((a, b) => new Date(a.dateSettlement) - new Date(b.dateSettlement));

    let cumulProfit = 0;
    const dates = [];
    const values = filtered.map(b => {
      cumulProfit += b.profit || 0;
      dates.push(b.dateSettlement);
      return cumulProfit;
    });
    return { values, dates, finalValue: values.length ? values[values.length - 1] : 0 };
  }

  const history = computeBalanceHistory(transactions, bets).filter(p => isWithinPeriod(p.date, period, now));
  return {
    values: history.map(p => p.value),
    dates: history.map(p => p.date),
    finalValue: history.length ? history[history.length - 1].value : 0,
  };
}

export function computeVariation(points) {
  if (!points || points.length < 2) return 0;
  return points[points.length - 1].value - points[0].value;
}

// ===================== Statistiques de performance pour UNE periode =====================
// Source UNIQUE des cartes ROI / Taux de reussite / Paris actifs partout dans l'app (accueil
// src/Home.js:StatsRow, page de compte src/Bankroll.js:AccountDetail, Performance insights
// src/PerformanceInsights.js) -- memes periode ET base de date que la courbe du graphique
// (computeBankrollSeries) : refDateForBet (date de REGLEMENT pour un pari decide, date de
// PLACEMENT pour un pari encore en cours), jamais la date de placement d'un pari deja regle. Un
// pari annule (push) n'est ni gagne ni perdu : exclu de decidedCount/winRate/roi, voir
// decidedBets. "Active bets" compte les paris encore en jeu PLACES dans la periode (meme filtre
// refDateForBet que le reste) -- changer la periode du graphique change donc aussi ce nombre,
// par coherence avec le reste de cette fonction.
export function computePeriodStats(bets, period, now = new Date()) {
  const inPeriod = (bets || []).filter(b => isWithinPeriod(refDateForBet(b), period, now));
  const decided = decidedBets(inPeriod);
  const pending = inPeriod.filter(b => b.status === 'pending');

  const profit = decided.reduce((a, b) => a + (b.profit || 0), 0);
  const staked = decided.reduce((a, b) => a + (b.stake || 0), 0);
  const returns = decided.reduce((a, b) => a + (b.stake || 0) + (b.profit || 0), 0);
  const wonCount = decided.filter(b => b.status === 'won').length;
  const lostCount = decided.length - wonCount;
  const roi = staked > 0 ? (profit / staked) * 100 : 0;
  const winRate = decided.length > 0 ? Math.round((wonCount / decided.length) * 100) : 0;
  const unrealized = computeUnrealizedProfit(pending);

  return {
    profit, staked, returns, roi, winRate, wonCount, lostCount,
    decidedCount: decided.length, activeCount: pending.length, unrealized,
    totalWithUnrealized: profit + unrealized,
  };
}

// Profit potentiel (pas encore gagne ni perdu) des paris EN COURS : mise x cote - mise. Toujours
// 0 pour un pari sans cote renseignee. Separe de computePeriodStats pour pouvoir aussi calculer
// un "profit non realise" global, non borne a une periode (voir PerformanceInsights.js).
export function computeUnrealizedProfit(bets) {
  return pendingBets(bets).reduce((a, b) => a + ((b.stake || 0) * (b.odds || 0) - (b.stake || 0)), 0);
}

// ===================== Couleur selon le signe =====================
// Regle partagee par TOUT chiffre affiche (gros chiffre, sous-titre, badge ROI...) : la couleur
// depend UNIQUEMENT du signe de CE chiffre (vert > 0, rouge < 0, `neutral` si exactement 0) --
// jamais de la variation d'un graphique ou d'un autre chiffre. Voir computePeriodStats.profit
// pour la couleur de la courbe elle-meme (tendance reelle de la periode affichee).
export function signColor(value, neutral = 'var(--c-white)') {
  if (!(value > 0) && !(value < 0)) return neutral; // couvre aussi NaN/undefined/null
  return value > 0 ? '#22c55e' : '#ef4444';
}

// ===================== Formatage compact (calendrier) =====================

// $876 (sous 1000), 1.8k (1000+), -2.3k pour une perte -- jamais de signe + explicite ici (les
// tuiles du calendrier portent deja la couleur verte/rouge, voir BankrollCalendar.js).
export function formatCompactAmount(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

// ===================== Calendrier mensuel de profit =====================

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// `new Date('YYYY-MM-DD')` est interprete en UTC (pas en heure locale) -- dans un fuseau a l'ouest
// de l'UTC, minuit UTC retombe la veille en heure locale, ce qui decalerait les paris d'un jour
// dans le calendrier. Les composants annee/mois/jour sont donc extraits directement de la chaine
// quand elle commence par YYYY-MM-DD, sans jamais passer par un Date UTC intermediaire.
function parseLocalDate(dateStr) {
  const s = String(dateStr);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

// Grille Dim-Sam du mois (year, monthIndex 0-based) : chaque cellule est soit un jour du mois
// (avec profit agrege + hasSettled/hasPending), soit null (case de remplissage hors mois, pour
// garder des semaines completes de 7 colonnes).
export function buildMonthCalendar(bets, year, monthIndex) {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0=dimanche

  const byDay = new Map();
  for (const b of bets || []) {
    const refDate = refDateForBet(b);
    if (!refDate) continue;
    const d = parseLocalDate(refDate);
    if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
    const key = dateKey(d);
    const entry = byDay.get(key) || { profit: 0, hasSettled: false, hasPending: false };
    if (b.status === 'pending') entry.hasPending = true;
    else { entry.hasSettled = true; entry.profit += b.profit || 0; }
    byDay.set(key, entry);
  }

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    const key = dateKey(d);
    const entry = byDay.get(key) || { profit: 0, hasSettled: false, hasPending: false };
    cells.push({ date: key, dayNum: day, ...entry });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const monthProfit = [...byDay.values()].reduce((a, e) => a + (e.hasSettled ? e.profit : 0), 0);
  return { weeks, monthProfit };
}

export function betsForDay(bets, dateStr) {
  return (bets || []).filter(b => {
    const refDate = refDateForBet(b);
    return refDate && String(refDate).slice(0, 10) === dateStr;
  });
}

// ===================== Mapping sportsbook <-> kind de compte =====================
// BOOKMAKERS_SUPPORTES (src/bookmakers.js, libelles affiches dans les formulaires de pari) vs
// `kind` de bankroll_accounts (valeurs stables utilisees par la migration/l'UI). Le mapping
// couvre volontairement seulement les 5 sportsbooks reconnus par la migration -- tout le reste
// ('DraftKings', ou aucun) releve d'un compte "Autre" cree par l'utilisateur (aucun compte par
// defaut/cache n'existe, voir src/Bankroll.js). Mise-o-jeu+ n'a aucune cote en direct (voir
// src/sportsbooksConfig.js/src/LineShopping.js, qui ne l'incluent pas) -- ses cotes restent
// toujours saisies manuellement dans Add Bet.
export const BOOKMAKER_VERS_KIND = {
  'Bet365': 'bet365',
  'Betway': 'betway',
  'Bet99': 'bet99',
  'Sports Interaction': 'sports_interaction',
  'Mise-o-jeu+': 'mise_o_jeu',
};

export const KIND_VERS_BOOKMAKER = Object.fromEntries(Object.entries(BOOKMAKER_VERS_KIND).map(([k, v]) => [v, k]));

export function bookmakerDepuisKind(kind) {
  return KIND_VERS_BOOKMAKER[kind] || null;
}

// Bookmaker a pre-remplir (derive du compte, voir BetAutoForm.js) quand l'utilisateur choisit un
// compte dans le formulaire de pari -- `accounts` = lignes brutes bankroll_accounts. null si le
// compte est introuvable ou de kind 'other' (aucun sportsbook associe).
export function autoBookmakerForAccount(accounts, accountId) {
  const compte = (accounts || []).find(a => a.id === accountId);
  return compte ? bookmakerDepuisKind(compte.kind) : null;
}
