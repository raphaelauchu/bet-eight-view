import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import { getUrl } from './nhlApi';

// Page "Favoris" (sidebar), style Wealthsimple Watchlist/Holdings : deux onglets commutables
// (Picks/Watchlist) sans changement de page, plus une vue agrandie plein ecran avec tableau.
// Reutilise les memes tables Supabase que l'onglet Analyses (watchlist_items/saved_picks, voir
// AnalysesFlux dans src/Analyses.js) mais avec sa propre lecture/realtime -- cette page est en
// LECTURE + retrait seulement : ajouter un favori ou "placer" un pick reste une action du
// contexte Analyses (match/joueur), pas dupliquee ici pour ne pas diverger de cette logique.

function IconExpand({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

async function resolverNomJoueur(id) {
  try {
    const res = await fetch(getUrl(`player/${id}/landing`));
    const d = await res.json();
    return { nom: `${d.firstName?.default || ''} ${d.lastName?.default || ''}`.trim() || String(id) };
  } catch { return { nom: String(id) }; }
}

function useFavorisData(utilisateur) {
  const [watchlist, setWatchlist] = useState([]);
  const [savedPicks, setSavedPicks] = useState([]);
  const [classement, setClassement] = useState([]);
  const [nomsJoueurs, setNomsJoueurs] = useState({});
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(getUrl('standings/now'));
        const data = await res.json();
        setClassement(data.standings || []);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!utilisateur?.id) { setChargement(false); return; }
    let annule = false;
    function rechargerWatchlist() {
      supabase.from('watchlist_items').select('*').eq('user_id', utilisateur.id).order('created_at', { ascending: false })
        .then(({ data }) => { if (!annule) setWatchlist(data || []); });
    }
    function rechargerPicks() {
      supabase.from('saved_picks').select('*').eq('user_id', utilisateur.id).eq('status', 'saved').order('created_at', { ascending: false })
        .then(({ data }) => { if (!annule) setSavedPicks(data || []); });
    }
    rechargerWatchlist();
    rechargerPicks();
    setChargement(false);
    const chWatch = supabase.channel(`favoris_watchlist_${utilisateur.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watchlist_items', filter: `user_id=eq.${utilisateur.id}` }, rechargerWatchlist)
      .subscribe();
    const chPicks = supabase.channel(`favoris_picks_${utilisateur.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_picks', filter: `user_id=eq.${utilisateur.id}` }, rechargerPicks)
      .subscribe();
    return () => { annule = true; supabase.removeChannel(chWatch); supabase.removeChannel(chPicks); };
  }, [utilisateur?.id]);

  // Les favoris "joueur" ne stockent que ref_id (id NHL) en base, jamais de nom -- resolu ici
  // depuis l'API NHL officielle (player/landing), jamais invente.
  useEffect(() => {
    const aResoudre = watchlist.filter(w => w.kind === 'player' && !nomsJoueurs[w.ref_id]);
    if (aResoudre.length === 0) return;
    let annule = false;
    Promise.all(aResoudre.map(w => resolverNomJoueur(w.ref_id))).then(resultats => {
      if (annule) return;
      setNomsJoueurs(prev => {
        const maj = { ...prev };
        aResoudre.forEach((w, i) => { maj[w.ref_id] = resultats[i]; });
        return maj;
      });
    });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist]);

  function libelleWatchlist(item) {
    if (item.kind === 'team') {
      const eq = classement.find(e => e.teamAbbrev?.default === item.ref_id);
      return eq?.teamName?.default || item.ref_id;
    }
    return nomsJoueurs[item.ref_id]?.nom || item.ref_id;
  }

  async function retirerWatchlist(item) { await supabase.from('watchlist_items').delete().eq('id', item.id); }
  async function retirerPick(id) { await supabase.from('saved_picks').delete().eq('id', id); }

  return { watchlist, savedPicks, chargement, libelleWatchlist, retirerWatchlist, retirerPick };
}

function EtatVide({ texte }) {
  return <div style={{ textAlign: 'center', color: 'var(--c-555)', fontSize: '13px', padding: '28px 10px' }}>{texte}</div>;
}

function LigneCompacte({ gauche, droite, onRemove, labelRemove }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 6px', borderRadius: '10px' }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-1a1a1a)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
      <div style={{ minWidth: 0 }}>{gauche}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {droite}
        <button onClick={onRemove} aria-label={labelRemove} style={{ background: 'none', border: 'none', color: 'var(--c-555)', cursor: 'pointer', fontSize: '13px', padding: '4px' }}>✕</button>
      </div>
    </div>
  );
}

function ListePicksCompacte({ t, picks, onRemove, chargement }) {
  if (chargement) return <EtatVide texte={t('favoris_chargement')} />;
  if (picks.length === 0) return <EtatVide texte={t('favoris_picks_vide')} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {picks.map(p => (
        <LigneCompacte key={p.id} onRemove={() => onRemove(p.id)} labelRemove={t('favoris_retirer')}
          gauche={(
            <>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--c-666)' }}>{p.market || '—'}{p.odds != null ? ` · ${p.odds}` : ''}{p.planned_stake != null ? ` · $${p.planned_stake}` : ''}</div>
            </>
          )}
        />
      ))}
    </div>
  );
}

function ListeWatchlistCompacte({ t, items, libelle, onRemove, chargement }) {
  if (chargement) return <EtatVide texte={t('favoris_chargement')} />;
  if (items.length === 0) return <EtatVide texte={t('favoris_watchlist_vide')} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {items.map(w => (
        <LigneCompacte key={w.id} onRemove={() => onRemove(w)} labelRemove={t('favoris_retirer')}
          gauche={<div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--c-white)' }}>{libelle(w)}</div>}
          droite={<span style={{ fontSize: '11px', color: 'var(--c-666)' }}>{w.kind === 'team' ? t('favoris_type_equipe') : t('favoris_type_joueur')}</span>}
        />
      ))}
    </div>
  );
}

const styleTh = { textAlign: 'left', fontSize: '11px', color: 'var(--c-555)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 12px', borderBottom: '1px solid var(--c-1a1a1a)', whiteSpace: 'nowrap' };
const styleTd = { padding: '12px', fontSize: '13px', color: 'var(--c-ccc)', borderBottom: '1px solid var(--c-141414)' };

function TablePicks({ t, lang, picks, onRemove, chargement }) {
  if (chargement) return <EtatVide texte={t('favoris_chargement')} />;
  if (picks.length === 0) return <EtatVide texte={t('favoris_picks_vide')} />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '680px' }}>
        <thead>
          <tr>
            <th style={styleTh}>{t('favoris_col_nom')}</th>
            <th style={styleTh}>{t('favoris_col_marche')}</th>
            <th style={styleTh}>{t('favoris_col_ligne')}</th>
            <th style={styleTh}>{t('favoris_col_cote')}</th>
            <th style={styleTh}>{t('favoris_col_mise')}</th>
            <th style={styleTh}>{t('favoris_col_note')}</th>
            <th style={styleTh}>{t('favoris_col_date')}</th>
            <th style={styleTh}></th>
          </tr>
        </thead>
        <tbody>
          {picks.map(p => (
            <tr key={p.id}>
              <td style={{ ...styleTd, fontWeight: '600', color: 'var(--c-white)' }}>{p.label}</td>
              <td style={styleTd}>{p.market || '—'}</td>
              <td style={styleTd}>{p.line ?? '—'}</td>
              <td style={styleTd}>{p.odds ?? '—'}</td>
              <td style={styleTd}>{p.planned_stake != null ? `$${p.planned_stake}` : '—'}</td>
              <td style={{ ...styleTd, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.note || '—'}</td>
              <td style={styleTd}>{new Date(p.created_at).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA')}</td>
              <td style={styleTd}><button onClick={() => onRemove(p.id)} aria-label={t('favoris_retirer')} style={{ background: 'none', border: 'none', color: 'var(--c-555)', cursor: 'pointer' }}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableWatchlist({ t, lang, items, libelle, onRemove, chargement }) {
  if (chargement) return <EtatVide texte={t('favoris_chargement')} />;
  if (items.length === 0) return <EtatVide texte={t('favoris_watchlist_vide')} />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '420px' }}>
        <thead>
          <tr>
            <th style={styleTh}>{t('favoris_col_nom')}</th>
            <th style={styleTh}>{t('favoris_col_type')}</th>
            <th style={styleTh}>{t('favoris_col_date')}</th>
            <th style={styleTh}></th>
          </tr>
        </thead>
        <tbody>
          {items.map(w => (
            <tr key={w.id}>
              <td style={{ ...styleTd, fontWeight: '600', color: 'var(--c-white)' }}>{libelle(w)}</td>
              <td style={styleTd}>{w.kind === 'team' ? t('favoris_type_equipe') : t('favoris_type_joueur')}</td>
              <td style={styleTd}>{new Date(w.created_at).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA')}</td>
              <td style={styleTd}><button onClick={() => onRemove(w)} aria-label={t('favoris_retirer')} style={{ background: 'none', border: 'none', color: 'var(--c-555)', cursor: 'pointer' }}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FavorisPage({ utilisateur, lang }) {
  const t = getT(lang);
  const { watchlist, savedPicks, chargement, libelleWatchlist, retirerWatchlist, retirerPick } = useFavorisData(utilisateur);
  const [onglet, setOnglet] = useState('picks'); // 'picks' | 'watchlist'
  const [agrandi, setAgrandi] = useState(false);

  const styleCarte = { backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', border: '1px solid var(--c-222)', padding: '16px' };
  const styleSegment = (actif) => ({ padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700', backgroundColor: actif ? '#f97316' : 'transparent', color: actif ? 'white' : 'var(--c-888)' });

  function Segmente() {
    return (
      <div style={{ display: 'inline-flex', backgroundColor: 'var(--c-111)', borderRadius: '24px', padding: '4px', gap: '4px' }}>
        <button style={styleSegment(onglet === 'picks')} onClick={() => setOnglet('picks')}>{t('favoris_tab_picks')}</button>
        <button style={styleSegment(onglet === 'watchlist')} onClick={() => setOnglet('watchlist')}>{t('favoris_tab_watchlist')}</button>
      </div>
    );
  }

  if (agrandi) {
    return (
      <div style={{ padding: '24px 28px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <button onClick={() => setAgrandi(false)} style={{ background: 'none', border: 'none', color: '#f97316', fontSize: '13px', fontWeight: '700', cursor: 'pointer', padding: 0 }}>{t('favoris_retour')}</button>
          <Segmente />
        </div>
        {onglet === 'picks'
          ? <TablePicks t={t} lang={lang} picks={savedPicks} onRemove={retirerPick} chargement={chargement} />
          : <TableWatchlist t={t} lang={lang} items={watchlist} libelle={libelleWatchlist} onRemove={retirerWatchlist} chargement={chargement} />}
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--c-white)' }}>{t('nav_tab_favoris')}</h2>
        <button onClick={() => setAgrandi(true)} aria-label={t('favoris_agrandir')} style={{ background: 'none', border: '1px solid var(--c-222)', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <IconExpand color="var(--c-888)" />
        </button>
      </div>
      <div style={{ marginBottom: '16px' }}><Segmente /></div>
      <div style={styleCarte}>
        {onglet === 'picks'
          ? <ListePicksCompacte t={t} picks={savedPicks} onRemove={retirerPick} chargement={chargement} />
          : <ListeWatchlistCompacte t={t} items={watchlist} libelle={libelleWatchlist} onRemove={retirerWatchlist} chargement={chargement} />}
      </div>
    </div>
  );
}
