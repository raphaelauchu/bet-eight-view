import { useEffect, useState } from 'react';
import { getUrl } from './nhlApi';

// ===================== Numeros de chandail, source unique partagee =====================
// Meme source que Analyses.js (roster/{abbrev}/current, qui inclut deja sweaterNumber pour
// chaque joueur) -- jamais un appel par JOUEUR : un seul fetch par EQUIPE, mis en cache en
// memoire (Map module-level, partagee par tous les composants qui l'utilisent : pool,
// formation, echanges, repechage) et reutilise pour tous les joueurs de cette equipe.
const teamRosterCache = new Map(); // teamAbbrev -> Promise<Map<playerId, sweaterNumber>>

// Tests uniquement : vide le cache entre deux tests qui simulent des rosters differents pour
// la meme equipe (sans ca, le premier mock gagnerait pour tous les tests suivants du fichier).
export function _resetTeamRosterCache() {
  teamRosterCache.clear();
}

function fetchTeamNumbers(teamAbbrev) {
  if (!teamRosterCache.has(teamAbbrev)) {
    const promise = fetch(getUrl(`roster/${teamAbbrev}/current`))
      .then(r => r.json())
      .then(data => {
        const m = new Map();
        [...(data.forwards || []), ...(data.defensemen || []), ...(data.goalies || [])].forEach(p => {
          if (p?.id != null && p.sweaterNumber != null) m.set(String(p.id), String(p.sweaterNumber));
        });
        return m;
      })
      .catch(() => new Map());
    teamRosterCache.set(teamAbbrev, promise);
  }
  return teamRosterCache.get(teamAbbrev);
}

// Retourne le numero (string) du joueur `playerId` dans l'equipe `teamAbbrev`, ou '' tant
// qu'il n'est pas encore connu / introuvable (jamais invente -- l'appelant retombe alors sur
// les initiales, voir BrandAssets.js TeamJersey).
export function useRosterNumber(teamAbbrev, playerId) {
  const [number, setNumber] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (!teamAbbrev || playerId == null) { setNumber(''); return undefined; }
    fetchTeamNumbers(teamAbbrev).then(map => {
      if (!cancelled) setNumber(map.get(String(playerId)) || '');
    });
    return () => { cancelled = true; };
  }, [teamAbbrev, playerId]);
  return number;
}
