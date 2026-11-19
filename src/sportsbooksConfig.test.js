import { SPORTSBOOKS, STATUT, getSportsbooksPourProvince, getStatutLabelKey } from './sportsbooksConfig';

test('Ontario : les quatre sportsbooks sont reglementes', () => {
  const visibles = getSportsbooksPourProvince('ontario');
  expect(visibles.map(sb => sb.id).sort()).toEqual(['bet365', 'bet99', 'betway', 'sportsinteraction'].sort());
  visibles.forEach(sb => expect(sb.statutInfo.statut).toBe(STATUT.REGULATED));
});

test('Alberta : BET99 et Sports Interaction (statut unverified) sont masques', () => {
  const visibles = getSportsbooksPourProvince('alberta');
  expect(visibles.map(sb => sb.id).sort()).toEqual(['bet365', 'betway'].sort());
  expect(visibles.some(sb => sb.id === 'bet99')).toBe(false);
  expect(visibles.some(sb => sb.id === 'sportsinteraction')).toBe(false);
});

test('Quebec : les quatre sportsbooks apparaissent avec le statut grey', () => {
  const visibles = getSportsbooksPourProvince('quebec');
  expect(visibles).toHaveLength(4);
  visibles.forEach(sb => expect(sb.statutInfo.statut).toBe(STATUT.GREY));
});

test('Autre : aucun sportsbook affiche', () => {
  expect(getSportsbooksPourProvince('autre')).toEqual([]);
  expect(getSportsbooksPourProvince(null)).toEqual([]);
  expect(getSportsbooksPourProvince(undefined)).toEqual([]);
});

test('getStatutLabelKey : etiquette correcte par statut et province', () => {
  expect(getStatutLabelKey(STATUT.REGULATED, 'ontario')).toBe('sportsbook_statut_regule_on');
  expect(getStatutLabelKey(STATUT.REGULATED, 'alberta')).toBe('sportsbook_statut_regule_ab');
  expect(getStatutLabelKey(STATUT.GREY, 'quebec')).toBe('sportsbook_statut_gris_qc');
  expect(getStatutLabelKey(STATUT.UNVERIFIED, 'alberta')).toBeNull();
});

test('bet99 et Sports Interaction ne sont pas mappes a la source de cotes (The Odds API)', () => {
  const bet99 = SPORTSBOOKS.find(sb => sb.id === 'bet99');
  const sportsInteraction = SPORTSBOOKS.find(sb => sb.id === 'sportsinteraction');
  expect(bet99.oddsApiBookmakerKey).toBeNull();
  expect(sportsInteraction.oddsApiBookmakerKey).toBeNull();
});
