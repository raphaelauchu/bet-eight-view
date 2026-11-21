import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
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

test('champsDBDepuisForm / formDepuisBetAuto : account_id est conserve tel quel (null par defaut)', () => {
  expect(champsDBDepuisForm(FORM_BASE, t).account_id).toBeNull();
  expect(champsDBDepuisForm({ ...FORM_BASE, account_id: 'acc-1' }, t).account_id).toBe('acc-1');
  expect(formDepuisBetAuto({ bookmaker: null, type_bet: 'Moneyline', account_id: 'acc-2' }).account_id).toBe('acc-2');
});

describe('selecteur de compte (optionnel, affiche seulement si `accounts` est fourni)', () => {
  test('sans `accounts`, aucun selecteur de compte ne s\'affiche', () => {
    render(<BetAutoForm form={FORM_BASE} setForm={noop} t={t} />);
    expect(screen.queryByText('Compte')).not.toBeInTheDocument();
  });

  test('avec `accounts`, le selecteur liste les comptes + une option "aucun"', () => {
    const accounts = [{ id: 'a1', name: 'Principal', kind: 'other' }, { id: 'a2', name: 'Betway', kind: 'betway' }];
    render(<BetAutoForm form={{ ...FORM_BASE, account_id: null }} setForm={noop} t={t} accounts={accounts} />);
    const select = screen.getByText('Aucun compte').closest('select');
    expect(select).toBeInTheDocument();
    expect(within(select).getByText('Betway')).toBeInTheDocument();
  });

  test('choisir un compte dont le kind est reconnu derive automatiquement le bookmaker', () => {
    const accounts = [{ id: 'a2', name: 'Betway', kind: 'betway' }];
    let formActuel = { ...FORM_BASE, bookmaker: '', account_id: null };
    const setForm = jest.fn(f => { formActuel = f; });
    const { rerender } = render(<BetAutoForm form={formActuel} setForm={setForm} t={t} accounts={accounts} />);
    fireEvent.change(screen.getByText('Aucun compte').closest('select'), { target: { value: 'a2' } });
    expect(setForm).toHaveBeenCalledWith(expect.objectContaining({ account_id: 'a2', bookmaker: 'Betway' }));
    rerender(<BetAutoForm form={formActuel} setForm={setForm} t={t} accounts={accounts} />);
  });

  test('une option "+ Nouveau compte..." appelle onCreateAccount quand `accounts` ET `onCreateAccount` sont fournis', () => {
    const accounts = [{ id: 'a1', name: 'Épargne', kind: 'other' }];
    const onCreateAccount = jest.fn();
    render(<BetAutoForm form={FORM_BASE} setForm={noop} t={t} accounts={accounts} onCreateAccount={onCreateAccount} />);
    const select = screen.getByText('Aucun compte').closest('select');
    fireEvent.change(select, { target: { value: '__new__' } });
    expect(onCreateAccount).toHaveBeenCalled();
  });

  test('sans AUCUN compte : propose de creer un compte a la volee (pas de selecteur, pas de repli cache)', () => {
    const onCreateAccount = jest.fn();
    render(<BetAutoForm form={FORM_BASE} setForm={noop} t={t} accounts={[]} onCreateAccount={onCreateAccount} />);
    expect(screen.getByText('Tu n\'as pas encore de compte.')).toBeInTheDocument();
    expect(screen.queryByText('Compte')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('+ Ajouter un compte'));
    expect(onCreateAccount).toHaveBeenCalled();
  });

  test('sans AUCUN compte et sans onCreateAccount (ex. edition d\'un vieux pari) : pas de prompt casse, juste "Aucun compte"', () => {
    render(<BetAutoForm form={FORM_BASE} setForm={noop} t={t} accounts={[]} />);
    expect(screen.queryByText('Tu n\'as pas encore de compte.')).not.toBeInTheDocument();
    expect(screen.getByText('Aucun compte')).toBeInTheDocument();
  });

  test('une fois le compte cree, il est selectionne automatiquement (sans retour manuel au menu)', async () => {
    const nouveauCompte = { id: 'new-1', name: 'Betway', kind: 'betway' };
    const onCreateAccount = jest.fn(() => Promise.resolve(nouveauCompte));
    let formActuel = { ...FORM_BASE, account_id: null };
    const setForm = jest.fn(f => { formActuel = f; });
    render(<BetAutoForm form={formActuel} setForm={setForm} t={t} accounts={[]} onCreateAccount={onCreateAccount} />);
    fireEvent.click(screen.getByText('+ Ajouter un compte'));
    await waitFor(() => expect(setForm).toHaveBeenCalledWith(expect.objectContaining({ account_id: 'new-1', bookmaker: 'Betway' })));
  });
});
