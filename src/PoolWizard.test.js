import { render, screen } from '@testing-library/react';
import { PoolWizard } from './Pool';

jest.mock('./Analyses', () => ({
  useIsMobile: jest.fn(() => false),
  useIsDesktopWide: jest.fn(() => false),
  useSaisonCourante: () => '20252026',
}));

const { useIsDesktopWide } = require('./Analyses');

const noop = () => {};

// ===================== Web (>=1200px) : apercu recapitulatif a droite pendant le remplissage =====================

test('web (>=1200px) : l\'apercu recapitulatif (Regles du pool) est visible a cote du formulaire', () => {
  useIsDesktopWide.mockReturnValue(true);
  render(<PoolWizard lang="fr" mode="create" onCancel={noop} onSubmit={noop} busy={false} submitError="" />);
  expect(screen.getByText('Créer un pool')).toBeInTheDocument();
  expect(screen.getByText('Règles du pool')).toBeInTheDocument();
});

// ===================== Mobile/iPad (<1200px) : INCHANGE, formulaire seul =====================

test('mobile/iPad (<1200px) : pas d\'apercu recapitulatif, formulaire seul (comportement inchange)', () => {
  useIsDesktopWide.mockReturnValue(false);
  render(<PoolWizard lang="fr" mode="create" onCancel={noop} onSubmit={noop} busy={false} submitError="" />);
  expect(screen.getByText('Créer un pool')).toBeInTheDocument();
  expect(screen.queryByText('Règles du pool')).not.toBeInTheDocument();
});
