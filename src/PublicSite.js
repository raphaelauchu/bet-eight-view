import React from 'react';
import { useRoute } from './routing';
import { useDocumentMeta } from './useDocumentMeta';
import Navbar from './Navbar';
import LandingHeaderV2 from './LandingHeaderV2';
import { LANDING_V2_ENABLED } from './landingConfig';
import PublicFooter from './PublicFooter';
import Landing, { homePageMeta } from './Landing';
import PoolShowcase, { poolPageMeta } from './PoolShowcase';
import PricingPage, { pricingPageMeta } from './PricingPage';
import SimplePage, { toolPageMeta, guidePageMeta } from './SimplePage';

// ===================== Orchestrateur du site public (visiteur non connecte) =====================
// Resout le chemin courant en page + meta SEO (titre/description/canonical/OG, voir
// useDocumentMeta.js), affiche la Navbar + la page + le pied de page sur toutes les routes
// publiques. Les pages legales (/confidentialite, /conditions, /privacy, /terms) sont desormais de
// VRAIES routes gerees au niveau de src/App.js (adresses publiques independantes, exigees par
// Google) -- `onOpenLegal` (prop, voir PublicFooter.js) n'est qu'un simple relais vers
// App.js:openLegalRoute, ce composant ne gere plus lui-meme cet etat.

function resolve(path) {
  if (path === '/pool') return { key: 'pool' };
  if (path === '/tarifs') return { key: 'tarifs' };
  if (path === '/guide') return { key: 'guide' };
  if (path.startsWith('/outils/')) return { key: 'outil', slug: path.slice('/outils/'.length) };
  return { key: 'accueil' };
}

export default function PublicSite({ lang, setLang, onOpenAuth, onOpenLegal }) {
  const [path, navigate] = useRoute();
  const route = resolve(path);

  const meta =
    route.key === 'pool' ? poolPageMeta(lang) :
    route.key === 'tarifs' ? pricingPageMeta(lang) :
    route.key === 'guide' ? guidePageMeta(lang) :
    route.key === 'outil' ? toolPageMeta(route.slug, lang) :
    homePageMeta(lang);

  useDocumentMeta({ title: meta?.title, description: meta?.description, path });

  let page;
  if (route.key === 'pool') page = <PoolShowcase lang={lang} onOpenAuth={onOpenAuth} />;
  else if (route.key === 'tarifs') page = <PricingPage lang={lang} onOpenAuth={onOpenAuth} />;
  else if (route.key === 'guide') page = <SimplePage slug="guide" lang={lang} onOpenAuth={onOpenAuth} />;
  else if (route.key === 'outil' && meta) page = <SimplePage slug={route.slug} lang={lang} onOpenAuth={onOpenAuth} />;
  else page = <Landing lang={lang} onOpenAuth={onOpenAuth} />;

  // Enveloppe en .ws-root : fournit les variables --ws-* (couleurs, polices) a la Navbar et au
  // pied de page sur TOUTES les routes, y compris /pool dont le contenu passe en theme sombre
  // (.landing-root, variables --landing-* distinctes) -- sans cette enveloppe commune, la nav
  // et le footer perdent leurs couleurs des qu'ils ne sont plus descendants d'une page qui
  // definit elle-meme .ws-root (ex. la page Pool, volontairement sombre).
  // Nouveau header (src/LandingHeaderV2.js) UNIQUEMENT sur la route "accueil", derriere
  // LANDING_V2_ENABLED -- les autres pages publiques (Pool/Tarifs/outils/guide) gardent l'ancienne
  // Navbar complete (menu Outils/Pool/Tarifs/Ressources, qui n'existe pas dans le nouveau header,
  // concu uniquement pour l'accueil).
  const header = (LANDING_V2_ENABLED && route.key === 'accueil')
    ? <LandingHeaderV2 lang={lang} onOpenAuth={onOpenAuth} />
    : <Navbar lang={lang} setLang={setLang} navigate={navigate} onOpenAuth={onOpenAuth} />;

  return (
    <div className="ws-root">
      {header}
      {page}
      <PublicFooter lang={lang} onOpenLegal={onOpenLegal} />
    </div>
  );
}
