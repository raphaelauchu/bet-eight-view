import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { getT } from './i18n';
import { AddSportsbookButton, SportsbookWaitlistSheet } from './SportsbookWaitlist';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }));
const { supabase } = require('./supabase');

const t = getT('fr');
const noop = () => {};
const utilisateur = { id: 'u1' };

function mockWaitlist({ existants = [], upsertError = null } = {}) {
  const upsert = jest.fn(() => Promise.resolve({ error: upsertError }));
  supabase.from.mockImplementation((table) => {
    if (table === 'sportsbook_waitlist') {
      return {
        select: () => ({ eq: () => Promise.resolve({ data: existants, error: null }) }),
        upsert,
      };
    }
    return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
  });
  return upsert;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('AddSportsbookButton : pilule "+ texte" sur desktop, rond "+" seul sur mobile', () => {
  const onClick = jest.fn();
  const { rerender } = render(<AddSportsbookButton t={t} mobile={false} onClick={onClick} />);
  expect(screen.getByText('Ajouter un sportsbook')).toBeInTheDocument();

  rerender(<AddSportsbookButton t={t} mobile onClick={onClick} />);
  expect(screen.queryByText('Ajouter un sportsbook')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Ajouter un sportsbook')).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Ajouter un sportsbook'));
  expect(onClick).toHaveBeenCalledTimes(1);
});

test('AddSportsbookButton (pilule) : texte complet sur une seule ligne, icone + texte, retrecit sous 380px via CSS plutot que de se couper', () => {
  render(<AddSportsbookButton t={t} mobile={false} onClick={noop} />);
  const bouton = screen.getByText('Ajouter un sportsbook').closest('button');
  expect(bouton.className).toContain('sportsbook-add-pill');
  expect(bouton).toHaveStyle({ whiteSpace: 'nowrap', flexShrink: '0' });
  // La regle media (<380px) qui retrecit police/padding est definie dans un <style> co-localise,
  // jamais une coupure du texte lui-meme (pas de textOverflow/ellipsis sur ce bouton).
  expect(bouton).not.toHaveStyle({ textOverflow: 'ellipsis' });
});

test('liste bet365/Betway/BET99/Sports Interaction, texte seul (aucun logo), avec "Bientôt disponible"', async () => {
  mockWaitlist();
  render(<SportsbookWaitlistSheet t={t} utilisateur={utilisateur} onClose={noop} />);

  await waitFor(() => expect(screen.getByText('bet365')).toBeInTheDocument());
  expect(screen.getByText('Betway')).toBeInTheDocument();
  expect(screen.getByText('BET99')).toBeInTheDocument();
  expect(screen.getByText('Sports Interaction')).toBeInTheDocument();
  expect(screen.getAllByText('Bientôt disponible')).toHaveLength(4);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

test('"Me prévenir" enregistre l\'interet (sportsbook_waitlist) et affiche "Tu seras prévenu"', async () => {
  const upsert = mockWaitlist();
  render(<SportsbookWaitlistSheet t={t} utilisateur={utilisateur} onClose={noop} />);
  await waitFor(() => expect(screen.getByText('bet365')).toBeInTheDocument());

  const boutons = screen.getAllByText('Me prévenir');
  fireEvent.click(boutons[0]);

  await waitFor(() => expect(screen.getAllByText('Tu seras prévenu')).toHaveLength(1));
  expect(upsert).toHaveBeenCalledWith(
    { user_id: 'u1', sportsbook: 'bet365' },
    { onConflict: 'user_id,sportsbook', ignoreDuplicates: true }
  );
});

test('un sportsbook deja inscrit affiche "Tu seras prévenu" des le chargement', async () => {
  mockWaitlist({ existants: [{ sportsbook: 'betway' }] });
  render(<SportsbookWaitlistSheet t={t} utilisateur={utilisateur} onClose={noop} />);

  await waitFor(() => expect(screen.getByText('bet365')).toBeInTheDocument());
  expect(screen.getAllByText('Tu seras prévenu')).toHaveLength(1);
  expect(screen.getAllByText('Me prévenir')).toHaveLength(3);
});

test('aucune connexion reelle : pas de champ mot de passe ni de formulaire de connexion', async () => {
  mockWaitlist();
  render(<SportsbookWaitlistSheet t={t} utilisateur={utilisateur} onClose={noop} />);
  await waitFor(() => expect(screen.getByText('bet365')).toBeInTheDocument());
  expect(document.querySelector('input[type="password"]')).toBeNull();
  expect(document.querySelectorAll('input').length).toBe(0);
});

test('fermeture via le bouton X (feuille desktop, rendue en modale centree)', async () => {
  mockWaitlist();
  const onClose = jest.fn();
  render(<SportsbookWaitlistSheet t={t} utilisateur={utilisateur} onClose={onClose} />);
  await waitFor(() => expect(screen.getByText('bet365')).toBeInTheDocument());

  fireEvent.click(screen.getByLabelText('← Retour'));
  expect(onClose).toHaveBeenCalledTimes(1);
});
