// Liste blanche d'origines pour les routes api/ (proxies NHL appeles depuis l'app React,
// deployee sur betrics.ca). Garde bet-eight-view.vercel.app (ancien domaine, encore utilise
// par des previews/tests Vercel) et localhost (developpement local, port variable). Prefixe
// `_` : Vercel n'expose jamais ce dossier comme une route.
const ALLOWED_ORIGINS = [
  'https://betrics.ca',
  'https://www.betrics.ca',
  'https://bet-eight-view.vercel.app',
];
const LOCALHOST_RE = /^https?:\/\/localhost(:\d+)?$/;

function resolveAllowedOrigin(origin) {
  if (origin && (ALLOWED_ORIGINS.includes(origin) || LOCALHOST_RE.test(origin))) return origin;
  return ALLOWED_ORIGINS[0];
}

export function applyCors(req, res, methods = 'GET, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', resolveAllowedOrigin(req.headers.origin));
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', methods);
}
