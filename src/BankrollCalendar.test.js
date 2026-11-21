import { render, screen, fireEvent } from '@testing-library/react';
import { BankrollCalendar } from './BankrollCalendar';

jest.mock('./useIsMobile', () => ({ useIsMobile: () => false }));

const t = (k) => ({
  bank_cal_month_profit: 'Profit du mois',
  bank_cal_prev_month: 'Mois precedent',
  bank_cal_next_month: 'Mois suivant',
  bank_cal_title: 'Calendrier de profit',
  bank_cal_profit_label: 'profit',
  bank_cal_loss_label: 'perte',
  bank_cal_no_bet: 'aucun pari',
  bank_cal_day_empty: 'Aucun pari ce jour',
  bets_odds: 'Cote',
  bets_auto_status_pending: 'En attente',
  back_btn: 'Retour',
  home_amounts_hidden: 'Montants masques',
}[k] || k);

function makeBet(id, status, profit, dateStr) {
  return { id, status, profit, stake: 10, odds: 2, match: `Match ${id}`, dateSettlement: dateStr, datePlaced: dateStr };
}

describe('BankrollCalendar', () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const today = `${y}-${m}-10`;

  test('affiche le profit du mois et les jours reglés', () => {
    const bets = [makeBet(1, 'won', 45, today)];
    render(<BankrollCalendar t={t} lang="fr" bets={bets} hideAmounts={false} />);
    expect(screen.getByText(/Profit du mois/)).toBeInTheDocument();
    expect(screen.getByLabelText(/profit \+\$45/)).toBeInTheDocument();
  });

  test('mode masque remplace les montants par des points, garde les labels aria avec montant reel', () => {
    const bets = [makeBet(1, 'won', 45, today)];
    render(<BankrollCalendar t={t} lang="fr" bets={bets} hideAmounts />);
    expect(screen.getAllByLabelText('Montants masques').length).toBeGreaterThan(0);
  });

  test('clic sur un jour regle ouvre le panneau avec le detail du pari', () => {
    const bets = [makeBet(1, 'won', 45, today)];
    render(<BankrollCalendar t={t} lang="fr" bets={bets} hideAmounts={false} />);
    fireEvent.click(screen.getByLabelText(/profit \+\$45/));
    expect(screen.getByText('Match 1')).toBeInTheDocument();
  });

  test('jour avec paris en attente seulement : aria-label "En attente", pas de montant', () => {
    const bets = [makeBet(1, 'pending', null, today)];
    render(<BankrollCalendar t={t} lang="fr" bets={bets} hideAmounts={false} />);
    expect(screen.getByLabelText(/En attente/)).toBeInTheDocument();
  });

  test('navigation au clavier (fleche droite) deplace le focus actif', () => {
    render(<BankrollCalendar t={t} lang="fr" bets={[]} hideAmounts={false} />);
    const grid = screen.getByRole('grid', { name: 'Calendrier de profit' });
    const cells = grid.querySelectorAll('[data-cal-idx]');
    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cells[1]);
  });
});
