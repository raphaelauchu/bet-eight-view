import React, { useMemo, useState } from 'react';
import { filterPlayerGames, computeHitStats } from './landingFeaturesCalc';

// ===================== Carte interactive "Fiches joueur" (bloc 1, src/LandingFeaturesV2.js) ====
// Joueur FICTIF (initiales seulement, aucune photo), adversaires en codes fictifs a 3 lettres
// (texte seul, jamais un logo d'equipe). 18 matchs + 1 match "ce soir" (barre pointillee "?",
// jamais compte dans les stats -- il n'a pas encore ete joue). Valeurs choisies pour que la carte
// par defaut (aucun filtre, ligne 2.5) affiche exactement "83 % (15/18)" comme dans le cahier des
// charges -- voir landingFeaturesCalc.test.js pour la verification exacte de ce calcul.
const JEUX = [
  { value: 3, date: '21 oct', opponent: 'RVK', home: false },
  { value: 4, date: '23 oct', opponent: 'NDX', home: true },
  { value: 2, date: '25 oct', opponent: 'BRM', home: false },
  { value: 5, date: '27 oct', opponent: 'STV', home: true },
  { value: 3, date: '29 oct', opponent: 'LCX', home: false },
  { value: 4, date: '31 oct', opponent: 'ORB', home: true },
  { value: 1, date: '2 nov', opponent: 'RVK', home: false },
  { value: 3, date: '4 nov', opponent: 'NDX', home: true },
  { value: 5, date: '6 nov', opponent: 'BRM', home: false },
  { value: 4, date: '8 nov', opponent: 'STV', home: true },
  { value: 3, date: '10 nov', opponent: 'LCX', home: false },
  { value: 6, date: '12 nov', opponent: 'ORB', home: true },
  { value: 4, date: '14 nov', opponent: 'RVK', home: false },
  { value: 3, date: '16 nov', opponent: 'NDX', home: true },
  { value: 5, date: '18 nov', opponent: 'BRM', home: false },
  { value: 2, date: '20 nov', opponent: 'STV', home: true },
  { value: 4, date: '22 nov', opponent: 'LCX', home: false },
  { value: 3, date: '24 nov', opponent: 'ORB', home: true },
];
const CE_SOIR = { date: '26 nov', opponent: 'STM', home: true };
const ECHELLE_MAX = 7; // hauteur des barres fixee sur le max du jeu complet (6), pas du sous-ensemble filtre -- comparaison visuelle stable entre filtres.
const LIGNE_MIN = 0.5;
const LIGNE_MAX = 6.5;

const FILTRES = [
  { key: 'last5', labelKey: 'landing2_feat1_filter_last5' },
  { key: 'last10', labelKey: 'landing2_feat1_filter_last10' },
  { key: 'home', labelKey: 'landing2_feat1_filter_home' },
  { key: 'away', labelKey: 'landing2_feat1_filter_away' },
];

export default function LandingPlayerPropCard({ t }) {
  const [line, setLine] = useState(2.5);
  const [filter, setFilter] = useState(null); // null = aucun filtre actif (les 18 matchs)

  const filteredGames = useMemo(() => filterPlayerGames(JEUX, filter), [filter]);
  const stats = useMemo(() => computeHitStats(filteredGames, line), [filteredGames, line]);

  const toggleFilter = (key) => setFilter(prev => (prev === key ? null : key));
  const decreaseLine = () => setLine(l => Math.max(LIGNE_MIN, Math.round((l - 0.5) * 10) / 10));
  const increaseLine = () => setLine(l => Math.min(LIGNE_MAX, Math.round((l + 0.5) * 10) / 10));

  return (
    <div className="landing2-card landing2-prop-card">
      <div className="landing2-card-header">
        <div className="landing2-prop-player">
          <span className="landing2-avatar-circle" role="img" aria-label={t('landing2_feat1_player_alt')}>FR</span>
          <div>
            <div className="landing2-card-title">{t('landing2_feat1_card_title')}</div>
            <div className="landing2-prop-market">{t('landing2_feat1_player_name')} · {t('landing2_feat1_market')}</div>
          </div>
        </div>
        <div className="landing2-prop-stats">
          <div className="landing2-prop-stat">
            <span className="landing2-prop-stat-label">{t('landing2_feat1_avg_label')}</span>
            <span className="landing2-prop-stat-value">{stats.average.toFixed(1)}</span>
          </div>
          <div className="landing2-prop-stat">
            <span className="landing2-prop-stat-label">{t('home_stat_win_rate')}</span>
            <span className="landing2-prop-stat-value">{stats.rate}% ({stats.hits}/{stats.total})</span>
          </div>
        </div>
      </div>

      <div className="landing2-prop-filters" role="group">
        {FILTRES.map(f => (
          <button
            key={f.key}
            type="button"
            className={`landing2-pill ${filter === f.key ? 'landing2-pill-active' : ''}`}
            aria-pressed={filter === f.key}
            onClick={() => toggleFilter(f.key)}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      <div className="landing2-prop-line-control">
        <button type="button" className="landing2-step-btn" aria-label={t('landing2_feat1_decrease_line')} onClick={decreaseLine}>−</button>
        <span className="landing2-prop-line-value">{t('landing2_feat1_line_label')} {line.toFixed(1)}</span>
        <button type="button" className="landing2-step-btn" aria-label={t('landing2_feat1_increase_line')} onClick={increaseLine}>+</button>
      </div>

      <div className="landing2-prop-bars" role="img" aria-label={`${t('landing2_feat1_card_title')} -- ${t('landing2_feat1_player_alt')}`}>
        {filteredGames.map((g, i) => {
          const hit = g.value >= line;
          return (
            <div className="landing2-prop-bar-col" key={`${g.date}-${i}`}>
              <div className="landing2-prop-bar-track">
                <div
                  className={`landing2-prop-bar ${hit ? 'landing2-prop-bar-hit' : 'landing2-prop-bar-miss'}`}
                  style={{ height: `${Math.min(100, (g.value / ECHELLE_MAX) * 100)}%` }}
                >
                  <span className="landing2-prop-bar-value">{g.value}</span>
                </div>
                <div className="landing2-prop-line-marker" style={{ bottom: `${Math.min(100, (line / ECHELLE_MAX) * 100)}%` }} aria-hidden="true" />
              </div>
              <div className="landing2-prop-bar-caption">{g.date}<br />{g.opponent}</div>
            </div>
          );
        })}
        <div className="landing2-prop-bar-col">
          <div className="landing2-prop-bar-track">
            <div className="landing2-prop-bar landing2-prop-bar-tonight">
              <span className="landing2-prop-bar-value">?</span>
            </div>
          </div>
          <div className="landing2-prop-bar-caption">{t('landing2_feat1_tonight')}<br />{CE_SOIR.opponent}</div>
        </div>
      </div>

      <p className="landing2-card-caption">{t('landing2_demo_data_caption')}</p>
    </div>
  );
}
