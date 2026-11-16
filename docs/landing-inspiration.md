# Inspiration design — landings concurrentes (pari sportif / outils de paris)

Analyse **design uniquement** de deux landings publiques du même secteur (outils de paris
sportifs / +EV), obtenues via un navigateur headless (Chromium/Playwright) pour capturer le
HTML/CSS réellement rendu (y compris pour le site propulsé en React/Next avec rendu client).

Aucun texte, image, logo ou nom de marque n'est reproduit ci-dessous : uniquement des
observations de structure et des valeurs de design (couleurs, tailles, espacements) destinées
à inspirer la landing de Betrics. Les deux sites sont désignés "Site A" et "Site B".

- **Site A** — outil +EV/arbitrage, thème sombre quasi monochrome, esthétique "premium feutrée".
- **Site B** — comparateur de cotes/outil +EV, thème sombre bleu nuit, esthétique "produit SaaS
  dense, très animée".

---

## 1. Typographie

### Site A
- Police principale : pile système **Arial/Helvetica** (pas de police custom chargée pour le
  corps ni les titres — choix volontairement neutre). Une seule police décorative cursive
  (style "signature manuscrite", ex. famille *Dancing Script*) est chargée en plus, réservée à
  un unique mot d'accent dans le texte (jamais utilisée pour un titre ou un paragraphe entier).
- Échelle de titres observée : **92px** (H1 hero) → **60px** (H2 de section) → **28px** (H3 de
  carte/feature). Graisse **600** (semi-bold) pour tous les niveaux de titre, jamais 700/800.
- Texte courant : **16px/400** pour le corps, **12-14px/400** pour les libellés de nav et
  légendes, **21px/400** pour les paragraphes d'intro de section (plus grand que le corps
  "produit" habituel — sert à aérer les sections marketing).
- Interlignage serré sur les gros titres : ratio ligne/taille ≈ **0,98-1,06** (quasi 1:1, très
  compact) avec un **letter-spacing négatif prononcé** sur les H1/H2 (environ -5,5 % de la
  taille de police, ex. -5px sur 92px) — effet "typographie resserrée, confiante". Les
  paragraphes ont au contraire un letter-spacing légèrement positif (+0,03em) pour la lisibilité
  à petite taille.
- Deux graisses seulement utilisées sur tout le site : **400** (texte) et **600** (titres/CTA).
  Aucun 500/700/800 observé.

### Site B
- Police de corps : pile système (**system-ui/-apple-system/Segoe UI/Roboto...**), avec
  **Inter** chargé explicitement pour certains blocs de texte (poids 500 par défaut, pas 400 — un
  choix délibérément plus "dense" que la normale). Les titres utilisent une police d'affichage
  custom/sous licence (géométrique, à fort contraste), distincte de la police de corps — un
  vrai couple "police d'affichage + police utilitaire", contrairement au site A qui n'a qu'une
  seule pile.
- Échelle de titres : **36px/600** (H1 et H2 traités à la même taille, qui grossit vers
  **52px** en version large écran via une classe responsive dédiée) → **20px/600** (H3 de
  carte). Interlignage plus large que le site A : ratio ≈ **1,1-1,25** sur les titres (moins
  compact), letter-spacing négatif plus modéré (~ -0,9px sur 36px, soit environ -2,5 %).
- Corps de texte : **14px/500** dominant (pas 400 — c'est la graisse "par défaut" du site),
  **16px** pour quelques blocs plus posés. Quatre graisses en circulation (400/500/600/700),
  contre deux seulement pour le site A — cohérent avec une interface plus "dashboard produit"
  que "manifeste premium".

### Pistes pour Betrics
- Choisir clairement un seul des deux axes : soit une pile système neutre + un accent
  décoratif ponctuel (épuré, confiant), soit un vrai couple police d'affichage/police de corps
  (plus "produit SaaS"). Les deux sont valides, mais les mélanger affaiblirait l'identité.
- Un letter-spacing négatif sur les très grands titres (H1 hero) donne immédiatement un effet
  "éditorial soigné" peu coûteux à mettre en place.
- Limiter le nombre de graisses à 2-3 au total (texte / accent / titres) évite l'effet "dashboard
  générique".

---

## 2. Palette, rayons, ombres, espacements, largeur de conteneur

### Site A — palette (thème sombre actif)
- Fond de page : **quasi noir** (surface de base ≈ HSL 240° 7% 4%, soit un gris anthracite à
  peine teinté de bleu-violet, perçu comme noir). Les sections alternent entre ce noir pur et
  des nuances **à peine plus claires** (écarts de luminosité de l'ordre de 1 à 3 points de L
  seulement, ex. 3%→4%→4,5%) — la hiérarchie entre sections se fait par un contraste minimal,
  presque subliminal, jamais par un bloc de couleur franche.
- Surfaces "élevées" (cartes, overlays) : légèrement plus claires que le fond (≈ 10-11% de
  luminosité), toujours dans la même teinte neutre froide.
- Bordures : blanc à très faible opacité (7 à 10 %) plutôt qu'une couleur de bordure dédiée —
  donne des contours "qui affleurent" plutôt que des traits dessinés.
- Texte : blanc cassé chaud (~96 % de luminosité) pour le texte principal, gris moyen (~56 %)
  pour le texte secondaire.
- Accents d'état : un **vert menthe vif** pour le positif (accompagné d'une "lueur" douce de la
  même teinte en box-shadow autour des éléments positifs — un halo, pas juste une couleur de
  texte), et un **terracotta/brique désaturé** pour le négatif — aucun des deux n'est un rouge ou
  un vert "signal" saturé à 100 %, les deux sont adoucis pour rester dans l'ambiance sombre et
  feutrée plutôt que de crier l'alerte.
- Pas d'accent de marque saturé omniprésent : les touches de couleur (vert, terracotta, un ton
  sauge, un ton sable chaud) sont utilisées au compte-gouttes, en teinte de **lueur de surface**
  plutôt qu'en aplat.

### Site B — palette (thème sombre actif)
- Fond de page : **bleu nuit profond** (pas neutre comme le site A — teinte froide assumée,
  proche d'un bleu marine très sombre).
- Palette construite en **rampes de 9 nuances par couleur** (du plus sombre au plus clair) pour
  au moins quatre teintes : un gris bleuté (fond/texte), un bleu (accent principal), un vert
  (succès/argent), un rose/violet (accent secondaire plus rare). C'est une vraie palette de
  design system, pas des couleurs ad hoc.
- Accent principal : **bleu cyan vif et saturé** (le plus saturé des deux sites) utilisé pour
  les CTA, liens et indicateurs actifs — contraste fort et immédiat avec le fond marine.
  Accent secondaire : **vert** assez saturé pour les badges "positif/argent" et un second type de
  CTA.
- Barre de nav : fond uni **de la même famille que le fond de page mais légèrement plus clair**
  (pas de transparence/flou), donc une séparation par palier de luminosité plutôt que par un
  calque translucide.

### Rayons de bordure
- Site A : **10px** très majoritaire (boutons secondaires, petites cartes), **20px** pour les
  grands panneaux/cartes produit, **30px** (quasi pleine capsule) réservé aux CTA principaux. Un
  seul rayon "plein cercle" pour les avatars/icônes. Logique d'imbrication : le rayon diminue au
  fur et à mesure qu'on descend dans la hiérarchie (panneau 20px → sous-cadre 18px → image
  interne 10px), ce qui donne un effet de "cadres dans le cadre" cohérent.
- Site B : échelle beaucoup plus fine et conventionnelle, type échelle de design system :
  **2px → 4px → 6px → 8px → 12px → 16px → 24px → "pleine capsule"**. La valeur la plus utilisée
  de loin est **8px** (cartes, boutons), suivie du "pleine capsule" pour les badges/tags.

### Ombres
- Site A : quasi aucune ombre "utilitaire". Seulement deux motifs : (1) un **filet lumineux
  intérieur très subtil** en haut des boutons/CTA (comme un reflet de bord supérieur, opacité
  quasi nulle) et (2) une **ombre portée large et douce très sombre** sous les cadres produit
  (grand rayon de flou, décalage vertical important, opacité élevée mais couleur neutre) — sert
  à faire "flotter" les visuels produit, jamais utilisée sur du texte ou des boutons standards.
- Site B : ombres **multi-couches** classiques de design system (une ombre serrée + une ombre
  large superposées, ex. flou court à forte opacité + flou large à faible opacité), utilisées
  sur les cartes mises en avant et le bouton CTA principal uniquement — les boutons secondaires
  et la nav n'ont aucune ombre.

### Espacements récurrents
- Site A : rythme vertical de section très généreux (padding vertical de section ≈ **144px**
  pour les grandes sections, ~100-110px pour les intermédiaires). Grille d'espacement interne
  typique : **28px / 16px / 12px** comme paliers les plus fréquents, et un pas de **8px** pour
  les petits écarts (icône-texte).
- Site B : rythme plus serré et plus "produit" : paliers dominants **24px / 16px / 8px / 4px**
  (progression géométrique classique base-4), padding de section vertical nettement plus
  modeste que le site A.

### Largeur de conteneur
- Site A : conteneur principal large mais mesuré, **autour de 1390-1400px** de contenu utile sur
  un viewport de 1440px (quasiment plein écran, marges latérales fines ~24px). Quelques blocs de
  texte en colonne resserrée (~440-520px) pour la lisibilité des paragraphes longs à l'intérieur
  d'une section pleine largeur.
- Site B : conteneurs variables selon le contexte, avec des paliers très larges bien identifiés
  (~1536px et ~1280px pour les sections pleine largeur sur grand écran) et des paliers étroits
  pour le texte (~768px, ~672px, ~512px) — approche "grille de breakpoints" plus explicite et
  plus fragmentée que le site A.

### Pistes pour Betrics
- Un fond quasi noir avec des écarts de luminosité minimes entre sections (site A) lit comme
  "premium/feutré" ; un bleu nuit saturé avec rampes de couleur complètes (site B) lit comme
  "produit SaaS énergique". Les deux fonctionnent pour un produit de paris — le choix dépend du
  positionnement voulu (feutré/confiant vs énergique/dense).
- Une rampe de couleurs à 9 nuances par teinte (succès/alerte/accent) est un vrai gain de
  cohérence si Betrics doit multiplier les badges d'état (cote qui monte/descend, +EV, etc.).
- Un "halo" coloré en box-shadow autour d'un badge positif (plutôt qu'une simple couleur de
  texte) est un détail à faible coût qui renforce beaucoup la perception de "signal fort".

---

## 3. Structure des sections, grilles, cartes, boutons, navigation, animations au défilement

### Ordre et structure des sections
- Site A (7 grandes sections identifiées) : **héros plein écran avec visuel produit animé en
  fond** → **grille de mini-outils** (une carte par fonctionnalité, légende courte) → **section
  "vitesse des données"** avec 2-3 points chiffrés en colonnes → **section suivi de
  performance** avec 3 cartes produit alternées texte/visuel → **bande de témoignages/logos de
  confiance** → **argumentaire final condensé** → **pied de page avec inscription
  newsletter**. Les sections lourdes (visuel produit en grand) et les sections "légères" (texte
  + petites cartes) alternent de façon régulière, jamais deux sections à gros visuel l'une après
  l'autre.
- Site B (page plus longue, structure en entonnoir explicite) : **héros avec preuve chiffrée
  immédiate** → **section "pourquoi ça marche" en 3 étapes numérotées** (chaque étape =
  mini-visuel + titre court + description) → **section mécanisme produit** détaillée avec
  captures → **bande de témoignages** → **FAQ en accordéon** → **CTA newsletter**. Plus
  orientée "pédagogie pas-à-pas" que le site A, avec davantage de preuve sociale répétée à
  plusieurs endroits (pas seulement en fin de page).

### Grilles et cartes
- Site A : grilles de cartes en **colonnes égales** (3 colonnes typique pour les mini-outils),
  cartes produit traitées comme des **"fenêtres" avec cadre propre** (voir section 4) plutôt
  que des cartes plates classiques — la carte elle-même n'a presque pas de style de "carte"
  (pas de fond distinct, pas de bordure visible), c'est le **visuel encadré à l'intérieur** qui
  porte toute la mise en relief.
- Site B : cartes plus "classiques" (fond légèrement plus clair que la page, coin arrondi
  modéré, ombre légère), utilisées en grilles 2 ou 3 colonnes selon la densité d'info ; une
  **bande d'images en défilement horizontal continu** (type "marquee", défilement automatique
  sans interaction) est utilisée au moins une fois pour exposer plusieurs captures produit côte
  à côte sans occuper toute la hauteur de page.

### Boutons
- Site A : CTA principal en **forme de capsule** (rayon proche de la pleine hauteur), fond en
  dégradé sombre très subtil avec un **filet lumineux supérieur** et un léger halo coloré au
  survol — jamais un aplat de couleur vive. Boutons secondaires = **texte seul, sans fond ni
  bordure**, changement de couleur de texte au survol (transition ~0,18s). Une seule famille de
  boutons "pleins", le reste est du texte de lien.
- Site B : CTA principal en **rectangle à coins modérément arrondis** (pas une capsule), aplat
  de couleur saturée (bleu ou vert selon le contexte), texte en graisse 600, avec une ombre
  portée uniquement sur le CTA le plus important de la page (celui du pied de page/newsletter).
  Boutons secondaires = **contour fin de la couleur d'accent sur fond transparent** ("ghost
  button"), plus un troisième style de petit badge arrondi plein (pour des tags d'état). Trois
  familles de boutons bien distinctes (plein / contour / badge), contre une seule chez le site A.

### Navigation
- Site A : barre de navigation **transparente, sans fond ni ombre, qui ne change pas au
  défilement** dans les premiers écrans — elle se fond dans le héros plutôt que de s'en
  détacher. Hauteur généreuse (~88px). Pas de flou d'arrière-plan (pas de style "verre dépoli").
- Site B : barre de navigation **sticky avec fond opaque uni** dès le chargement (pas de
  transparence du tout), plus basse (~64px), également sans flou d'arrière-plan — la séparation
  avec le contenu se fait par un simple écart de teinte, pas par une ombre ni un flou.
- Aucun des deux sites n'utilise de "rétrécissement" de la nav au scroll (hauteur constante) ni
  de flou verre dépoli (backdrop-blur) — point commun notable, alors que c'est un motif très
  répandu ailleurs : les deux ont préféré la simplicité (fond fixe, opaque ou transparent).

### Animations au défilement
- Site A : vocabulaire d'animation réduit et cohérent — des noms de code internes évoquent
  clairement des motifs **"apparition en fondu" et "arrivée"** au défilement (éléments qui
  apparaissent progressivement quand ils entrent dans le viewport), plus une animation dédiée de
  **barre qui se remplit progressivement** (probablement un indicateur chiffré/graphique). Pas
  de défilement horizontal automatique, pas d'effet "parallaxe" détecté. Registre sobre : peu
  d'animations, mais cohérentes et répétées.
- Site B : vocabulaire d'animation beaucoup plus riche — on retrouve, en plus d'un **titre de
  héros qui "monte" à l'entrée**, plusieurs familles d'animations dédiées à des **données qui
  vivent en continu** (un chiffre qui défile, un flux d'évènements qui descend en boucle, une
  **bande défilante automatique sans fin** de type "marquee" dans les deux sens), un effet de
  **scintillement de chargement** (style "skeleton shimmer"), des transitions d'ouverture/
  fermeture de modale et de menu, et un indicateur "qui clignote" pour signaler du direct. C'est
  un site qui mise sur la sensation de **flux de données vivant en permanence**, pas seulement
  sur des apparitions au scroll.

### Pistes pour Betrics
- L'alternance stricte section-lourde / section-légère (site A) garde une page dense agréable à
  parcourir ; à copier dans l'esprit, pas dans l'ordre exact.
- Avoir une SEULE famille de bouton "plein" (site A) force une hiérarchie claire ; en avoir
  trois (site B) permet plus de nuances (action principale / action secondaire / statut) — utile
  si Betrics a besoin de distinguer "Ouvrir un compte" d'un simple tag de cote.
- Une nav fixe et simple (opaque OU transparente, sans flou ni rétrécissement) semble être le
  standard du secteur en ce moment — pas une priorité d'investissement design.
- Un indicateur de donnée "vivante" (chiffre qui défile, pastille clignotante, flux qui bouge en
  continu) est un signal fort et peu coûteux pour un produit de paris en temps réel — à envisager
  pour une preuve sociale ou un indicateur de cote sur la landing de Betrics.

---

## 4. Effet de profondeur autour des captures produit

### Site A — "fenêtre éclairée"
- Les captures produit ne sont **jamais posées à plat**. Chaque capture est imbriquée dans 2 à 3
  cadres successifs, chacun avec un **rayon de bordure légèrement plus petit** que son parent
  (effet de "cadre dans le cadre", ~20px → ~18px → ~10px en descendant vers l'image elle-même).
- Le cadre extérieur porte une **ombre portée large, sombre et douce** (grand flou, décalage
  vertical net) qui fait "flotter" le panneau au-dessus du fond — c'est la SEULE source d'ombre
  marquée de tout le site.
- Chaque cadre intermédiaire porte en plus un **halo lumineux radial, ancré près d'un coin**
  (souvent le coin supérieur), teinté d'une couleur douce qui change selon la section (vert
  sauge, sable chaud...) plutôt que du blanc pur — comme si une lumière colorée ambiante
  éclairait le haut de la surface. Ce halo est répété sur un calque séparé juste derrière la
  capture, ce qui donne une impression de profondeur en plusieurs plans plutôt qu'un simple
  dégradé plat.
- Le visuel du héros (plein écran, animé) utilise en plus un **masque en dégradé qui fait
  disparaître progressivement le bas de l'image** dans le fond de page — l'image ne s'arrête pas
  net, elle se dissout dans la section suivante.
- Résultat perçu : les captures semblent **posées sous un éclairage de studio doux**, chaque
  surface ayant son propre reflet subtil, plutôt que de simples rectangles avec une bordure.

### Site B — "capture nue, mise en scène par le mouvement"
- À l'inverse, les grandes captures/mockups observés sont souvent utilisés **sans cadre ni
  ombre propre** (image "détourée" ou pleine largeur, fond transparent) : la profondeur ne vient
  pas du cadrage mais du **contexte autour** (dégradés de fond, superposition avec d'autres
  éléments, défilement horizontal continu qui donne une impression de "mur" de captures).
- Là où une mise en relief existe (cartes de témoignages, CTA mis en avant), c'est une **ombre
  multi-couches classique** (courte + large superposées) sur un rectangle à coins modérément
  arrondis — une profondeur "système de design" standard, pas une mise en scène dédiée aux
  captures.
- Pas de halo coloré ni de masque de fondu observé autour des visuels produit — la profondeur
  est traitée de façon beaucoup plus utilitaire/sobre que le site A, qui lui consacre un
  traitement visuel dédié et récurrent.

### Pistes pour Betrics
- La technique du site A (halo radial coloré ancré à un coin + ombre douce large + rayons
  imbriqués qui diminuent vers le centre) est un principe générique réutilisable, indépendant de
  toute marque : **un halo de lumière colorée et directionnelle en arrière-plan immédiat d'une
  capture produit, combiné à une ombre large et douce, donne une impression "premium" nette par
  rapport à une simple carte avec ombre plate.** C'est probablement le détail le plus
  transférable des deux analyses pour donner du relief aux captures d'écran de Betrics (cotes,
  tickets, tableaux de bord) sans effort d'habillage graphique lourd.
- Si Betrics préfère une approche plus "produit dense" (site B), privilégier un défilement
  horizontal continu de plusieurs mini-captures plutôt qu'une seule grande image statique — donne
  une impression de richesse fonctionnelle sans travail de mise en scène par image.

---

## Résumé rapide (axes de décision pour Betrics)

| Axe | Site A | Site B | Choix Betrics (à trancher) |
|---|---|---|---|
| Ton typographique | Système neutre + accent cursif ponctuel | Police d'affichage dédiée + Inter | — |
| Fond | Quasi noir neutre, paliers très subtils | Bleu nuit saturé, rampes de couleur | — |
| Accent | Vert menthe (positif) + terracotta (négatif), désaturés | Cyan vif + vert vif, saturés | — |
| Boutons | 1 style plein (capsule) + liens texte | 3 styles (plein/contour/badge) | — |
| Nav | Transparente, fixe, sans flou | Opaque unie, fixe, sans flou | — |
| Animation dominante | Fondus d'apparition au scroll, sobre | Flux de données "vivants" en continu | — |
| Profondeur des captures | Halo coloré + ombre douce + cadres imbriqués | Captures nues, profondeur par le mouvement | — |

*(Document d'inspiration uniquement — aucune modification de la landing Betrics n'a été
effectuée à ce stade.)*
