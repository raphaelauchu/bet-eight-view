// ===================== Interrupteur "Synchronisation automatique" (comptes bankroll) =====================
// La liste d'attente de synchronisation automatique avec un sportsbook (src/SportsbookWaitlist.js,
// table sportsbook_waitlist) est retiree de l'interface pour le moment -- aucune connexion reelle
// n'existe, et cette section ajoutait de la confusion a cote de la creation manuelle de compte.
// Rien n'est supprime cote serveur (table, policies, Edge Function) ni cote composant
// (SportsbookWaitlistBody/SportsbookWaitlistSheet restent exportes et fonctionnels) -- seul le
// point d'entree dans src/Home.js (AddSportsbookSheet) est gate derriere ce drapeau. Un compte
// bankroll existant dont le `kind` ne correspondrait a aucune option manuelle continue de
// s'afficher normalement (son nom vient de bankroll_accounts.name, jamais de cette liste).
// Repasser a `true` restaure la section "Synchronisation automatique" sans rien reecrire.
export const BANKROLL_SYNC_ENABLED = false;
