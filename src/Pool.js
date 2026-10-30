import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { getT } from './i18n';
import { useIsMobile, useSaisonCourante } from './Analyses';
import PoolDraft from './PoolDraft';
import {
  SKATER_STAT_KEYS, GOALIE_STAT_KEYS, ROSTER_SLOT_KEYS, DRAFT_TYPES, LINEUP_MODES,
  RULE_PRESETS, defaultRules, cloneRules, validateRules, hasAnyScoring,
  totalRosterSlots, currentSeasonLabelFromSeasonId,
} from './poolRules';

const card = { backgroundColor: 'var(--c-0d0d0d)', borderRadius: '16px', border: '1px solid var(--c-161616)', padding: '20px' };
const inputStyle = { width: '100%', padding: '11px 14px', backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '12px', color: 'var(--c-white)', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--c-666)', marginBottom: '6px' };
const btnPrimary = { padding: '12px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: '#f97316', color: 'white', fontSize: '14px', fontWeight: '700' };
const btnSecondary = { padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--c-222)', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--c-888)', fontSize: '14px', fontWeight: '600' };
const choiceBtn = (active) => ({ flex: 1, padding: '10px', borderRadius: '10px', border: active ? '1px solid #f97316' : '1px solid var(--c-222)', cursor: 'pointer', backgroundColor: active ? 'rgba(249,115,22,0.12)' : 'var(--c-111)', color: active ? '#f97316' : 'var(--c-888)', fontSize: '13px', fontWeight: '600' });

function clearJoinUrl() {
  try { window.history.replaceState(null, '', '/'); } catch { /* noop */ }
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

function ScoringRow({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--c-111)' }}>
      <span style={{ fontSize: '13px', color: 'var(--c-ccc)' }}>{label}</span>
      <input type="number" step="0.1" value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ width: '80px', padding: '6px 8px', backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '8px', color: 'var(--c-white)', fontSize: '13px', textAlign: 'right' }} />
    </div>
  );
}

function summarizeActiveScoring(rules, t) {
  const activeSkater = SKATER_STAT_KEYS.filter(k => rules?.scoring?.skater?.[k]);
  const activeGoalie = GOALIE_STAT_KEYS.filter(k => rules?.scoring?.goalie?.[k]);
  if (activeSkater.length + activeGoalie.length === 0) return t('pool_recap_none_active');
  return [
    ...activeSkater.map(k => `${t(`pool_stat_${k}`)} (${rules.scoring.skater[k]})`),
    ...activeGoalie.map(k => `${t(`pool_stat_${k}`)} (${rules.scoring.goalie[k]})`),
  ].join(' · ');
}

function summarizeRoster(rules, t) {
  const activeRoster = ROSTER_SLOT_KEYS.filter(k => rules?.roster?.[k] > 0);
  if (activeRoster.length === 0) return t('pool_recap_none_active');
  return activeRoster.map(k => `${t(`pool_slot_${k}`)}: ${rules.roster[k]}`).join(' · ');
}

function summarizeSalaryCap(rules, t) {
  if (!rules?.salaryCap?.enabled) return t('pool_recap_salarycap_none');
  return `$${Number(rules.salaryCap.amount || 0).toLocaleString()} (${t(`pool_salarycap_source_${rules.salaryCap.source}`)})`;
}

function summarizeTransactions(rules, t) {
  const parts = [rules?.transactions?.trades && t('pool_transactions_trades'), rules?.transactions?.waivers && t('pool_transactions_waivers')].filter(Boolean);
  return parts.length ? parts.join(' · ') : t('pool_recap_none_active');
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
        <div>
          <label style={labelStyle}>{t('pool_field_team_name')}</label>
          <input style={inputStyle} value={form.teamName} onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))} placeholder={t('pool_field_team_name_ph')} />
        </div>
      )}
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

function StepPreset({ form, setForm, t }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {RULE_PRESETS.map(p => (
        <button key={p.id} onClick={() => setForm(f => ({ ...f, presetId: p.id, rules: p.buildRules() }))}
          style={{ textAlign: 'left', padding: '16px', borderRadius: '14px', cursor: 'pointer', border: form.presetId === p.id ? '1px solid #f97316' : '1px solid var(--c-222)', backgroundColor: form.presetId === p.id ? 'rgba(249,115,22,0.08)' : 'var(--c-111)' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--c-white)', marginBottom: '4px' }}>{t(p.labelKey)}</div>
          <div style={{ fontSize: '12px', color: 'var(--c-666)' }}>{t(p.descKey)}</div>
        </button>
      ))}
    </div>
  );
}

function StepScoring({ form, setForm, t, errors }) {
  function setSkater(key, value) { setForm(f => ({ ...f, rules: { ...f.rules, scoring: { ...f.rules.scoring, skater: { ...f.rules.scoring.skater, [key]: value } } } })); }
  function setGoalie(key, value) { setForm(f => ({ ...f, rules: { ...f.rules, scoring: { ...f.rules.scoring, goalie: { ...f.rules.scoring.goalie, [key]: value } } } })); }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t('pool_scoring_skater_title')}</div>
        {SKATER_STAT_KEYS.map(k => (
          <ScoringRow key={k} label={t(`pool_stat_${k}`)} value={form.rules.scoring.skater[k]} onChange={v => setSkater(k, v)} />
        ))}
      </div>
      <div>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t('pool_scoring_goalie_title')}</div>
        {GOALIE_STAT_KEYS.map(k => (
          <ScoringRow key={k} label={t(`pool_stat_${k}`)} value={form.rules.scoring.goalie[k]} onChange={v => setGoalie(k, v)} />
        ))}
      </div>
      {errors.length > 0 && <ErrorList errors={errors} t={t} />}
    </div>
  );
}

function StepRoster({ form, setForm, t, errors }) {
  function setSlot(key, value) { setForm(f => ({ ...f, rules: { ...f.rules, roster: { ...f.rules.roster, [key]: value } } })); }
  function setCap(patch) { setForm(f => ({ ...f, rules: { ...f.rules, salaryCap: { ...f.rules.salaryCap, ...patch } } })); }
  const cap = form.rules.salaryCap;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--c-666)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t('pool_roster_title')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {ROSTER_SLOT_KEYS.map(k => (
            <div key={k}>
              <label style={labelStyle}>{t(`pool_slot_${k}`)}</label>
              <input type="number" min={0} max={20} style={inputStyle} value={form.rules.roster[k]} onChange={e => setSlot(k, parseInt(e.target.value, 10) || 0)} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--c-666)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t('pool_salarycap_title')}</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={cap.enabled} onChange={e => setCap({ enabled: e.target.checked })} />
          <span style={{ fontSize: '13px', color: 'var(--c-ccc)' }}>{t('pool_salarycap_enable')}</span>
        </label>
        {cap.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>{t('pool_salarycap_amount')}</label>
              <input type="number" min={0} step={100000} style={inputStyle} value={cap.amount} onChange={e => setCap({ amount: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label style={labelStyle}>{t('pool_salarycap_source')}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['nhl', 'manual'].map(s => (
                  <button key={s} onClick={() => setCap({ source: s })} style={choiceBtn(cap.source === s)}>
                    {t(`pool_salarycap_source_${s}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t('pool_salarycap_min_spend')}</label>
              <input type="number" min={0} step={100000} style={inputStyle} value={cap.mustSpendMin ?? ''} onChange={e => setCap({ mustSpendMin: e.target.value === '' ? null : parseFloat(e.target.value) })} />
            </div>
          </div>
        )}
      </div>
      {errors.length > 0 && <ErrorList errors={errors} t={t} />}
    </div>
  );
}

function StepDraftTx({ form, setForm, t }) {
  function setDraft(patch) { setForm(f => ({ ...f, rules: { ...f.rules, draft: { ...f.rules.draft, ...patch } } })); }
  function setTx(patch) { setForm(f => ({ ...f, rules: { ...f.rules, transactions: { ...f.rules.transactions, ...patch } } })); }
  const draft = form.rules.draft;
  const tx = form.rules.transactions;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <label style={labelStyle}>{t('pool_draft_type')}</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {DRAFT_TYPES.map(dt => (
            <button key={dt} onClick={() => setDraft({ type: dt })} style={choiceBtn(draft.type === dt)}>
              {t(`pool_draft_type_${dt}`)}
            </button>
          ))}
        </div>
        <label style={labelStyle}>{t('pool_draft_seconds')}</label>
        <input type="number" min={10} max={600} style={inputStyle} value={draft.secondsPerPick} onChange={e => setDraft({ secondsPerPick: parseInt(e.target.value, 10) || 0 })} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={draft.teamPickCountsAsRound} onChange={e => setDraft({ teamPickCountsAsRound: e.target.checked })} />
          <span style={{ fontSize: '13px', color: 'var(--c-ccc)' }}>{t('pool_draft_team_pick_rounds')}</span>
        </label>
      </div>
      <div>
        <label style={labelStyle}>{t('pool_lineup_title')}</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {LINEUP_MODES.map(lm => (
            <button key={lm} onClick={() => setForm(f => ({ ...f, rules: { ...f.rules, lineup: lm } }))} style={choiceBtn(form.rules.lineup === lm)}>
              {t(`pool_lineup_${lm}`)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={labelStyle}>{t('pool_transactions_title')}</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
          <input type="checkbox" checked={tx.trades} onChange={e => setTx({ trades: e.target.checked })} />
          <span style={{ fontSize: '13px', color: 'var(--c-ccc)' }}>{t('pool_transactions_trades')}</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input type="checkbox" checked={tx.waivers} onChange={e => setTx({ waivers: e.target.checked })} />
          <span style={{ fontSize: '13px', color: 'var(--c-ccc)' }}>{t('pool_transactions_waivers')}</span>
        </label>
      </div>
    </div>
  );
}

function StepRecap({ form, mode, t, errors }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <RecapRow label={t('pool_recap_name')} value={form.name} />
      <RecapRow label={t('pool_recap_season')} value={form.season} />
      {mode === 'create' && <RecapRow label={t('pool_recap_team')} value={form.teamName} />}
      <RecapRow label={t('pool_recap_visibility')} value={t(`pool_visibility_${form.visibility}`)} />
      <RecapRow label={t('pool_recap_max_members')} value={form.maxMembers} />
      <RecapRow label={t('pool_recap_scoring')} value={summarizeActiveScoring(form.rules, t)} />
      <RecapRow label={t('pool_recap_roster')} value={summarizeRoster(form.rules, t)} />
      <RecapRow label={t('pool_recap_salarycap')} value={summarizeSalaryCap(form.rules, t)} />
      <RecapRow label={t('pool_recap_draft')} value={`${t(`pool_draft_type_${form.rules.draft.type}`)} · ${form.rules.draft.secondsPerPick}s`} />
      <RecapRow label={t('pool_recap_lineup')} value={t(`pool_lineup_${form.rules.lineup}`)} />
      <RecapRow label={t('pool_recap_transactions')} value={summarizeTransactions(form.rules, t)} />
      {errors.length > 0 && <div style={{ marginTop: '14px' }}><ErrorList errors={errors} t={t} /></div>}
    </div>
  );
}

const WIZARD_STEPS = ['base', 'preset', 'scoring', 'roster', 'draftTx', 'recap'];

function PoolWizard({ lang, mode, initial, onCancel, onSubmit, busy, submitError }) {
  const t = getT(lang);
  const seasonId = useSaisonCourante();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    season: initial?.season || currentSeasonLabelFromSeasonId(seasonId),
    teamName: initial?.teamName || '',
    visibility: initial?.visibility || 'private',
    maxMembers: initial?.maxMembers ?? 12,
    presetId: initial?.presetId || 'custom',
    rules: initial?.rules ? cloneRules(initial.rules) : defaultRules(),
  }));

  const stepId = WIZARD_STEPS[stepIndex];

  const stepErrors = React.useMemo(() => {
    if (stepId === 'base') {
      const errs = [];
      if (!form.name.trim()) errs.push('pool_error_name_required');
      if (mode === 'create' && !form.teamName.trim()) errs.push('pool_error_team_name_required');
      return errs;
    }
    if (stepId === 'scoring') return hasAnyScoring(form.rules) ? [] : ['pool_error_no_points'];
    if (stepId === 'roster') {
      const errs = [];
      if (totalRosterSlots(form.rules.roster) <= 0) errs.push('pool_error_empty_roster');
      if (form.rules.salaryCap.enabled && (!form.rules.salaryCap.amount || form.rules.salaryCap.amount <= 0)) errs.push('pool_error_salary_cap_amount');
      return errs;
    }
    if (stepId === 'recap') return validateRules(form.rules);
    return [];
  }, [stepId, form, mode]);

  const isLastStep = stepIndex === WIZARD_STEPS.length - 1;
  const progressPct = (stepIndex / (WIZARD_STEPS.length - 1)) * 100;

  function goNext() {
    if (stepErrors.length > 0) return;
    if (!isLastStep) setStepIndex(i => i + 1);
  }
  function goBack() {
    if (stepIndex === 0) onCancel();
    else setStepIndex(i => i - 1);
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>{mode === 'create' ? t('pool_wizard_create_title') : t('pool_wizard_edit_title')}</h2>
      <div style={{ fontSize: '12px', color: 'var(--c-666)', marginBottom: '16px' }}>
        {stepId === 'recap' ? t('pool_wizard_step_recap') : t('pool_wizard_step_counter').replace('{n}', stepIndex + 1)}
      </div>
      <div style={{ height: '4px', backgroundColor: 'var(--c-1a1a1a)', borderRadius: '4px', marginBottom: '24px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progressPct}%`, backgroundColor: '#f97316', transition: 'width 0.2s ease' }} />
      </div>

      <div style={{ ...card, marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--c-white)', marginBottom: '16px' }}>{t(`pool_wizard_step_${stepId}`)}</div>
        {stepId === 'base' && <StepBase form={form} setForm={setForm} mode={mode} t={t} />}
        {stepId === 'preset' && <StepPreset form={form} setForm={setForm} t={t} />}
        {stepId === 'scoring' && <StepScoring form={form} setForm={setForm} t={t} errors={stepErrors} />}
        {stepId === 'roster' && <StepRoster form={form} setForm={setForm} t={t} errors={stepErrors} />}
        {stepId === 'draftTx' && <StepDraftTx form={form} setForm={setForm} t={t} />}
        {stepId === 'recap' && <StepRecap form={form} mode={mode} t={t} errors={stepErrors} />}
      </div>

      {submitError && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{submitError}</div>}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={goBack} style={btnSecondary}>{stepIndex === 0 ? t('pool_wizard_cancel') : t('pool_wizard_back')}</button>
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
  return (
    <div style={card}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--c-666)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t('pool_lobby_rules_title')}</div>
      <RecapRow label={t('pool_recap_scoring')} value={summarizeActiveScoring(rules, t)} />
      <RecapRow label={t('pool_recap_roster')} value={summarizeRoster(rules, t)} />
      <RecapRow label={t('pool_recap_salarycap')} value={summarizeSalaryCap(rules, t)} />
      <RecapRow label={t('pool_recap_draft')} value={`${t(`pool_draft_type_${rules?.draft?.type}`)} · ${rules?.draft?.secondsPerPick}s`} />
      <RecapRow label={t('pool_recap_lineup')} value={t(`pool_lineup_${rules?.lineup}`)} />
      <RecapRow label={t('pool_recap_transactions')} value={summarizeTransactions(rules, t)} />
    </div>
  );
}

function PoolLobby({ pool, utilisateur, lang, isMobile, onBack, onEditRules }) {
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
        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--c-666)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>{t('pool_lobby_invite_title')}</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <code style={{ flex: 1, minWidth: '160px', backgroundColor: 'var(--c-111)', border: '1px solid var(--c-222)', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pool.invite_code}
          </code>
          <button onClick={copyLink} style={btnSecondary}>{copied ? t('pool_lobby_invite_copied') : t('pool_lobby_invite_copy')}</button>
        </div>
      </div>

      <div style={{ ...card, marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--c-666)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
          {t('pool_lobby_members_title')} · {members.length}/{pool.max_members}
        </div>
        {loading ? (
          <div style={{ color: 'var(--c-555)', fontSize: '13px' }}>{t('pool_loading_generic')}</div>
        ) : members.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--c-111)' }}>
            <span style={{ fontSize: '13px', color: 'var(--c-white)' }}>{m.team_name}</span>
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
  invalid_team_name: 'pool_join_error_invalid_team_name',
};

function PoolJoinForm({ lang, initialCode, onJoined, onCancel }) {
  const t = getT(lang);
  const [code, setCode] = useState(initialCode || '');
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true); setError('');
    const { data, error: err } = await supabase.rpc('join_pool_by_code', { p_invite_code: code.trim(), p_team_name: teamName.trim() });
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

  return (
    <div style={{ maxWidth: '420px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: '800' }}>{t('pool_join_title')}</h2>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={labelStyle}>{t('pool_join_code_label')}</label>
          <input style={{ ...inputStyle, textTransform: 'uppercase' }} value={code} onChange={e => setCode(e.target.value)} placeholder={t('pool_join_code_ph')} />
        </div>
        <div>
          <label style={labelStyle}>{t('pool_join_team_label')}</label>
          <input style={inputStyle} value={teamName} onChange={e => setTeamName(e.target.value)} placeholder={t('pool_join_team_ph')} />
        </div>
        {error && <div style={{ color: '#ef4444', fontSize: '13px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={btnSecondary}>{t('pool_join_cancel_btn')}</button>
          <button onClick={submit} disabled={busy || !code.trim() || !teamName.trim()}
            style={{ ...btnPrimary, flex: 1, opacity: (busy || !code.trim() || !teamName.trim()) ? 0.6 : 1, cursor: (busy || !code.trim() || !teamName.trim()) ? 'not-allowed' : 'pointer' }}>
            {busy ? t('pool_join_joining') : t('pool_join_submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== Hub (liste "Mes pools") =====================

function PoolListCard({ pool, membership, t, onOpen }) {
  return (
    <button onClick={onOpen} style={{ textAlign: 'left', width: '100%', ...card, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
      <div>
        <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--c-white)', marginBottom: '4px' }}>{pool.name}</div>
        <div style={{ fontSize: '12px', color: 'var(--c-666)' }}>{pool.season} · {membership.role === 'commissioner' ? t('pool_lobby_commissioner_badge') : membership.team_name}</div>
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

  useEffect(() => { chargerPools(); }, [utilisateur?.id]);

  async function chargerPools() {
    if (!utilisateur?.id) return;
    setLoading(true); setError('');
    const { data, error: err } = await supabase
      .from('pool_members')
      .select('role, team_name, pool:pools(*)')
      .eq('user_id', utilisateur.id)
      .order('joined_at', { ascending: false });
    if (err) setError(err.message);
    else setPools((data || []).filter(r => r.pool));
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

    const { error: errMember } = await supabase.from('pool_members').insert({
      pool_id: poolRow.id, user_id: utilisateur.id, team_name: form.teamName.trim(), role: 'commissioner',
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
        <PoolJoinForm lang={lang} initialCode={initialJoinCode}
          onJoined={(poolRow) => { clearJoinUrl(); setSelectedPool(poolRow); setView('lobby'); chargerPools(); }}
          onCancel={() => { clearJoinUrl(); setView('list'); }} />
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div style={containerStyle}>
        <PoolWizard lang={lang} mode="create"
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
        <PoolLobby pool={selectedPool} utilisateur={utilisateur} lang={lang} isMobile={isMobile}
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
          {pools.map(({ pool, role, team_name }) => (
            <PoolListCard key={pool.id} pool={pool} membership={{ role, team_name }} t={t} onOpen={() => openPool(pool)} />
          ))}
        </div>
      )}
    </div>
  );
}
