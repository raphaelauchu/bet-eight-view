export default async function handler(req, res) {
  const { path } = req.query;
  
  try {
    const response = await fetch(`https://api-web.nhle.com/v1/${path}`);
    const data = await response.json();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
} 