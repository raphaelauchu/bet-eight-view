import { useState, useEffect, useCallback } from 'react';

// ===================== Routage du site public (sans dependance ajoutee) =====================
// Aucun routeur externe : vercel.json reecrit deja toutes les routes vers index.html (voir le
// rewrite existant), donc un routage cote client par window.history suffit pour /, /pool,
// /tarifs, /guide et /outils/:slug. Separe de l'etat `page` de App.js (qui ne gere que les
// onglets de l'app CONNECTEE) -- ce hook ne s'utilise que dans la branche non connectee.
export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to) => {
    if (to !== window.location.pathname) {
      window.history.pushState({}, '', to);
      setPath(to);
    }
    window.scrollTo(0, 0);
  }, []);

  return [path, navigate];
}
