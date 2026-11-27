// ===================== Champs legaux a confirmer manuellement (src/LegalPage.js) =====================
// Aucune information verifiable dans le code source pour les 4 champs "[A CONFIRMER]" ci-dessous
// (nom legal de l'entreprise, adresse, responsable de la protection des renseignements personnels,
// region d'hebergement exacte de la base de donnees) -- JAMAIS invente, voir le texte de la tache
// qui a cree ce fichier (27 nov 2026) pour la liste complete communiquee a l'utilisateur. Chaque
// valeur est interpolee dans le contenu des pages legales (src/i18n.js:legal_privacy_sections /
// legal_terms_sections, placeholders {entity}/{address}/{officer}/{region}) -- remplacer ici
// seulement, jamais directement dans i18n.js.
export const LEGAL_ENTITY_NAME = '[À CONFIRMER]';
export const LEGAL_ENTITY_ADDRESS = '[À CONFIRMER]';
export const LEGAL_PRIVACY_OFFICER_NAME = '[À CONFIRMER]';
export const LEGAL_HOSTING_REGION = '[À CONFIRMER]';

// Deja une adresse publique reelle (voir src/PublicFooter.js, lien mailto existant) -- pas un
// placeholder, contrairement aux 4 champs ci-dessus.
export const LEGAL_CONTACT_EMAIL = 'contact@betrics.ca';

// Date affichee en haut de chaque page legale ("Derniere mise a jour"). Mettre a jour cette valeur
// (les deux langues) chaque fois que le contenu de src/i18n.js:legal_privacy_sections ou
// legal_terms_sections change reellement.
export const LEGAL_LAST_UPDATED_DISPLAY = { fr: '26 novembre 2026', en: 'November 26, 2026' };

// Bandeau discret en haut de chaque page legale -- desactiver une fois le contenu valide par un
// professionnel du droit (et les 4 champs "[A CONFIRMER]" ci-dessus remplaces).
export const LEGAL_DRAFT_BANNER = true;
