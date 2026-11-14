import { useState, useEffect } from 'react';
import { getUrl } from './nhlApi';

// Source de verite UNIQUE pour la saison NHL courante (format AAAAAAAA, ex. "20262027").
// Tout code qui a besoin de "la saison en cours" doit passer par useSaisonCourante()/
// chargerSaisonCourante() -- aucun seasonId ne doit etre ecrit en dur ailleurs dans src/.
//
// standings/now ne fournit PAS de seasonId par ligne de classement (verifie sur l'API reelle) :
// l'utiliser comme source donnait toujours un repli silencieux sur SAISON DE SECOURS, meme en
// pleine saison 2026-27 (bug corrige ici). La seule source API fiable pour "la saison la plus
// recente" est standings-season, dont le DERNIER element de la liste est toujours la saison
// couverte par les matchs les plus recents (y compris pendant la pre-saison, avant le 1er match
// regulier). Repli si l'API est indisponible : calcul par date -- la saison NHL (pre-saison
// incluse) demarre en septembre ; avant septembre, l'annee de depart est celle de l'an dernier.
const MOIS_DEBUT_SAISON = 9; // septembre (1-12)

export function seasonIdDepuisDate(date = new Date()) {
  const annee = date.getFullYear();
  const mois = date.getMonth() + 1;
  const anneeDebut = mois >= MOIS_DEBUT_SAISON ? annee : annee - 1;
  return `${anneeDebut}${anneeDebut + 1}`;
}

let _saisonCourantePromise = null;

// Promesse partagee au niveau module : un seul appel reseau par session, peu importe combien
// de composants appellent useSaisonCourante().
export function chargerSaisonCourante() {
  if (!_saisonCourantePromise) {
    _saisonCourantePromise = fetch(getUrl('standings-season'))
      .then(res => res.json())
      .then(data => {
        const saisons = data.seasons || [];
        const derniere = saisons[saisons.length - 1];
        return derniere?.id ? String(derniere.id) : seasonIdDepuisDate();
      })
      .catch(() => seasonIdDepuisDate());
  }
  return _saisonCourantePromise;
}

// Reinitialise le cache (tests uniquement, pour isoler chaque scenario).
export function _resetCacheSaisonCourante() { _saisonCourantePromise = null; }

export function useSaisonCourante() {
  const [seasonId, setSeasonId] = useState(seasonIdDepuisDate());
  useEffect(() => {
    let annule = false;
    chargerSaisonCourante().then(s => { if (!annule) setSeasonId(s); });
    return () => { annule = true; };
  }, []);
  return seasonId;
}

export function construireSaisonReg(seasonId) { return { id: `reg-${seasonId}`, seasonId, gameType: 2, label: 'Saison régulière' }; }
export function construireSaisonPO(seasonId) { return { id: `po-${seasonId}`, seasonId, gameType: 3, label: 'Playoffs' }; }

// Format court "2026-27" a partir d'un seasonId AAAAAAAA.
export function formatAnneeCourte(seasonId) {
  const s = String(seasonId || '');
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(6, 8)}` : '';
}

// Libelle UI ("Saison 2026-27" / "Séries 2026-27") a partir d'un seasonId AAAAAAAA.
export function formatSaisonLabel(seasonId, gameType = 2) {
  const annee = formatAnneeCourte(seasonId);
  if (!annee) return '';
  const prefixe = gameType === 3 ? 'Séries' : 'Saison';
  return `${prefixe} ${annee}`;
}
