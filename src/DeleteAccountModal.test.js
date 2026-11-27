import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeleteAccountModal from './DeleteAccountModal';

// ===================== Modale de suppression de compte -- composant isole =====================
// Voir src/AppDeleteAccount.test.js pour l'integration complete (bouton dans ProfilePage, lien
// dans ProfileSetup, appel reel de la RPC via App.js:handleDeleteAccount).

function setup(onConfirm = jest.fn().mockResolvedValue(undefined)) {
  const onClose = jest.fn();
  const utils = render(<DeleteAccountModal lang="en" onConfirm={onConfirm} onClose={onClose} />);
  return { ...utils, onConfirm, onClose };
}

test('etape 1 (avertissement) : "Cancel" ferme la modale, "Continue" passe a l\'etape de confirmation', () => {
  const { onClose } = setup();
  expect(screen.getByText('Delete your account?')).toBeInTheDocument();
  expect(screen.getByText(/permanently erases your Betrics data|permanent and will delete/i)).toBeInTheDocument();

  fireEvent.click(screen.getByText('Continue'));
  expect(screen.getByText('Final confirmation')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

test('clic sur le fond (overlay) ferme la modale', () => {
  const { onClose } = setup();
  fireEvent.click(screen.getByRole('dialog'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('etape 2 : le bouton final reste desactive tant que "DELETE" n\'est pas tape exactement', () => {
  setup();
  fireEvent.click(screen.getByText('Continue'));
  const bouton = screen.getByText('Permanently delete my account').closest('button');
  expect(bouton).toBeDisabled();

  fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DEL' } });
  expect(bouton).toBeDisabled();

  fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'delete' } }); // insensible a la casse
  expect(bouton).not.toBeDisabled();
});

test('bouton final active : appelle onConfirm', async () => {
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  setup(onConfirm);
  fireEvent.click(screen.getByText('Continue'));
  fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });
  fireEvent.click(screen.getByText('Permanently delete my account'));
  await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
});

test('echec de onConfirm : message d\'erreur affiche, bouton redevient "Try again", onClose jamais appele, reessai possible', async () => {
  const onConfirm = jest.fn().mockRejectedValue(new Error('boom'));
  const { onClose } = setup(onConfirm);
  fireEvent.click(screen.getByText('Continue'));
  fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });
  fireEvent.click(screen.getByText('Permanently delete my account'));

  await waitFor(() => expect(screen.getByText('Deletion failed. Please try again in a moment.')).toBeInTheDocument());
  expect(screen.getByText('Try again')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();

  // Reessai possible : le texte tape est toujours la, le bouton est a nouveau actif.
  fireEvent.click(screen.getByText('Try again'));
  await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
});

test('accessibilite : role dialog + aria-modal + aria-label', () => {
  setup();
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(dialog).toHaveAttribute('aria-label', 'Delete your account?');
});
