import { render, screen, fireEvent } from '@testing-library/react';
import PlayerCard, { computePlayerTier, PLAYER_CARD_TIER_PERCENTILES } from './PlayerCard';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

function makeRow(overrides) {
  return { kind: 'player', ref_id: '1', label: 'Nick Suzuki', pos_group: 'F', team_abbrev: 'MTL', total_points: 10, ...overrides };
}

// ===================== computePlayerTier : paliers relatifs, jamais un seuil absolu =====================

test('computePlayerTier : repli "bronze" si moins de 2 valeurs comparables (pas de contexte)', () => {
  expect(computePlayerTier(50, [])).toBe('bronze');
  expect(computePlayerTier(50, [50])).toBe('bronze');
  expect(computePlayerTier(50, null)).toBe('bronze');
});

test('computePlayerTier : palier selon le percentile dans la distribution fournie', () => {
  const distribution = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20
  expect(computePlayerTier(20, distribution)).toBe('elite'); // top (percentile 1.0 >= elite)
  expect(computePlayerTier(1, distribution)).toBe('bronze'); // minimum
  // Coherence interne : les seuils nommes (pas de nombre magique) pilotent bien le resultat.
  const seuilGold = Math.ceil(PLAYER_CARD_TIER_PERCENTILES.gold * distribution.length);
  expect(computePlayerTier(seuilGold, distribution)).not.toBe('bronze');
});

test('computePlayerTier : deux pools avec des baremes differents donnent des paliers coherents a leur propre distribution', () => {
  // Pool A : bareme genereux (points eleves). Pool B : bareme serre (points bas). Le MEME
  // joueur releatif (meilleur de son pool) doit ressortir "elite" dans les deux, preuve que le
  // seuil est relatif et non une valeur absolue codee en dur.
  const poolA = [80, 120, 200, 450];
  const poolB = [1, 2, 3, 9];
  expect(computePlayerTier(450, poolA)).toBe('elite');
  expect(computePlayerTier(9, poolB)).toBe('elite');
});

// ===================== Rendu, blessure, badges, accessibilite =====================

test('PlayerCard : emplacement vide (placeholder) propre, sans donnee inventee', () => {
  render(<PlayerCard row={null} lang="fr" />);
  expect(screen.getByText('Vide')).toBeInTheDocument();
});

test('PlayerCard : points DANS CE POOL affiches, photo/nom/logo/position', () => {
  render(<PlayerCard row={makeRow({ total_points: 23.4 })} size="M" lang="fr" seasonId="20262027" />);
  expect(screen.getByText('23.4')).toBeInTheDocument();
  expect(screen.getByText('Nick Suzuki')).toBeInTheDocument();
  expect(screen.getByText('F')).toBeInTheDocument();
  // Onglet Pool (NHL_VISUALS_ENABLED) : photo joueur + logo d'equipe, URLs assets.nhle.com reelles.
  expect(screen.getByAltText('MTL')).toBeInTheDocument();
  expect(document.querySelector('img[src*="assets.nhle.com/mugs/nhl/"]')).toBeInTheDocument();
});

test('PlayerCard : taille S/M/L -- classe CSS correspondante', () => {
  const { container, rerender } = render(<PlayerCard row={makeRow()} size="S" lang="fr" />);
  expect(container.querySelector('.player-card-S')).toBeInTheDocument();
  rerender(<PlayerCard row={makeRow()} size="L" lang="fr" />);
  expect(container.querySelector('.player-card-L')).toBeInTheDocument();
});

test('PlayerCard : palier visuel applique via la classe player-card-tier-*', () => {
  const { container } = render(<PlayerCard row={makeRow()} tier="elite" lang="fr" />);
  expect(container.querySelector('.player-card-tier-elite')).toBeInTheDocument();
});

test('PlayerCard : joueur blesse -- croix rouge + detail au clic (statut et description reels, jamais inventes)', () => {
  const injury = { status: 'Blessure au haut du corps', description: 'Retour estime dans 2 semaines.' };
  render(<PlayerCard row={makeRow()} injury={injury} lang="fr" />);
  const badge = screen.getByLabelText(/Blessure :/, { selector: 'span' });
  expect(badge).toBeInTheDocument();
  expect(screen.queryByText('Retour estime dans 2 semaines.')).not.toBeInTheDocument(); // pas affiche avant interaction
  fireEvent.click(badge);
  expect(screen.getByText('Blessure au haut du corps')).toBeInTheDocument();
  expect(screen.getByText('Retour estime dans 2 semaines.')).toBeInTheDocument();
});

test('PlayerCard : pas de blessure -- aucune croix rouge', () => {
  render(<PlayerCard row={makeRow()} lang="fr" />);
  expect(screen.queryByLabelText(/Blessure :/)).not.toBeInTheDocument();
});

test('PlayerCard : badge "joue ce soir" / "en direct"', () => {
  const { rerender } = render(<PlayerCard row={makeRow()} gameStatus="tonight" lang="fr" />);
  expect(screen.getByText('Joue ce soir')).toBeInTheDocument();
  rerender(<PlayerCard row={makeRow()} gameStatus="live" lang="fr" />);
  expect(screen.getByText('En direct')).toBeInTheDocument();
});

test('PlayerCard : accessible -- role bouton, libelle complet, activation au clavier (Entree)', () => {
  const onOpen = jest.fn();
  render(<PlayerCard row={makeRow({ total_points: 5 })} lang="fr" onOpen={onOpen} />);
  const carte = screen.getByRole('button', { name: /Nick Suzuki/ });
  expect(carte).toHaveAttribute('tabindex', '0');
  fireEvent.keyDown(carte, { key: 'Enter' });
  expect(onOpen).toHaveBeenCalledTimes(1);
  fireEvent.click(carte);
  expect(onOpen).toHaveBeenCalledTimes(2);
});

test('PlayerCard : bouton d\'action (ex. "Ajouter") distinct du clic -> fiche, sans propager au clic sur la carte', () => {
  const onOpen = jest.fn();
  const onAction = jest.fn();
  render(<PlayerCard row={makeRow()} lang="fr" onOpen={onOpen} actionLabel="Ajouter" onAction={onAction} />);
  fireEvent.click(screen.getByText('Ajouter'));
  expect(onAction).toHaveBeenCalledTimes(1);
  expect(onOpen).not.toHaveBeenCalled();
});

test('PlayerCard : carte selectionnee/desactivee -- etats visuels distincts, pas de clic si desactive', () => {
  const onOpen = jest.fn();
  const { container } = render(<PlayerCard row={makeRow()} lang="fr" onOpen={onOpen} selected disabled />);
  expect(container.querySelector('.player-card-selected')).toBeInTheDocument();
  expect(container.querySelector('.player-card-disabled')).toBeInTheDocument();
  fireEvent.click(container.querySelector('.player-card'));
  expect(onOpen).not.toHaveBeenCalled();
});
