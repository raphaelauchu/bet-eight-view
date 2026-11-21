import React from 'react';

// Remplace un montant sensible quand hideAmounts est actif : 5 petits points gris arrondis
// (pas de texte/emoji), avec un libelle accessible pour les lecteurs d'ecran. Fichier dedie
// (plutot que defini dans src/Home.js comme avant) pour que src/BetRow.js puisse l'utiliser sans
// importer Home.js -- Home.js importe lui-meme BetRow.js (ligne "Recent Bets"), un import
// BetRow -> Home aurait ferme un cycle (Home -> BetRow -> Home). src/Home.js continue d'exporter
// MaskedDots (re-export) pour que les autres importeurs existants n'aient rien a changer.
export function MaskedDots({ t, count = 5, size = 5 }) {
  return (
    <span aria-label={t('home_amounts_hidden')} style={{ display: 'inline-flex', alignItems: 'center', gap: `${Math.max(3, Math.round(size / 2))}px`, verticalAlign: 'middle' }}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', backgroundColor: 'var(--c-666)', display: 'inline-block' }} />
      ))}
    </span>
  );
}

export default MaskedDots;
