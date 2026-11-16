# Captures QA -- avatars Betrics (casque, masque, chandail)

Captures finales de la boucle de verification Playwright decrite dans la tache de refonte des
avatars (voir historique de commits). Produites depuis une page de demo temporaire (non
commitee, supprimee apres usage) qui rendait `PlayerHelmet`/`GoalieMask`/`TeamJersey` pour
8 equipes a 32/48/96 px et plusieurs longueurs de nom/numero.

- `final_overview.png` -- vue d'ensemble de la page de demo (toutes les sections).
- `final_helmets_96_realsize.png` / `final_helmets_96_large.png` -- casques (8 equipes), taille
  reelle et agrandie.
- `final_masks_96_realsize.png` / `final_masks_96_large.png` -- masques de gardien, idem.
- `final_jerseys_realsize.png` / `final_jerseys_large.png` -- chandails vus de dos, noms/numeros
  varies (courts, longs, accentues, 1-2 chiffres).

Le logo "B" visible sur les casques/masques est un trace vectoriel fidele de
`public/logo512.png` (via `potrace`), normalise et integre tel quel dans
`src/BrandAssets.js` (`BETRICS_B_PATHS`) -- jamais redessine.
