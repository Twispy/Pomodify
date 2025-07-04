import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';

const secret = process.env.NEXTAUTH_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { q, type = 'track,playlist', limit = 10 } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ message: 'Paramètre de recherche manquant' });
  }

  try {
    const token = await getToken({ req, secret });
    if (!token || !token.accessToken) {
      return res.status(401).json({ message: "Token d'accès manquant" });
    }

    const params = new URLSearchParams({
      q,
      type: type as string,
      limit: String(limit),
    });

    const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return res.status(response.status).json({ message: 'Erreur Spotify', error });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur serveur', error: error instanceof Error ? error.message : 'Erreur inconnue' });
  }
} 