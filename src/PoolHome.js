import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import { TeamLogo, memberLabel, round1, useTeamCrests, easternDateStr } from './PoolDraftRoom';
import { usePlayerInjuries } from './PoolLockerRoom';

const card = { backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', border: '1px solid var(--c-161616)', padding: '16px' };
const sectionTitleStyle = (color) => ({ fontSize: '11px', fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' });

// ===================== Accueil du pool (Phase 3) =====================
// Ecussons de tous les participants, top 3, prochains matchs de MES joueurs, fil d'activite.
// Tout vient de donnees/RPC deja existantes (get_pool_standings, get_member_breakdown,
// pool_transactions, nhl_games, player_injuries, pool_roster_periods via useTeamCrests) --
// aucune nouvelle table ni fonction serveur pour cette phase.
export function PoolHomeDashboard({ pool, members, myMember, lang }) {
  const t = getT(lang);
  const crests = useTeamCrests(pool.id);
  const [standings, setStandings] = useState(null);
  const [myRows, setMyRows] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    let annule = false;
    supabase.rpc('get_pool_standings', { p_pool_id: pool.id }).then(({ data, error }) => { if (!annule && !error) setStandings(data || []); });
    return () => { annule = true; };
  }, [pool.id]);

  useEffect(() => {
    if (!myMember?.id) { setMyRows([]); return; }
    let annule = false;
    supabase.rpc('get_member_breakdown', { p_pool_id: pool.id, p_member_id: myMember.id }).then(({ data, error }) => { if (!annule && !error) setMyRows(data || []); });
    return () => { annule = true; };
  }, [pool.id, myMember?.id]);

  useEffect(() => {
    let annule = false;
    supabase.from('pool_transactions').select('*').eq('pool_id', pool.id).order('created_at', { ascending: false }).limit(15)
      .then(({ data, error }) => { if (!annule && !error) setTransactions(data || []); });
    return () => { annule = true; };
  }, [pool.id]);

  const myActiveTeams = useMemo(() => {
    const teams = new Set();
    (myRows || []).filter(r => r.is_active && r.team_abbrev).forEach(r => teams.add(r.team_abbrev));
    return [...teams];
  }, [myRows]);

  useEffect(() => {
    if (myActiveTeams.length === 0) { setUpcoming([]); return; }
    let annule = false;
    const today = easternDateStr();
    const liste = myActiveTeams.join(',');
    supabase.from('nhl_games').select('game_id, game_date, home_abbrev, away_abbrev, state')
      .gte('game_date', today).eq('state', 'FUT')
      .or(`home_abbrev.in.(${liste}),away_abbrev.in.(${liste})`)
      .order('game_date', { ascending: true }).limit(10)
      .then(({ data, error }) => { if (!annule && !error) setUpcoming(data || []); })
      .catch(() => { if (!annule) setUpcoming([]); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myActiveTeams.join(',')]);

  const injuriesKey = useMemo(() => (myRows || []).filter(r => r.is_active && r.kind === 'player').map(r => String(r.ref_id)).join(','), [myRows]);
  const injuries = usePlayerInjuries(injuriesKey);
  const myInjuredPlayers = useMemo(() => (
    (myRows || []).filter(r => r.is_active && r.kind === 'player' && injuries[String(r.ref_id)])
      .map(r => ({ ...injuries[String(r.ref_id)], player_name: r.label }))
  ), [myRows, injuries]);

  const top3 = (standings || []).slice(0, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
      <div style={card}>
        <div style={sectionTitleStyle('var(--c-666)')}>{t('pool_lobby_members_title')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {members.map(m => (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '60px' }}>
              {crests[m.id]
                ? <TeamLogo abbrev={crests[m.id]} size={36} />
                : <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)' }} />}
              <div style={{ fontSize: '10px', color: 'var(--c-888)', textAlign: 'center', maxWidth: '72px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {memberLabel(m, pool.rules)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={sectionTitleStyle('#f97316')}>{t('pool_home_top3_title')}</div>
        {standings === null ? (
          <div style={{ color: 'var(--c-555)', fontSize: '12px' }}>{t('pool_loading_generic')}</div>
        ) : top3.length === 0 ? (
          <div style={{ color: 'var(--c-333)', fontSize: '12px' }}>{t('pool_standings_empty')}</div>
        ) : top3.map(row => (
          <div key={row.member_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderTop: '1px solid var(--c-111)' }}>
            <span style={{ fontWeight: '900', color: '#f97316', minWidth: '16px' }}>{row.rank}</span>
            {crests[row.member_id] && <TeamLogo abbrev={crests[row.member_id]} size={22} />}
            <span style={{ flex: 1, color: 'var(--c-white)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.display_name || row.team_name}</span>
            <span style={{ color: '#f97316', fontWeight: '800' }}>{round1(row.total_points)}</span>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={sectionTitleStyle('var(--c-666)')}>{t('pool_home_upcoming_title')}</div>
        {upcoming.length === 0 ? (
          <div style={{ color: 'var(--c-333)', fontSize: '12px' }}>{t('pool_home_upcoming_empty')}</div>
        ) : upcoming.map(g => (
          <div key={g.game_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderTop: '1px solid var(--c-111)', fontSize: '12px' }}>
            <TeamLogo abbrev={g.away_abbrev} size={20} />
            <span style={{ color: 'var(--c-666)' }}>@</span>
            <TeamLogo abbrev={g.home_abbrev} size={20} />
            <span style={{ color: 'var(--c-white)' }}>{g.away_abbrev} @ {g.home_abbrev}</span>
            <span style={{ color: 'var(--c-666)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              {new Date(g.game_date + 'T12:00:00').toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={sectionTitleStyle('var(--c-666)')}>{t('pool_home_activity_title')}</div>
        <ActivityFeed transactions={transactions} members={members} pool={pool} myInjuredPlayers={myInjuredPlayers} t={t} />
      </div>
    </div>
  );
}

function ActivityFeed({ transactions, members, pool, myInjuredPlayers, t }) {
  const items = useMemo(() => {
    const fromTx = transactions.map(tx => {
      const m = members.find(x => x.id === tx.member_id);
      const who = m ? memberLabel(m, pool.rules) : '?';
      let label;
      if (tx.type === 'trade') {
        label = `${who} — ${t('pool_home_activity_trade')}`;
      } else if (tx.type === 'add') {
        label = `${who} — ${t('pool_home_activity_add')} : ${tx.details?.player_name || tx.details?.player_id || '?'}`;
      } else {
        label = `${who} — ${t('pool_home_activity_drop')} : ${tx.details?.player_name || tx.details?.player_id || '?'}`;
      }
      return { key: tx.id, at: tx.created_at, label };
    });
    const fromInjuries = myInjuredPlayers.map((inj, i) => ({
      key: `injury-${inj.player_id || i}`,
      at: inj.updated_at,
      label: `${t('pool_home_activity_injury')} : ${inj.player_name} (${inj.status})`,
    }));
    return [...fromTx, ...fromInjuries]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 15);
  }, [transactions, myInjuredPlayers, members, pool.rules, t]);

  if (items.length === 0) return <div style={{ color: 'var(--c-333)', fontSize: '12px' }}>{t('pool_home_activity_empty')}</div>;
  return (
    <div>
      {items.map(it => (
        <div key={it.key} style={{ padding: '6px 0', borderTop: '1px solid var(--c-111)', fontSize: '12px', color: 'var(--c-ccc)' }}>{it.label}</div>
      ))}
    </div>
  );
}
