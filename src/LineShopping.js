import React, { useEffect, useState } from 'react';
import { getT } from './i18n';
import { supabase } from './supabase';
import {
  PROVINCES,
  STATUT,
  MISE_O_JEU,
  getSportsbooksPourProvince,
  getStatutLabelKey,
} from './sportsbooksConfig';
import { extraireComparaisonCotes, decimalToAmerican, getCotesLastUpdated } from './cotes';

const PROVINCE_STORAGE_KEY = 'betrics_province';

// Charge/persiste la province confirmee par l'utilisateur : profiles.province si connecte,
// localStorage sinon (le comparateur reste utilisable en lecture pour un visiteur non connecte,
// mais rien n'est enregistre cote serveur sans utilisateur authentifie).
function useProvinceUtilisateur(utilisateur) {
  const [province, setProvince] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    (async () => {
      if (!utilisateur?.id) {
        let local = null;
        try { local = window.localStorage.getItem(PROVINCE_STORAGE_KEY); } catch {}
        if (!annule) { setProvince(local || null); setChargement(false); }
        return;
      }
      try {
        const { data } = await supabase.from('profiles').select('province').eq('id', utilisateur.id).single();
        if (!annule) setProvince(data?.province || null);
      } catch {
        if (!annule) setProvince(null);
      }
      if (!annule) setChargement(false);
    })();
    return () => { annule = true; };
  }, [utilisateur?.id]);

  async function confirmerProvince(p) {
    setProvince(p);
    if (utilisateur?.id) {
      try {
        await supabase.from('profiles').upsert({ id: utilisateur.id, province: p, updated_at: new Date().toISOString() });
      } catch {}
    } else {
      try { window.localStorage.setItem(PROVINCE_STORAGE_KEY, p); } catch {}
    }
  }

  return { province, chargement, confirmerProvince };
}

function formatPrixAmericain(decimal) {
  const am = decimalToAmerican(decimal);
  if (am == null) return '-';
  return am > 0 ? `+${am}` : `${am}`;
}

function formatPrixDecimal(decimal) {
  if (typeof decimal !== 'number' || !Number.isFinite(decimal)) return null;
  return decimal.toFixed(2);
}

function moyenneDisponibles(valeurs) {
  const dispo = valeurs.filter(v => typeof v === 'number' && Number.isFinite(v));
  if (dispo.length === 0) return null;
  return dispo.reduce((a, b) => a + b, 0) / dispo.length;
}

// Cellule "cote" d'une colonne de marche : format americain + equivalent decimal, surlignage
// sobre si c'est la meilleure cote disponible de la colonne, ecart vs moyenne sinon.
function CelluleCote({ prix, meilleurPrix, moyenne, t }) {
  if (typeof prix !== 'number' || !Number.isFinite(prix)) {
    return <div style={{ textAlign: 'center', color: 'var(--c-555)', fontSize: '12px', padding: '8px 6px' }}>{t('comparateur_cotes_non_dispo')}</div>;
  }
  const estMeilleure = meilleurPrix != null && Math.abs(prix - meilleurPrix) < 1e-9;
  const ecartPct = moyenne ? ((prix - moyenne) / moyenne) * 100 : null;
  return (
    <div style={{
      textAlign: 'center',
      padding: '8px 6px',
      borderRadius: '8px',
      backgroundColor: estMeilleure ? 'rgba(249,115,22,0.10)' : 'transparent',
      border: estMeilleure ? '1px solid rgba(249,115,22,0.35)' : '1px solid transparent',
    }}>
      <div style={{ fontSize: '13px', fontWeight: estMeilleure ? '800' : '600', color: estMeilleure ? '#f97316' : 'var(--c-ddd)' }}>
        {formatPrixAmericain(prix)}
      </div>
      <div style={{ fontSize: '10px', color: 'var(--c-666)' }}>{formatPrixDecimal(prix)}</div>
      {ecartPct != null && !estMeilleure && (
        <div style={{ fontSize: '9px', color: 'var(--c-555)', marginTop: '2px' }}>
          {ecartPct > 0 ? '+' : ''}{ecartPct.toFixed(1)}% {t('comparateur_ecart_moyenne')}
        </div>
      )}
    </div>
  );
}

function EtiquetteStatut({ sportsbook, province, t }) {
  const statut = sportsbook.statutInfo?.statut;
  const cleLabel = getStatutLabelKey(statut, province);
  if (!cleLabel) return null;
  const estGris = statut === STATUT.GREY;
  const contenu = (
    <span style={{
      fontSize: '10px',
      fontWeight: '700',
      padding: '3px 8px',
      borderRadius: '20px',
      backgroundColor: estGris ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
      color: estGris ? '#ef4444' : '#22c55e',
      whiteSpace: 'nowrap',
    }}>
      {t(cleLabel)}
    </span>
  );
  if (!estGris) return contenu;
  return (
    <span title={t('sportsbook_statut_gris_qc_tooltip')} style={{ cursor: 'help' }}>
      {contenu}
    </span>
  );
}

// Un tableau "marche" (Moneyline / Total...) : une ligne par sportsbook visible, mise en
// evidence sobre de la meilleure cote par colonne, ecart vs moyenne sinon.
function TableauMarche({ titre, colonnes, sportsbooksVisibles, cotesParSite, province, t }) {
  const valeursParColonne = colonnes.map(col => sportsbooksVisibles.map(sb => col.valeur(cotesParSite[sb.id])));
  const meilleurParColonne = valeursParColonne.map(vals => {
    const dispo = vals.filter(v => typeof v === 'number' && Number.isFinite(v));
    return dispo.length ? Math.max(...dispo) : null;
  });
  const moyenneParColonne = valeursParColonne.map(moyenneDisponibles);

  return (
    <div style={{ backgroundColor: 'var(--c-0d0d0d)', borderRadius: '14px', border: '1px solid var(--c-222)', padding: '14px', marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', color: 'var(--c-666)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>{titre}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '420px', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: '10px', color: 'var(--c-555)', fontWeight: '700', padding: '4px 6px' }}>{t('comparateur_site_col')}</th>
              <th style={{ textAlign: 'left', fontSize: '10px', color: 'var(--c-555)', fontWeight: '700', padding: '4px 6px' }}>{t('comparateur_statut_col')}</th>
              {colonnes.map((col, i) => (
                <th key={i} style={{ fontSize: '10px', color: 'var(--c-555)', fontWeight: '700', padding: '4px 6px', textAlign: 'center' }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sportsbooksVisibles.map((sb, ligne) => (
              <tr key={sb.id} style={{ borderTop: '1px solid var(--c-161616)' }}>
                <td style={{ padding: '8px 6px', fontSize: '13px', color: 'var(--c-white)', fontWeight: '600' }}>{sb.nom}</td>
                <td style={{ padding: '8px 6px' }}><EtiquetteStatut sportsbook={sb} province={province} t={t} /></td>
                {colonnes.map((col, i) => (
                  <td key={i}>
                    <CelluleCote prix={valeursParColonne[i][ligne]} meilleurPrix={meilleurParColonne[i]} moyenne={moyenneParColonne[i]} t={t} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProvinceSelecteur({ valeurInitiale, t, styleSelect, styleBouton, onConfirmer }) {
  const [choix, setChoix] = useState(valeurInitiale || 'quebec');
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      <label htmlFor="comparateur-province-select" style={{ fontSize: '12px', color: 'var(--c-666)' }}>{t('comparateur_province_label')}</label>
      <select id="comparateur-province-select" value={choix} onChange={e => setChoix(e.target.value)} style={styleSelect}>
        {PROVINCES.map(p => <option key={p} value={p}>{t(`comparateur_province_${p}`)}</option>)}
      </select>
      <button style={{ ...styleBouton, backgroundColor: '#f97316', color: 'white', border: 'none' }} onClick={() => onConfirmer(choix)}>
        {t('comparateur_province_confirmer')}
      </button>
    </div>
  );
}

// Comparateur de cotes LNH multi-sportsbooks (bet365, Betway, BET99, Sports Interaction),
// a titre informatif, avec statut reglementaire par province (src/sportsbooksConfig.js).
// Reutilise la source de cotes existante (getCotesHockey/cotes.js) -- n'ajoute aucun scraping,
// aucun lien sortant, aucun logo, aucun bouton de pari. Rendu en plus de BlocCotesSportsbook
// (jamais a sa place) dans les ecrans qui l'utilisent.
export function ComparateurCotesLNH({ matchBrut, nom1, nom2, dejaJoue, utilisateur, lang = 'fr', cotesFetchedAt }) {
  const t = getT(lang);
  const { province, chargement, confirmerProvince } = useProvinceUtilisateur(utilisateur);
  const [modifierProvince, setModifierProvince] = useState(false);
  const [filtreRegulesSeulement, setFiltreRegulesSeulement] = useState(false);

  if (dejaJoue) return null;
  if (chargement) return null;

  const cotesParSite = extraireComparaisonCotes(matchBrut);
  const derniereMaj = cotesFetchedAt || null;

  const sportsbooksBase = getSportsbooksPourProvince(province);
  const sportsbooksVisibles = filtreRegulesSeulement
    ? sportsbooksBase.filter(sb => sb.statutInfo?.statut === STATUT.REGULATED)
    : sportsbooksBase;

  const ageLabelKey = province === 'ontario' ? 'comparateur_age_on' : province === 'alberta' ? 'comparateur_age_ab' : province === 'quebec' ? 'comparateur_age_qc' : null;
  const aideLabelKey = province === 'quebec' ? 'comparateur_aide_qc' : province === 'ontario' ? 'comparateur_aide_on' : province === 'alberta' ? 'comparateur_aide_ab' : null;

  const styleCarte = { backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', border: '1px solid var(--c-222)', padding: '18px', marginBottom: '18px' };
  const styleSelect = { padding: '8px 12px', backgroundColor: 'var(--c-111)', border: '1px solid var(--c-333)', borderRadius: '8px', color: 'var(--c-white)', fontSize: '13px' };
  const styleBouton = { padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--c-333)', backgroundColor: 'transparent', color: 'var(--c-ccc)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' };

  if (!province || modifierProvince) {
    return (
      <div style={styleCarte}>
        <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--c-white)', marginBottom: '10px' }}>{t('comparateur_titre')}</div>
        <ProvinceSelecteur
          valeurInitiale={province}
          t={t}
          styleSelect={styleSelect}
          styleBouton={styleBouton}
          onConfirmer={(choix) => { confirmerProvince(choix); setModifierProvince(false); }}
        />
      </div>
    );
  }

  if (province === 'autre') {
    return (
      <div style={styleCarte}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--c-white)' }}>{t('comparateur_titre')}</div>
          <button style={styleBouton} onClick={() => setModifierProvince(true)}>{t('comparateur_province_modifier')}</button>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--c-555)', fontSize: '13px', padding: '20px 0' }}>{t('comparateur_province_non_dispo')}</div>
      </div>
    );
  }

  const colonnesMoneyline = [
    { label: nom1, valeur: c => c?.moneyline?.find(o => (o.name || '').toLowerCase().includes(nom1.toLowerCase()) || nom1.toLowerCase().includes((o.name || '').toLowerCase()))?.price },
    { label: nom2, valeur: c => c?.moneyline?.find(o => (o.name || '').toLowerCase().includes(nom2.toLowerCase()) || nom2.toLowerCase().includes((o.name || '').toLowerCase()))?.price },
  ];
  const colonnesTotal = [
    { label: t('comparateur_total_over'), valeur: c => c?.total?.find(o => o.name === 'Over')?.price },
    { label: t('comparateur_total_under'), valeur: c => c?.total?.find(o => o.name === 'Under')?.price },
  ];

  return (
    <div style={styleCarte}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--c-white)' }}>{t('comparateur_titre')}</div>
          <div style={{ fontSize: '11px', color: 'var(--c-666)' }}>{t('comparateur_sub')}</div>
        </div>
        <button style={styleBouton} onClick={() => setModifierProvince(true)}>
          {t(`comparateur_province_${province}`)} · {t('comparateur_province_modifier')}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', margin: '10px 0 14px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--c-888)', cursor: 'pointer' }}>
          <input type="checkbox" checked={filtreRegulesSeulement} onChange={e => setFiltreRegulesSeulement(e.target.checked)} />
          {t('comparateur_filtre_regules')}
        </label>
        {ageLabelKey && (
          <span style={{ fontSize: '11px', color: 'var(--c-666)', fontWeight: '700' }}>{t(ageLabelKey)}</span>
        )}
      </div>

      {province === 'quebec' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--c-111)', borderRadius: '10px', marginBottom: '14px' }}>
          <span style={{ fontSize: '13px', color: 'var(--c-white)', fontWeight: '600' }}>{MISE_O_JEU.nom}</span>
          <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', backgroundColor: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>{t('sportsbook_miseojeu_statut')}</span>
        </div>
      )}

      {sportsbooksVisibles.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--c-555)', fontSize: '12px', padding: '16px 0' }}>{t('comparateur_cotes_non_dispo')}</div>
      ) : (
        <div>
          <TableauMarche titre={t('comparateur_moneyline')} colonnes={colonnesMoneyline} sportsbooksVisibles={sportsbooksVisibles} cotesParSite={cotesParSite} province={province} t={t} />
          <TableauMarche titre={t('comparateur_total_titre')} colonnes={colonnesTotal} sportsbooksVisibles={sportsbooksVisibles} cotesParSite={cotesParSite} province={province} t={t} />
        </div>
      )}

      <div style={{ fontSize: '10px', color: 'var(--c-555)', marginBottom: '10px' }}>
        {t('comparateur_maj')} {derniereMaj ? new Date(derniereMaj).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA') : '-'}
      </div>

      <div style={{ borderTop: '1px solid var(--c-161616)', paddingTop: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--c-888)', marginBottom: '4px' }}>{t('comparateur_jeu_responsable_titre')}</div>
        {aideLabelKey && <div style={{ fontSize: '10px', color: 'var(--c-555)', marginBottom: '2px' }}>{t(aideLabelKey)}</div>}
        <div style={{ fontSize: '9px', color: 'var(--c-444)', lineHeight: '1.5', marginTop: '6px' }}>{t('comparateur_mention_legale')}</div>
      </div>
    </div>
  );
}
