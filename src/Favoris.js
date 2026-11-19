import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getUrl } from './nhlApi';

// Donnees partagees Picks (saved_picks) / Watchlist (watchlist_items), utilisees par la carte
// "Holdings/Watchlist" de l'accueil (src/Home.js, HoldingsWatchlistCard) et sa vue agrandie.
// Reutilise les memes tables que l'onglet Analyses (voir AnalysesFlux dans src/Analyses.js)
// mais avec sa propre lecture/realtime -- LECTURE + retrait seulement : ajouter un favori ou
// "placer" un pick reste une action du contexte Analyses (match/joueur), pas dupliquee ici
// pour ne pas diverger de cette logique.

export function IconExpand({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

export function IconFilter({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </svg>
  );
}

export function IconStarFilled({ color = '#f97316', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1">
      <path d="M12 2.5 15.1 8.9l7.05 1.02-5.1 4.97 1.2 7.02L12 18.4l-6.25 3.5 1.2-7.02-5.1-4.97 7.05-1.02Z" />
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

export function useFavorisData(utilisateur) {
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

const styleTh = { textAlign: 'left', fontSize: '11px', color: 'var(--c-555)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 12px', borderBottom: '1px solid var(--c-1a1a1a)', whiteSpace: 'nowrap' };
const styleTd = { padding: '12px', fontSize: '13px', color: 'var(--c-ccc)', borderBottom: '1px solid var(--c-141414)' };

export function EtatVideFavoris({ texte }) {
  return <div style={{ textAlign: 'center', color: 'var(--c-555)', fontSize: '13px', padding: '28px 10px' }}>{texte}</div>;
}

export function TablePicks({ t, lang, picks, onRemove, chargement }) {
  if (chargement) return <EtatVideFavoris texte={t('favoris_chargement')} />;
  if (picks.length === 0) return <EtatVideFavoris texte={t('favoris_picks_vide')} />;
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

export function TableWatchlist({ t, lang, items, libelle, onRemove, chargement }) {
  if (chargement) return <EtatVideFavoris texte={t('favoris_chargement')} />;
  if (items.length === 0) return <EtatVideFavoris texte={t('favoris_watchlist_vide')} />;
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
