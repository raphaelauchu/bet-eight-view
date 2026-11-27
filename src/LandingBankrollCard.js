import React, { useMemo, useState } from 'react';
import {
  computeAccountBalance, computeAtRisk, computePeriodStats, computeBankrollSeries, signColor,
} from './bankrollCalc';
import { MiniSparkline } from './Bankroll';
import { BetRow } from './BetRow';

// ===================== Carte interactive "Bankroll" (bloc 2, src/LandingFeaturesV2.js) =====
// Tous les chiffres affiches (solde, ROI, taux de reussite, courbe) passent par
// src/bankrollCalc.js -- jamais ecrits a la main -- appliques a ce jeu de donnees de
// DEMONSTRATION (depots/mises/retours fictifs, paris fictifs entre codes d'equipe fictifs
// reutilises du bloc "Fiches joueur"). `DEMO_NOW` fixe la reference temporelle des filtres de
// periode (1S/1M/Tout) : sans elle, isWithinPeriod() utiliserait la vraie date du jour et ces
// dates fixes (oct/nov 2026) finiraient par sortir silencieusement de "1S"/"1M" avec le temps.
const DEMO_NOW = new Date('2026-11-26T12:00:00');

const COMPTES = {
  bet99: {
    nom: 'BET99',
    transactions: [{ type: 'deposit', amount: 500, occurred_on: '2026-10-01' }],
    bets: [
      { status: 'won', stake: 40, odds: 1.91, profit: 36.4, datePlaced: '2026-10-05', dateSettlement: '2026-10-05', title: 'RVK @ NDX', bookmaker: 'BET99' },
      { status: 'lost', stake: 25, odds: 2.2, profit: -25, datePlaced: '2026-10-12', dateSettlement: '2026-10-12', title: 'S. Caron — 2+ tirs', bookmaker: 'BET99' },
      { status: 'won', stake: 30, odds: 1.8, profit: 24, datePlaced: '2026-11-02', dateSettlement: '2026-11-02', title: 'BRM @ STV', bookmaker: 'BET99' },
      { status: 'pending', stake: 20, odds: 2.5, profit: null, datePlaced: '2026-11-24', dateSettlement: null, title: 'LCX @ ORB', bookmaker: 'BET99' },
    ],
  },
  betway: {
    nom: 'Betway',
    transactions: [{ type: 'deposit', amount: 300, occurred_on: '2026-10-03' }],
    bets: [
      { status: 'lost', stake: 50, odds: 1.95, profit: -50, datePlaced: '2026-10-10', dateSettlement: '2026-10-10', title: 'NDX @ RVK', bookmaker: 'Betway' },
      { status: 'won', stake: 35, odds: 2.1, profit: 38.5, datePlaced: '2026-10-20', dateSettlement: '2026-10-20', title: 'F. Rainville — 3+ tirs', bookmaker: 'Betway' },
      { status: 'lost', stake: 20, odds: 3.0, profit: -20, datePlaced: '2026-11-05', dateSettlement: '2026-11-05', title: 'STV @ BRM', bookmaker: 'Betway' },
      { status: 'pending', stake: 15, odds: 1.7, profit: null, datePlaced: '2026-11-23', dateSettlement: null, title: 'ORB @ LCX', bookmaker: 'Betway' },
    ],
  },
  mise_o_jeu: {
    nom: 'Mise-o-jeu+',
    transactions: [
      { type: 'deposit', amount: 200, occurred_on: '2026-10-02' },
      { type: 'withdrawal', amount: 20, occurred_on: '2026-11-01' },
    ],
    bets: [
      { status: 'won', stake: 25, odds: 2.4, profit: 35, datePlaced: '2026-10-08', dateSettlement: '2026-10-08', title: 'RVK @ BRM', bookmaker: 'Mise-o-jeu+' },
      { status: 'won', stake: 15, odds: 1.6, profit: 9, datePlaced: '2026-10-18', dateSettlement: '2026-10-18', title: 'S. Caron — 1+ passe', bookmaker: 'Mise-o-jeu+' },
      { status: 'pending', stake: 10, odds: 2.0, profit: null, datePlaced: '2026-11-20', dateSettlement: null, title: 'NDX @ STV', bookmaker: 'Mise-o-jeu+' },
    ],
  },
};

const ORDRE_COMPTES = ['bet99', 'betway', 'mise_o_jeu'];
const PERIODES = [
  { key: '1w', labelKey: 'landing2_feat2_period_1w' },
  { key: '1m', labelKey: 'landing2_feat2_period_1m' },
  { key: 'all', labelKey: 'landing2_feat2_period_all' },
];

function dataForAccount(accountKey) {
  if (accountKey === 'all') {
    return {
      transactions: ORDRE_COMPTES.flatMap(k => COMPTES[k].transactions),
      bets: ORDRE_COMPTES.flatMap(k => COMPTES[k].bets),
    };
  }
  return COMPTES[accountKey];
}

const ORANGE = '#f97316';

export default function LandingBankrollCard({ t }) {
  const [accountKey, setAccountKey] = useState('bet99');
  const [period, setPeriod] = useState('1m');

  const { transactions, bets } = useMemo(() => dataForAccount(accountKey), [accountKey]);
  const balance = useMemo(() => computeAccountBalance(transactions, bets), [transactions, bets]);
  const atRisk = useMemo(() => computeAtRisk(bets), [bets]);
  const periodStats = useMemo(() => computePeriodStats(bets, period, DEMO_NOW), [bets, period]);
  const points = useMemo(() => {
    const { values, dates } = computeBankrollSeries(transactions, bets, period, 'value', DEMO_NOW);
    return values.map((v, i) => ({ date: dates[i], value: v }));
  }, [transactions, bets, period]);
  const recentBets = useMemo(() => [...bets].sort((a, b) => new Date(b.dateSettlement || b.datePlaced) - new Date(a.dateSettlement || a.datePlaced)).slice(0, 3), [bets]);

  const couleurCourbe = signColor(periodStats.profit, 'var(--c-666)');

  return (
    <div className="landing2-card landing2-bankroll-card">
      <div className="landing2-bankroll-accounts" role="group">
        {ORDRE_COMPTES.map(k => (
          <button
            key={k}
            type="button"
            className={`landing2-pill ${accountKey === k ? 'landing2-pill-active' : ''}`}
            aria-pressed={accountKey === k}
            onClick={() => setAccountKey(k)}
          >
            {COMPTES[k].nom}
          </button>
        ))}
        <button
          type="button"
          className={`landing2-pill ${accountKey === 'all' ? 'landing2-pill-active' : ''}`}
          aria-pressed={accountKey === 'all'}
          onClick={() => setAccountKey('all')}
        >
          {t('landing2_feat2_account_all')}
        </button>
      </div>

      <div className="landing2-bankroll-balance-row">
        <div>
          <div className="landing2-prop-stat-label">{t('landing2_feat2_available_label')}</div>
          <div className="landing2-bankroll-balance">${balance.toFixed(2)}</div>
        </div>
        <div className="landing2-bankroll-at-risk">
          <div className="landing2-prop-stat-label">{t('landing2_feat2_at_risk_label')}</div>
          <div className="landing2-bankroll-at-risk-value">${atRisk.toFixed(2)}</div>
        </div>
      </div>

      <MiniSparkline points={points} color={couleurCourbe} height={40} />

      <div className="landing2-bankroll-periods" role="group">
        {PERIODES.map(p => (
          <button
            key={p.key}
            type="button"
            className={`landing2-pill landing2-pill-sm ${period === p.key ? 'landing2-pill-active' : ''}`}
            aria-pressed={period === p.key}
            onClick={() => setPeriod(p.key)}
          >
            {t(p.labelKey)}
          </button>
        ))}
      </div>

      <div className="landing2-bankroll-stats">
        <div className="landing2-prop-stat">
          <span className="landing2-prop-stat-label">{t('home_stat_roi')}</span>
          <span className="landing2-prop-stat-value" style={{ color: signColor(periodStats.roi, 'var(--ws-text)') }}>{periodStats.roi >= 0 ? '+' : ''}{periodStats.roi.toFixed(1)}%</span>
        </div>
        <div className="landing2-prop-stat">
          <span className="landing2-prop-stat-label">{t('home_stat_win_rate')}</span>
          <span className="landing2-prop-stat-value">{periodStats.winRate}%</span>
        </div>
      </div>

      <div className="landing2-bankroll-recent-title">{t('home_recent_bets')}</div>
      <div className="landing2-bankroll-recent-bets">
        {recentBets.map((b, i) => (
          <BetRow key={i} t={t} title={b.title} bookmaker={b.bookmaker} odds={b.odds} stake={b.stake} status={b.status} profit={b.profit} bordered={i > 0} />
        ))}
      </div>

      <p className="landing2-card-caption">{t('landing2_demo_data_caption')}</p>
    </div>
  );
}
