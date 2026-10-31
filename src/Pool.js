import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import { useIsMobile, useSaisonCourante } from './Analyses';
import PoolDraft from './PoolDraft';
import {
  POSITION_STAT_KEYS, GOALIE_STAT_KEYS, TEAM_STAT_KEYS, CLASSIC_ROSTER_KEYS, FANTASY_ROSTER_KEYS,
  DRAFT_TYPES, LINEUP_MODES, TRADE_APPROVAL_TYPES, WAIVER_CLAIM_ORDERS, DISPLAY_MODES,
  POOL_TYPE_INFO, defaultRules, cloneRules, validateRules, hasAnyScoring,
  totalRosterSlots, currentSeasonLabelFromSeasonId, applyPoolType, normalizeRules,
} from './poolRules';

const card = { backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', border: '1px solid var(--c-161616)', padding: '20px' };
const inputStyle = { width: '100%', padding: '11px 14px', backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '12px', color: 'var(--c-white)', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--c-666)', marginBottom: '6px' };
const btnPrimary = { padding: '12px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: '#f97316', color: 'white', fontSize: '14px', fontWeight: '700' };
const btnSecondary = { padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--c-222)', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--c-888)', fontSize: '14px', fontWeight: '600' };
const choiceBtn = (active) => ({ flex: 1, padding: '10px', borderRadius: '10px', border: active ? '1px solid #f97316' : '1px solid var(--c-222)', cursor: 'pointer', backgroundColor: active ? 'rgba(249,115,22,0.12)' : 'var(--c-111)', color: active ? '#f97316' : 'var(--c-888)', fontSize: '13px', fontWeight: '600' });
const sectionTitleStyle = (color) => ({ fontSize: '12px', fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' });

function clearJoinUrl() {
  try { window.history.replaceState(null, '', '/'); } catch { /* noop */ }
}

function splitFullName(fullName) {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const [first, ...rest] = trimmed.split(/\s+/);
  return { firstName: first, lastName: rest.join(' ') };
}

// Prenom/nom pre-remplis pour le participant connecte : son profil Supabase
// (profiles.first_name/last_name) en priorite, sinon user_metadata (full_name/name ou
// first_name/last_name), sinon vide (l'utilisateur les saisit lui-meme). Resolu une seule
// fois cote client, a partir de SA PROPRE ligne `profiles` (toujours lisible par son
// proprietaire) et de son propre objet auth (user_metadata).
async function resolveMyIdentity(utilisateur) {
  if (!utilisateur?.id) return { firstName: '', lastName: '' };
  const { data } = await supabase.from('profiles').select('first_name, last_name').eq('id', utilisateur.id).maybeSingle();
  if (data?.first_name || data?.last_name) {
    return { firstName: data.first_name || '', lastName: data.last_name || '' };
  }
  const meta = utilisateur.user_metadata || {};
  if (meta.first_name || meta.last_name) {
    return { firstName: meta.first_name || '', lastName: meta.last_name || '' };
  }
  if (meta.full_name || meta.name) {
    return splitFullName(meta.full_name || meta.name);
  }
  return { firstName: '', lastName: '' };
}

function memberDisplayName(member, rules, t) {
  if (rules?.display === 'team' && member?.team_name) return member.team_name;
  return member?.display_name || member?.team_name || t('pool_member_fallback_name');
}

function StatusBadge({ status, t }) {
  const colors = { setup: '#3b82f6', draft: '#f97316', active: '#22c55e', finished: '#666666' };
  const color = colors[status] || '#666666';
  return (
    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', backgroundColor: `${color}22`, color, flexShrink: 0 }}>
      {t(`pool_status_${status}`)}
    </span>
  );
}

function ErrorList({ errors, t }) {
  return (
    <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {errors.map(e => <div key={e} style={{ color: '#ef4444', fontSize: '12px' }}>{t(e)}</div>)}
    </div>
  );
}

function RecapRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderTop: '1px solid var(--c-111)' }}>
      <span style={{ fontSize: '12px', color: 'var(--c-666)', fontWeight: '600', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '13px', color: 'var(--c-white)', textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

function ScoringRow({ label, value, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--c-111)' }}>
      <span style={{ fontSize: '13px', color: disabled ? 'var(--c-555)' : 'var(--c-ccc)' }}>{label}</span>
      <input type="number" step="0.1" value={value} disabled={disabled}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ width: '80px', padding: '6px 8px', backgroundColor: disabled ? 'var(--c-0d0d0d)' : 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '8px', color: disabled ? 'var(--c-666)' : 'var(--c-white)', fontSize: '13px', textAlign: 'right' }} />
    </div>
  );
}

function summarizeStatsGroup(statsObj, keys, t) {
  const active = keys.filter(k => statsObj?.[k]);
  if (active.length === 0) return t('pool_recap_none_active');
  return active.map(k => `${t(`pool_stat_${k}`)} (${statsObj[k]})`).join(' · ');
}

function summarizeRoster(rules, t) {
  const keys = rules?.poolType === 'classic' ? CLASSIC_ROSTER_KEYS : FANTASY_ROSTER_KEYS;
  const active = keys.filter(k => rules?.roster?.[k] > 0);
  if (active.length === 0) return t('pool_recap_none_active');
  return active.map(k => `${t(`pool_slot_${k}`)}: ${rules.roster[k]}`).join(' · ');
}

function summarizeSalaryCap(rules, t) {
  if (!rules?.salaryCap?.enabled) return t('pool_recap_salarycap_without');
  const millions = Math.round((rules.salaryCap.amount || 0) / 1000000);
  return t('pool_recap_salarycap_with').replace('{amount}', millions);
}

function summarizeTrades(trades, t) {
  if (!trades?.enabled) return t('pool_recap_disabled');
  const parts = [
    trades.maxPerSeason == null ? t('pool_unlimited') : `${trades.maxPerSeason} ${t('pool_recap_max_suffix')}`,
    trades.noReacquire ? t('pool_trades_no_reacquire') : null,
    `${t('pool_trades_approval')}: ${t(`pool_trades_approval_${trades.approval}`)}`,
  ].filter(Boolean);
  return parts.join(' · ');
}

function formatTeamPicks(n, t) {
  return t('pool_team_picks_value').replace('{n}', n).replace('{s}', n === 1 ? '' : 's');
}

function summarizeWaivers(waivers, t) {
  if (!waivers?.enabled) return t('pool_recap_disabled');
  const parts = [
    waivers.maxAddsPerSeason == null ? t('pool_unlimited') : `${waivers.maxAddsPerSeason} ${t('pool_recap_max_suffix')}`,
    waivers.noReacquireDropped ? t('pool_waivers_no_reacquire') : null,
    `${t('pool_waivers_claim_order')}: ${t(`pool_waivers_claim_order_${waivers.claimOrder}`)}`,
    waivers.waiverDays > 0 ? `${t('pool_waivers_days')}: ${waivers.waiverDays}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

// ===================== Blocs reutilisables (echanges / ballottage) =====================

function MaxOrUnlimited({ value, onChange, unlimitedLabel, limitedLabel, min = 1 }) {
  const isUnlimited = value == null;
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: isUnlimited ? 0 : '8px' }}>
        <button onClick={() => onChange(null)} style={choiceBtn(isUnlimited)}>{unlimitedLabel}</button>
        <button onClick={() => onChange(value ?? 10)} style={choiceBtn(!isUnlimited)}>{limitedLabel}</button>
      </div>
      {!isUnlimited && (
        <input type="number" min={min} style={inputStyle} value={value} onChange={e => onChange(parseInt(e.target.value, 10) || min)} />
      )}
    </div>
  );
}

function TradesBlock({ trades, onChange, t }) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
        <input type="checkbox" checked={trades.enabled} onChange={e => onChange({ enabled: e.target.checked })} />
        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-ccc)' }}>{t('pool_trades_title')}</span>
      </label>
      {trades.enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>{t('pool_trades_max_label')}</label>
            <MaxOrUnlimited value={trades.maxPerSeason} onChange={v => onChange({ maxPerSeason: v })} unlimitedLabel={t('pool_unlimited')} limitedLabel={t('pool_limited')} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={trades.noReacquire} onChange={e => onChange({ noReacquire: e.target.checked })} />
            <span style={{ fontSize: '13px', color: 'var(--c-ccc)' }}>{t('pool_trades_no_reacquire')}</span>
          </label>
          <div>
            <label style={labelStyle}>{t('pool_trades_approval')}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {TRADE_APPROVAL_TYPES.map(a => (
                <button key={a} onClick={() => onChange({ approval: a })} style={choiceBtn(trades.approval === a)}>{t(`pool_trades_approval_${a}`)}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--c-666)', fontStyle: 'italic' }}>{t('pool_trades_day_points_note')}</div>
        </div>
      )}
    </div>
  );
}

function WaiversBlock({ waivers, onChange, t }) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
        <input type="checkbox" checked={waivers.enabled} onChange={e => onChange({ enabled: e.target.checked })} />
        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-ccc)' }}>{t('pool_waivers_title')}</span>
      </label>
      {waivers.enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>{t('pool_waivers_max_label')}</label>
            <MaxOrUnlimited value={waivers.maxAddsPerSeason} onChange={v => onChange({ maxAddsPerSeason: v })} unlimitedLabel={t('pool_unlimited')} limitedLabel={t('pool_limited')} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={waivers.noReacquireDropped} onChange={e => onChange({ noReacquireDropped: e.target.checked })} />
            <span style={{ fontSize: '13px', color: 'var(--c-ccc)' }}>{t('pool_waivers_no_reacquire')}</span>
          </label>
          <div>
            <label style={labelStyle}>{t('pool_waivers_claim_order')}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {WAIVER_CLAIM_ORDERS.map(o => (
                <button key={o} onClick={() => onChange({ claimOrder: o })} style={choiceBtn(waivers.claimOrder === o)}>{t(`pool_waivers_claim_order_${o}`)}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>{t('pool_waivers_days')}</label>
            <input type="number" min={0} max={14} style={inputStyle} value={waivers.waiverDays} onChange={e => onChange({ waiverDays: parseInt(e.target.value, 10) || 0 })} />
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== Etapes du wizard =====================

function StepBase({ form, setForm, mode, t }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={labelStyle}>{t('pool_field_name')}</label>
        <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('pool_field_name_ph')} />
      </div>
      <div>
        <label style={labelStyle}>{t('pool_field_season')}</label>
        <input style={inputStyle} value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))} />
      </div>
      {mode === 'create' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            <div>
              <label style={labelStyle}>{t('pool_field_first_name')}</label>
              <input style={inputStyle} value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder={t('pool_field_first_name_ph')} />
            </div>
            <div>
              <label style={labelStyle}>{t('pool_field_last_name')}</label>
              <input style={inputStyle} value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder={t('pool_field_last_name_ph')} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>{t('pool_field_team_name')}</label>
            <input style={inputStyle} value={form.teamName} onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))} placeholder={t('pool_field_team_name_ph')} />
          </div>
        </>
      )}
      <div>
        <label style={labelStyle}>{t('pool_field_display')}</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {DISPLAY_MODES.map(d => (
            <button key={d} onClick={() => setForm(f => ({ ...f, rules: { ...f.rules, display: d } }))} style={choiceBtn(form.rules.display === d)}>
              {t(`pool_display_${d}`)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={labelStyle}>{t('pool_field_visibility')}</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['private', 'public'].map(v => (
            <button key={v} onClick={() => setForm(f => ({ ...f, visibility: v }))} style={choiceBtn(form.visibility === v)}>
              {t(`pool_visibility_${v}`)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={labelStyle}>{t('pool_field_max_members')}</label>
        <input type="number" min={2} max={30} style={inputStyle} value={form.maxMembers} onChange={e => setForm(f => ({ ...f, maxMembers: parseInt(e.target.value, 10) || 2 }))} />
      </div>
    </div>
  );
}

function StepType({ form, setForm, t }) {
  function switchType(newType) {
    if (form.rules.poolType === newType) return;
    setForm(f => ({ ...f, rules: applyPoolType(f.rules, newType) }));
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {POOL_TYPE_INFO.map(p => (
        <button key={p.id} onClick={() => switchType(p.id)}
          style={{ textAlign: 'left', padding: '16px', borderRadius: '14px', cursor: 'pointer', border: form.rules.poolType === p.id ? '1px solid #f97316' : '1px solid var(--c-222)', backgroundColor: form.rules.poolType === p.id ? 'rgba(249,115,22,0.08)' : 'var(--c-111)' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--c-white)', marginBottom: '4px' }}>{t(p.labelKey)}</div>
          <div style={{ fontSize: '12px', color: 'var(--c-666)' }}>{t(p.descKey)}</div>
        </button>
      ))}
    </div>
  );
}

function StepScoring({ form, setForm, t, errors }) {
  const { scoring, sameForwardDefenseScoring } = form.rules;

  function setStat(group, key, value) {
    setForm(f => {
      const nextGroup = { ...f.rules.scoring[group], [key]: value };
      const nextScoring = { ...f.rules.scoring, [group]: nextGroup };
      if (f.rules.sameForwardDefenseScoring && group === 'forward') nextScoring.defense = { ...nextGroup };
      return { ...f, rules: { ...f.rules, scoring: nextScoring } };
    });
  }
  function toggleSame(checked) {
    setForm(f => {
      const nextScoring = { ...f.rules.scoring };
      if (checked) nextScoring.defense = { ...nextScoring.forward };
      return { ...f, rules: { ...f.rules, sameForwardDefenseScoring: checked, scoring: nextScoring } };
    });
  }
  function copyForwardToDefense() {
    setForm(f => ({ ...f, rules: { ...f.rules, scoring: { ...f.rules.scoring, defense: { ...f.rules.scoring.forward } } } }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input type="checkbox" checked={sameForwardDefenseScoring} onChange={e => toggleSame(e.target.checked)} />
        <span style={{ fontSize: '13px', color: 'var(--c-ccc)' }}>{t('pool_scoring_same_fd')}</span>
      </label>

      <div>
        <div style={sectionTitleStyle('#f97316')}>{t('pool_scoring_forward_title')}</div>
        {POSITION_STAT_KEYS.map(k => (
          <ScoringRow key={k} label={t(`pool_stat_${k}`)} value={scoring.forward[k]} onChange={v => setStat('forward', k, v)} />
        ))}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div style={sectionTitleStyle('#3b82f6')}>{t('pool_scoring_defense_title')}</div>
          {!sameForwardDefenseScoring && (
            <button onClick={copyForwardToDefense} style={{ ...btnSecondary, padding: '6px 10px', fontSize: '11px' }}>{t('pool_scoring_copy_fwd_to_def')}</button>
          )}
        </div>
        {POSITION_STAT_KEYS.map(k => (
          <ScoringRow key={k} label={t(`pool_stat_${k}`)} value={scoring.defense[k]} onChange={v => setStat('defense', k, v)} disabled={sameForwardDefenseScoring} />
        ))}
      </div>

      <div>
        <div style={sectionTitleStyle('#22c55e')}>{t('pool_scoring_goalie_title')}</div>
        {GOALIE_STAT_KEYS.map(k => (
          <ScoringRow key={k} label={t(`pool_stat_${k}`)} value={scoring.goalie[k]} onChange={v => setStat('goalie', k, v)} />
        ))}
      </div>

      {form.rules.roster.teamPicks >= 1 && (
        <div>
          <div style={sectionTitleStyle('#a78bfa')}>{t('pool_scoring_team_title')}</div>
          {TEAM_STAT_KEYS.map(k => (
            <ScoringRow key={k} label={t(`pool_stat_${k}`)} value={scoring.team[k]} onChange={v => setStat('team', k, v)} />
          ))}
        </div>
      )}

      {errors.length > 0 && <ErrorList errors={errors} t={t} />}
    </div>
  );
}

function StepRoster({ form, setForm, t, errors }) {
  const poolType = form.rules.poolType;
  const keys = poolType === 'classic' ? CLASSIC_ROSTER_KEYS : FANTASY_ROSTER_KEYS;
  function setSlot(key, value) { setForm(f => ({ ...f, rules: { ...f.rules, roster: { ...f.rules.roster, [key]: value } } })); }
  function setCap(patch) { setForm(f => ({ ...f, rules: { ...f.rules, salaryCap: { ...f.rules.salaryCap, ...patch } } })); }
  const cap = form.rules.salaryCap;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={sectionTitleStyle('var(--c-666)')}>{t(poolType === 'classic' ? 'pool_team_title' : 'pool_roster_title')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {keys.map(k => (
            <div key={k}>
              <label style={labelStyle}>{t(`pool_slot_${k}`)}</label>
              <input type="number" min={0} max={30} style={inputStyle} value={form.rules.roster[k]} onChange={e => setSlot(k, parseInt(e.target.value, 10) || 0)} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: '10px' }}>
          <label style={labelStyle}>{t('pool_team_picks_label')}</label>
          <input type="number" min={0} max={5} style={inputStyle} value={form.rules.roster.teamPicks} onChange={e => setSlot('teamPicks', parseInt(e.target.value, 10) || 0)} />
        </div>
      </div>
      <div>
        <div style={sectionTitleStyle('var(--c-666)')}>{t('pool_salarycap_title')}</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: cap.enabled ? '12px' : 0 }}>
          <button onClick={() => setCap({ enabled: false })} style={choiceBtn(!cap.enabled)}>{t('pool_salarycap_without')}</button>
          <button onClick={() => setCap({ enabled: true })} style={choiceBtn(cap.enabled)}>{t('pool_salarycap_with')}</button>
        </div>
        {cap.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>{t('pool_salarycap_amount')}</label>
              <input type="number" min={0} step={1000000} style={inputStyle} value={cap.amount} onChange={e => setCap({ amount: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label style={labelStyle}>{t('pool_salarycap_source')}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['nhl', 'manual'].map(s => (
                  <button key={s} onClick={() => setCap({ source: s })} style={choiceBtn(cap.source === s)}>{t(`pool_salarycap_source_${s}`)}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {errors.length > 0 && <ErrorList errors={errors} t={t} />}
    </div>
  );
}

function StepManagement({ form, setForm, t }) {
  function setLineup(lm) { setForm(f => ({ ...f, rules: { ...f.rules, lineup: lm } })); }
  function setTrades(patch) { setForm(f => ({ ...f, rules: { ...f.rules, trades: { ...f.rules.trades, ...patch } } })); }
  function setWaivers(patch) { setForm(f => ({ ...f, rules: { ...f.rules, waivers: { ...f.rules.waivers, ...patch } } })); }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div>
        <label style={labelStyle}>{t('pool_lineup_title')}</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {LINEUP_MODES.map(lm => (
            <button key={lm} onClick={() => setLineup(lm)} style={choiceBtn(form.rules.lineup === lm)}>{t(`pool_lineup_${lm}`)}</button>
          ))}
        </div>
      </div>
      <TradesBlock trades={form.rules.trades} onChange={setTrades} t={t} />
      <WaiversBlock waivers={form.rules.waivers} onChange={setWaivers} t={t} />
    </div>
  );
}

function StepDraft({ form, setForm, t }) {
  function setDraft(patch) { setForm(f => ({ ...f, rules: { ...f.rules, draft: { ...f.rules.draft, ...patch } } })); }
  function setTrades(patch) { setForm(f => ({ ...f, rules: { ...f.rules, trades: { ...f.rules.trades, ...patch } } })); }
  const draft = form.rules.draft;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <label style={labelStyle}>{t('pool_draft_type')}</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {DRAFT_TYPES.map(dt => (
            <button key={dt} onClick={() => setDraft({ type: dt })} style={choiceBtn(draft.type === dt)}>{t(`pool_draft_type_${dt}`)}</button>
          ))}
        </div>
        <label style={labelStyle}>{t('pool_draft_seconds')}</label>
        <input type="number" min={10} max={600} style={inputStyle} value={draft.secondsPerPick} onChange={e => setDraft({ secondsPerPick: parseInt(e.target.value, 10) || 0 })} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={draft.teamPickCountsAsRound} onChange={e => setDraft({ teamPickCountsAsRound: e.target.checked })} />
          <span style={{ fontSize: '13px', color: 'var(--c-ccc)' }}>{t('pool_draft_team_pick_rounds')}</span>
        </label>
      </div>
      {form.rules.poolType === 'classic' && (
        <TradesBlock trades={form.rules.trades} onChange={setTrades} t={t} />
      )}
    </div>
  );
}

function StepRecap({ form, setForm, mode, t, errors }) {
  const { rules } = form;
  const isClassic = rules.poolType === 'classic';
  function toggleDraftAssistant(enabled) {
    setForm(f => ({ ...f, rules: { ...f.rules, draftAssistant: { enabled } } }));
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <RecapRow label={t('pool_recap_name')} value={form.name} />
      <RecapRow label={t('pool_recap_season')} value={form.season} />
      {mode === 'create' && <RecapRow label={t('pool_recap_team')} value={form.teamName || t('pool_recap_team_default')} />}
      <RecapRow label={t('pool_recap_display')} value={t(`pool_display_${rules.display}`)} />
      <RecapRow label={t('pool_recap_visibility')} value={t(`pool_visibility_${form.visibility}`)} />
      <RecapRow label={t('pool_recap_max_members')} value={form.maxMembers} />
      <RecapRow label={t('pool_recap_type')} value={t(`pool_type_${rules.poolType}`)} />
      <RecapRow label={t('pool_scoring_forward_title')} value={summarizeStatsGroup(rules.scoring.forward, POSITION_STAT_KEYS, t)} />
      <RecapRow label={t('pool_scoring_defense_title')} value={summarizeStatsGroup(rules.scoring.defense, POSITION_STAT_KEYS, t)} />
      <RecapRow label={t('pool_scoring_goalie_title')} value={summarizeStatsGroup(rules.scoring.goalie, GOALIE_STAT_KEYS, t)} />
      <RecapRow label={t(isClassic ? 'pool_team_title' : 'pool_roster_title')} value={summarizeRoster(rules, t)} />
      <RecapRow label={t('pool_recap_team_picks')} value={formatTeamPicks(rules.roster.teamPicks, t)} />
      {rules.roster.teamPicks >= 1 && <RecapRow label={t('pool_scoring_team_title')} value={summarizeStatsGroup(rules.scoring.team, TEAM_STAT_KEYS, t)} />}
      <RecapRow label={t('pool_recap_salarycap')} value={summarizeSalaryCap(rules, t)} />
      <RecapRow label={t('pool_recap_draft')} value={`${t(`pool_draft_type_${rules.draft.type}`)} · ${rules.draft.secondsPerPick}s`} />
      {!isClassic && <RecapRow label={t('pool_recap_lineup')} value={t(`pool_lineup_${rules.lineup}`)} />}
      <RecapRow label={t('pool_recap_trades')} value={summarizeTrades(rules.trades, t)} />
      {rules.trades?.enabled && <div style={{ fontSize: '12px', color: 'var(--c-666)', fontStyle: 'italic', padding: '6px 0' }}>{t('pool_trades_day_points_note')}</div>}
      {!isClassic && <RecapRow label={t('pool_recap_waivers')} value={summarizeWaivers(rules.waivers, t)} />}

      <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--c-111)' }}>
        <div style={sectionTitleStyle('var(--c-666)')}>{t('pool_draft_assistant_title')}</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px' }}>
          <input type="checkbox" checked={rules.draftAssistant.enabled} onChange={e => toggleDraftAssistant(e.target.checked)} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-ccc)' }}>{t('pool_draft_assistant_toggle')}</span>
        </label>
        <div style={{ fontSize: '12px', color: 'var(--c-666)' }}>{t('pool_draft_assistant_desc')}</div>
      </div>

      {errors.length > 0 && <div style={{ marginTop: '14px' }}><ErrorList errors={errors} t={t} /></div>}
    </div>
  );
}

function stepsForType(poolType) {
  return poolType === 'classic'
    ? ['base', 'type', 'scoring', 'roster', 'draft', 'recap']
    : ['base', 'type', 'scoring', 'roster', 'management', 'draft', 'recap'];
}
function stepTitleKey(stepId, poolType) {
  if (stepId === 'roster') return poolType === 'classic' ? 'pool_wizard_step_team' : 'pool_wizard_step_roster';
  return `pool_wizard_step_${stepId}`;
}

function PoolWizard({ lang, mode, initial, defaultFirstName, defaultLastName, onCancel, onSubmit, busy, submitError }) {
  const t = getT(lang);
  const seasonId = useSaisonCourante();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    season: initial?.season || currentSeasonLabelFromSeasonId(seasonId),
    firstName: initial?.firstName ?? (mode === 'create' ? (defaultFirstName || '') : ''),
    lastName: initial?.lastName ?? (mode === 'create' ? (defaultLastName || '') : ''),
    teamName: initial?.teamName || '',
    visibility: initial?.visibility || 'private',
    maxMembers: initial?.maxMembers ?? 12,
    rules: initial?.rules ? cloneRules(initial.rules) : defaultRules('classic'),
  }));

  const steps = stepsForType(form.rules.poolType);
  const stepIndexClamped = Math.min(stepIndex, steps.length - 1);
  const stepId = steps[stepIndexClamped];

  const stepErrors = React.useMemo(() => {
    if (stepId === 'base') {
      const errs = [];
      if (!form.name.trim()) errs.push('pool_error_name_required');
      if (mode === 'create') {
        if (!form.firstName.trim()) errs.push('pool_error_first_name_required');
        if (!form.lastName.trim()) errs.push('pool_error_last_name_required');
      }
      return errs;
    }
    if (stepId === 'scoring') return hasAnyScoring(form.rules) ? [] : ['pool_error_no_points'];
    if (stepId === 'roster') {
      const errs = [];
      if (totalRosterSlots(form.rules) <= 0) errs.push('pool_error_empty_roster');
      if (form.rules.salaryCap.enabled && (!form.rules.salaryCap.amount || form.rules.salaryCap.amount <= 0)) errs.push('pool_error_salary_cap_amount');
      return errs;
    }
    if (stepId === 'recap') return validateRules(form.rules);
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, form]);

  const isLastStep = stepIndexClamped === steps.length - 1;
  const progressPct = (stepIndexClamped / (steps.length - 1)) * 100;

  function goNext() {
    if (stepErrors.length > 0) return;
    if (!isLastStep) setStepIndex(i => i + 1);
  }
  function goBack() {
    if (stepIndexClamped === 0) onCancel();
    else setStepIndex(i => i - 1);
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>{mode === 'create' ? t('pool_wizard_create_title') : t('pool_wizard_edit_title')}</h2>
      <div style={{ fontSize: '12px', color: 'var(--c-666)', marginBottom: '16px' }}>
        {stepId === 'recap' ? t('pool_wizard_step_recap') : t('pool_wizard_step_counter').replace('{n}', stepIndexClamped + 1).replace('{total}', steps.length - 1)}
      </div>
      <div style={{ height: '4px', backgroundColor: 'var(--c-1a1a1a)', borderRadius: '4px', marginBottom: '24px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progressPct}%`, backgroundColor: '#f97316', transition: 'width 0.2s ease' }} />
      </div>

      <div style={{ ...card, marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--c-white)', marginBottom: '16px' }}>{t(stepTitleKey(stepId, form.rules.poolType))}</div>
        {stepId === 'base' && <StepBase form={form} setForm={setForm} mode={mode} t={t} />}
        {stepId === 'type' && <StepType form={form} setForm={setForm} t={t} />}
        {stepId === 'scoring' && <StepScoring form={form} setForm={setForm} t={t} errors={stepErrors} />}
        {stepId === 'roster' && <StepRoster form={form} setForm={setForm} t={t} errors={stepErrors} />}
        {stepId === 'management' && <StepManagement form={form} setForm={setForm} t={t} />}
        {stepId === 'draft' && <StepDraft form={form} setForm={setForm} t={t} />}
        {stepId === 'recap' && <StepRecap form={form} setForm={setForm} mode={mode} t={t} errors={stepErrors} />}
      </div>

      {submitError && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{submitError}</div>}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={goBack} style={btnSecondary}>{stepIndexClamped === 0 ? t('pool_wizard_cancel') : t('pool_wizard_back')}</button>
        {!isLastStep ? (
          <button onClick={goNext} disabled={stepErrors.length > 0}
            style={{ ...btnPrimary, flex: 1, opacity: stepErrors.length > 0 ? 0.5 : 1, cursor: stepErrors.length > 0 ? 'not-allowed' : 'pointer' }}>
            {t('pool_wizard_next')}
          </button>
        ) : (
          <button onClick={() => onSubmit(form)} disabled={busy || stepErrors.length > 0}
            style={{ ...btnPrimary, flex: 1, opacity: (busy || stepErrors.length > 0) ? 0.6 : 1, cursor: (busy || stepErrors.length > 0) ? 'not-allowed' : 'pointer' }}>
            {busy ? t('pool_wizard_saving') : (mode === 'create' ? t('pool_wizard_create_submit') : t('pool_wizard_save_submit'))}
          </button>
        )}
      </div>
    </div>
  );
}

// ===================== Lobby =====================

function RulesSummary({ rules, t }) {
  const isClassic = rules.poolType === 'classic';
  return (
    <div style={card}>
      <div style={sectionTitleStyle('var(--c-666)')}>{t('pool_lobby_rules_title')}</div>
      <RecapRow label={t('pool_recap_type')} value={t(`pool_type_${rules.poolType}`)} />
      <RecapRow label={t('pool_scoring_forward_title')} value={summarizeStatsGroup(rules.scoring.forward, POSITION_STAT_KEYS, t)} />
      <RecapRow label={t('pool_scoring_defense_title')} value={summarizeStatsGroup(rules.scoring.defense, POSITION_STAT_KEYS, t)} />
      <RecapRow label={t('pool_scoring_goalie_title')} value={summarizeStatsGroup(rules.scoring.goalie, GOALIE_STAT_KEYS, t)} />
      <RecapRow label={t(isClassic ? 'pool_team_title' : 'pool_roster_title')} value={summarizeRoster(rules, t)} />
      <RecapRow label={t('pool_recap_team_picks')} value={formatTeamPicks(rules.roster.teamPicks, t)} />
      {rules.roster.teamPicks >= 1 && <RecapRow label={t('pool_scoring_team_title')} value={summarizeStatsGroup(rules.scoring.team, TEAM_STAT_KEYS, t)} />}
      <RecapRow label={t('pool_recap_salarycap')} value={summarizeSalaryCap(rules, t)} />
      <RecapRow label={t('pool_recap_draft')} value={`${t(`pool_draft_type_${rules.draft.type}`)} · ${rules.draft.secondsPerPick}s`} />
      <RecapRow label={t('pool_draft_assistant_title')} value={rules.draftAssistant?.enabled ? t('pool_enabled') : t('pool_disabled')} />
      {!isClassic && <RecapRow label={t('pool_recap_lineup')} value={t(`pool_lineup_${rules.lineup}`)} />}
      <RecapRow label={t('pool_recap_trades')} value={summarizeTrades(rules.trades, t)} />
      {rules.trades?.enabled && <div style={{ fontSize: '12px', color: 'var(--c-666)', fontStyle: 'italic', padding: '6px 0' }}>{t('pool_trades_day_points_note')}</div>}
      {!isClassic && <RecapRow label={t('pool_recap_waivers')} value={summarizeWaivers(rules.waivers, t)} />}
    </div>
  );
}

function PoolLobby({ pool, utilisateur, lang, onBack, onEditRules }) {
  const t = getT(lang);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [openDraft, setOpenDraft] = useState(false);

  useEffect(() => { chargerMembres(); }, [pool.id]);

  async function chargerMembres() {
    setLoading(true); setError('');
    const { data, error: err } = await supabase.from('pool_members').select('*').eq('pool_id', pool.id).order('joined_at', { ascending: true });
    if (err) setError(err.message); else setMembers(data || []);
    setLoading(false);
  }

  const isCommissioner = pool.owner_id === utilisateur.id;
  const inviteLink = `${window.location.origin}/pool/join/${pool.invite_code}`;

  function copyLink() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  if (openDraft) {
    return (
      <div>
        <button onClick={() => setOpenDraft(false)} style={{ ...btnSecondary, marginBottom: '16px' }}>{t('pool_draft_tool_back')}</button>
        <PoolDraft />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <button onClick={onBack}
        style={{ backgroundColor: 'transparent', border: '1px solid var(--c-222)', color: 'var(--c-666)', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>
        {t('pool_lobby_back_btn')}
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800' }}>{pool.name}</h2>
          <div style={{ fontSize: '12px', color: 'var(--c-666)' }}>{pool.season}</div>
        </div>
        <StatusBadge status={pool.status} t={t} />
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{t('pool_error_generic').replace('{erreur}', error)}</div>}

      <div style={{ ...card, marginBottom: '16px' }}>
        <div style={sectionTitleStyle('var(--c-666)')}>{t('pool_lobby_invite_title')}</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <code style={{ flex: 1, minWidth: '160px', backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pool.invite_code}
          </code>
          <button onClick={copyLink} style={btnSecondary}>{copied ? t('pool_lobby_invite_copied') : t('pool_lobby_invite_copy')}</button>
        </div>
      </div>

      <div style={{ ...card, marginBottom: '16px' }}>
        <div style={sectionTitleStyle('var(--c-666)')}>{t('pool_lobby_members_title')} · {members.length}/{pool.max_members}</div>
        {loading ? (
          <div style={{ color: 'var(--c-555)', fontSize: '13px' }}>{t('pool_loading_generic')}</div>
        ) : members.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--c-111)' }}>
            <span style={{ fontSize: '13px', color: 'var(--c-white)' }}>{memberDisplayName(m, pool.rules, t)}</span>
            {m.role === 'commissioner' && <span style={{ fontSize: '11px', color: '#f97316', fontWeight: '700' }}>{t('pool_lobby_commissioner_badge')}</span>}
          </div>
        ))}
      </div>

      <RulesSummary rules={pool.rules} t={t} />

      {isCommissioner && pool.status === 'setup' && (
        <button onClick={onEditRules} style={{ ...btnSecondary, width: '100%', marginTop: '16px' }}>{t('pool_lobby_edit_rules_btn')}</button>
      )}
      {isCommissioner && pool.status !== 'setup' && (
        <div style={{ fontSize: '12px', color: 'var(--c-555)', marginTop: '12px', textAlign: 'center' }}>{t('pool_lobby_locked_notice')}</div>
      )}

      <button onClick={() => setOpenDraft(true)} style={{ ...btnPrimary, width: '100%', marginTop: '12px' }}>{t('pool_lobby_open_draft_btn')}</button>
    </div>
  );
}

// ===================== Rejoindre un pool =====================

const JOIN_ERROR_KEYS = {
  invalid_code: 'pool_join_error_invalid_code',
  already_member: 'pool_join_error_already_member',
  pool_full: 'pool_join_error_pool_full',
  pool_closed: 'pool_join_error_pool_closed',
};

function PoolJoinForm({ lang, initialCode, defaultFirstName, defaultLastName, onJoined, onCancel }) {
  const t = getT(lang);
  const [code, setCode] = useState(initialCode || '');
  const [firstName, setFirstName] = useState(defaultFirstName || '');
  const [lastName, setLastName] = useState(defaultLastName || '');
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (defaultFirstName && !firstName) setFirstName(defaultFirstName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultFirstName]);
  useEffect(() => {
    if (defaultLastName && !lastName) setLastName(defaultLastName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultLastName]);

  async function submit() {
    setBusy(true); setError('');
    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const { data, error: err } = await supabase.rpc('join_pool_by_code', {
      p_invite_code: code.trim(), p_team_name: teamName.trim(), p_display_name: displayName || null,
    });
    if (err) {
      const key = JOIN_ERROR_KEYS[err.message];
      setError(key ? t(key) : t('pool_join_error_generic').replace('{erreur}', err.message));
      setBusy(false);
      return;
    }
    const { data: poolRow, error: poolErr } = await supabase.from('pools').select('*').eq('id', data).single();
    setBusy(false);
    if (poolErr) { setError(poolErr.message); return; }
    onJoined(poolRow);
  }

  const canSubmit = code.trim() && firstName.trim() && lastName.trim();

  return (
    <div style={{ maxWidth: '420px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: '800' }}>{t('pool_join_title')}</h2>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={labelStyle}>{t('pool_join_code_label')}</label>
          <input style={{ ...inputStyle, textTransform: 'uppercase' }} value={code} onChange={e => setCode(e.target.value)} placeholder={t('pool_join_code_ph')} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <div>
            <label style={labelStyle}>{t('pool_field_first_name')}</label>
            <input style={inputStyle} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={t('pool_field_first_name_ph')} />
          </div>
          <div>
            <label style={labelStyle}>{t('pool_field_last_name')}</label>
            <input style={inputStyle} value={lastName} onChange={e => setLastName(e.target.value)} placeholder={t('pool_field_last_name_ph')} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>{t('pool_join_team_label')}</label>
          <input style={inputStyle} value={teamName} onChange={e => setTeamName(e.target.value)} placeholder={t('pool_join_team_ph')} />
        </div>
        {error && <div style={{ color: '#ef4444', fontSize: '13px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={btnSecondary}>{t('pool_join_cancel_btn')}</button>
          <button onClick={submit} disabled={busy || !canSubmit}
            style={{ ...btnPrimary, flex: 1, opacity: (busy || !canSubmit) ? 0.6 : 1, cursor: (busy || !canSubmit) ? 'not-allowed' : 'pointer' }}>
            {busy ? t('pool_join_joining') : t('pool_join_submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== Hub (liste "Mes pools") =====================

function PoolListCard({ pool, membership, t, onOpen }) {
  const name = membership.role === 'commissioner' ? t('pool_lobby_commissioner_badge') : memberDisplayName(membership, pool.rules, t);
  return (
    <button onClick={onOpen} style={{ textAlign: 'left', width: '100%', ...card, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
      <div>
        <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--c-white)', marginBottom: '4px' }}>{pool.name}</div>
        <div style={{ fontSize: '12px', color: 'var(--c-666)' }}>{pool.season} · {name}</div>
      </div>
      <StatusBadge status={pool.status} t={t} />
    </button>
  );
}

function getInitialJoinCode() {
  try {
    const m = window.location.pathname.match(/^\/pool\/join\/([A-Za-z0-9]+)/i);
    return m ? m[1] : null;
  } catch { return null; }
}

export default function PoolHub({ utilisateur, lang }) {
  const t = getT(lang);
  const isMobile = useIsMobile();

  const [initialJoinCode] = useState(getInitialJoinCode);
  const [view, setView] = useState(() => (getInitialJoinCode() ? 'join' : 'list'));
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPool, setSelectedPool] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [myFirstName, setMyFirstName] = useState('');
  const [myLastName, setMyLastName] = useState('');

  useEffect(() => { chargerPools(); }, [utilisateur?.id]);
  useEffect(() => {
    if (!utilisateur?.id) return;
    resolveMyIdentity(utilisateur).then(({ firstName, lastName }) => { setMyFirstName(firstName); setMyLastName(lastName); });
  }, [utilisateur?.id]);

  async function chargerPools() {
    if (!utilisateur?.id) return;
    setLoading(true); setError('');
    const { data, error: err } = await supabase
      .from('pool_members')
      .select('role, team_name, display_name, pool:pools(*)')
      .eq('user_id', utilisateur.id)
      .order('joined_at', { ascending: false });
    if (err) setError(err.message);
    else setPools((data || []).filter(r => r.pool).map(r => ({ ...r, pool: { ...r.pool, rules: normalizeRules(r.pool.rules) } })));
    setLoading(false);
  }

  function openPool(poolRow) {
    setSelectedPool(poolRow);
    setView('lobby');
  }

  async function handleCreate(form) {
    setBusy(true); setFormError('');
    const { data: poolRow, error: errPool } = await supabase.from('pools').insert({
      owner_id: utilisateur.id,
      name: form.name.trim(),
      season: form.season.trim(),
      visibility: form.visibility,
      max_members: form.maxMembers,
      rules: form.rules,
    }).select().single();
    if (errPool) { setFormError(errPool.message); setBusy(false); return; }

    const displayName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const { error: errMember } = await supabase.from('pool_members').insert({
      pool_id: poolRow.id,
      user_id: utilisateur.id,
      team_name: form.teamName.trim() || null,
      display_name: displayName || null,
      role: 'commissioner',
    });
    setBusy(false);
    if (errMember) { setFormError(errMember.message); return; }

    await chargerPools();
    setSelectedPool(poolRow);
    setView('lobby');
  }

  async function handleEditRules(form) {
    setBusy(true); setFormError('');
    const { data: updated, error: errUpdate } = await supabase.from('pools').update({
      name: form.name.trim(),
      season: form.season.trim(),
      visibility: form.visibility,
      max_members: form.maxMembers,
      rules: form.rules,
    }).eq('id', selectedPool.id).select().single();
    setBusy(false);
    if (errUpdate) { setFormError(errUpdate.message); return; }
    setSelectedPool(updated);
    await chargerPools();
    setView('lobby');
  }

  const containerStyle = { padding: isMobile ? '16px' : '32px' };

  if (view === 'join') {
    return (
      <div style={containerStyle}>
        <PoolJoinForm lang={lang} initialCode={initialJoinCode} defaultFirstName={myFirstName} defaultLastName={myLastName}
          onJoined={(poolRow) => { clearJoinUrl(); setSelectedPool({ ...poolRow, rules: normalizeRules(poolRow.rules) }); setView('lobby'); chargerPools(); }}
          onCancel={() => { clearJoinUrl(); setView('list'); }} />
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div style={containerStyle}>
        <PoolWizard lang={lang} mode="create" defaultFirstName={myFirstName} defaultLastName={myLastName}
          onCancel={() => { setFormError(''); setView('list'); }}
          onSubmit={handleCreate} busy={busy} submitError={formError} />
      </div>
    );
  }

  if (view === 'edit' && selectedPool) {
    return (
      <div style={containerStyle}>
        <PoolWizard lang={lang} mode="edit"
          initial={{ name: selectedPool.name, season: selectedPool.season, visibility: selectedPool.visibility, maxMembers: selectedPool.max_members, rules: selectedPool.rules }}
          onCancel={() => { setFormError(''); setView('lobby'); }}
          onSubmit={handleEditRules} busy={busy} submitError={formError} />
      </div>
    );
  }

  if (view === 'lobby' && selectedPool) {
    return (
      <div style={containerStyle}>
        <PoolLobby pool={selectedPool} utilisateur={utilisateur} lang={lang}
          onBack={() => setView('list')} onEditRules={() => setView('edit')} />
      </div>
    );
  }

  return (
    <div style={{ ...containerStyle, maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>{t('pool_hub_title')}</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setView('join')} style={btnSecondary}>{t('pool_hub_join_btn')}</button>
          <button onClick={() => setView('create')} style={btnPrimary}>{t('pool_hub_create_btn')}</button>
        </div>
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>{t('pool_error_generic').replace('{erreur}', error)}</div>}

      {loading ? (
        <div style={{ color: 'var(--c-555)', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>{t('pool_hub_loading')}</div>
      ) : pools.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--c-white)', marginBottom: '6px' }}>{t('pool_hub_empty_title')}</div>
          <div style={{ fontSize: '13px', color: 'var(--c-666)' }}>{t('pool_hub_empty_sub')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pools.map(({ pool, role, team_name, display_name }) => (
            <PoolListCard key={pool.id} pool={pool} membership={{ role, team_name, display_name }} t={t} onOpen={() => openPool(pool)} />
          ))}
        </div>
      )}
    </div>
  );
}
