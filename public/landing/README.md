# Captures pour la landing publique (src/Landing.js)

Dépose ici les captures d'écran réelles de l'app (jamais de logo de sportsbook ni de marque
tierce). Tant qu'un fichier est absent, `Landing.js` affiche automatiquement un emplacement
propre (cadre + halo, sans image cassée) à la place — aucune action requise pour que le site
reste fonctionnel sans ces fichiers.

Formats attendus : PNG ou JPG, fond sombre cohérent avec le thème de l'app, haute résolution
(au moins 1600px de large pour `hero-analyse`, 1000px pour les autres) pour rester nets sur
grand écran. Le composant les affiche en `object-fit: cover` dans un cadre à ratio fixe — recadre
large si besoin.

| Fichier attendu | Utilisé dans | Ratio du cadre | Contenu suggéré |
|---|---|---|---|
| `hero-analyse.png` | Hero (haut de page) | 16 / 9 | Vue d'ensemble d'un tableau d'analyse de matchup LNH |
| `pool-formation.png` | Bloc « Pool de hockey » | 4 / 3 | Formation en cartes du pool |
| `analyses-matchup.png` | Bloc « Analyses » | 4 / 3 | Comparatif de matchup / tendances L5-L10-Saison |
| `bankroll-suivi.png` | Bloc « Suivi de bankroll » | 4 / 3 | Courbe de profit / historique des mises |
