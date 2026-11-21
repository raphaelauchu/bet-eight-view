// Fonctions pures de calcul pour les comptes de bankroll multiples (src/Bankroll.js, src/Home.js).
// Aucun appel reseau ici -- tout prend en entree des listes deja chargees (bankroll_accounts,
// bankroll_transactions, paris, bets_auto) et retourne des nombres/series. Permet de tester le
// calcul independamment de Supabase/React (voir bankrollCalc.test.js).
//
// Convention partagee avec src/Home.js (computeTodayChangeAmount, computeChartSeries) : un pari
// manuel (table `paris`) n'a qu'une seule date (date_pari), utilisee a la fois comme date de mise
// et date de reglement -- un bet importe (table `bets_auto`) a game_date/created_at (mise) et
// verified_at (reglement). normalizeBet() uniformise les deux sources vers une seule forme.

export function normalizeBet(entry, source) {
  if (source === 'paris') {
    const statut = entry.statut;
    const status = statut === 'actif' ? 'pending' : statut === 'gagne' ? 'won' : 'lost';
    return {
      id: `m-${entry.id}`,
      source: 'paris',
      accountId: entry.account_id || null,
      datePlaced: entry.date_pari || null,
      dateSettlement: entry.date_pari || null,
      status,
      stake: Number(entry.mise) || 0,
      odds: Number(entry.cote) || 0,
      profit: status === 'pending' ? null : (Number(entry.profit) || 0),
      match: entry.match || null,
      selection: entry.selection || null,
    };
  }
  // bets_auto
  const statut = entry.statut;
  const status = statut === 'pending' ? 'pending' : statut === 'gagne' ? 'won' : 'lost';
  return {
    id: `a-${entry.id}`,
    source: 'bets_auto',
    accountId: entry.account_id || null,
    datePlaced: entry.game_date || entry.created_at || null,
    dateSettlement: entry.verified_at || entry.created_at || null,
    status,
    stake: Number(entry.mise) || 0,
    odds: Number(entry.cote) || 0,
    profit: status === 'pending' ? null : (Number(entry.resultat) || 0),
    match: entry.equipe && entry.adversaire ? `${entry.equipe} vs ${entry.adversaire}` : null,
    selection: entry.joueur_nom || entry.type_bet || null,
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

export function computeTotalReturn(bets) {
  return settledBets(bets).reduce((a, b) => a + (b.profit || 0), 0);
}

export function computeTotalStaked(bets) {
  return settledBets(bets).reduce((a, b) => a + (b.stake || 0), 0);
}

export function computeROI(bets) {
  const staked = computeTotalStaked(bets);
  return staked > 0 ? (computeTotalReturn(bets) / staked) * 100 : 0;
}

// Solde = depots - retraits + profit realise des paris regles du compte.
export function computeAccountBalance(transactions, bets) {
  return computeNetDeposits(transactions) + computeTotalReturn(bets);
}

// En jeu = somme des mises des paris en attente du compte.
export function computeAtRisk(bets) {
  return pendingBets(bets).reduce((a, b) => a + (b.stake || 0), 0);
}

// Disponible = solde - en jeu.
export function computeAvailable(balance, atRisk) {
  return balance - atRisk;
}

export function computeWinRate(bets) {
  const settled = settledBets(bets);
  if (settled.length === 0) return 0;
  return Math.round((settled.filter(b => b.status === 'won').length / settled.length) * 100);
}

export function computeAverageOdds(bets) {
  const settled = settledBets(bets);
  if (settled.length === 0) return 0;
  return settled.reduce((a, b) => a + (b.odds || 0), 0) / settled.length;
}

// Meilleure journee (profit le plus eleve sur un seul jour de reglement), null s'il n'y a aucun
// pari regle.
export function computeBestDay(bets) {
  const byDay = new Map();
  for (const b of settledBets(bets)) {
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
    available: computeAvailable(balance, atRisk),
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

// Serie {values,dates,finalValue} pour la courbe : mode='value' -> profit cumulatif ($),
// mode='return' -> rendement cumulatif (%) = profit cumule / mise cumulee. Memes composants que
// src/Home.js computeChartSeries (le depot/retrait n'intervient JAMAIS ici, seulement le profit
// des paris regles -- voir computeAccountBalance pour le solde reel, qui lui en tient compte).
export function computeBankrollSeries(bets, period, mode, now = new Date()) {
  const filtered = settledBets(bets)
    .filter(b => isWithinPeriod(b.dateSettlement, period, now))
    .sort((a, b) => new Date(a.dateSettlement) - new Date(b.dateSettlement));

  let cumulProfit = 0;
  let cumulStake = 0;
  const dates = [];
  const values = filtered.map(b => {
    cumulProfit += b.profit || 0;
    cumulStake += b.stake || 0;
    dates.push(b.dateSettlement);
    return mode === 'return' ? (cumulStake > 0 ? (cumulProfit / cumulStake) * 100 : 0) : cumulProfit;
  });
  return { values, dates, finalValue: values.length ? values[values.length - 1] : 0 };
}

export function computeVariation(points) {
  if (!points || points.length < 2) return 0;
  return points[points.length - 1].value - points[0].value;
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
    const refDate = b.status === 'pending' ? b.datePlaced : b.dateSettlement;
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
    const refDate = b.status === 'pending' ? b.datePlaced : b.dateSettlement;
    return refDate && String(refDate).slice(0, 10) === dateStr;
  });
}

// ===================== Mapping sportsbook <-> kind de compte =====================
// BOOKMAKERS_SUPPORTES (src/bookmakers.js, libelles affiches dans les formulaires de pari) vs
// `kind` de bankroll_accounts (valeurs stables utilisees par la migration/l'UI). Le mapping
// couvre volontairement seulement les 4 sportsbooks reconnus par la migration -- tout le reste
// ('Mise au jeu', 'DraftKings', ou aucun) releve du compte "Autre"/"Principal".
export const BOOKMAKER_VERS_KIND = {
  'Bet365': 'bet365',
  'Betway': 'betway',
  'Bet99': 'bet99',
  'Sports Interaction': 'sports_interaction',
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
