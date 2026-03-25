export default async function handler(req, res) {
  const { path } = req.query;

  try {
    const response = await fetch(`https://api-web.nhle.com/v1/${path}`);
    const data = await response.json();

    if (path && path.startsWith('schedule/')) {
      const aujourdhui = path.replace('schedule/', '');
      const gameWeek = data.gameWeek || [];
      const jour = gameWeek.find(g => g.date === aujourdhui);
      const games = jour?.games || gameWeek[0]?.games || [];
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({ gameWeek: [{ games }] });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
}