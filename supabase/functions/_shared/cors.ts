// Liste blanche d'origines pour les appels navigateur (supabase.functions.invoke depuis l'app
// React, deployee sur betrics.ca). Garde bet-eight-view.vercel.app (ancien domaine, encore
// utilise par des previews/tests Vercel) et localhost (developpement local, port variable).
// Une origine hors liste reçoit quand meme une reponse -- cors ne protege jamais des donnees
// sensibles a lui seul (c'est getAuthenticatedUser qui verifie l'identite), il evite juste
// qu'un site tiers lise la reponse depuis le navigateur d'un visiteur.
const ALLOWED_ORIGINS = [
  'https://betrics.ca',
  'https://www.betrics.ca',
  'https://bet-eight-view.vercel.app',
];
const LOCALHOST_RE = /^https?:\/\/localhost(:\d+)?$/;

function resolveAllowedOrigin(origin: string | null): string {
  if (origin && (ALLOWED_ORIGINS.includes(origin) || LOCALHOST_RE.test(origin))) return origin;
  return ALLOWED_ORIGINS[0];
}

export function corsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': resolveAllowedOrigin(req.headers.get('origin')),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

export function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}
