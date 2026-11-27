import { render, screen } from '@testing-library/react';
import LegalPage, { legalPageMeta } from './LegalPage';

// ===================== Pages legales completes (src/LegalPage.js, refonte du 27 nov 2026) =====
// Contenu reel (src/i18n.js:legal_privacy_sections/legal_terms_sections) -- voir
// src/AppLegalPages.test.js pour l'integration complete (routes /confidentialite, /conditions,
// /privacy, /terms a travers App(), bouton retour du navigateur, liens du pied de page/d'auth/de
// l'onboarding).

test('politique de confidentialite (FR) : titre unique (h1), 9 sections numerotees, phrase Google API presente', () => {
  render(<LegalPage page="privacy" lang="fr" onBack={() => {}} />);
  expect(screen.getAllByRole('heading', { level: 1 }).length).toBe(1);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Politique de confidentialité');
  expect(screen.getAllByRole('heading', { level: 2 }).length).toBe(9);
  expect(screen.getByText(/5\. Connexion avec Google/)).toBeInTheDocument();
  expect(screen.getByText(/respecte la politique de Google sur les données utilisateur des services d'API \(Google API Services User Data Policy\), y compris les exigences d'utilisation limitée/)).toBeInTheDocument();
});

test('conditions d\'utilisation (FR) : titre unique, 8 sections, aucune section "Abonnements et paiements" (non geree par le code)', () => {
  render(<LegalPage page="terms" lang="fr" onBack={() => {}} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Conditions d\'utilisation');
  expect(screen.getAllByRole('heading', { level: 2 }).length).toBe(8);
  expect(screen.queryByText(/abonnement/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/paiement/i)).not.toBeInTheDocument();
  expect(screen.getByText(/n'est PAS un bookmaker/)).toBeInTheDocument();
});

test('politique de confidentialite (EN) : titre et phrase Google API en anglais', () => {
  render(<LegalPage page="privacy" lang="en" onBack={() => {}} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy policy');
  expect(screen.getByText(/adheres to the Google API Services User Data Policy, including the Limited Use requirements/)).toBeInTheDocument();
});

test('conditions d\'utilisation (EN) : titre en anglais', () => {
  render(<LegalPage page="terms" lang="en" onBack={() => {}} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Terms of use');
  expect(screen.getByText(/is NOT a sportsbook/)).toBeInTheDocument();
});

test('logo, bandeau de brouillon, derniere mise a jour, lien retour a l\'accueil', () => {
  const onBack = jest.fn();
  render(<LegalPage page="privacy" lang="fr" onBack={onBack} />);
  expect(screen.getByAltText('Betrics')).toBeInTheDocument();
  expect(screen.getByText('Version initiale, en cours de validation juridique.')).toBeInTheDocument();
  expect(screen.getByText('Dernière mise à jour : 26 novembre 2026')).toBeInTheDocument();
  const retour = screen.getByText('← Retour à l\'accueil');
  expect(retour.tagName).toBe('BUTTON');
  retour.click();
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('champs "[À CONFIRMER]" affiches de maniere discrete (pas en gros/en titre) la ou l\'information n\'est pas verifiable dans le code', () => {
  render(<LegalPage page="privacy" lang="fr" onBack={() => {}} />);
  const occurrences = screen.getAllByText(/\[À CONFIRMER\]/);
  expect(occurrences.length).toBeGreaterThan(0);
  occurrences.forEach(el => expect(['P', 'LI']).toContain(el.closest('p, li, h1, h2')?.tagName));
});

test('confidentialite (FR) : la suppression de compte en libre-service est mentionnee (section 7), plus aucune phrase disant que ce n\'est pas encore possible', () => {
  render(<LegalPage page="privacy" lang="fr" onBack={() => {}} />);
  expect(screen.getByText(/Tu peux supprimer ton compte toi-même, à tout moment, depuis les paramètres/)).toBeInTheDocument();
  expect(screen.queryByText(/n'est pas encore offerte/)).not.toBeInTheDocument();
});

test('confidentialite (EN) : self-service account deletion is mentioned (section 7), no more "not yet available" phrasing', () => {
  render(<LegalPage page="privacy" lang="en" onBack={() => {}} />);
  expect(screen.getByText(/You can delete your account yourself, at any time, from your profile settings/)).toBeInTheDocument();
  expect(screen.queryByText(/isn't yet available/)).not.toBeInTheDocument();
});

test('legalPageMeta : titre et description distincts par page/langue', () => {
  const privacyFr = legalPageMeta('privacy', 'fr');
  const termsEn = legalPageMeta('terms', 'en');
  expect(privacyFr.title).toMatch(/Politique de confidentialité/);
  expect(termsEn.title).toMatch(/Terms of use/);
  expect(privacyFr.description.length).toBeGreaterThan(0);
  expect(termsEn.description.length).toBeGreaterThan(0);
});
