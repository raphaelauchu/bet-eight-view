import React, { useMemo } from 'react';
import { getT } from './i18n';
import { useSaisonCourante } from './season';
import { buildFormation, PoolIceBoard } from './PoolLockerRoom';
import { Reveal, ProductShot } from './PublicShared';

// ===================== Page Pool publique (/pool) -- ambiance energique, contraste assume =====================
// Contraste volontaire avec l'accueil (clair/sobre) : fond sombre, cartes de joueurs "jeu
// video" -- reutilise le VRAI composant PlayerCard et la VRAIE vue formation (buildFormation +
// PoolIceBoard, voir src/PoolLockerRoom.js), jamais une image statique. Les joueurs affiches
// sont des EXEMPLES explicitement marques comme tels : noms generiques, ref_id non numeriques
// (jamais l'identifiant NHL d'un vrai joueur -- la photo echoue donc toujours et retombe sur
// les initiales, ce qui est le comportement normal et voulu ici). Formats et fonctions lus
// dans src/poolRules.js / src/Pool.js / src/PoolDraftRoom.js -- rien n'est invente.

const EXAMPLE_FORWARDS = ['Tremblay', 'Gagnon', 'Bouchard', 'Roy', 'Pelletier', 'Morin', 'Lavoie', 'Bergeron', 'Caron'];
const EXAMPLE_DEFENSE = ['Dubé', 'Gauthier', 'Fortin', 'Leblanc', 'Cloutier', 'Girard'];
const EXAMPLE_GOALIES = ['Beaulieu', 'Simard'];
const EXAMPLE_TEAMS = ['MTL', 'TOR', 'BOS', 'TBL', 'EDM', 'COL', 'VGK', 'NYR', 'CAR'];

function buildExampleRows() {
  const rows = [];
  EXAMPLE_FORWARDS.forEach((name, i) => rows.push({
    kind: 'player', ref_id: `exemple-f${i}`, label: name, pos_group: 'F',
    team_abbrev: EXAMPLE_TEAMS[i % EXAMPLE_TEAMS.length], total_points: 18 + ((i * 7) % 20), is_active: true, closed_reason: null, current_slot: null,
  }));
  EXAMPLE_DEFENSE.forEach((name, i) => rows.push({
    kind: 'player', ref_id: `exemple-d${i}`, label: name, pos_group: 'D',
    team_abbrev: EXAMPLE_TEAMS[(i + 2) % EXAMPLE_TEAMS.length], total_points: 10 + ((i * 5) % 14), is_active: true, closed_reason: null, current_slot: null,
  }));
  EXAMPLE_GOALIES.forEach((name, i) => rows.push({
    kind: 'player', ref_id: `exemple-g${i}`, label: name, pos_group: 'G',
    team_abbrev: EXAMPLE_TEAMS[(i + 4) % EXAMPLE_TEAMS.length], total_points: 12 + i * 3, is_active: true, closed_reason: null, current_slot: null,
  }));
  return rows;
}

const EXAMPLE_RULES = { poolType: 'classic', roster: { forwards: 9, defense: 6, goalies: 2, teamPicks: 1 } };

function FormationShowcase({ lang }) {
  const t = getT(lang);
  const seasonId = useSaisonCourante();
  const rows = useMemo(() => buildExampleRows(), []);
  const formation = useMemo(() => buildFormation(rows, EXAMPLE_RULES), [rows]);
  const allPoints = useMemo(() => rows.map(r => r.total_points), [rows]);
  return (
    <div className="pool-showcase-formation-wrap">
      <span className="ws-example-tag pool-showcase-example-tag">{t('ws_example_tag')}</span>
      <PoolIceBoard formation={formation} seasonId={seasonId} lang={lang} gamesToday={[]} injuries={{}} allPoints={allPoints} />
    </div>
  );
}

function PoolFormats({ lang }) {
  const t = getT(lang);
  const formats = [
    { title: t('pool_page_format1_title'), desc: t('pool_page_format1_desc'), shot: '/landing/pool-format-classic.png', alt: t('pool_page_format1_shot_alt') },
    { title: t('pool_page_format2_title'), desc: t('pool_page_format2_desc'), shot: '/landing/pool-format-fantasy.png', alt: t('pool_page_format2_shot_alt') },
  ];
  return (
    <section className="landing-section">
      <div className="landing-container">
        <Reveal className="landing-section-head">
          <h2 className="landing-h2">{t('pool_page_formats_title')}</h2>
          <p className="landing-section-sub">{t('pool_page_formats_sub')}</p>
        </Reveal>
        <div className="pool-showcase-format-grid">
          {formats.map((f, i) => (
            <Reveal as="article" className="pool-showcase-format-card" key={i}>
              <ProductShot src={f.shot} alt={f.alt} placeholderLabel={f.alt} ratio="4 / 3" />
              <h3 className="landing-h3">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className="pool-showcase-rules-list">
          <h3 className="landing-h3">{t('pool_page_rules_title')}</h3>
          <ul className="landing-alt-tags">
            {[1, 2, 3, 4, 5, 6].map(n => <li key={n}>{t(`pool_page_rule${n}`)}</li>)}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function WhyBetrics({ lang }) {
  const t = getT(lang);
  return (
    <section className="landing-section landing-section-alt">
      <div className="landing-container">
        <Reveal className="landing-section-head">
          <h2 className="landing-h2">{t('pool_page_why_title')}</h2>
        </Reveal>
        <div className="pool-showcase-why-grid">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <Reveal as="div" className="pool-showcase-why-item" key={n}>
              <span className="pool-showcase-why-number">{n}</span>
              <span>{t(`pool_page_why${n}`)}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FlowSteps({ lang }) {
  const t = getT(lang);
  return (
    <section className="landing-section">
      <div className="landing-container">
        <Reveal className="landing-section-head">
          <h2 className="landing-h2">{t('pool_page_flow_title')}</h2>
        </Reveal>
        <ol className="pool-showcase-flow">
          {[1, 2, 3, 4, 5].map(n => (
            <Reveal as="li" className="pool-showcase-flow-step" key={n}>
              <span className="pool-showcase-flow-number">{n}</span>
              <span className="landing-h3" style={{ margin: 0 }}>{t(`pool_page_flow${n}`)}</span>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function poolPageMeta(lang) {
  const t = getT(lang);
  return { title: `${t('pool_page_title')} — Betrics`, description: t('pool_page_subtitle') };
}

export default function PoolShowcase({ lang, onOpenAuth }) {
  const t = getT(lang);
  return (
    <main className="landing-root">
      <section className="landing-hero" style={{ paddingBottom: '48px' }}>
        <div className="landing-container landing-hero-inner">
          <Reveal className="landing-hero-copy">
            <h1 className="landing-h1">{t('pool_page_title')}</h1>
            <p className="landing-hero-sub">{t('pool_page_subtitle')}</p>
            <div className="landing-hero-actions">
              <button type="button" className="landing-btn landing-btn-primary landing-btn-lg" onClick={() => onOpenAuth('signup')}>
                {t('pool_page_cta')}
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="landing-container">
        <Reveal>
          <FormationShowcase lang={lang} />
        </Reveal>
      </div>

      <PoolFormats lang={lang} />
      <WhyBetrics lang={lang} />
      <FlowSteps lang={lang} />

      <section className="landing-section landing-final-cta">
        <div className="landing-container">
          <Reveal className="landing-final-inner">
            <h2 className="landing-h2">{t('pool_page_final_title')}</h2>
            <button type="button" className="landing-btn landing-btn-primary landing-btn-lg" onClick={() => onOpenAuth('signup')}>
              {t('pool_page_cta')}
            </button>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
