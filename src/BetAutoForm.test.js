import { render, screen } from '@testing-library/react';
import { getT } from './i18n';
import { BetAutoForm, champsDBDepuisForm, formDepuisBetAuto } from './BetAutoForm';

const t = getT('fr');
const noop = () => {};

const FORM_BASE = {
  bookmaker: '', type_bet: 'Moneyline', joueur_ou_equipe: '', stat_pariee: 'buts', over_under: 'over',
  ligne: '', mise: '100', cote: '1.9', equipe: 'MTL', adversaire: 'TOR', date_match: '', game_id: '',
};

test('le champ "sportsbook d\'origine" (bookmaker) est optionnel : une option vide est proposee en premier', () => {
  render(<BetAutoForm form={FORM_BASE} setForm={noop} t={t} />);
  const select = screen.getByText('Non spécifié').closest('select');
  expect(select).toBeInTheDocument();
  expect(select.value).toBe('');
});

test('champsDBDepuisForm : un bookmaker non choisi est enregistre comme null, pas comme chaine vide', () => {
  const champs = champsDBDepuisForm(FORM_BASE, t);
  expect(champs.bookmaker).toBeNull();
});

test('champsDBDepuisForm : un bookmaker choisi est conserve tel quel', () => {
  const champs = champsDBDepuisForm({ ...FORM_BASE, bookmaker: 'Betway' }, t);
  expect(champs.bookmaker).toBe('Betway');
});

test('formDepuisBetAuto : une ligne existante sans bookmaker (ou avec une valeur non reconnue) redevient "non specifie", pas un choix invente', () => {
  expect(formDepuisBetAuto({ bookmaker: null, type_bet: 'Moneyline' }).bookmaker).toBe('');
  expect(formDepuisBetAuto({ bookmaker: 'SiteInconnu', type_bet: 'Moneyline' }).bookmaker).toBe('');
  expect(formDepuisBetAuto({ bookmaker: 'Betway', type_bet: 'Moneyline' }).bookmaker).toBe('Betway');
});
