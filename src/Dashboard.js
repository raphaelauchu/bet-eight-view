import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getT } from './i18n';
import BetImportFlow from './BetImportFlow';
import BetDetailSheet from './BetDetailSheet';
import { fichierVersJpegBase64 } from './imageUtils';
import { BET_TYPES } from './betTypes';

// Titre d'affichage d'un bet importe : joueur (prop) > equipe misee (moneyline) > type
function titreBetAuto(bet) {
  if (bet.joueur_nom) return `${bet.joueur_nom} — ${bet.stat_type || ''} ${bet.ligne ?? ''}`.trim();
  if (bet.equipe) return `${bet.equipe} vs ${bet.adversaire || '?'}`;
  return bet.type_bet || '—';
}

function Dashboard({ lang = 'en' }) {
  const t = getT(lang);
  const [paris, setParis] = useState([]);
  const [bankroll, setBankrollState] = useState(1000);
  const [afficherImport, setAfficherImport] = useState(false);
  const [imageImport, setImageImport] = useState(null); // { apercu, base64 }
  const [erreurImport, setErreurImport] = useState('');
  const galerieInputRef = useRef(null);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState('actifs');
  const [betsAuto, setBetsAuto] = useState([]);
  const [betSelectionne, setBetSelectionne] = useState(null);
  const [montantBankroll, setMontantBankroll] = useState('');
  const [filtreGraphique, setFiltreGraphique] = useState('30d');
  const [filtrePeriode, setFiltrePeriode] = useState('1m');
  const [filtreAnnee, setFiltreAnnee] = useState('all');
  const [filtreCustomDebut, setFiltreCustomDebut] = useState('');
  const [filtreCustomFin, setFiltreCustomFin] = useState('');
  const [filtreRecherche, setFiltreRecherche] = useState('');
  const [showFiltresAvances, setShowFiltresAvances] = useState(false);

  useEffect(() => { chargerDonnees(); }, []);

  async function chargerDonnees() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: dataParis, error: errorParis } = await supabase.from('paris').select('*').eq('user_id', user.id).order('date_pari', { ascending: false });
      if (!errorParis) setParis(dataParis || []);
      const { data: dataBankroll } = await supabase.from('bankroll').select('*').eq('user_id', user.id).single();
      if (dataBankroll) { setBankrollState(dataBankroll.montant); }
      else { await supabase.from('bankroll').insert({ user_id: user.id, montant: 1000 }); setBankrollState(1000); }
      const { data: dataBetsAuto, error: errorBetsAuto } = await supabase.from('bets_auto').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (!errorBetsAuto) setBetsAuto(dataBetsAuto || []);

      // TODO (parsers): une fois les parsers email branchés, cette liste sera peuplée
      // automatiquement par une Edge Function / job qui lit les courriels de confirmation
      // (via user_email_connections), extrait les infos de pari (parser par bookmaker),
      // et insère les lignes dans `bets_auto`. La vérification du résultat (gagné/perdu)
      // se fera ensuite via l'API NHL en comparant `game_id` / `stat_type` / `ligne`.
      // Voir aussi `email_parsing_logs` pour le suivi des échecs de parsing.
    } catch (err) { console.error(err); }
    setChargement(false);
  }

  async function mettreAJourBankroll(nouveauMontant) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setBankrollState(nouveauMontant);
      await supabase.from('bankroll').update({ montant: nouveauMontant, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    } catch (err) { console.error(err); }
  }


  async function mettreAJourStatut(id, statut, mise, cote) {
    try {
      const profit = statut === 'gagne' ? parseFloat((mise * cote - mise).toFixed(2)) : -parseFloat(mise);
      await supabase.from('paris').update({ statut, profit }).eq('id', id);
      if (statut === 'gagne') await mettreAJourBankroll(bankroll + parseFloat(mise) + parseFloat((mise * cote - mise).toFixed(2)));
      chargerDonnees();
    } catch (err) { console.error(err); }
  }

  async function remettreEnActif(id, mise, statut, profit) {
    try {
      await supabase.from('paris').update({ statut: 'actif', profit: 0 }).eq('id', id);
      if (statut === 'gagne') await mettreAJourBankroll(bankroll - parseFloat(mise) - parseFloat(profit));
      chargerDonnees();
    } catch (err) { console.error(err); }
  }

  async function supprimerPari(id, statut, mise) {
    try {
      await supabase.from('paris').delete().eq('id', id);
      if (statut === 'actif') await mettreAJourBankroll(bankroll + parseFloat(mise));
      chargerDonnees();
    } catch (err) { console.error(err); }
  }

  // Bets importes par screenshot (bets_auto) : la mise n'est jamais debitee a
  // l'import (contrairement aux paris manuels), donc a la resolution on applique
  // directement le resultat signe (+gain net si gagne, -mise si perdu) a la bankroll.
  async function mettreAJourStatutAuto(id, statut, mise, cote) {
    try {
      const resultat = statut === 'gagne' ? parseFloat((mise * cote - mise).toFixed(2)) : -parseFloat(mise);
      await supabase.from('bets_auto').update({ statut, resultat, verified_at: new Date().toISOString() }).eq('id', id);
      await mettreAJourBankroll(bankroll + resultat);
      chargerDonnees();
    } catch (err) { console.error(err); }
  }

  async function remettreEnActifAuto(id, resultat) {
    try {
      await supabase.from('bets_auto').update({ statut: 'pending', resultat: null, verified_at: null }).eq('id', id);
      await mettreAJourBankroll(bankroll - parseFloat(resultat || 0));
      chargerDonnees();
    } catch (err) { console.error(err); }
  }

  async function supprimerBetAuto(id) {
    try {
      await supabase.from('bets_auto').delete().eq('id', id);
      chargerDonnees();
    } catch (err) { console.error(err); }
  }

  async function modifierPari(id, champs) {
    try {
      await supabase.from('paris').update(champs).eq('id', id);
      chargerDonnees();
    } catch (err) { console.error(err); }
  }

  async function modifierBetAuto(id, champs) {
    try {
      await supabase.from('bets_auto').update(champs).eq('id', id);
      chargerDonnees();
    } catch (err) { console.error(err); }
  }

  // Dispatchers utilises par la fiche detaillee (BetDetailSheet) : fonctionnent
  // identiquement peu importe l'onglet (Actifs/Historique) et le type de bet.
  function supprimerDepuisFiche(item) {
    if (item.type === 'manuel') supprimerPari(item.data.id, item.data.statut, item.data.mise);
    else supprimerBetAuto(item.data.id);
    setBetSelectionne(null);
  }

  function marquerStatutDepuisFiche(item, statut) {
    if (item.type === 'manuel') mettreAJourStatut(item.data.id, statut, item.data.mise, item.data.cote);
    else mettreAJourStatutAuto(item.data.id, statut, item.data.mise, item.data.cote);
    setBetSelectionne(null);
  }

  async function sauvegarderDepuisFiche(item, champs) {
    if (item.type === 'manuel') await modifierPari(item.data.id, champs);
    else await modifierBetAuto(item.data.id, champs);
    setBetSelectionne(null);
  }

  function ouvrirGalerieImport() {
    setErreurImport('');
    galerieInputRef.current?.click();
  }

  async function onFichierImportChoisi(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await fichierVersJpegBase64(file);
      setImageImport({ apercu: dataUrl, base64: dataUrl.split(',')[1] });
      setAfficherImport(true);
    } catch {
      setErreurImport(t('import_error_unsupported_image'));
    }
  }

  function getDonneesGraphique() {
    const parisTraites = paris.filter(p => p.statut !== 'actif');
    const jours = filtreGraphique === '7d' ? 7 : filtreGraphique === '30d' ? 30 : 90;
    const dateDebut = new Date(Date.now() - jours * 24 * 60 * 60 * 1000);
    let profitCumulatif = 0;
    return parisTraites.filter(p => new Date(p.date_pari) >= dateDebut).sort((a, b) => new Date(a.date_pari) - new Date(b.date_pari)).map(p => {
      profitCumulatif += p.profit || 0;
      return { date: new Date(p.date_pari).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }), profit: parseFloat(profitCumulatif.toFixed(2)) };
    });
  }

  const maintenant = new Date();
  const periodeJours = { '1m': 30, '3m': 90, '6m': 180, '1y': 365, 'all': 99999 };
  const parisActifs = paris.filter(p => p.statut === 'actif');
  const anneesDisponibles = [...new Set(paris.filter(p => p.statut !== 'actif' && p.date_pari).map(p => new Date(p.date_pari).getFullYear()))].sort((a,b) => b-a);

  const parisHistorique = paris.filter(p => {
    if (p.statut === 'actif') return false;
    if (!p.date_pari) return true;
    const datePari = new Date(p.date_pari);
    const diff = (maintenant - datePari) / (1000 * 60 * 60 * 24);

    if (filtreCustomDebut && filtreCustomFin) {
      const debut = new Date(filtreCustomDebut);
      const fin = new Date(filtreCustomFin);
      fin.setHours(23,59,59);
      if (datePari < debut || datePari > fin) return false;
    } else if (filtreAnnee !== 'all') {
      if (datePari.getFullYear() !== parseInt(filtreAnnee)) return false;
    } else if (filtrePeriode !== 'all') {
      if (diff > periodeJours[filtrePeriode]) return false;
    }

    if (filtreRecherche) {
      const q = filtreRecherche.toLowerCase();
      return (p.match || '').toLowerCase().includes(q) ||
             (p.selection || '').toLowerCase().includes(q) ||
             (p.bookmaker || '').toLowerCase().includes(q) ||
             (p.joueur || '').toLowerCase().includes(q);
    }
    return true;
  });
  const parisTraites = paris.filter(p => p.statut !== 'actif');
  const profitTotal = parisTraites.reduce((acc, p) => acc + (p.profit || 0), 0);
  const parisGagnes = parisTraites.filter(p => p.statut === 'gagne').length;
  const winRate = parisTraites.length > 0 ? Math.round((parisGagnes / parisTraites.length) * 100) : 0;
  const miseTotale = parisTraites.reduce((acc, p) => acc + (p.mise || 0), 0);
  const roi = miseTotale > 0 ? ((profitTotal / miseTotale) * 100).toFixed(1) : '0.0';
  const donneesGraphique = getDonneesGraphique();

  // Un bet importe par screenshot = un bet actif en attente de resultat : fusionne
  // avec les paris manuels dans les onglets Actifs / Historique (pas d'onglet a part).
  const betsAutoActifs = betsAuto.filter(b => b.statut === 'pending');
  const betsAutoTraites = betsAuto.filter(b => b.statut !== 'pending');
  const actifsCombines = [
    ...parisActifs.map(p => ({ type: 'manuel', date: p.date_pari, data: p })),
    ...betsAutoActifs.map(b => ({ type: 'auto', date: b.created_at, data: b })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const traitesCombines = [
    ...parisHistorique.map(p => ({ type: 'manuel', date: p.date_pari, data: p })),
    ...betsAutoTraites.map(b => ({ type: 'auto', date: b.verified_at || b.created_at, data: b })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const inp = { width: '100%', padding: '10px 12px', backgroundColor: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: '8px', color: 'white', fontSize: '14px', boxSizing: 'border-box', outline: 'none' };

  if (chargement) return <div style={{ padding: '80px', textAlign: 'center', color: '#555' }}>Loading...</div>;

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1100px', margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>{t('bets_title')}</h2>
        <p style={{ margin: 0, color: '#555', fontSize: '14px' }}>Track and manage your wagers</p>
      </div>



      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', backgroundColor: '#0d0d0d', borderRadius: '10px', padding: '4px', border: '1px solid #161616', width: 'fit-content' }}>
        {[{ id: 'actifs', label: `${t('bets_tab_active')} (${actifsCombines.length})` }, { id: 'traites', label: `${t('bets_tab_history')} (${traitesCombines.length})` }].map(tab => (
          <button key={tab.id} onClick={() => setOnglet(tab.id)} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: onglet === tab.id ? '#f97316' : 'transparent', color: onglet === tab.id ? 'white' : '#555', fontSize: '13px', fontWeight: onglet === tab.id ? '600' : 'normal' }}>{tab.label}</button>
        ))}
      </div>

      <input ref={galerieInputRef} type="file" accept="image/*,.heic,.heif" onChange={onFichierImportChoisi} style={{ display: 'none' }} />

      {onglet === 'actifs' && !afficherImport && (
        <button onClick={ouvrirGalerieImport} style={{ marginBottom: '16px', padding: '10px 20px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
          📷 {t('bets_import_btn')}
        </button>
      )}

      {erreurImport && !afficherImport && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#ef4444' }}>
          {erreurImport}
        </div>
      )}

      {afficherImport && imageImport && (
        <BetImportFlow
          lang={lang}
          apercu={imageImport.apercu}
          imageBase64={imageImport.base64}
          onClose={() => { setAfficherImport(false); setImageImport(null); }}
          onImported={() => { setAfficherImport(false); setImageImport(null); chargerDonnees(); }}
        />
      )}

      {onglet === 'actifs' && (
        <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', padding: '24px', border: '1px solid #161616' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '20px', letterSpacing: '-0.3px' }}>{t('bets_tab_active')}</div>
          {actifsCombines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontSize: '14px' }}>{t('bets_no_active')}</div>
          ) : actifsCombines.map((entree, i) => {
            const bordure = { borderTop: i === 0 ? 'none' : '1px solid #111', padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', cursor: 'pointer' };
            if (entree.type === 'manuel') {
              const pari = entree.data;
              return (
                <div key={`m-${pari.id}`} style={bordure} onClick={() => setBetSelectionne({ type: 'manuel', data: pari })}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px', letterSpacing: '-0.3px' }}>{pari.match}</div>
                    <div style={{ color: '#f97316', fontSize: '12px', fontWeight: '500', marginBottom: '2px' }}>{BET_TYPES.find(bt => bt.value === pari.type_pari)?.label || pari.type_pari}</div>
                    {pari.selection && <div style={{ color: '#888', fontSize: '12px', marginBottom: '2px' }}>→ {pari.selection}</div>}
                    <div style={{ color: '#444', fontSize: '12px' }}>{pari.bookmaker} · {t('bets_odds')} {pari.cote} · {t('bets_stake').replace(' ($)', '')} ${pari.mise}</div>
                    <div style={{ color: '#22c55e', fontSize: '12px', marginTop: '3px' }}>{t('bets_potential_short')}: +${(pari.mise * pari.cote - pari.mise).toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => mettreAJourStatut(pari.id, 'gagne', pari.mise, pari.cote)} style={{ padding: '7px 14px', backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>{t('bets_won')}</button>
                    <button onClick={() => mettreAJourStatut(pari.id, 'perdu', pari.mise, pari.cote)} style={{ padding: '7px 14px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>{t('bets_lost')}</button>
                    <button onClick={() => supprimerPari(pari.id, pari.statut, pari.mise)} style={{ padding: '7px 14px', backgroundColor: 'transparent', color: '#444', border: '1px solid #1a1a1a', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                  </div>
                </div>
              );
            }
            const bet = entree.data;
            return (
              <div key={`a-${bet.id}`} style={bordure} onClick={() => setBetSelectionne({ type: 'auto', data: bet })}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px', letterSpacing: '-0.3px' }}>
                    {titreBetAuto(bet)}
                  </div>
                  <div style={{ color: '#f97316', fontSize: '12px', fontWeight: '500', marginBottom: '2px' }}>📷 {bet.type_bet || t('bets_import_btn')}</div>
                  {bet.equipe && bet.adversaire && <div style={{ color: '#888', fontSize: '12px', marginBottom: '2px' }}>{bet.equipe} vs {bet.adversaire}</div>}
                  <div style={{ color: '#444', fontSize: '12px' }}>{bet.bookmaker || '—'} · {t('bets_odds')} {bet.cote ?? '—'} · ${bet.mise ?? '—'}</div>
                  {bet.gain_potentiel != null && <div style={{ color: '#22c55e', fontSize: '12px', marginTop: '3px' }}>{t('bets_potential_short')}: +${parseFloat(bet.gain_potentiel).toFixed(2)}</div>}
                </div>
                <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => mettreAJourStatutAuto(bet.id, 'gagne', bet.mise, bet.cote)} style={{ padding: '7px 14px', backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>{t('bets_won')}</button>
                  <button onClick={() => mettreAJourStatutAuto(bet.id, 'perdu', bet.mise, bet.cote)} style={{ padding: '7px 14px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>{t('bets_lost')}</button>
                  <button onClick={() => supprimerBetAuto(bet.id)} style={{ padding: '7px 14px', backgroundColor: 'transparent', color: '#444', border: '1px solid #1a1a1a', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {onglet === 'traites' && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {[['1m', '1M'], ['3m', '3M'], ['6m', '6M'], ['1y', '1Y']].map(([val, label]) => (
            <button key={val} onClick={() => { setFiltrePeriode(val); setFiltreAnnee('all'); setFiltreCustomDebut(''); setFiltreCustomFin(''); }}
              style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', backgroundColor: filtrePeriode === val && filtreAnnee === 'all' && !filtreCustomDebut ? '#f97316' : '#0d0d0d', color: filtrePeriode === val && filtreAnnee === 'all' && !filtreCustomDebut ? 'white' : '#555', fontSize: '12px', fontWeight: '600' }}>
              {label}
            </button>
          ))}
          <button onClick={() => setShowFiltresAvances(!showFiltresAvances)}
            style={{ padding: '6px 10px', borderRadius: '20px', border: '1px solid #222', cursor: 'pointer', backgroundColor: showFiltresAvances || filtreCustomDebut ? '#f97316' : 'transparent', color: showFiltresAvances || filtreCustomDebut ? 'white' : '#555', fontSize: '13px', fontWeight: '600' }}>
            ⚙
          </button>
        </div>
      )}
      {onglet === 'traites' && showFiltresAvances && (
        <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', padding: '16px', border: '1px solid #1a1a1a', marginBottom: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Search</div>
              <input value={filtreRecherche} onChange={e => setFiltreRecherche(e.target.value)}
                placeholder={t('bets_search_placeholder')}
                style={{ width: '100%', padding: '9px 12px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', color: 'white', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                onFocus={e => e.target.style.borderColor = '#f97316'}
                onBlur={e => e.target.style.borderColor = '#222'} />
            </div>

            <div>
              <div style={{ color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>{t('bank_custom_range')}</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="date" value={filtreCustomDebut} onChange={e => { setFiltreCustomDebut(e.target.value); setFiltrePeriode('all'); setFiltreAnnee('all'); }}
                  style={{ flex: 1, padding: '9px 12px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                <span style={{ color: '#444' }}>→</span>
                <input type="date" value={filtreCustomFin} onChange={e => { setFiltreCustomFin(e.target.value); setFiltrePeriode('all'); setFiltreAnnee('all'); }}
                  style={{ flex: 1, padding: '9px 12px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                {(filtreCustomDebut || filtreCustomFin) && (
                  <button onClick={() => { setFiltreCustomDebut(''); setFiltreCustomFin(''); }}
                    style={{ padding: '9px 12px', backgroundColor: 'transparent', border: '1px solid #333', borderRadius: '10px', color: '#555', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                )}
              </div>
            </div>
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '12px', display: 'flex', gap: '16px' }}>
              <div><span style={{ color: '#444', fontSize: '11px' }}>{t('bets_results')} </span><span style={{ color: 'white', fontSize: '13px', fontWeight: '700' }}>{parisHistorique.length} {t('bets_unit')}</span></div>
              <div><span style={{ color: '#444', fontSize: '11px' }}>{t('bets_profit')} </span><span style={{ color: parisHistorique.reduce((a,p) => a+(p.profit||0),0) >= 0 ? '#22c55e' : '#ef4444', fontSize: '13px', fontWeight: '700' }}>{parisHistorique.reduce((a,p) => a+(p.profit||0),0) >= 0 ? '+' : ''}${parisHistorique.reduce((a,p) => a+(p.profit||0),0).toFixed(2)}</span></div>
              <div><span style={{ color: '#444', fontSize: '11px' }}>{t('bets_win_rate')} </span><span style={{ color: 'white', fontSize: '13px', fontWeight: '700' }}>{parisHistorique.length > 0 ? Math.round(parisHistorique.filter(p=>p.statut==='gagne').length/parisHistorique.length*100) : 0}%</span></div>
            </div>
          </div>
        </div>
      )}
      {onglet === 'traites' && (
        <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', padding: '24px', border: '1px solid #161616' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '20px', letterSpacing: '-0.3px' }}>{t('bets_history_title')}</div>
          {traitesCombines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontSize: '14px' }}>{t('bets_no_history')}</div>
          ) : traitesCombines.map((entree, i) => {
            const bordure = { borderTop: i === 0 ? 'none' : '1px solid #111', padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', cursor: 'pointer' };
            if (entree.type === 'manuel') {
              const pari = entree.data;
              return (
                <div key={`m-${pari.id}`} style={bordure} onClick={() => setBetSelectionne({ type: 'manuel', data: pari })}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px', letterSpacing: '-0.3px' }}>{pari.match}</div>
                    {pari.selection && <div style={{ color: '#888', fontSize: '12px', marginBottom: '2px' }}>→ {pari.selection}</div>}
                    <div style={{ color: '#444', fontSize: '12px' }}>{pari.bookmaker} · {t('bets_odds')} {pari.cote} · ${pari.mise}</div>
                    <div style={{ color: '#333', fontSize: '11px', marginTop: '3px' }}>{new Date(pari.date_pari).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: pari.statut === 'gagne' ? '#22c55e' : '#ef4444', letterSpacing: '-0.5px' }}>
                      {pari.statut === 'gagne' ? `+$${parseFloat(pari.profit).toFixed(2)}` : `-$${parseFloat(pari.mise).toFixed(2)}`}
                    </div>
                    <div style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: pari.statut === 'gagne' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: pari.statut === 'gagne' ? '#22c55e' : '#ef4444', border: `1px solid ${pari.statut === 'gagne' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                      {pari.statut === 'gagne' ? t('bets_won') : t('bets_lost')}
                    </div>
                    <button onClick={() => remettreEnActif(pari.id, pari.mise, pari.statut, pari.profit)} style={{ padding: '5px 10px', backgroundColor: 'transparent', color: '#333', border: '1px solid #1a1a1a', borderRadius: '7px', cursor: 'pointer', fontSize: '11px' }}>{t('bets_undo')}</button>
                  </div>
                </div>
              );
            }
            const bet = entree.data;
            return (
              <div key={`a-${bet.id}`} style={bordure} onClick={() => setBetSelectionne({ type: 'auto', data: bet })}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px', letterSpacing: '-0.3px' }}>
                    {titreBetAuto(bet)}
                  </div>
                  {bet.equipe && bet.adversaire && <div style={{ color: '#888', fontSize: '12px', marginBottom: '2px' }}>{bet.equipe} vs {bet.adversaire}</div>}
                  <div style={{ color: '#444', fontSize: '12px' }}>📷 {bet.bookmaker || '—'} · {t('bets_odds')} {bet.cote ?? '—'} · ${bet.mise ?? '—'}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: bet.statut === 'gagne' ? '#22c55e' : '#ef4444', letterSpacing: '-0.5px' }}>
                    {bet.statut === 'gagne' ? `+$${parseFloat(bet.resultat ?? 0).toFixed(2)}` : `-$${parseFloat(bet.mise ?? 0).toFixed(2)}`}
                  </div>
                  <div style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: bet.statut === 'gagne' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: bet.statut === 'gagne' ? '#22c55e' : '#ef4444', border: `1px solid ${bet.statut === 'gagne' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                    {bet.statut === 'gagne' ? t('bets_won') : t('bets_lost')}
                  </div>
                  <button onClick={() => remettreEnActifAuto(bet.id, bet.resultat)} style={{ padding: '5px 10px', backgroundColor: 'transparent', color: '#333', border: '1px solid #1a1a1a', borderRadius: '7px', cursor: 'pointer', fontSize: '11px' }}>{t('bets_undo')}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BetDetailSheet
        item={betSelectionne}
        onClose={() => setBetSelectionne(null)}
        lang={lang}
        onDelete={supprimerDepuisFiche}
        onMarkStatut={marquerStatutDepuisFiche}
        onSave={sauvegarderDepuisFiche}
      />

      {onglet === 'bankroll' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', padding: '24px', border: '1px solid #161616' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '20px', letterSpacing: '-0.3px' }}>{t('bets_bankroll_title')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#111', borderRadius: '10px', padding: '20px' }}>
                <div style={{ color: '#555', fontSize: '12px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{t('bets_bankroll_current')}</div>
                <div style={{ fontSize: '32px', fontWeight: '800', color: '#f97316', letterSpacing: '-1px', marginBottom: '16px' }}>${bankroll.toFixed(2)}</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="number" placeholder={t('bets_amount')} style={{ ...inp, flex: 1 }} value={montantBankroll} onChange={e => setMontantBankroll(e.target.value)} />
                  <button onClick={async () => { const m = parseFloat(montantBankroll); if (m > 0) { await mettreAJourBankroll(bankroll + m); setMontantBankroll(''); } }} style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>{t('bets_deposit')}</button>
                  <button onClick={async () => { const m = parseFloat(montantBankroll); if (m > 0) { await mettreAJourBankroll(bankroll - m); setMontantBankroll(''); } }} style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>{t('bets_withdraw')}</button>
                </div>
              </div>
              <div style={{ backgroundColor: '#111', borderRadius: '10px', padding: '20px' }}>
                <div style={{ color: '#555', fontSize: '12px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{t('bets_kelly')}</div>
                <div style={{ fontSize: '32px', fontWeight: '800', color: '#22c55e', letterSpacing: '-1px', marginBottom: '8px' }}>${(bankroll * 0.05).toFixed(2)}</div>
                <div style={{ color: '#333', fontSize: '12px', lineHeight: '1.6' }}>Never bet more than 5% of your bankroll per bet for healthy risk management.</div>
              </div>
            </div>
          </div>
          <div style={{ backgroundColor: '#0d0d0d', borderRadius: '14px', padding: '24px', border: '1px solid #161616' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px', letterSpacing: '-0.3px' }}>Financial Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { label: t('bets_total_staked'), value: `$${miseTotale.toFixed(2)}`, color: 'white' },
                { label: t('bets_net_profit'), value: `${profitTotal >= 0 ? '+' : ''}$${profitTotal.toFixed(2)}`, color: profitTotal >= 0 ? '#22c55e' : '#ef4444' },
                { label: 'ROI', value: `${roi}%`, color: parseFloat(roi) >= 0 ? '#22c55e' : '#ef4444' },
                { label: 'Bets Won', value: `${parisGagnes}/${parisTraites.length}`, color: 'white' },
              ].map((s, i) => (
                <div key={i} style={{ backgroundColor: '#111', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ color: '#444', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{s.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
