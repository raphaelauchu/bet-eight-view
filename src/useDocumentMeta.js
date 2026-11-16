import { useEffect } from 'react';

// ===================== Balises SEO par page (sans react-helmet, CRA n'a pas de SSR) =====================
// Met a jour title / meta description / canonical / og:title / og:url directement dans le
// <head> deja present (public/index.html) a chaque changement de route. Limite connue et
// assumee : les crawlers qui n'executent pas JavaScript (la plupart des previews de reseaux
// sociaux -- Slack, iMessage, Facebook) ne verront que les balises og: statiques de la page
// d'accueil definies dans index.html, pas celles des sous-pages ; Google et les moteurs de
// recherche modernes executent JS et verront les bonnes balises par page.
function setMeta(name, content, attr = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function useDocumentMeta({ title, description, path }) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) setMeta('description', description);
    if (title) setMeta('og:title', title, 'property');
    if (description) setMeta('og:description', description, 'property');

    const url = `https://betrics.ca${path === '/' ? '' : path}`;
    setMeta('og:url', url, 'property');
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', url);
  }, [title, description, path]);
}
