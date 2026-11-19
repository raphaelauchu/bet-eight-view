import { render, screen, fireEvent } from '@testing-library/react';
import { DropdownPill } from './DropdownPill';

const OPTIONS = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

function setViewportWidth(width) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

afterEach(() => {
  setViewportWidth(1024); // repli deterministe (desktop) entre les tests
});

test('affiche le libelle de l\'option active, ouvre le panneau flottant au clic (desktop)', () => {
  const onChange = jest.fn();
  render(<DropdownPill label="Choix" value="b" onChange={onChange} options={OPTIONS} />);

  expect(screen.getByRole('button', { name: 'Choix' })).toHaveTextContent('Option B');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Choix' }));
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  expect(screen.getAllByRole('option')).toHaveLength(3);
});

test('cliquer une option appelle onChange avec sa valeur et referme le panneau', () => {
  const onChange = jest.fn();
  render(<DropdownPill label="Choix" value="a" onChange={onChange} options={OPTIONS} />);

  fireEvent.click(screen.getByRole('button', { name: 'Choix' }));
  fireEvent.click(screen.getByText('Option C'));

  expect(onChange).toHaveBeenCalledWith('c');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

test('Echap referme le panneau et rend le focus au bouton', () => {
  const onChange = jest.fn();
  render(<DropdownPill label="Choix" value="a" onChange={onChange} options={OPTIONS} />);

  fireEvent.click(screen.getByRole('button', { name: 'Choix' }));
  expect(screen.getByRole('listbox')).toBeInTheDocument();

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Choix' })).toHaveFocus();
});

test('un clic en dehors referme le panneau', () => {
  const onChange = jest.fn();
  render(
    <div>
      <DropdownPill label="Choix" value="a" onChange={onChange} options={OPTIONS} />
      <button>Ailleurs</button>
    </div>
  );

  fireEvent.click(screen.getByRole('button', { name: 'Choix' }));
  expect(screen.getByRole('listbox')).toBeInTheDocument();

  fireEvent.mouseDown(screen.getByText('Ailleurs'));
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

test('regroupe les options par section (titre de groupe affiche)', () => {
  const onChange = jest.fn();
  render(
    <DropdownPill
      label="Choix"
      value="a"
      onChange={onChange}
      groups={[
        { options: [{ value: 'a', label: 'Option A' }] },
        { titre: 'Section B', options: [{ value: 'b', label: 'Option B' }] },
      ]}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Choix' }));
  expect(screen.getByText('Section B')).toBeInTheDocument();
});

test('sous 768px, le panneau devient une feuille du bas rendue via portail (document.body), fermeture au clic sur le fond', () => {
  setViewportWidth(375);
  const onChange = jest.fn();
  const { container } = render(<DropdownPill label="Choix" value="a" onChange={onChange} options={OPTIONS} />);

  fireEvent.click(screen.getByRole('button', { name: 'Choix' }));
  const panneau = screen.getByRole('listbox');
  expect(panneau).toBeInTheDocument();
  const dialogue = screen.getByRole('dialog');
  expect(dialogue).toContainElement(panneau);
  // Portail : la feuille n'est PAS un descendant DOM du conteneur de rendu local.
  expect(container.contains(dialogue)).toBe(false);
  expect(document.body.contains(dialogue)).toBe(true);

  // Le fond (backdrop) est le parent du dialogue ; cliquer dessus referme (clic sur le
  // dialogue lui-meme, via stopPropagation, ne doit PAS refermer).
  fireEvent.click(dialogue);
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  fireEvent.click(dialogue.parentElement);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
