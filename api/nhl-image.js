// Proxy d'image en lecture seule pour assets.nhle.com (photos joueurs, logos d'equipe).
// Necessaire uniquement pour l'export PNG de la Vue vestiaire des pools (canvas.toDataURL/
// toBlob exige des images servies avec un en-tete CORS, qu'assets.nhle.com ne fournit pas) --
// l'affichage normal (<img>) n'en a pas besoin. Liste blanche stricte : ne proxy jamais une
// URL hors assets.nhle.com, pour ne pas devenir un proxy d'image ouvert.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url || !/^https:\/\/assets\.nhle\.com\//.test(url)) {
    return res.status(400).json({ error: 'url invalide' });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`asset NHL: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
