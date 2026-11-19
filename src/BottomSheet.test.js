import { render, screen, fireEvent } from '@testing-library/react';
import { BottomSheet } from './BottomSheet';

test('rendu via portail (document.body), pas un descendant DOM du conteneur de rendu', () => {
  const { container } = render(<BottomSheet onClose={() => {}} title="Titre">contenu</BottomSheet>);
  const dialogue = screen.getByRole('dialog');
  expect(container.contains(dialogue)).toBe(false);
  expect(document.body.contains(dialogue)).toBe(true);
  expect(screen.getByText('Titre')).toBeInTheDocument();
  expect(screen.getByText('contenu')).toBeInTheDocument();
});

test('ferme au clic sur le fond, pas au clic a l\'interieur (stopPropagation)', () => {
  const onClose = jest.fn();
  render(<BottomSheet onClose={onClose} title="Titre">contenu</BottomSheet>);

  fireEvent.click(screen.getByText('contenu'));
  expect(onClose).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('dialog').parentElement);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('ferme avec le bouton X', () => {
  const onClose = jest.fn();
  render(<BottomSheet onClose={onClose} title="Titre">contenu</BottomSheet>);
  fireEvent.click(screen.getByLabelText('Fermer'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('ferme avec Echap', () => {
  const onClose = jest.fn();
  render(<BottomSheet onClose={onClose} title="Titre">contenu</BottomSheet>);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('ferme en glissant vers le bas (drag tactile) au-dela du seuil', () => {
  const onClose = jest.fn();
  render(<BottomSheet onClose={onClose} title="Titre">contenu</BottomSheet>);
  const dialogue = screen.getByRole('dialog');

  fireEvent.touchStart(dialogue, { touches: [{ clientY: 100 }] });
  fireEvent.touchMove(dialogue, { touches: [{ clientY: 250 }] }); // +150px, au-dela du seuil de fermeture
  fireEvent.touchEnd(dialogue);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('un petit glissement sous le seuil ne ferme pas', () => {
  const onClose = jest.fn();
  render(<BottomSheet onClose={onClose} title="Titre">contenu</BottomSheet>);
  const dialogue = screen.getByRole('dialog');

  fireEvent.touchStart(dialogue, { touches: [{ clientY: 100 }] });
  fireEvent.touchMove(dialogue, { touches: [{ clientY: 130 }] }); // +30px, sous le seuil
  fireEvent.touchEnd(dialogue);
  expect(onClose).not.toHaveBeenCalled();
});

test('verrouille le defilement du fond pendant l\'ouverture, le restaure a la fermeture', () => {
  const { unmount } = render(<BottomSheet onClose={() => {}} title="Titre">contenu</BottomSheet>);
  expect(document.body.style.overflow).toBe('hidden');
  unmount();
  expect(document.body.style.overflow).not.toBe('hidden');
});
